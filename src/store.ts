import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent, StoryStatus, Agent, ProjectType, AgentHistoryEntry, AITool, ClaudeModel, HumanReviewChecklistItem, StoryReviewState, ChatMessage, AgentThread, StatusChangeEntry, StatusChangeSource } from './types'
import { FullCycleState, FullCycleStepType, FullCycleStepStatus, initialFullCycleState } from './types/fullCycle'

export type ViewMode = 'board' | 'chat'

export interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

const MAX_HISTORY_ENTRIES = 50
const MAX_RECENT_PROJECTS = 10
const MAX_STATUS_HISTORY_PER_STORY = 50
const MAX_GLOBAL_STATUS_HISTORY = 100

// Debounce settings saves to prevent rapid writes that corrupt the file
let saveTimeout: NodeJS.Timeout | null = null
let pendingSettings: Record<string, unknown> | null = null

async function debouncedSave(settings: Record<string, unknown>) {
  pendingSettings = settings

  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(async () => {
    if (pendingSettings) {
      try {
        await window.fileAPI.saveSettings(pendingSettings)
      } catch (error) {
        console.error('Failed to save settings:', error)
      }
      pendingSettings = null
    }
    saveTimeout = null
  }, 1000) // Wait 1 second before saving
}

// Custom storage using Electron IPC
const electronStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const settings = await window.fileAPI.getSettings()
      return JSON.stringify({ state: settings, version: 0 })
    } catch {
      return null
    }
  },
  setItem: async (_name: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value)
      if (parsed.state) {
        // Only save the settings we care about
        const { themeMode, aiTool, claudeModel, projectPath, projectType, selectedEpicId, collapsedColumnsByEpic, agentHistory, recentProjects, notificationsEnabled, baseBranch, allowDirectEpicMerge, bmadInGitignore, bmadInGitignoreUserSet, storyOrder, enableHumanReviewColumn, humanReviewChecklist, humanReviewStates, humanReviewStories, maxThreadMessages, statusHistoryByStory, globalStatusHistory, lastViewedStatusHistoryAt, enableEpicBranches } = parsed.state

        // Don't persist full output - it can contain characters that break JSON
        // Just save metadata and a small summary
        const sanitizedHistory = (agentHistory || []).map((entry: AgentHistoryEntry) => ({
          ...entry,
          output: [] // Don't persist output - it's only useful in current session
        }))

        // Use debounced save to prevent rapid writes
        // Note: enableAgents is intentionally NOT persisted - must re-enable each session
        debouncedSave({
          themeMode,
          aiTool: aiTool || 'claude-code',
          claudeModel: claudeModel || 'sonnet',
          projectPath,
          projectType,
          selectedEpicId,
          collapsedColumnsByEpic,
          agentHistory: sanitizedHistory,
          recentProjects: recentProjects || [],
          notificationsEnabled: notificationsEnabled ?? false,
          baseBranch: baseBranch || 'main',
          allowDirectEpicMerge: allowDirectEpicMerge ?? false,
          bmadInGitignore: bmadInGitignore ?? false,
          bmadInGitignoreUserSet: bmadInGitignoreUserSet ?? false,
          storyOrder: storyOrder || {},
          enableHumanReviewColumn: enableHumanReviewColumn ?? false,
          humanReviewChecklist: humanReviewChecklist || [],
          humanReviewStates: humanReviewStates || {},
          humanReviewStories: humanReviewStories || [],
          maxThreadMessages: maxThreadMessages ?? 100,
          statusHistoryByStory: statusHistoryByStory || {},
          globalStatusHistory: globalStatusHistory || [],
          lastViewedStatusHistoryAt: lastViewedStatusHistoryAt || 0,
          enableEpicBranches: enableEpicBranches ?? false
        })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    await window.fileAPI.saveSettings({
      themeMode: 'light',
      aiTool: 'claude-code',
      claudeModel: 'sonnet',
      projectPath: null,
      projectType: null,
      selectedEpicId: null,
      collapsedColumnsByEpic: {},
      agentHistory: [],
      recentProjects: [],
      notificationsEnabled: false,
      baseBranch: 'main',
      allowDirectEpicMerge: false,
      bmadInGitignore: false,
      bmadInGitignoreUserSet: false,
      storyOrder: {},
      enableHumanReviewColumn: false,
      humanReviewChecklist: [],
      humanReviewStates: {},
      humanReviewStories: [],
      maxThreadMessages: 100,
      statusHistoryByStory: {},
      globalStatusHistory: [],
      lastViewedStatusHistoryAt: 0,
      enableEpicBranches: false
    })
  }
}

