import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent, StoryStatus } from './types'
import type { ProjectType } from './utils/projectTypes'

export interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

const MAX_RECENT_PROJECTS = 10

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
        const { themeMode, projectPath, projectType, selectedEpicId, collapsedColumnsByEpic, recentProjects } = parsed.state
        await window.fileAPI.saveSettings({ themeMode, projectPath, projectType, selectedEpicId, collapsedColumnsByEpic, recentProjects })
      }
    } catch (error) {
      console.error('Failed to save settings:', error)
    }
  },
  removeItem: async (_name: string): Promise<void> => {
    await window.fileAPI.saveSettings({
      themeMode: 'light',
      projectPath: null,
      projectType: null,
      selectedEpicId: null,
      collapsedColumnsByEpic: {},
      recentProjects: []
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
