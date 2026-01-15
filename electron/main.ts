import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'

// Set app name (shows in menu bar on macOS)
app.setName('BMad Board')

let mainWindow: BrowserWindow | null = null

// Settings file path in user data directory
const getSettingsPath = () => join(app.getPath('userData'), 'settings.json')

interface AppSettings {
  themeMode: 'light' | 'dark'
  projectPath: string | null
  selectedEpicId: number | null
}

const defaultSettings: AppSettings = {
  themeMode: 'light',
  projectPath: null,
  selectedEpicId: null
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

app.whenReady().then(createWindow)

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

  // Validate it's a BMAD project
  const sprintStatusPath = join(projectPath, '_bmad-output', 'implementation-artifacts', 'sprint-status.yaml')
  if (!existsSync(sprintStatusPath)) {
    return { error: 'Invalid BMAD project: sprint-status.yaml not found' }
  }

  return { path: projectPath }
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
