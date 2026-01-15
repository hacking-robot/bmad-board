import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent, StoryStatus, Agent, ProjectType, AgentHistoryEntry } from './types'

const MAX_HISTORY_ENTRIES = 50

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
        const { themeMode, projectPath, selectedEpicId, collapsedColumnsByEpic, agentHistory } = parsed.state

        // Don't persist full output - it can contain characters that break JSON
        // Just save metadata and a small summary
        const sanitizedHistory = (agentHistory || []).map((entry: AgentHistoryEntry) => ({
          ...entry,
          output: [] // Don't persist output - it's only useful in current session
        }))

        // Use debounced save to prevent rapid writes
        debouncedSave({
          themeMode,
          projectPath,
          selectedEpicId,
          collapsedColumnsByEpic,
          agentHistory: sanitizedHistory
        })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    await window.fileAPI.saveSettings({
      themeMode: 'light',
      projectPath: null,
      selectedEpicId: null,
      collapsedColumnsByEpic: {},
      agentHistory: []
    })
  }
}

interface AppState {
  // Hydration
  _hasHydrated: boolean
  setHasHydrated: (state: boolean) => void

  // Theme
  themeMode: 'light' | 'dark'
  setThemeMode: (mode: 'light' | 'dark') => void
  toggleTheme: () => void

  // Project
  projectPath: string | null
  setProjectPath: (path: string | null) => void

  // Data
  epics: Epic[]
  stories: Story[]
  loading: boolean
  error: string | null
  setEpics: (epics: Epic[]) => void
  setStories: (stories: Story[]) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  // Filters
  selectedEpicId: number | null
  setSelectedEpicId: (id: number | null) => void
  searchQuery: string
  setSearchQuery: (query: string) => void

  // Column collapse state (per epic)
  collapsedColumnsByEpic: Record<string, StoryStatus[]>
  toggleColumnCollapse: (status: StoryStatus) => void
  getCollapsedColumns: () => StoryStatus[]

  // Story dialog
  selectedStory: Story | null
  storyContent: StoryContent | null
  setSelectedStory: (story: Story | null) => void
  setStoryContent: (content: StoryContent | null) => void

  // Agents
  agents: Record<string, Agent>
  activeAgentId: string | null
  agentPanelOpen: boolean
  projectType: ProjectType
  addAgent: (agent: Agent) => void
  updateAgent: (agentId: string, updates: Partial<Agent>) => void
  appendAgentOutput: (agentId: string, output: string) => void
  removeAgent: (agentId: string) => void
  setActiveAgent: (agentId: string | null) => void
  toggleAgentPanel: () => void
  setAgentPanelOpen: (open: boolean) => void
  setProjectType: (type: ProjectType) => void
  getAgentForStory: (storyId: string) => Agent | null

  // Agent History (persisted)
  agentHistory: AgentHistoryEntry[]
  addToHistory: (entry: AgentHistoryEntry) => void
  updateHistoryEntry: (id: string, updates: Partial<AgentHistoryEntry>) => void
  clearHistory: () => void
  getHistoryForStory: (storyId: string) => AgentHistoryEntry[]

  // Computed - filtered stories
  getFilteredStories: () => Story[]
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Hydration
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Theme
      themeMode: 'light',
      setThemeMode: (mode) => set({ themeMode: mode }),
      toggleTheme: () => set((state) => ({
        themeMode: state.themeMode === 'light' ? 'dark' : 'light'
      })),

      // Project
      projectPath: null,
      setProjectPath: (path) => set({ projectPath: path }),

      // Data
      epics: [],
      stories: [],
      loading: false,
      error: null,
      setEpics: (epics) => set({ epics }),
      setStories: (stories) => set({ stories }),
      setLoading: (loading) => set({ loading }),
      setError: (error) => set({ error }),

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

      // Story dialog
      selectedStory: null,
      storyContent: null,
      setSelectedStory: (story) => set({ selectedStory: story }),
      setStoryContent: (content) => set({ storyContent: content }),

      // Agents
      agents: {},
      activeAgentId: null,
      agentPanelOpen: false,
      projectType: 'bmad',
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
      setProjectType: (type) => set({ projectType: type }),
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
