import { useMemo, useState } from 'react'
import { Box, CircularProgress, Typography, Alert, Snackbar } from '@mui/material'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin } from '@dnd-kit/core'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'
import { STATUS_COLUMNS, Story, StoryStatus } from '../../types'
import Column from './Column'
import StoryCard from '../StoryCard/StoryCard'

export default function Board() {
  const loading = useStore((state) => state.loading)
  const error = useStore((state) => state.error)
  const allStories = useStore((state) => state.stories)
  const selectedEpicId = useStore((state) => state.selectedEpicId)
  const searchQuery = useStore((state) => state.searchQuery)
  const collapsedColumnsByEpic = useStore((state) => state.collapsedColumnsByEpic)
  const toggleColumnCollapse = useStore((state) => state.toggleColumnCollapse)
  const setIsUserDragging = useStore((state) => state.setIsUserDragging)
  const { loadProjectData } = useProjectData()

  // Drag and drop state
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    const story = allStories.find((s) => s.id === active.id)
    if (story) {
      setActiveStory(story)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveStory(null)

    if (!over) return

    const storyId = active.id as string
    const newStatus = over.id as StoryStatus
    const story = allStories.find((s) => s.id === storyId)

    if (!story || story.status === newStatus) return

    // Update the story status in sprint-status.yaml
    if (story.filePath) {
      // Set flag to prevent notification for user's own drag action
      setIsUserDragging(true)
      const result = await window.fileAPI.updateStoryStatus(story.filePath, newStatus)
      if (result.success) {
        setSnackbarMessage(`Moved "${story.title}" to ${newStatus}`)
        setSnackbarOpen(true)
        // Refresh stories to reflect the change
        loadProjectData()
      } else {
        setSnackbarMessage(`Failed to update status: ${result.error}`)
        setSnackbarOpen(true)
        setIsUserDragging(false)
      }
    } else {
      setSnackbarMessage('Cannot update story without a file path')
      setSnackbarOpen(true)
    }
  }

  // Get collapsed columns for current epic
  const collapsedColumns = useMemo(() => {
    const epicKey = selectedEpicId === null ? 'all' : String(selectedEpicId)
    return collapsedColumnsByEpic[epicKey] || []
  }, [collapsedColumnsByEpic, selectedEpicId])

  // Filter stories reactively when filter state changes
  const stories = useMemo(() => {
    let filtered = allStories

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
  }, [allStories, selectedEpicId, searchQuery])

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: 2
        }}
      >
        <CircularProgress size={24} />
        <Typography color="text.secondary">Loading project...</Typography>
      </Box>
    )
  }

  if (error) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    )
  }

  // Filter out 'optional' status which is only for retrospectives
  const displayColumns = STATUS_COLUMNS.filter((col) => col.status !== 'optional')

  return (
    <DndContext
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            gap: 2,
            p: 2,
            overflowX: 'auto',
            overflowY: 'hidden',
            '&::-webkit-scrollbar': {
              height: 8
            },
            '&::-webkit-scrollbar-track': {
              bgcolor: 'action.hover',
              borderRadius: 4
            },
            '&::-webkit-scrollbar-thumb': {
              bgcolor: 'action.disabled',
              borderRadius: 4,
              '&:hover': {
                bgcolor: 'action.active'
              }
            }
          }}
        >
          {displayColumns.map((column) => {
            const columnStories = stories.filter((s) => s.status === column.status)

            return (
              <Column
                key={column.status}
                status={column.status}
                label={column.label}
                color={column.color}
                stories={columnStories}
                isCollapsed={collapsedColumns.includes(column.status)}
                onToggleCollapse={() => toggleColumnCollapse(column.status)}
              />
            )
          })}
        </Box>
      </Box>

      {/* Drag Overlay - shows the card being dragged */}
      <DragOverlay>
        {activeStory ? (
          <Box sx={{ opacity: 0.8, transform: 'rotate(3deg)' }}>
            <StoryCard story={activeStory} isDragging />
          </Box>
        ) : null}
      </DragOverlay>

      {/* Status change notification */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </DndContext>
  )
}
