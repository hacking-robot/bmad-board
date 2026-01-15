import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { Epic, Story, StoryContent } from './types'

interface AppState {
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
      partialize: (state) => ({
        themeMode: state.themeMode,
        projectPath: state.projectPath,
        selectedEpicId: state.selectedEpicId
      })
    }
  )
)
