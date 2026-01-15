import { app, BrowserWindow, ipcMain, dialog, Menu } from 'electron'
import { join } from 'path'
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises'
import { existsSync, watch, FSWatcher } from 'fs'

// Set app name (shows in menu bar on macOS)
app.setName('BMad Board')

let mainWindow: BrowserWindow | null = null
let watchDebounceTimer: NodeJS.Timeout | null = null

// Settings file path in user data directory
const getSettingsPath = () => join(app.getPath('userData'), 'settings.json')

type ProjectType = 'bmm' | 'bmgd'

interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

interface AppSettings {
  themeMode: 'light' | 'dark'
  projectPath: string | null
  projectType: ProjectType | null
  selectedEpicId: number | null
  collapsedColumnsByEpic: Record<string, string[]>
  recentProjects: RecentProject[]
}

const defaultSettings: AppSettings = {
  themeMode: 'light',
  projectPath: null,
  projectType: null,
  selectedEpicId: null,
  collapsedColumnsByEpic: {},
  recentProjects: []
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const settingsPath = getSettingsPath()
    if (existsSync(settingsPath)) {
      const content = await readFile(settingsPath, 'utf-8')
      return { ...defaultSettings, ...JSON.parse(content) }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
  }
  return defaultSettings
}

async function saveSettings(settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const settingsPath = getSettingsPath()
    const dir = app.getPath('userData')

    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    // Load existing settings and merge
    const existing = await loadSettings()
    const merged = { ...existing, ...settings }

    await writeFile(settingsPath, JSON.stringify(merged, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save settings:', error)
    return false
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    },
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: isMac ? 'Cmd+/' : 'Ctrl+/',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('show-keyboard-shortcuts')
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()
  createMenu()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers for file operations

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select BMAD Project Folder'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const projectPath = result.filePaths[0]
  const bmadOutputPath = join(projectPath, '_bmad-output')

  // Validate sprint-status.yaml exists (required for both project types)
  const sprintStatusPath = join(bmadOutputPath, 'implementation-artifacts', 'sprint-status.yaml')
  if (!existsSync(sprintStatusPath)) {
    return { error: 'Invalid BMAD project: sprint-status.yaml not found' }
  }

  // Detect project type by epics.md location
  const bmmEpicsPath = join(bmadOutputPath, 'planning-artifacts', 'epics.md')
  const bmgdEpicsPath = join(bmadOutputPath, 'epics.md')

  let projectType: ProjectType

  if (existsSync(bmmEpicsPath)) {
    projectType = 'bmm'
  } else if (existsSync(bmgdEpicsPath)) {
    projectType = 'bmgd'
  } else {
    return { error: 'Invalid BMAD project: epics.md not found' }
  }

  return { path: projectPath, projectType }
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { content }
  } catch (error) {
    return { error: `Failed to read file: ${filePath}` }
  }
})

ipcMain.handle('list-directory', async (_, dirPath: string) => {
  try {
    const entries = await readdir(dirPath)
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      const stats = await stat(fullPath)
      if (stats.isFile()) {
        files.push(entry)
      }
    }

    return { files }
  } catch (error) {
    return { error: `Failed to list directory: ${dirPath}` }
  }
})

// Settings IPC handlers
ipcMain.handle('get-settings', async () => {
  return await loadSettings()
})

ipcMain.handle('save-settings', async (_, settings: Partial<AppSettings>) => {
  return await saveSettings(settings)
})

// File watching for auto-refresh
let fileWatchers: FSWatcher[] = []

function startWatching(projectPath: string, projectType: ProjectType) {
  // Stop any existing watchers
  stopWatching()

  const watchPaths: string[] = [
    join(projectPath, '_bmad-output', 'implementation-artifacts')
  ]

  // For BMM projects, also watch planning-artifacts (where epics.md lives)
  if (projectType === 'bmm') {
    watchPaths.push(join(projectPath, '_bmad-output', 'planning-artifacts'))
  }

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) {
      console.log('Watch path does not exist:', watchPath)
      continue
    }

    try {
      const watcher = watch(watchPath, { recursive: true }, (_eventType, filename) => {
        // Only care about .yaml and .md files
        if (!filename || (!filename.endsWith('.yaml') && !filename.endsWith('.md'))) {
          return
        }

        // Debounce to avoid multiple rapid refreshes
        if (watchDebounceTimer) {
          clearTimeout(watchDebounceTimer)
        }

        watchDebounceTimer = setTimeout(() => {
          console.log('File changed:', filename)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('files-changed')
          }
        }, 500)
      })

      fileWatchers.push(watcher)
      console.log('Started watching:', watchPath)
    } catch (error) {
      console.error('Failed to start file watcher:', error)
    }
  }
}

function stopWatching() {
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer)
    watchDebounceTimer = null
  }

  for (const watcher of fileWatchers) {
    watcher.close()
  }
  if (fileWatchers.length > 0) {
    console.log('Stopped file watchers')
  }
  fileWatchers = []
}

ipcMain.handle('start-watching', async (_, projectPath: string, projectType: ProjectType) => {
  startWatching(projectPath, projectType)
  return true
})

ipcMain.handle('stop-watching', async () => {
  stopWatching()
  return true
})

// Clean up watcher when app closes
app.on('before-quit', () => {
  stopWatching()
})
