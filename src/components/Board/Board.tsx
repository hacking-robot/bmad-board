import { useMemo } from 'react'
import { Box, CircularProgress, Typography, Alert } from '@mui/material'
import { useStore } from '../../store'
import { STATUS_COLUMNS } from '../../types'
import Column from './Column'

export default function Board() {
  const loading = useStore((state) => state.loading)
  const error = useStore((state) => state.error)
  const allStories = useStore((state) => state.stories)
  const selectedEpicId = useStore((state) => state.selectedEpicId)
  const searchQuery = useStore((state) => state.searchQuery)
  const collapsedColumns = useStore((state) => state.collapsedColumns)
  const toggleColumnCollapse = useStore((state) => state.toggleColumnCollapse)

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
  )
}
