import { contextBridge, ipcRenderer } from 'electron'

export interface FileAPI {
  selectDirectory: () => Promise<{ path?: string; error?: string } | null>
  readFile: (filePath: string) => Promise<{ content?: string; error?: string }>
  listDirectory: (dirPath: string) => Promise<{ files?: string[]; error?: string }>
  getStoredProjectPath: () => Promise<string | null>
  storeProjectPath: (path: string) => Promise<boolean>
}

const fileAPI: FileAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('list-directory', dirPath),
  getStoredProjectPath: () => ipcRenderer.invoke('get-stored-project-path'),
  storeProjectPath: (path: string) => ipcRenderer.invoke('store-project-path', path)
}

contextBridge.exposeInMainWorld('fileAPI', fileAPI)

declare global {
  interface Window {
    fileAPI: FileAPI
  }
}
