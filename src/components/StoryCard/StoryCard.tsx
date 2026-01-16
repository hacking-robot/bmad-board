import { useState, useEffect } from 'react'
import { Card, CardContent, Typography, Box, Chip, Button, CircularProgress, Tooltip, IconButton, Menu, Snackbar } from '@mui/material'
import DescriptionIcon from '@mui/icons-material/Description'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import RateReviewIcon from '@mui/icons-material/RateReview'
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import PersonIcon from '@mui/icons-material/Person'
import GitHubIcon from '@mui/icons-material/GitHub'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import AutorenewIcon from '@mui/icons-material/Autorenew'
import { Story, EPIC_COLORS } from '../../types'
import { useStore } from '../../store'
import { useWorkflow } from '../../hooks/useWorkflow'
import GitDiffDialog from '../GitDiffDialog'

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
  const [branchExists, setBranchExists] = useState(false)
  const [isActivelyWorking, setIsActivelyWorking] = useState(false)
  const [diffDialogOpen, setDiffDialogOpen] = useState(false)

  // Check if the story's branch exists and has recent activity
  useEffect(() => {
    const checkBranchStatus = async () => {
      if (!projectPath) {
        setBranchExists(false)
        setIsActivelyWorking(false)
        return
      }

      try {
        // Branch name format: epicId-storyId
        const fullBranchName = `${story.epicId}-${story.id}`

        // Check if branch exists
        const existsResult = await window.gitAPI.branchExists(projectPath, fullBranchName)
        setBranchExists(existsResult.exists)

        // If branch exists, check for activity
        if (existsResult.exists) {
          const activityResult = await window.gitAPI.getBranchActivity(projectPath, fullBranchName)
          setIsActivelyWorking(activityResult.isActive)
        } else {
          setIsActivelyWorking(false)
        }
      } catch {
        setBranchExists(false)
        setIsActivelyWorking(false)
      }
    }

    checkBranchStatus()

    // Re-check activity periodically (every 15 seconds) for active stories
    let interval: NodeJS.Timeout | null = null
    if ((story.status === 'in-progress' || story.status === 'review') && projectPath) {
      interval = setInterval(checkBranchStatus, 15000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [projectPath, story.id, story.status])

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

  const handleCopySingle = (command: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation()
    }
    navigator.clipboard.writeText(command)
    setSnackbarMessage(`Copied: ${command.length > 40 ? command.substring(0, 40) + '...' : command}`)
    setSnackbarOpen(true)
  }

  // Generate branch name: epicId-storyId (e.g., "1-1-6-load-built-in-chips-not")
  const branchName = `${story.epicId}-${story.id}`
  const gitBranchCommand = `git checkout -b "${branchName}"`

  // Git commands for committing (combined add + commit)
  const gitCommitImplementation = `git add . && git commit -m "feat(${branchName}): implement story ${story.epicId}.${story.storyNumber}"`
  const gitCommitComplete = `git add . && git commit -m "feat(${branchName}): complete story ${story.epicId}.${story.storyNumber}"`
  const gitCommitCommand = story.status === 'review' ? gitCommitImplementation : gitCommitComplete

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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flex: 1 }}>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 500, cursor: 'help' }}
                >
                  {story.epicId}.{story.storyNumber}
                </Typography>
                {/* Spinning icon: shows for in-progress/review when agent running OR recent git activity (last 1 min) */}
                {(story.status === 'in-progress' || story.status === 'review') && (runningAgent || isActivelyWorking) && (
                  <Tooltip title={runningAgent ? 'Agent running' : 'Recent git activity'} arrow placement="top">
                    <AutorenewIcon
                      sx={{
                        fontSize: 14,
                        color: runningAgent ? 'success.main' : story.status === 'review' ? 'info.main' : 'warning.main',
                        animation: 'spin 2s linear infinite',
                        '@keyframes spin': {
                          '0%': { transform: 'rotate(0deg)' },
                          '100%': { transform: 'rotate(360deg)' }
                        }
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
            </Tooltip>

            {/* Quick Actions Menu Button */}
            {nextSteps.length > 0 && (
              <Tooltip title="Next steps" arrow placement="top">
                <IconButton
                  size="small"
                  onClick={handleMenuOpen}
                  sx={{
                    p: 0.25,
                    bgcolor: 'primary.main',
                    color: 'white',
                    borderRadius: 1,
                    '&:hover': {
                      bgcolor: 'primary.dark'
                    }
                  }}
                >
                  <KeyboardArrowRightIcon sx={{ fontSize: 16 }} />
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

          {/* Git Diff Icon - only shows when story's branch exists */}
          {branchExists && (
            <Tooltip title="View branch diff" arrow placement="top">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation()
                  setDiffDialogOpen(true)
                }}
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  bgcolor: 'success.main',
                  color: 'white',
                  p: 0.5,
                  '&:hover': {
                    bgcolor: 'success.dark'
                  }
                }}
              >
                <CompareArrowsIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
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
            sx: { minWidth: 320, maxWidth: 400 }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" fontWeight={600}>
            Next Steps
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Click copy buttons individually
          </Typography>
        </Box>

        {/* Git Branch Command - Only for ready-for-dev */}
        {story.status === 'ready-for-dev' && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <GitHubIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>
                Create Branch
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  px: 1,
                  py: 0.5,
                  borderRadius: 0.5,
                  flex: 1,
                  wordBreak: 'break-all'
                }}
              >
                {gitBranchCommand}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => handleCopySingle(gitBranchCommand, e)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        )}

        {/* Git Commit Command - For review (commit implementation) and done (complete) */}
        {(story.status === 'review' || story.status === 'done') && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <GitHubIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500}>
                {story.status === 'review' ? 'Commit Implementation' : 'Commit & Complete'}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.7rem',
                  color: 'text.primary',
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: 'divider',
                  px: 1,
                  py: 0.5,
                  borderRadius: 0.5,
                  flex: 1,
                  wordBreak: 'break-all'
                }}
              >
                {gitCommitCommand}
              </Typography>
              <IconButton
                size="small"
                onClick={(e) => handleCopySingle(gitCommitCommand, e)}
                sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
              >
                <ContentCopyIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          </Box>
        )}

        {nextSteps.map((step, index) => {
          const agent = getAgent(step.agentId)
          return (
            <Box
              key={index}
              sx={{ px: 2, py: 1.5, borderBottom: index < nextSteps.length - 1 ? 1 : 0, borderColor: 'divider' }}
            >
              {/* Step Header */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <PersonIcon sx={{ fontSize: 18, color: agent?.color || 'text.secondary' }} />
                <Typography variant="body2" fontWeight={500}>
                  {step.label}
                </Typography>
                {step.primary && (
                  <Chip label="Primary" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1, ml: 3.25 }}>
                {agent?.role} ({agent?.name})
              </Typography>

              {/* Agent invocation command */}
              {agent?.commands?.[0] && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, ml: 3.25 }}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', minWidth: 16 }}>
                    1.
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      color: agent?.color || 'text.secondary',
                      bgcolor: 'action.hover',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.5,
                      flex: 1,
                      wordBreak: 'break-all'
                    }}
                  >
                    {agent.commands[0]}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopySingle(agent.commands[0], e)}
                    sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}

              {/* Workflow command */}
              {step.command && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 3.25 }}>
                  <Typography variant="caption" color="text.disabled" sx={{ fontSize: '0.65rem', minWidth: 16 }}>
                    2.
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'monospace',
                      fontSize: '0.7rem',
                      color: 'primary.main',
                      bgcolor: 'action.hover',
                      px: 0.75,
                      py: 0.25,
                      borderRadius: 0.5,
                      flex: 1,
                      wordBreak: 'break-all'
                    }}
                  >
                    {step.command} {story.id}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopySingle(`${step.command} ${story.id}`, e)}
                    sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                  >
                    <ContentCopyIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                </Box>
              )}
            </Box>
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

      {/* Git Diff Dialog */}
      <GitDiffDialog
        open={diffDialogOpen}
        onClose={() => setDiffDialogOpen(false)}
        branchName={story.id}
      />
    </>
  )
}
