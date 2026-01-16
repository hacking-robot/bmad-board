import { useMemo, useState } from 'react'
import { Box, CircularProgress, Typography, Alert, Snackbar } from '@mui/material'
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
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
  const storyOrder = useStore((state) => state.storyOrder)
  const setStoryOrder = useStore((state) => state.setStoryOrder)
  const enableHumanReviewColumn = useStore((state) => state.enableHumanReviewColumn)
  const humanReviewStories = useStore((state) => state.humanReviewStories)
  const addToHumanReview = useStore((state) => state.addToHumanReview)
  const removeFromHumanReview = useStore((state) => state.removeFromHumanReview)
  const getEffectiveStatus = useStore((state) => state.getEffectiveStatus)
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
    const story = allStories.find((s) => s.id === storyId)
    if (!story) return

    const overId = over.id as string
    const epicKey = selectedEpicId === null ? 'all' : String(selectedEpicId)

    // Check if we're dropping on another story (reorder within same column)
    const overStory = allStories.find((s) => s.id === overId)
    const storyEffectiveStatus = getEffectiveStatus(story)

    if (overStory && getEffectiveStatus(overStory) === storyEffectiveStatus) {
      // Reorder within the same column
      const status = storyEffectiveStatus
      const columnStories = allStories
        .filter((s) => getEffectiveStatus(s) === status)
        .filter((s) => selectedEpicId === null || s.epicId === selectedEpicId)

      // Get current order or create from existing stories
      const currentOrder = storyOrder[epicKey]?.[status] || columnStories.map(s => s.id)

      // Ensure all stories in column are in the order array
      const allIds = columnStories.map(s => s.id)
      const orderedIds = currentOrder.filter(id => allIds.includes(id))
      const missingIds = allIds.filter(id => !orderedIds.includes(id))
      const fullOrder = [...orderedIds, ...missingIds]

      const oldIndex = fullOrder.indexOf(storyId)
      const newIndex = fullOrder.indexOf(overId)

      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const newOrder = arrayMove(fullOrder, oldIndex, newIndex)
        setStoryOrder(epicKey, status, newOrder)
      }
      return
    }

    // Check if we're dropping on a column (status change)
    // Only allow dropping on visible columns
    const validStatuses: string[] = STATUS_COLUMNS
      .filter(c => c.status !== 'optional')
      .filter(c => c.status !== 'human-review' || enableHumanReviewColumn)
      .map(c => c.status)
    if (validStatuses.includes(overId)) {
      const newStatus = overId as StoryStatus
      const currentEffectiveStatus = getEffectiveStatus(story)
      if (currentEffectiveStatus === newStatus) return

      // Handle human-review as app-level status (not written to BMAD)
      if (newStatus === 'human-review') {
        // Moving TO human-review: just add to app-level list
        addToHumanReview(story.id)
        setSnackbarMessage(`Moved "${story.title}" to Human Review`)
        setSnackbarOpen(true)
        return
      }

      // If moving FROM human-review to another status
      const wasInHumanReview = humanReviewStories.includes(story.id)
      if (wasInHumanReview) {
        removeFromHumanReview(story.id)
      }

      // Update the story status in sprint-status.yaml (for real BMAD statuses)
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
          // Re-add to human review if the update failed and it was there before
          if (wasInHumanReview) {
            addToHumanReview(story.id)
          }
        }
      } else {
        setSnackbarMessage('Cannot update story without a file path')
        setSnackbarOpen(true)
        // Re-add to human review if no file path and it was there before
        if (wasInHumanReview) {
          addToHumanReview(story.id)
        }
      }
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

  // Filter out 'optional' status and conditionally filter 'human-review'
  const displayColumns = STATUS_COLUMNS.filter((col) => {
    if (col.status === 'optional') return false
    if (col.status === 'human-review' && !enableHumanReviewColumn) return false
    return true
  })

  // Helper to sort stories by persisted order
  const sortStoriesByOrder = (columnStories: Story[], status: StoryStatus): Story[] => {
    const epicKey = selectedEpicId === null ? 'all' : String(selectedEpicId)
    const order = storyOrder[epicKey]?.[status]

    if (!order || order.length === 0) {
      return columnStories
    }

    // Sort by order, with stories not in order array at the end
    return [...columnStories].sort((a, b) => {
      const indexA = order.indexOf(a.id)
      const indexB = order.indexOf(b.id)

      // Stories not in order go to the end
      if (indexA === -1 && indexB === -1) return 0
      if (indexA === -1) return 1
      if (indexB === -1) return -1

      return indexA - indexB
    })
  }

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
            const columnStories = stories.filter((s) => getEffectiveStatus(s) === column.status)
            const sortedStories = sortStoriesByOrder(columnStories, column.status)

            return (
              <Column
                key={column.status}
                status={column.status}
                label={column.label}
                color={column.color}
                stories={sortedStories}
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
