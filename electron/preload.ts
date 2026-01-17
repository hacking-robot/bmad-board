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

// Human Review checklist types (must match src/types/index.ts)
export interface HumanReviewChecklistItem {
  id: string
  label: string
  description?: string
}

export interface StoryReviewState {
  storyId: string
  checkedItems: string[]
  lastUpdated: number
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
  notificationsEnabled: boolean
  storyOrder: Record<string, Record<string, string[]>> // { [epicId]: { [status]: [storyIds...] } }
  // Human Review feature
  enableHumanReviewColumn: boolean
  humanReviewChecklist: HumanReviewChecklistItem[]
  humanReviewStates: Record<string, StoryReviewState> // keyed by storyId
  humanReviewStories: string[] // story IDs currently in human-review (app-level status override)
  // Chat settings
  maxThreadMessages: number // Max messages per chat thread (default 100)
}

export interface FileAPI {
  selectDirectory: () => Promise<{ path?: string; projectType?: ProjectType; isNewProject?: boolean; error?: string } | null>
  readFile: (filePath: string) => Promise<{ content?: string; error?: string }>
  listDirectory: (dirPath: string) => Promise<{ files?: string[]; error?: string }>
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: Partial<AppSettings>) => Promise<boolean>
  startWatching: (projectPath: string, projectType: ProjectType) => Promise<boolean>
  stopWatching: () => Promise<boolean>
  updateStoryStatus: (filePath: string, newStatus: string) => Promise<{ success: boolean; error?: string }>
  showNotification: (title: string, body: string) => Promise<void>
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
  updateStoryStatus: (filePath: string, newStatus: string) => ipcRenderer.invoke('update-story-status', filePath, newStatus),
  showNotification: (title: string, body: string) => ipcRenderer.invoke('show-notification', title, body),
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

// Git API types
export interface GitChangedFile {
  status: 'A' | 'M' | 'D' | 'R' | 'C'
  path: string
  mtime: number | null
  lastCommitTime: number | null
}

export interface GitBranchActivity {
  isOnBranch: boolean
  hasRecentFileChanges: boolean
  lastCommitTime: number | null
  hasRecentCommit: boolean
  isActive: boolean
}

export interface GitCommit {
  hash: string
  author: string
  timestamp: number
  subject: string
}

export interface GitCommitFile {
  status: 'A' | 'M' | 'D' | 'R' | 'C'
  path: string
}

export interface GitAPI {
  getCurrentBranch: (projectPath: string) => Promise<{ branch?: string; error?: string }>
  listBranches: (projectPath: string) => Promise<{ branches: string[]; error?: string }>
  checkoutBranch: (projectPath: string, branchName: string) => Promise<{ success: boolean; error?: string }>
  createBranch: (projectPath: string, branchName: string) => Promise<{ success: boolean; error?: string; alreadyExists?: boolean }>
  branchExists: (projectPath: string, branchName: string) => Promise<{ exists: boolean }>
  hasChanges: (projectPath: string) => Promise<{ hasChanges: boolean; error?: string }>
  commit: (projectPath: string, message: string) => Promise<{ success: boolean; error?: string }>
  getBranchActivity: (projectPath: string, branchName: string) => Promise<GitBranchActivity>
  getDefaultBranch: (projectPath: string) => Promise<{ branch?: string; error?: string }>
  getChangedFiles: (projectPath: string, baseBranch: string, featureBranch?: string) => Promise<{ files?: GitChangedFile[]; mergeBase?: string; error?: string }>
  getFileContent: (projectPath: string, filePath: string, commitOrBranch: string) => Promise<{ content: string }>
  getWorkingFileContent: (projectPath: string, filePath: string) => Promise<{ content: string }>
  getCommitHistory: (projectPath: string, baseBranch: string, featureBranch: string) => Promise<{ commits: GitCommit[]; error?: string }>
  getCommitDiff: (projectPath: string, commitHash: string) => Promise<{ files: GitCommitFile[]; error?: string }>
  getFileAtParent: (projectPath: string, filePath: string, commitHash: string) => Promise<{ content: string }>
  getFileAtCommit: (projectPath: string, filePath: string, commitHash: string) => Promise<{ content: string }>
  isBranchMerged: (projectPath: string, branchToCheck: string, targetBranch: string) => Promise<{ merged: boolean; error?: string }>
  mergeBranch: (projectPath: string, branchToMerge: string) => Promise<{ success: boolean; error?: string; hasConflicts?: boolean }>
}

