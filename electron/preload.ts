import { contextBridge, ipcRenderer } from 'electron'

export type ProjectType = 'bmm' | 'bmgd'

export interface AgentHistoryEntry {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: 'running' | 'completed' | 'error' | 'interrupted'
  output: string[]
  startTime: number
  endTime?: number
  exitCode?: number
}

export interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

export type AITool = 'claude-code' | 'cursor' | 'windsurf' | 'roo-code'

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  isMaximized?: boolean
}

export interface AppSettings {
  themeMode: 'light' | 'dark'
  aiTool: AITool
  projectPath: string | null
  projectType: ProjectType | null
  selectedEpicId: number | null
  collapsedColumnsByEpic: Record<string, string[]>
  agentHistory?: AgentHistoryEntry[]
  recentProjects: RecentProject[]
  windowBounds?: WindowBounds
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

// Agent API types
export interface AgentInfo {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: 'running' | 'completed' | 'error'
  startTime: number
  pid: number | undefined
}

export interface AgentOutputEvent {
  agentId: string
  type: 'stdout' | 'stderr'
  chunk: string
  timestamp: number
}

export interface AgentExitEvent {
  agentId: string
  code: number | null
  signal: string | null
  timestamp: number
}

export interface AgentErrorEvent {
  agentId: string
  error: string
  timestamp: number
}

export interface AgentSpawnedEvent {
  agentId: string
  storyId: string
  storyTitle: string
  command: string
  pid: number | undefined
  timestamp: number
}

export interface AgentAPI {
  spawnAgent: (options: {
    storyId: string
    storyTitle: string
    projectPath: string
    initialPrompt: string
  }) => Promise<{ success: boolean; agentId?: string; error?: string }>
  sendInput: (agentId: string, input: string) => Promise<boolean>
  killAgent: (agentId: string) => Promise<boolean>
  getAgents: () => Promise<AgentInfo[]>
  getAgent: (agentId: string) => Promise<AgentInfo | null>
  getAgentForStory: (storyId: string) => Promise<string | null>
  detectProjectType: (projectPath: string) => Promise<ProjectType>
  // Agent output file management
  appendOutput: (agentId: string, lines: string[]) => Promise<boolean>
  loadOutput: (agentId: string) => Promise<string[]>
  deleteOutput: (agentId: string) => Promise<boolean>
  listOutputs: () => Promise<string[]>
  // Event listeners
  onAgentOutput: (callback: (event: AgentOutputEvent) => void) => () => void
  onAgentExit: (callback: (event: AgentExitEvent) => void) => () => void
  onAgentError: (callback: (event: AgentErrorEvent) => void) => () => void
  onAgentSpawned: (callback: (event: AgentSpawnedEvent) => void) => () => void
}

const agentAPI: AgentAPI = {
  spawnAgent: (options) => ipcRenderer.invoke('spawn-agent', options),
  sendInput: (agentId, input) => ipcRenderer.invoke('send-agent-input', agentId, input),
  killAgent: (agentId) => ipcRenderer.invoke('kill-agent', agentId),
  getAgents: () => ipcRenderer.invoke('get-agents'),
  getAgent: (agentId) => ipcRenderer.invoke('get-agent', agentId),
  getAgentForStory: (storyId) => ipcRenderer.invoke('get-agent-for-story', storyId),
  detectProjectType: (projectPath) => ipcRenderer.invoke('detect-project-type', projectPath),
  // Agent output file management
  appendOutput: (agentId, lines) => ipcRenderer.invoke('append-agent-output', agentId, lines),
  loadOutput: (agentId) => ipcRenderer.invoke('load-agent-output', agentId),
  deleteOutput: (agentId) => ipcRenderer.invoke('delete-agent-output', agentId),
  listOutputs: () => ipcRenderer.invoke('list-agent-outputs'),
  // Event listeners
  onAgentOutput: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentOutputEvent) => callback(data)
    ipcRenderer.on('agent:output', listener)
    return () => ipcRenderer.removeListener('agent:output', listener)
  },
  onAgentExit: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentExitEvent) => callback(data)
    ipcRenderer.on('agent:exit', listener)
    return () => ipcRenderer.removeListener('agent:exit', listener)
  },
  onAgentError: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentErrorEvent) => callback(data)
    ipcRenderer.on('agent:error', listener)
    return () => ipcRenderer.removeListener('agent:error', listener)
  },
  onAgentSpawned: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: AgentSpawnedEvent) => callback(data)
    ipcRenderer.on('agent:spawned', listener)
    return () => ipcRenderer.removeListener('agent:spawned', listener)
  }
}

contextBridge.exposeInMainWorld('agentAPI', agentAPI)

declare global {
  interface Window {
    fileAPI: FileAPI
    agentAPI: AgentAPI
  }
}
