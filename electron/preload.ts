import { contextBridge, ipcRenderer } from 'electron'

export interface AppSettings {
  themeMode: 'light' | 'dark'
  projectPath: string | null
  selectedEpicId: number | null
}

export interface FileAPI {
  selectDirectory: () => Promise<{ path?: string; error?: string } | null>
  readFile: (filePath: string) => Promise<{ content?: string; error?: string }>
  listDirectory: (dirPath: string) => Promise<{ files?: string[]; error?: string }>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>
}

const fileAPI: FileAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('list-directory', dirPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('save-settings', settings)
}

contextBridge.exposeInMainWorld('fileAPI', fileAPI)

declare global {
  interface Window {
    fileAPI: FileAPI
  }
}