interface AppState {
  // Hydration
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

  // Hidden features
  enableAgents: boolean
  toggleEnableAgents: () => void

  // Theme
  themeMode: 'light' | 'dark'
  setThemeMode: (mode: 'light' | 'dark') => void
  toggleTheme: () => void

  // AI Tool
  aiTool: AITool
  setAITool: (tool: AITool) => void

  // Claude Model (only applies when aiTool is 'claude-code')
  claudeModel: ClaudeModel
  setClaudeModel: (model: ClaudeModel) => void

  // Notifications
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  isUserDragging: boolean
  setIsUserDragging: (dragging: boolean) => void

  // Git settings
  baseBranch: string
  setBaseBranch: (branch: string) => void
  allowDirectEpicMerge: boolean
  setAllowDirectEpicMerge: (allow: boolean) => void
  bmadInGitignore: boolean // When true, bmad folders are gitignored so branch restrictions are relaxed
  setBmadInGitignore: (inGitignore: boolean, userSet?: boolean) => void
  bmadInGitignoreUserSet: boolean // When true, user has manually set bmadInGitignore (don't auto-detect)
  enableEpicBranches: boolean // When true, show epic branch features (GitHub icon in EpicFilter, epic branches in BranchSwitcher)
  setEnableEpicBranches: (enabled: boolean) => void

  // Project
  projectPath: string | null
  projectType: ProjectType | null
  setProjectPath: (path: string | null) => void
  setProjectType: (type: ProjectType | null) => void

  // Recent Projects
  recentProjects: RecentProject[]
  addRecentProject: (project: RecentProject) => void
  removeRecentProject: (path: string) => void

  // Git state (reactive across components)
  currentBranch: string | null
  hasUncommittedChanges: boolean
  unmergedStoryBranches: string[]
  epicMergeStatusChecked: boolean // true once we've checked merge status for current epic
  setCurrentBranch: (branch: string | null) => void
  setHasUncommittedChanges: (hasChanges: boolean) => void
  setUnmergedStoryBranches: (branches: string[]) => void
  setEpicMergeStatusChecked: (checked: boolean) => void

