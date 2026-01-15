import { Card, CardContent, Typography, Box, Chip, Button, CircularProgress } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import RateReviewIcon from '@mui/icons-material/RateReview'
import { Story, EPIC_COLORS, AGENT_ACTIONS } from '../../types'
import { useStore } from '../../store'

const ENABLE_AGENTS = import.meta.env.VITE_ENABLE_AGENTS !== 'false'

interface StoryCardProps {
  story: Story
}

export default function StoryCard({ story }: StoryCardProps) {
  const setSelectedStory = useStore((state) => state.setSelectedStory)
  const projectPath = useStore((state) => state.projectPath)
  const addAgent = useStore((state) => state.addAgent)
  const setActiveAgent = useStore((state) => state.setActiveAgent)
  const setAgentPanelOpen = useStore((state) => state.setAgentPanelOpen)
  const agents = useStore((state) => state.agents)

  const epicColor = EPIC_COLORS[(story.epicId - 1) % EPIC_COLORS.length]
  const agentAction = AGENT_ACTIONS[story.status]
  const runningAgent = Object.values(agents).find((a) => a.storyId === story.id && a.status === 'running')

  const handleClick = () => {
    setSelectedStory(story)
  }

  const handleAgentAction = async (e: React.MouseEvent) => {
    e.stopPropagation()
    console.log('handleAgentAction clicked', { projectPath, agentAction, story: story.id })

    if (!projectPath || !agentAction) {
      console.log('Missing projectPath or agentAction')
      return
    }

    // If agent is already running for this story, just show it
    if (runningAgent) {
      setActiveAgent(runningAgent.id)
      setAgentPanelOpen(true)
      return
    }

    try {
      console.log('Calling spawnAgent...')
      const result = await window.agentAPI.spawnAgent({
        storyId: story.id,
        storyTitle: story.title,
        projectPath,
        initialPrompt: agentAction.command ? `${agentAction.command} ${story.id}` : ''
      })
      console.log('spawnAgent result:', result)

      if (result.success && result.agentId) {
        // Add agent to store
        addAgent({
          id: result.agentId,
          storyId: story.id,
          storyTitle: story.title,
          command: agentAction.command,
          status: 'running',
          output: [],
          startTime: Date.now()
        })

        // Open the agent panel and set this as active
        setActiveAgent(result.agentId)
        setAgentPanelOpen(true)
      }
    } catch (error) {
      console.error('Failed to spawn agent:', error)
    }
  }

  const getActionIcon = () => {
    if (!agentAction) return null
    switch (agentAction.icon) {
      case 'play':
        return <PlayArrowIcon sx={{ fontSize: 16 }} />
      case 'continue':
        return <PlayCircleOutlineIcon sx={{ fontSize: 16 }} />
      case 'review':
        return <RateReviewIcon sx={{ fontSize: 16 }} />
      default:
        return <PlayArrowIcon sx={{ fontSize: 16 }} />
    }
  }

  return (
    <Card
      elevation={0}
      sx={{
        border: 1,
        borderColor: runningAgent ? 'success.main' : 'divider',
        transition: 'all 0.15s ease',
        position: 'relative',
        cursor: 'pointer',
        '&:hover': {
          borderColor: runningAgent ? 'success.main' : 'primary.main',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }
      }}
      onClick={handleClick}
    >
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

        {/* Agent Action Button */}
        {ENABLE_AGENTS && agentAction && (
          <Box sx={{ mt: 1.5 }}>
            <Button
              size="small"
              variant={runningAgent ? 'contained' : 'outlined'}
              color={runningAgent ? 'success' : 'primary'}
              onClick={handleAgentAction}
              startIcon={runningAgent ? <CircularProgress size={14} color="inherit" /> : getActionIcon()}
              sx={{
                fontSize: '0.75rem',
                py: 0.5,
                px: 1.5,
                textTransform: 'none'
              }}
            >
              {runningAgent ? 'View Agent' : agentAction.label}
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
