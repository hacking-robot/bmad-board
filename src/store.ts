import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent, StoryStatus } from './types'

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
        const { themeMode, projectPath, selectedEpicId, collapsedColumns } = parsed.state
        await window.fileAPI.saveSettings({ themeMode, projectPath, selectedEpicId, collapsedColumns })
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
      collapsedColumns: []
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

  // Column collapse state
  collapsedColumns: StoryStatus[]
  toggleColumnCollapse: (status: StoryStatus) => void

  // Story dialog
  selectedStory: Story | null
  storyContent: StoryContent | null
  setSelectedStory: (story: Story | null) => void
  setStoryContent: (content: StoryContent | null) => void

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

      // Column collapse state
      collapsedColumns: [],
      toggleColumnCollapse: (status) => set((state) => {
        const isCollapsed = state.collapsedColumns.includes(status)
        return {
          collapsedColumns: isCollapsed
            ? state.collapsedColumns.filter((s) => s !== status)
            : [...state.collapsedColumns, status]
        }
      }),

      // Story dialog
      selectedStory: null,
      storyContent: null,
      setSelectedStory: (story) => set({ selectedStory: story }),
      setStoryContent: (content) => set({ storyContent: content }),

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
        state?.setHasHydrated(true)
      }
    }
  )
)
