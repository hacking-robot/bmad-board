export type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'human-review' | 'done' | 'optional'

export interface Epic {
  id: number
  name: string
  goal: string
  status: StoryStatus
  stories: Story[]
}

export interface Story {
  id: string // e.g., "1-1-place-nand-gates"
  epicId: number
  storyNumber: number
  title: string
  slug: string
  status: StoryStatus
  filePath?: string
  // Parsed content (loaded on demand)
  content?: StoryContent
}

export interface StoryContent {
  rawMarkdown: string
  description: string // The "As a... I want... so that..." part
  acceptanceCriteria: AcceptanceCriterion[]
  tasks: Task[]
  devNotes: string
  fileChanges?: FileChanges
}

export interface AcceptanceCriterion {
  id: string
  title: string
  description: string
}

export interface Task {
  id: string
  title: string
  completed: boolean
  subtasks: Subtask[]
}

export interface Subtask {
  id: string
  title: string
  completed: boolean
}

export interface FileChanges {
  created: string[]
  modified: string[]
  verified: string[]
}

// Column configuration for the board
export const STATUS_COLUMNS: { status: StoryStatus; label: string; color: string }[] = [
  { status: 'backlog', label: 'Backlog', color: '#9e9e9e' },
  { status: 'ready-for-dev', label: 'Ready for Dev', color: '#2196f3' },
  { status: 'in-progress', label: 'In Progress', color: '#ff9800' },
  { status: 'review', label: 'Review', color: '#9c27b0' },
  { status: 'human-review', label: 'Human Review', color: '#e91e63' },
  { status: 'done', label: 'Done', color: '#4caf50' }
]

// Human Review checklist types
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

// Epic colors for badges
export const EPIC_COLORS: string[] = [
  '#1976d2', // Blue
  '#388e3c', // Green
  '#f57c00', // Orange
  '#7b1fa2', // Purple
  '#c62828', // Red
  '#00838f', // Cyan
  '#5d4037', // Brown
  '#455a64', // Blue Grey
  '#ad1457'  // Pink
]

// Agent types
export type AgentStatus = 'running' | 'completed' | 'error' | 'interrupted'
export type ProjectType = 'bmm' | 'bmgd'

// AI Tool types - determines command syntax
export type AITool = 'claude-code' | 'cursor' | 'windsurf' | 'roo-code'

export const AI_TOOLS: { id: AITool; name: string; agentPrefix: string; description: string }[] = [
  { id: 'claude-code', name: 'Claude Code', agentPrefix: '/', description: 'Anthropic CLI - uses /agent slash commands' },
  { id: 'cursor', name: 'Cursor', agentPrefix: '@', description: 'Cursor IDE - uses @agent rules' },
  { id: 'windsurf', name: 'Windsurf', agentPrefix: '@', description: 'Codeium IDE - uses @agent workflows' },
  { id: 'roo-code', name: 'Roo Code', agentPrefix: '@', description: 'VS Code extension - uses @agent rules' }
]

export interface Agent {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: AgentStatus
  output: string[]
  startTime: number
  pid?: number
}

// Agent history for persistence across app restarts
export interface AgentHistoryEntry {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: AgentStatus
  output: string[] // Last N lines of output
  startTime: number
  endTime?: number
  exitCode?: number
}

// NOTE: Agent actions are now defined in src/data/flow.json
// Use the useWorkflow hook to access workflow data

// Chat interface types
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
  isInitialized: boolean // Whether the BMAD agent has been loaded in the session
  sessionId?: string // Claude conversation session ID for --resume
  thinkingActivity?: string // What Claude is currently doing (e.g., "Reading file...", "Searching...")
  storyId?: string // The story this thread is working on
  branchName?: string // The branch this thread is working on
}

// Story chat history types (persisted to project and user directories)
export interface StoryChatSession {
  sessionId: string          // UUID for this session
  agentId: string            // e.g., "dev", "pm"
  agentName: string          // Human-readable name
  messages: ChatMessage[]    // Conversation messages
  startTime: number
  endTime?: number
  branchName?: string
}

export interface StoryChatHistory {
  storyId: string
  storyTitle: string
  sessions: StoryChatSession[]
  lastUpdated: number
}

// NOTE: BMAD agent definitions are now in src/data/flow-bmm.json and src/data/flow-bmgd.json
// Use the useWorkflow hook to access agent data

