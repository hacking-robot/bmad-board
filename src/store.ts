import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent, StoryStatus, Agent, ProjectType, AgentHistoryEntry, AITool, HumanReviewChecklistItem, StoryReviewState } from './types'

export interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

const MAX_HISTORY_ENTRIES = 50
const MAX_RECENT_PROJECTS = 10

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
        const { themeMode, aiTool, projectPath, projectType, selectedEpicId, collapsedColumnsByEpic, agentHistory, recentProjects, notificationsEnabled, storyOrder, enableHumanReviewColumn, humanReviewChecklist, humanReviewStates, humanReviewStories } = parsed.state

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
          projectPath,
          projectType,
          selectedEpicId,
          collapsedColumnsByEpic,
          agentHistory: sanitizedHistory,
          recentProjects: recentProjects || [],
          notificationsEnabled: notificationsEnabled ?? false,
          storyOrder: storyOrder || {},
          enableHumanReviewColumn: enableHumanReviewColumn ?? false,
          humanReviewChecklist: humanReviewChecklist || [],
          humanReviewStates: humanReviewStates || {},
          humanReviewStories: humanReviewStories || []
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
      projectPath: null,
      projectType: null,
      selectedEpicId: null,
      collapsedColumnsByEpic: {},
      agentHistory: [],
      recentProjects: [],
      notificationsEnabled: false,
      storyOrder: {},
      enableHumanReviewColumn: false,
      humanReviewChecklist: [],
      humanReviewStates: {},
      humanReviewStories: []
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

  // Notifications
  notificationsEnabled: boolean
  setNotificationsEnabled: (enabled: boolean) => void
  isUserDragging: boolean
  setIsUserDragging: (dragging: boolean) => void

  // Project
  projectPath: string | null
  projectType: ProjectType | null
  setProjectPath: (path: string | null) => void
  setProjectType: (type: ProjectType | null) => void

  // Recent Projects
  recentProjects: RecentProject[]
  addRecentProject: (project: RecentProject) => void
  removeRecentProject: (path: string) => void

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
  setHelpPanelOpen: (open: boolean, tab?: number) => void
  toggleHelpPanel: () => void

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

      // Notifications
      notificationsEnabled: false,
      setNotificationsEnabled: (enabled) => set({ notificationsEnabled: enabled }),
      isUserDragging: false,
      setIsUserDragging: (dragging) => set({ isUserDragging: dragging }),

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
      setHelpPanelOpen: (open, tab = 0) => set({ helpPanelOpen: open, helpPanelTab: tab }),
      toggleHelpPanel: () => set((state) => ({ helpPanelOpen: !state.helpPanelOpen })),

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