  // Data
  epics: Epic[]
  stories: Story[]
  loading: boolean
  error: string | null
  lastRefreshed: Date | null
  isWatching: boolean
  setEpics: (epics: Epic[]) => void
  setStories: (stories: Story[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setLastRefreshed: (date: Date | null) => void
  setIsWatching: (watching: boolean) => void

  // Filters
  selectedEpicId: number | null
  setSelectedEpicId: (id: number | null) => void
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Column collapse state (per epic)
  collapsedColumnsByEpic: Record<string, StoryStatus[]>
  toggleColumnCollapse: (status: StoryStatus) => void
  getCollapsedColumns: () => StoryStatus[]

  // Story order (per epic per status)
  storyOrder: Record<string, Record<string, string[]>>
  setStoryOrder: (epicId: string, status: string, storyIds: string[]) => void
  getStoryOrder: (epicId: string, status: string) => string[]

  // Story dialog
  selectedStory: Story | null
  storyContent: StoryContent | null
  setSelectedStory: (story: Story | null) => void
  setStoryContent: (content: StoryContent | null) => void

  // Help Panel
  helpPanelOpen: boolean
  helpPanelTab: number
  helpPanelScrollToAgent: string | null
  setHelpPanelOpen: (open: boolean, tab?: number, scrollToAgent?: string) => void
  toggleHelpPanel: () => void
  clearHelpPanelScrollToAgent: () => void

  // New Project Dialog
  newProjectDialogOpen: boolean
  pendingNewProject: { path: string; projectType: ProjectType } | null
  setNewProjectDialogOpen: (open: boolean) => void
  setPendingNewProject: (project: { path: string; projectType: ProjectType } | null) => void

  // Agents
  agents: Record<string, Agent>
  activeAgentId: string | null
  agentPanelOpen: boolean
  addAgent: (agent: Agent) => void
  updateAgent: (agentId: string, updates: Partial<Agent>) => void
  appendAgentOutput: (agentId: string, output: string) => void
  removeAgent: (agentId: string) => void
  setActiveAgent: (agentId: string | null) => void
  toggleAgentPanel: () => void
  setAgentPanelOpen: (open: boolean) => void
  getAgentForStory: (storyId: string) => Agent | null

  // Agent History (persisted)
  agentHistory: AgentHistoryEntry[]
  addToHistory: (entry: AgentHistoryEntry) => void
  updateHistoryEntry: (id: string, updates: Partial<AgentHistoryEntry>) => void
  clearHistory: () => void
  getHistoryForStory: (storyId: string) => AgentHistoryEntry[]

  // Human Review
  enableHumanReviewColumn: boolean
  setEnableHumanReviewColumn: (enabled: boolean) => void
  humanReviewChecklist: HumanReviewChecklistItem[]
  humanReviewStates: Record<string, StoryReviewState>
  toggleReviewItem: (storyId: string, itemId: string) => void
  isReviewComplete: (storyId: string) => boolean
  // Human Review status override (app-level, not written to BMAD)
  humanReviewStories: string[]
  addToHumanReview: (storyId: string) => void
  removeFromHumanReview: (storyId: string) => void
  isInHumanReview: (storyId: string) => boolean
  getEffectiveStatus: (story: Story) => StoryStatus

  // View Mode (board or chat)
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  toggleViewMode: () => void

  // Chat Interface
  chatThreads: Record<string, AgentThread>
  selectedChatAgent: string | null
  maxThreadMessages: number
  setSelectedChatAgent: (agentId: string | null) => void
  setMaxThreadMessages: (max: number) => void
  addChatMessage: (agentId: string, message: ChatMessage) => void
  updateChatMessage: (agentId: string, messageId: string, updates: Partial<ChatMessage>) => void
  setChatTyping: (agentId: string, isTyping: boolean) => void
  setChatActivity: (agentId: string, activity: string | undefined) => void
  markChatRead: (agentId: string) => void
  incrementUnread: (agentId: string) => void
  clearChatThread: (agentId: string) => void
  setAgentInitialized: (agentId: string, initialized: boolean) => void
  setChatSessionId: (agentId: string, sessionId: string) => void
  // Pending message to send when switching to chat
  pendingChatMessage: { agentId: string; message: string; storyId?: string; branchName?: string } | null
  setPendingChatMessage: (pending: { agentId: string; message: string; storyId?: string; branchName?: string } | null) => void
  clearPendingChatMessage: () => void
  setThreadContext: (agentId: string, storyId: string | undefined, branchName: string | undefined) => void

  // Status History
  statusHistoryByStory: Record<string, StatusChangeEntry[]>
  globalStatusHistory: StatusChangeEntry[]
  statusHistoryPanelOpen: boolean
  lastViewedStatusHistoryAt: number
  recordStatusChange: (storyId: string, storyTitle: string, epicId: number, storyNumber: number, oldStatus: StoryStatus, newStatus: StoryStatus, source: StatusChangeSource) => void
  getStatusHistoryForStory: (storyId: string) => StatusChangeEntry[]
  setStatusHistoryPanelOpen: (open: boolean) => void
  markStatusHistoryViewed: () => void
  getUnreadStatusHistoryCount: () => number

  // Full Cycle Automation
  fullCycle: FullCycleState
  startFullCycle: (storyId: string, totalSteps: number) => void
  updateFullCycleStep: (step: number, name: string, type: FullCycleStepType) => void
  appendFullCycleLog: (log: string) => void
  setFullCycleError: (error: string) => void
  completeFullCycle: () => void
  cancelFullCycle: () => void
  retryFullCycle: () => void
  setFullCycleMinimized: (minimized: boolean) => void
  setFullCycleSessionId: (sessionId: string) => void
  skipFullCycleStep: (stepIndex: number) => void
  advanceFullCycleStep: () => void
  fullCycleDialogOpen: boolean
  setFullCycleDialogOpen: (open: boolean) => void

  // Computed - filtered stories
  getFilteredStories: () => Story[]
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Hidden features
      enableAgents: false,
      toggleEnableAgents: () => set((state) => ({ enableAgents: !state.enableAgents })),

      // Theme
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleTheme: () => set((state) => ({
        themeMode: state.themeMode === 'light' ? 'dark' : 'light'
      })),

      // AI Tool
      aiTool: 'claude-code',
      setAITool: (tool) => set({ aiTool: tool }),

      // Claude Model
      claudeModel: 'sonnet',
      setClaudeModel: (model) => set({ claudeModel: model }),

      // Notifications
      notificationsEnabled: false,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      isUserDragging: false,
      setIsUserDragging: (dragging) => set({ isUserDragging: dragging }),

      // Git settings
      baseBranch: 'main',
      setBaseBranch: (branch) => set({ baseBranch: branch }),
      allowDirectEpicMerge: false,
      setAllowDirectEpicMerge: (allow) => set({ allowDirectEpicMerge: allow }),
      bmadInGitignore: false,
      setBmadInGitignore: (inGitignore, userSet) => set({
        bmadInGitignore: inGitignore,
        ...(userSet !== undefined && { bmadInGitignoreUserSet: userSet })
      }),
      bmadInGitignoreUserSet: false,
      enableEpicBranches: false,
      setEnableEpicBranches: (enabled) => set({ enableEpicBranches: enabled }),

      // Project
      projectPath: null,
      projectType: null,
      setProjectPath: (path) => set({ projectPath: path }),
      setProjectType: (type) => set({ projectType: type }),

      // Recent Projects
      recentProjects: [],
      addRecentProject: (project) => set((state) => {
        // Remove if already exists (to move it to top)
        const filtered = state.recentProjects.filter((p) => p.path !== project.path)
        // Add to beginning and limit to max
        const updated = [project, ...filtered].slice(0, MAX_RECENT_PROJECTS)
        return { recentProjects: updated }
      }),
      removeRecentProject: (path) => set((state) => ({
        recentProjects: state.recentProjects.filter((p) => p.path !== path)
      })),

      // Git state (reactive across components)
      currentBranch: null,
      hasUncommittedChanges: false,
      unmergedStoryBranches: [],
      epicMergeStatusChecked: false,
      setCurrentBranch: (branch) => {
        const current = get().currentBranch
        // Skip if branch hasn't changed - prevents resetting merge status check
        if (branch === current) return
        set({
          currentBranch: branch,
          unmergedStoryBranches: [],
          epicMergeStatusChecked: false // Reset - need to re-check merge status
        })
      },
      setHasUncommittedChanges: (hasChanges) => set({ hasUncommittedChanges: hasChanges }),
      setUnmergedStoryBranches: (branches) => {
        set({ unmergedStoryBranches: branches, epicMergeStatusChecked: true })
      },
      setEpicMergeStatusChecked: (checked) => set({ epicMergeStatusChecked: checked }),

      // Data
      epics: [],
      stories: [],
      loading: false,
      error: null,
      lastRefreshed: null,
      isWatching: false,
      setEpics: (epics) => set({ epics }),
      setStories: (stories) => set({ stories }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),
      setLastRefreshed: (date) => set({ lastRefreshed: date }),
      setIsWatching: (watching) => set({ isWatching: watching }),

      // Filters
      selectedEpicId: null,
      setSelectedEpicId: (id) => set({ selectedEpicId: id }),
      searchQuery: '',
      setSearchQuery: (query) => set({ searchQuery: query }),

      // Column collapse state (per epic)
      collapsedColumnsByEpic: {},
      toggleColumnCollapse: (status) => set((state) => {
        const epicKey = state.selectedEpicId === null ? 'all' : String(state.selectedEpicId)
        const currentCollapsed = state.collapsedColumnsByEpic[epicKey] || []
        const isCollapsed = currentCollapsed.includes(status)
        return {
          collapsedColumnsByEpic: {
            ...state.collapsedColumnsByEpic,
            [epicKey]: isCollapsed
              ? currentCollapsed.filter((s) => s !== status)
              : [...currentCollapsed, status]
          }
        }
      }),
      getCollapsedColumns: () => {
        const state = get()
        const epicKey = state.selectedEpicId === null ? 'all' : String(state.selectedEpicId)
        return state.collapsedColumnsByEpic[epicKey] || []
      },

      // Story order (per epic per status)
      storyOrder: {},
      setStoryOrder: (epicId, status, storyIds) => set((state) => ({
        storyOrder: {
          ...state.storyOrder,
          [epicId]: {
            ...(state.storyOrder[epicId] || {}),
            [status]: storyIds
          }
        }
      })),
      getStoryOrder: (epicId, status) => {
        const state = get()
        return state.storyOrder[epicId]?.[status] || []
      },

      // Story dialog
      selectedStory: null,
      storyContent: null,
      setSelectedStory: (story) => set({ selectedStory: story }),
      setStoryContent: (content) => set({ storyContent: content }),

      // Help Panel
      helpPanelOpen: false,
      helpPanelTab: 0,
      helpPanelScrollToAgent: null,
      setHelpPanelOpen: (open, tab = 0, scrollToAgent) => set({
        helpPanelOpen: open,
        helpPanelTab: tab,
        helpPanelScrollToAgent: scrollToAgent || null
      }),
      toggleHelpPanel: () => set((state) => ({ helpPanelOpen: !state.helpPanelOpen })),
      clearHelpPanelScrollToAgent: () => set({ helpPanelScrollToAgent: null }),

      // New Project Dialog
      newProjectDialogOpen: false,
      pendingNewProject: null,
      setNewProjectDialogOpen: (open) => set({ newProjectDialogOpen: open }),
      setPendingNewProject: (project) => set({ pendingNewProject: project }),

      // Agents
      agents: {},
      activeAgentId: null,
      agentPanelOpen: false,
      addAgent: (agent) => set((state) => ({
        agents: { ...state.agents, [agent.id]: agent }
      })),
      updateAgent: (agentId, updates) => set((state) => {
        const agent = state.agents[agentId]
        if (!agent) return state
        return {
          agents: {
            ...state.agents,
            [agentId]: { ...agent, ...updates }
          }
        }
      }),
      appendAgentOutput: (agentId, output) => set((state) => {
        const agent = state.agents[agentId]
        if (!agent) return state
        return {
          agents: {
            ...state.agents,
            [agentId]: {
              ...agent,
              output: [...agent.output, output]
            }
          }
        }
      }),
      removeAgent: (agentId) => set((state) => {
        const { [agentId]: _, ...rest } = state.agents
        return {
          agents: rest,
          activeAgentId: state.activeAgentId === agentId ? null : state.activeAgentId
        }
      }),
      setActiveAgent: (agentId) => set({ activeAgentId: agentId }),
      toggleAgentPanel: () => set((state) => ({ agentPanelOpen: !state.agentPanelOpen })),
      setAgentPanelOpen: (open) => set({ agentPanelOpen: open }),
      getAgentForStory: (storyId) => {
        const { agents } = get()
        return Object.values(agents).find((a) => a.storyId === storyId) || null
      },

      // Agent History
      agentHistory: [],
      addToHistory: (entry) => set((state) => {
        // Check if entry already exists (prevent duplicates)
        if (state.agentHistory.some(h => h.id === entry.id)) {
          return state
        }
        // Don't store output in history - it's saved to files
        const trimmedEntry = {
          ...entry,
          output: [] // Output is stored in separate files
        }
        // Add to front, limit total entries
        const newHistory = [trimmedEntry, ...state.agentHistory].slice(0, MAX_HISTORY_ENTRIES)
        return { agentHistory: newHistory }
      }),
      updateHistoryEntry: (id, updates) => set((state) => {
        const index = state.agentHistory.findIndex((h) => h.id === id)
        if (index === -1) return state
        const updated = [...state.agentHistory]
        // Don't update output - it's stored in files
        const { output: _output, ...safeUpdates } = updates
        updated[index] = { ...updated[index], ...safeUpdates }
        return { agentHistory: updated }
      }),
      clearHistory: () => set({ agentHistory: [] }),
      getHistoryForStory: (storyId) => {
        const { agentHistory } = get()
        return agentHistory.filter((h) => h.storyId === storyId)
      },

      // Human Review
      enableHumanReviewColumn: false,
      setEnableHumanReviewColumn: (enabled) => set({ enableHumanReviewColumn: enabled }),
      humanReviewChecklist: [],
      humanReviewStates: {},
      toggleReviewItem: (storyId, itemId) => set((state) => {
        const current = state.humanReviewStates[storyId] || { storyId, checkedItems: [], lastUpdated: 0 }
        const isChecked = current.checkedItems.includes(itemId)
        const newCheckedItems = isChecked
          ? current.checkedItems.filter((id) => id !== itemId)
          : [...current.checkedItems, itemId]

        return {
          humanReviewStates: {
            ...state.humanReviewStates,
            [storyId]: {
              storyId,
              checkedItems: newCheckedItems,
              lastUpdated: Date.now()
            }
          }
        }
      }),
      isReviewComplete: (storyId) => {
        const { humanReviewStates, humanReviewChecklist } = get()
        const reviewState = humanReviewStates[storyId]
        if (!reviewState || humanReviewChecklist.length === 0) return false
        return reviewState.checkedItems.length === humanReviewChecklist.length
      },
      // Human Review status override (app-level, not written to BMAD)
      humanReviewStories: [],
      addToHumanReview: (storyId) => set((state) => ({
        humanReviewStories: state.humanReviewStories.includes(storyId)
          ? state.humanReviewStories
          : [...state.humanReviewStories, storyId]
      })),
      removeFromHumanReview: (storyId) => set((state) => ({
        humanReviewStories: state.humanReviewStories.filter((id) => id !== storyId)
      })),
      isInHumanReview: (storyId) => {
        const { humanReviewStories } = get()
        return humanReviewStories.includes(storyId)
      },
      getEffectiveStatus: (story) => {
        const { humanReviewStories, enableHumanReviewColumn } = get()
        if (enableHumanReviewColumn && humanReviewStories.includes(story.id)) {
          return 'human-review'
        }
        return story.status
      },

      // View Mode
      viewMode: 'board',
      setViewMode: (mode) => set({ viewMode: mode }),
      toggleViewMode: () => set((state) => ({
        viewMode: state.viewMode === 'board' ? 'chat' : 'board'
      })),

      // Chat Interface
      chatThreads: {},
      selectedChatAgent: null,
      maxThreadMessages: 100,
      pendingChatMessage: null,
      setSelectedChatAgent: (agentId) => set({ selectedChatAgent: agentId }),
      setPendingChatMessage: (pending) => set({ pendingChatMessage: pending }),
      clearPendingChatMessage: () => set({ pendingChatMessage: null }),
      setMaxThreadMessages: (max) => set({ maxThreadMessages: max }),
      addChatMessage: (agentId, message) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        // Add message and trim to max
        const messages = [...thread.messages, message]
        const trimmedMessages = messages.slice(-state.maxThreadMessages)

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              messages: trimmedMessages,
              lastActivity: Date.now()
            }
          }
        }
      }),
      updateChatMessage: (agentId, messageId, updates) => set((state) => {
        const thread = state.chatThreads[agentId]
        if (!thread) return state

        const messages = thread.messages.map((msg) =>
          msg.id === messageId ? { ...msg, ...updates } : msg
        )

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              messages
            }
          }
        }
      }),
      setChatTyping: (agentId, isTyping) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              isTyping,
              // Clear activity when typing stops
              thinkingActivity: isTyping ? thread.thinkingActivity : undefined
            }
          }
        }
      }),
      setChatActivity: (agentId, activity) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              thinkingActivity: activity
            }
          }
        }
      }),
      markChatRead: (agentId) => set((state) => {
        const thread = state.chatThreads[agentId]
        if (!thread) return state

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              unreadCount: 0
            }
          }
        }
      }),
      incrementUnread: (agentId) => set((state) => {
        const thread = state.chatThreads[agentId]
        if (!thread) return state

        // Don't increment if this agent is selected
        if (state.selectedChatAgent === agentId) return state

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              unreadCount: thread.unreadCount + 1
            }
          }
        }
      }),
      clearChatThread: (agentId) => set((state) => ({
        chatThreads: {
          ...state.chatThreads,
          [agentId]: {
            agentId,
            messages: [],
            lastActivity: Date.now(),
            unreadCount: 0,
            isTyping: false,
            isInitialized: false,
            sessionId: undefined // Clear session so agent reloads on next message
          }
        }
      })),
      setAgentInitialized: (agentId, initialized) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              isInitialized: initialized
            }
          }
        }
      }),
      setChatSessionId: (agentId, sessionId) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              sessionId
            }
          }
        }
      }),
      setThreadContext: (agentId, storyId, branchName) => set((state) => {
        const thread = state.chatThreads[agentId] || {
          agentId,
          messages: [],
          lastActivity: Date.now(),
          unreadCount: 0,
          isTyping: false,
          isInitialized: false
        }

        return {
          chatThreads: {
            ...state.chatThreads,
            [agentId]: {
              ...thread,
              storyId,
              branchName
            }
          }
        }
      }),

      // Status History
      statusHistoryByStory: {},
      globalStatusHistory: [],
      statusHistoryPanelOpen: false,
      recordStatusChange: (storyId, storyTitle, epicId, storyNumber, oldStatus, newStatus, source) => set((state) => {
        // Skip if no actual change
        if (oldStatus === newStatus) return state

        const entry: StatusChangeEntry = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          storyId,
          storyTitle,
          epicId,
          storyNumber,
          oldStatus,
          newStatus,
          timestamp: Date.now(),
          source
        }

        // Update per-story history
        const storyHistory = state.statusHistoryByStory[storyId] || []
        const newStoryHistory = [entry, ...storyHistory].slice(0, MAX_STATUS_HISTORY_PER_STORY)

        // Update global history
        const newGlobalHistory = [entry, ...state.globalStatusHistory].slice(0, MAX_GLOBAL_STATUS_HISTORY)

        return {
          statusHistoryByStory: {
            ...state.statusHistoryByStory,
            [storyId]: newStoryHistory
          },
          globalStatusHistory: newGlobalHistory
        }
      }),
      getStatusHistoryForStory: (storyId) => {
        const { statusHistoryByStory } = get()
        return statusHistoryByStory[storyId] || []
      },
      setStatusHistoryPanelOpen: (open) => set({ statusHistoryPanelOpen: open }),
      lastViewedStatusHistoryAt: 0,
      markStatusHistoryViewed: () => set({ lastViewedStatusHistoryAt: Date.now() }),
      getUnreadStatusHistoryCount: () => {
        const { globalStatusHistory, lastViewedStatusHistoryAt } = get()
        return globalStatusHistory.filter(entry => entry.timestamp > lastViewedStatusHistoryAt).length
      },

      // Full Cycle Automation
      fullCycle: initialFullCycleState,
      fullCycleDialogOpen: false,
      setFullCycleDialogOpen: (open) => set({ fullCycleDialogOpen: open }),
      startFullCycle: (storyId, totalSteps) => set({
        fullCycle: {
          ...initialFullCycleState,
          isRunning: true,
          storyId,
          totalSteps,
          stepStatuses: new Array(totalSteps).fill('pending' as FullCycleStepStatus),
          startTime: Date.now(),
          stepStartTime: Date.now()
        },
        fullCycleDialogOpen: true
      }),
      updateFullCycleStep: (step, name, type) => set((state) => {
        const newStatuses = [...state.fullCycle.stepStatuses]
        newStatuses[step] = 'running'
        return {
          fullCycle: {
            ...state.fullCycle,
            currentStep: step,
            stepName: name,
            stepType: type,
            stepStatus: 'running',
            stepStatuses: newStatuses,
            stepStartTime: Date.now()
          }
        }
      }),
      appendFullCycleLog: (log) => set((state) => ({
        fullCycle: {
          ...state.fullCycle,
          logs: [...state.fullCycle.logs, log]
        }
      })),
      setFullCycleError: (error) => set((state) => {
        const newStatuses = [...state.fullCycle.stepStatuses]
        if (state.fullCycle.currentStep < newStatuses.length) {
          newStatuses[state.fullCycle.currentStep] = 'error'
        }
        return {
          fullCycle: {
            ...state.fullCycle,
            error,
            stepStatus: 'error',
            stepStatuses: newStatuses
          }
        }
      }),
      completeFullCycle: () => set((state) => {
        const newStatuses = state.fullCycle.stepStatuses.map((s) =>
          s === 'running' ? 'completed' : s
        )
        return {
          fullCycle: {
            ...state.fullCycle,
            isRunning: false,
            stepStatus: 'completed',
            stepStatuses: newStatuses
          }
        }
      }),
      cancelFullCycle: () => set((state) => ({
        fullCycle: {
          ...state.fullCycle,
          isRunning: false,
          error: 'Cancelled by user'
        }
      })),
      retryFullCycle: () => set((state) => {
        // Find the first step that isn't completed or skipped
        const stepStatuses = state.fullCycle.stepStatuses
        let resumeStep = 0
        for (let i = 0; i < stepStatuses.length; i++) {
          if (stepStatuses[i] !== 'completed' && stepStatuses[i] !== 'skipped') {
            resumeStep = i
            break
          }
        }
        // Reset the status of failed/pending steps to pending
        const newStatuses = stepStatuses.map((s, i) =>
          i >= resumeStep ? 'pending' as FullCycleStepStatus : s
        )
        return {
          fullCycle: {
            ...state.fullCycle,
            isRunning: true,
            currentStep: resumeStep,
            error: null,
            stepStatus: 'pending',
            stepStatuses: newStatuses,
            stepStartTime: Date.now()
          }
        }
      }),
      setFullCycleMinimized: (minimized) => set((state) => ({
        fullCycle: {
          ...state.fullCycle,
          minimized
        }
      })),
      setFullCycleSessionId: (sessionId) => set((state) => ({
        fullCycle: {
          ...state.fullCycle,
          sessionId
        }
      })),
      skipFullCycleStep: (stepIndex) => set((state) => {
        const newStatuses = [...state.fullCycle.stepStatuses]
        newStatuses[stepIndex] = 'skipped'
        return {
          fullCycle: {
            ...state.fullCycle,
            currentStep: stepIndex + 1,
            stepStatus: 'skipped',
            stepStatuses: newStatuses
          }
        }
      }),
      advanceFullCycleStep: () => set((state) => {
        const newStatuses = [...state.fullCycle.stepStatuses]
        if (state.fullCycle.currentStep < newStatuses.length) {
          newStatuses[state.fullCycle.currentStep] = 'completed'
        }
        return {
          fullCycle: {
            ...state.fullCycle,
            currentStep: state.fullCycle.currentStep + 1,
            stepStatus: 'completed',
            stepStatuses: newStatuses
          }
        }
      }),

      // Computed
      getFilteredStories: () => {
        const { stories, selectedEpicId, searchQuery } = get()
        let filtered = stories

        // Filter by epic
        if (selectedEpicId !== null) {
          filtered = filtered.filter((s) => s.epicId === selectedEpicId)
        }

        // Filter by search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase()
          filtered = filtered.filter((s) =>
            s.title.toLowerCase().includes(query) ||
            s.id.toLowerCase().includes(query)
          )
        }

        return filtered
      }
    }),
    {
      name: 'bmadboard-storage',
      storage: createJSONStorage(() => electronStorage),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Mark any "running" agents in history as "interrupted" since the app restarted
          const updatedHistory = state.agentHistory.map((entry) => {
            if (entry.status === 'running') {
              return { ...entry, status: 'interrupted' as const, endTime: Date.now() }
            }
            return entry
          })
          if (updatedHistory.some((h, i) => h !== state.agentHistory[i])) {
            state.agentHistory = updatedHistory
          }
          state.setHasHydrated(true)
        }
      }
    }
  )
)