const gitAPI: GitAPI = {
  getCurrentBranch: (projectPath) => ipcRenderer.invoke('git-current-branch', projectPath),
  listBranches: (projectPath) => ipcRenderer.invoke('git-list-branches', projectPath),
  checkoutBranch: (projectPath, branchName) => ipcRenderer.invoke('git-checkout-branch', projectPath, branchName),
  createBranch: (projectPath, branchName) => ipcRenderer.invoke('git-create-branch', projectPath, branchName),
  branchExists: (projectPath, branchName) => ipcRenderer.invoke('git-branch-exists', projectPath, branchName),
  hasChanges: (projectPath) => ipcRenderer.invoke('git-has-changes', projectPath),
  commit: (projectPath, message) => ipcRenderer.invoke('git-commit', projectPath, message),
  getBranchActivity: (projectPath, branchName) => ipcRenderer.invoke('git-branch-activity', projectPath, branchName),
  getDefaultBranch: (projectPath) => ipcRenderer.invoke('git-default-branch', projectPath),
  getChangedFiles: (projectPath, baseBranch, featureBranch) => ipcRenderer.invoke('git-changed-files', projectPath, baseBranch, featureBranch),
  getFileContent: (projectPath, filePath, commitOrBranch) => ipcRenderer.invoke('git-file-content', projectPath, filePath, commitOrBranch),
  getWorkingFileContent: (projectPath, filePath) => ipcRenderer.invoke('git-working-file-content', projectPath, filePath),
  getCommitHistory: (projectPath, baseBranch, featureBranch) => ipcRenderer.invoke('git-commit-history', projectPath, baseBranch, featureBranch),
  getCommitDiff: (projectPath, commitHash) => ipcRenderer.invoke('git-commit-diff', projectPath, commitHash),
  getFileAtParent: (projectPath, filePath, commitHash) => ipcRenderer.invoke('git-file-at-parent', projectPath, filePath, commitHash),
  getFileAtCommit: (projectPath, filePath, commitHash) => ipcRenderer.invoke('git-file-at-commit', projectPath, filePath, commitHash),
  isBranchMerged: (projectPath, branchToCheck, targetBranch) => ipcRenderer.invoke('git-is-merged', projectPath, branchToCheck, targetBranch),
  mergeBranch: (projectPath, branchToMerge) => ipcRenderer.invoke('git-merge-branch', projectPath, branchToMerge)
}

contextBridge.exposeInMainWorld('gitAPI', gitAPI)

// Chat API types
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  status: 'pending' | 'streaming' | 'complete' | 'error'
}

export interface AgentThread {
  agentId: string
  messages: ChatMessage[]
  lastActivity: number
  unreadCount: number
  isTyping: boolean
  isInitialized: boolean
  sessionId?: string // Claude conversation session ID for --resume
}

export interface ChatOutputEvent {
  agentId: string
  type: 'stdout' | 'stderr'
  chunk: string
  timestamp: number
  isAgentLoad?: boolean
}

export interface ChatExitEvent {
  agentId: string
  code: number | null
  signal: string | null
  error?: string
  timestamp: number
  sessionId?: string // Session ID captured from this conversation
  cancelled?: boolean // True if the message was cancelled by user
}

export interface ChatAgentLoadedEvent {
  agentId: string
  code: number | null
  signal: string | null
  error?: string
  sessionId?: string // Session ID for subsequent messages
  timestamp: number
}

export interface ChatAPI {
  // Thread persistence
  loadThread: (agentId: string) => Promise<AgentThread | null>
  saveThread: (agentId: string, thread: AgentThread) => Promise<boolean>
  clearThread: (agentId: string) => Promise<boolean>
  listThreads: () => Promise<string[]>
  // Agent loading - loads the BMAD agent, returns session ID via event
  loadAgent: (options: {
    agentId: string
    projectPath: string
    projectType: 'bmm' | 'bmgd'
  }) => Promise<{ success: boolean; error?: string }>
  // Message sending - spawns new process per message, uses --resume for conversation continuity
  sendMessage: (options: {
    agentId: string
    projectPath: string
    message: string
    sessionId?: string // Session ID from previous response for --resume
  }) => Promise<{ success: boolean; error?: string }>
  // Cancel an ongoing message/agent load
  cancelMessage: (agentId: string) => Promise<boolean>
  // Check if agent has a running process (for crash detection)
  isAgentRunning: (agentId: string) => Promise<boolean>
  // Event listeners
  onChatOutput: (callback: (event: ChatOutputEvent) => void) => () => void
  onChatExit: (callback: (event: ChatExitEvent) => void) => () => void
  onAgentLoaded: (callback: (event: ChatAgentLoadedEvent) => void) => () => void
}

const chatAPI: ChatAPI = {
  loadThread: (agentId) => ipcRenderer.invoke('load-chat-thread', agentId),
  saveThread: (agentId, thread) => ipcRenderer.invoke('save-chat-thread', agentId, thread),
  clearThread: (agentId) => ipcRenderer.invoke('clear-chat-thread', agentId),
  listThreads: () => ipcRenderer.invoke('list-chat-threads'),
  // Agent loading
  loadAgent: (options) => ipcRenderer.invoke('chat-load-agent', options),
  // Message sending
  sendMessage: (options) => ipcRenderer.invoke('chat-send-message', options),
  // Cancel message
  cancelMessage: (agentId) => ipcRenderer.invoke('chat-cancel-message', agentId),
  // Check if agent is running
  isAgentRunning: (agentId) => ipcRenderer.invoke('chat-is-agent-running', agentId),
  // Event listeners
  onChatOutput: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ChatOutputEvent) => {
      callback(data)
    }
    ipcRenderer.on('chat:output', listener)
    return () => ipcRenderer.removeListener('chat:output', listener)
  },
  onChatExit: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ChatExitEvent) => {
      callback(data)
    }
    ipcRenderer.on('chat:exit', listener)
    return () => ipcRenderer.removeListener('chat:exit', listener)
  },
  onAgentLoaded: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, data: ChatAgentLoadedEvent) => {
      callback(data)
    }
    ipcRenderer.on('chat:agent-loaded', listener)
    return () => ipcRenderer.removeListener('chat:agent-loaded', listener)
  }
}

contextBridge.exposeInMainWorld('chatAPI', chatAPI)

declare global {
  interface Window {
    fileAPI: FileAPI
    agentAPI: AgentAPI
    gitAPI: GitAPI
    chatAPI: ChatAPI
  }
}
