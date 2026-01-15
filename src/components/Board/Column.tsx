import { Box, Typography, Paper, Chip } from '@mui/material'
import { Story, StoryStatus } from '../../types'
import StoryCard from '../StoryCard/StoryCard'

interface ColumnProps {
  status: StoryStatus
  label: string
  color: string
  stories: Story[]
}

// status is part of the interface for type checking but not directly used in rendering

export default function Column({ status: _status, label, color, stories }: ColumnProps) {
  void _status // Used for type discrimination
  return (
    <Paper
      elevation={0}
      sx={{
        width: 300,
        flexShrink: 0,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
        border: 1,
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          px: 2,
          py: 1.5,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5
        }}
      >
        <Box
          sx={{
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: color
          }}
        />
        <Typography
          variant="subtitle2"
          fontWeight={600}
          sx={{ flex: 1, color: 'text.primary' }}
        >
          {label}
        </Typography>
        <Chip
          label={stories.length}
          size="small"
          sx={{
            height: 22,
            minWidth: 28,
            bgcolor: 'action.hover',
            fontWeight: 600,
            fontSize: '0.75rem'
          }}
        />
      </Box>

      {/* Stories List */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          p: 1.5,
          '&::-webkit-scrollbar': {
            width: 6
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent'
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: 'transparent',
            borderRadius: 3,
            transition: 'background-color 0.2s'
          },
          '&:hover::-webkit-scrollbar-thumb': {
            bgcolor: 'action.disabled'
          },
          '&:hover::-webkit-scrollbar-thumb:hover': {
            bgcolor: 'action.active'
          }
        }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
          }}
        >
          {stories.length === 0 ? (
            <Box
              sx={{
                py: 4,
                textAlign: 'center'
              }}
            >
              <Typography variant="body2" color="text.secondary">
                No stories
              </Typography>
            </Box>
          ) : (
            stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))
          )}
        </Box>
      </Box>
    </Paper>
  )
}
