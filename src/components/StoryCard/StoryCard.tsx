import { Card, CardActionArea, CardContent, Typography, Box, Chip } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import { Story, EPIC_COLORS } from '../../types'
import { useStore } from '../../store'

interface StoryCardProps {
  story: Story
}

export default function StoryCard({ story }: StoryCardProps) {
  const setSelectedStory = useStore((state) => state.setSelectedStory)
  const epicColor = EPIC_COLORS[(story.epicId - 1) % EPIC_COLORS.length]

  const handleClick = () => {
    setSelectedStory(story)
  }

  return (
    <Card
      elevation={0}
      sx={{
        border: 1,
        borderColor: 'divider',
        transition: 'all 0.15s ease',
        '&:hover': {
          borderColor: 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }
      }}
    >
      <CardActionArea onClick={handleClick}>
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Epic Badge */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Chip
              label={`Epic ${story.epicId}`}
              size="small"
              sx={{
                height: 20,
                fontSize: '0.7rem',
                fontWeight: 600,
                bgcolor: epicColor,
                color: 'white',
                '& .MuiChip-label': {
                  px: 1
                }
              }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 500 }}
            >
              {story.epicId}.{story.storyNumber}
            </Typography>
          </Box>

          {/* Story Title */}
          <Typography
            variant="body2"
            sx={{
              fontWeight: 500,
              color: 'text.primary',
              lineHeight: 1.4,
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}
          >
            {story.title}
          </Typography>

          {/* File indicator */}
          {story.filePath && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                mt: 1.5,
                color: 'text.secondary'
              }}
            >
              <DescriptionIcon sx={{ fontSize: 14 }} />
              <Typography variant="caption">Story file available</Typography>
            </Box>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  )
}
