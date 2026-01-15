import { Box, Typography, Paper, Chip, IconButton, Tooltip } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { Story, StoryStatus } from '../../types'
import StoryCard from '../StoryCard/StoryCard'

interface ColumnProps {
  status: StoryStatus
  label: string
  color: string
  stories: Story[]
  isCollapsed?: boolean
  onToggleCollapse?: () => void
}

export default function Column({
  status: _status,
  label,
  color,
  stories,
  isCollapsed = false,
  onToggleCollapse
}: ColumnProps) {
  void _status // Used for type discrimination

  // Collapsed view - thin vertical bar
  if (isCollapsed) {
    return (
      <Paper
        elevation={0}
        onClick={onToggleCollapse}
        sx={{
          width: 48,
          flexShrink: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          bgcolor: 'background.default',
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all 0.2s ease',
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        {/* Collapsed Header */}
        <Box
          sx={{
            py: 1.5,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 1
          }}
        >
          <ChevronRightIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
          <Box
            sx={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              bgcolor: color
            }}
          />
          <Chip
            label={stories.length}
            size="small"
            sx={{
              height: 20,
              minWidth: 24,
              bgcolor: 'action.hover',
              fontWeight: 600,
              fontSize: '0.7rem',
              '& .MuiChip-label': { px: 0.75 }
            }}
          />
        </Box>

        {/* Rotated Label */}
        <Typography
          variant="caption"
          fontWeight={600}
          sx={{
            writingMode: 'vertical-rl',
            textOrientation: 'mixed',
            transform: 'rotate(180deg)',
            color: 'text.secondary',
            mt: 1,
            letterSpacing: '0.05em'
          }}
        >
          {label}
        </Typography>
      </Paper>
    )
  }

  // Expanded view
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
        overflow: 'hidden',
        transition: 'width 0.2s ease'
      }}
    >
      {/* Column Header */}
      <Box
        sx={{
          px: 1.5,
          py: 1,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1
        }}
      >
        <Tooltip title="Collapse column">
          <IconButton
            size="small"
            onClick={onToggleCollapse}
            sx={{
              p: 0.25,
              color: 'text.secondary',
              '&:hover': { color: 'text.primary' }
            }}
          >
            <ChevronLeftIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
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
