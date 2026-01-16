import { useState } from 'react'
import { Card, CardContent, Typography, Box, Chip, Button, CircularProgress, Tooltip, IconButton, Menu, MenuItem, ListItemText, ListItemIcon, Snackbar } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import RateReviewIcon from '@mui/icons-material/RateReview'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PersonIcon from '@mui/icons-material/Person'
import { Story, EPIC_COLORS } from '../../types'
import { useStore } from '../../store'
import { useWorkflow } from '../../hooks/useWorkflow'

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
  const enableAgents = useStore((state) => state.enableAgents)

  const { getNextSteps, getAgent, getPrimaryNextStep } = useWorkflow()

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')

  const epicColor = EPIC_COLORS[(story.epicId - 1) % EPIC_COLORS.length]
  const nextSteps = getNextSteps(story.status)
  const primaryStep = getPrimaryNextStep(story.status)
  const runningAgent = Object.values(agents).find((a) => a.storyId === story.id && a.status === 'running')

  const handleClick = () => {
    setSelectedStory(story)
  }

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setMenuAnchor(e.currentTarget)
  }

  const handleMenuClose = () => {
    setMenuAnchor(null)
  }

  const handleCopyCommand = (agentCommand: string | undefined, workflowCommand: string | undefined) => {
    const parts: string[] = []
    if (agentCommand) {
      parts.push(agentCommand)
    }
    if (workflowCommand) {
      parts.push(`${workflowCommand} ${story.id}`)
    }

    if (parts.length > 0) {
      const textToCopy = parts.join('\n')
      navigator.clipboard.writeText(textToCopy)
      setSnackbarMessage(parts.length > 1 ? 'Copied both commands' : `Copied: ${parts[0]}`)
    }
    setSnackbarOpen(true)
    handleMenuClose()
  }

  const handleAgentAction = async (e: React.MouseEvent) => {
    e.stopPropagation()

    if (!projectPath || !primaryStep) {
      return
    }

    // If agent is already running for this story, just show it
    if (runningAgent) {
      setActiveAgent(runningAgent.id)
      setAgentPanelOpen(true)
      return
    }

    try {
      const result = await window.agentAPI.spawnAgent({
        storyId: story.id,
        storyTitle: story.title,
        projectPath,
        initialPrompt: primaryStep.command ? `${primaryStep.command} ${story.id}` : ''
      })

      if (result.success && result.agentId) {
        addAgent({
          id: result.agentId,
          storyId: story.id,
          storyTitle: story.title,
          command: primaryStep.command,
          status: 'running',
          output: [],
          startTime: Date.now()
        })

        setActiveAgent(result.agentId)
        setAgentPanelOpen(true)
      }
    } catch (error) {
      console.error('Failed to spawn agent:', error)
    }
  }

  const getActionIcon = (iconType?: string) => {
    switch (iconType) {
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
    <>
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
          {/* Header: Epic Badge + Story ID + Quick Actions Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Tooltip title="Epics group related stories into a theme" arrow placement="top">
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
            </Tooltip>
            <Tooltip title={`Story ${story.epicId}.${story.storyNumber} - Click card for details`} arrow placement="top">
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 500, cursor: 'help', flex: 1 }}
              >
                {story.epicId}.{story.storyNumber}
              </Typography>
            </Tooltip>

            {/* Quick Actions Menu Button */}
            {nextSteps.length > 0 && (
              <Tooltip title="Next steps" arrow placement="top">
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{
                    p: 0.5,
                    color: 'text.secondary',
                    '&:hover': { color: 'primary.main' }
                  }}
                >
                  <KeyboardArrowRightIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Tooltip>
            )}
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
            <Tooltip title="This story has a markdown file with full requirements and acceptance criteria" arrow placement="bottom">
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  mt: 1.5,
                  color: 'text.secondary',
                  cursor: 'help'
                }}
              >
                <DescriptionIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption">Story file available</Typography>
              </Box>
            </Tooltip>
          )}

          {/* Agent Action Button (only when agents enabled) */}
          {enableAgents && primaryStep && (
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
                {runningAgent ? 'View Agent' : primaryStep.label}
              </Button>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { minWidth: 280, maxWidth: 320 }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Next Steps
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click to copy commands
          </Typography>
        </Box>
        {nextSteps.map((step, index) => {
          const agent = getAgent(step.agentId)
          return (
            <MenuItem
              key={index}
              onClick={() => handleCopyCommand(agent?.commands?.[0], step.command)}
              sx={{ py: 1.5 }}
            >
              <ListItemIcon>
                <PersonIcon sx={{ color: agent?.color || 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {step.label}
                    </Typography>
                    {step.primary && (
                      <Chip label="Primary" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                    )}
                  </Box>
                }
                secondary={
                  <Box sx={{ mt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>
                      {agent?.role} ({agent?.name})
                    </Typography>
                    {/* Agent invocation command */}
                    {agent?.commands?.[0] && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.25 }}>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', minWidth: 16 }}>
                          1.
                        </Typography>
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: agent?.color || 'text.secondary',
                            bgcolor: 'action.hover',
                            px: 0.5,
                            py: 0.125,
                            borderRadius: 0.5,
                            wordBreak: 'break-all'
                          }}
                        >
                          {agent.commands[0]}
                        </Typography>
                      </Box>
                    )}
                    {/* Workflow command */}
                    {step.command && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', minWidth: 16 }}>
                          2.
                        </Typography>
                        <Typography
                          variant="caption"
                          component="span"
                          sx={{
                            fontFamily: 'monospace',
                            fontSize: '0.7rem',
                            color: 'primary.main',
                            bgcolor: 'action.hover',
                            px: 0.5,
                            py: 0.125,
                            borderRadius: 0.5,
                            wordBreak: 'break-all'
                          }}
                        >
                          {step.command}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                }
              />
              <ContentCopyIcon sx={{ fontSize: 16, color: 'text.disabled', ml: 1 }} />
            </MenuItem>
          )
        })}
      </Menu>

      {/* Copy Snackbar */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </>
  )
}
