import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'

let mainWindow: BrowserWindow | null = null

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

ipcMain.handle('get-stored-project-path', async () => {
  // For now, return null - we could use electron-store for persistence
  return null
})

ipcMain.handle('store-project-path', async (_, path: string) => {
  // For now, just log - we could use electron-store for persistence
  console.log('Storing project path:', path)
  return true
})
