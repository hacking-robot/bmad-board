import { contextBridge, ipcRenderer } from 'electron'

export type ProjectType = 'bmm' | 'bmgd'

export interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

export interface AppSettings {
  themeMode: 'light' | 'dark'
  projectPath: string | null
  projectType: ProjectType | null
  selectedEpicId: number | null
  collapsedColumnsByEpic: Record<string, string[]>
  recentProjects: RecentProject[]
}

export interface FileAPI {
  selectDirectory: () => Promise<{ path?: string; projectType?: ProjectType; error?: string } | null>
  readFile: (filePath: string) => Promise<{ content?: string; error?: string }>
  listDirectory: (dirPath: string) => Promise<{ files?: string[]; error?: string }>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  startWatching: (projectPath: string, projectType: ProjectType) => Promise<boolean>
  stopWatching: () => Promise<boolean>
  onFilesChanged: (callback: () => void) => () => void
  onShowKeyboardShortcuts: (callback: () => void) => () => void
}

const fileAPI: FileAPI = {
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  listDirectory: (dirPath: string) => ipcRenderer.invoke('list-directory', dirPath),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Partial<AppSettings>) => ipcRenderer.invoke('save-settings', settings),
  startWatching: (projectPath: string, projectType: ProjectType) => ipcRenderer.invoke('start-watching', projectPath, projectType),
  stopWatching: () => ipcRenderer.invoke('stop-watching'),
  onFilesChanged: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('files-changed', listener)
    // Return cleanup function
    return () => ipcRenderer.removeListener('files-changed', listener)
  },
  onShowKeyboardShortcuts: (callback: () => void) => {
    const listener = () => callback()
    ipcRenderer.on('show-keyboard-shortcuts', listener)
    return () => ipcRenderer.removeListener('show-keyboard-shortcuts', listener)
  }
}

contextBridge.exposeInMainWorld('fileAPI', fileAPI)

declare global {
  interface Window {
    fileAPI: FileAPI
  }
}
