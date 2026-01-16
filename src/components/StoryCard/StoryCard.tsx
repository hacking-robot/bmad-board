import { useState, useEffect } from 'react'
import { Card, CardContent, Typography, Box, Chip, Button, CircularProgress, Tooltip, IconButton, Menu, Snackbar } from '@mui/material'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import ChecklistIcon from '@mui/icons-material/Checklist'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { Story, EPIC_COLORS } from '../../types'
import { useStore } from '../../store'
import { useWorkflow } from '../../hooks/useWorkflow'
import GitDiffDialog from '../GitDiffDialog'

interface StoryCardProps {
  story: Story
  isDragging?: boolean
}

export default function StoryCard({ story, isDragging = false }: StoryCardProps) {
  const setSelectedStory = useStore((state) => state.setSelectedStory)
  const projectPath = useStore((state) => state.projectPath)
  const addAgent = useStore((state) => state.addAgent)
  const setActiveAgent = useStore((state) => state.setActiveAgent)
  const setAgentPanelOpen = useStore((state) => state.setAgentPanelOpen)
  const agents = useStore((state) => state.agents)
  const enableAgents = useStore((state) => state.enableAgents)
  const humanReviewChecklist = useStore((state) => state.humanReviewChecklist)
  const humanReviewStates = useStore((state) => state.humanReviewStates)
  const getEffectiveStatus = useStore((state) => state.getEffectiveStatus)
  const aiTool = useStore((state) => state.aiTool)

  // Transform command based on selected AI tool
  // Claude Code uses /command, others use *command (universal)
  const transformCommand = (command: string | null | undefined): string => {
    if (!command) return ''
    if (aiTool === 'claude-code') {
      // Claude Code uses slash commands as-is
      return command
    }
    // For other tools, replace leading / with * (universal command syntax)
    return command.replace(/^\//, '*')
  }

  const { getNextSteps, getAgent, getPrimaryNextStep } = useWorkflow()

  // Get effective status (may be overridden to 'human-review' at app level)
  const effectiveStatus = getEffectiveStatus(story)

  // Human review progress
  const reviewState = humanReviewStates[story.id]
  const checkedCount = reviewState?.checkedItems.length || 0
  const totalItems = humanReviewChecklist.length
  const allApproved = checkedCount === totalItems && totalItems > 0

  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)
  const [snackbarMessage, setSnackbarMessage] = useState('')
  const [branchExists, setBranchExists] = useState(false)
  const [isActivelyWorking, setIsActivelyWorking] = useState(false)
  const [diffDialogOpen, setDiffDialogOpen] = useState(false)
  const [committing, setCommitting] = useState(false)

  // Get git state from store (reactive)
  const currentBranch = useStore((state) => state.currentBranch)
  const hasUncommittedChanges = useStore((state) => state.hasUncommittedChanges)
  const setHasUncommittedChanges = useStore((state) => state.setHasUncommittedChanges)

  // Compute if we're on this story's branch (derived from store state)
  const storyBranchName = `${story.epicId}-${story.id}`
  const isOnStoryBranch = currentBranch === storyBranchName

  // Make card sortable (draggable + reorderable)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging: isBeingDragged } = useSortable({
    id: story.id
  })
  const dragStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isBeingDragged ? 1000 : undefined
  }

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
  }, [projectPath, story.epicId, story.id, story.status])

  const epicColor = EPIC_COLORS[(story.epicId - 1) % EPIC_COLORS.length]
  const nextSteps = getNextSteps(effectiveStatus)
  const primaryStep = getPrimaryNextStep(effectiveStatus)
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
  const gitCommitMessageImpl = `feat(${branchName}): implement story ${story.epicId}.${story.storyNumber}`
  const gitCommitMessageComplete = `feat(${branchName}): complete story ${story.epicId}.${story.storyNumber}`
  const gitCommitMessage = effectiveStatus === 'review' ? gitCommitMessageImpl : gitCommitMessageComplete
  const gitCommitCommand = `git add . && git commit -m "${gitCommitMessage}"`

  // Handle commit action
  const handleCommit = async (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!projectPath) return

    setCommitting(true)
    try {
      const result = await window.gitAPI.commit(projectPath, gitCommitMessage)
      if (result.success) {
        setHasUncommittedChanges(false)
        setSnackbarMessage('Changes committed successfully')
        setSnackbarOpen(true)
        handleMenuClose()
      } else {
        setSnackbarMessage(result.error || 'Failed to commit')
        setSnackbarOpen(true)
      }
    } catch {
      setSnackbarMessage('Failed to commit changes')
      setSnackbarOpen(true)
    } finally {
      setCommitting(false)
    }
  }

  // Generate git commit command based on command name
  const getAgentGitCommand = (command: string): string => {
    // Remove leading * or / and get just the last part after colon
    const cleanCommand = command.replace(/^[*\/]/, '')
    const actionPart = cleanCommand.includes(':') ? cleanCommand.split(':').pop()! : cleanCommand

    const cmdLower = actionPart.toLowerCase()
    let commitType = 'chore'

    // Determine commit type from command name
    if (cmdLower.includes('implement') || cmdLower.includes('feature') || cmdLower.includes('quick')) {
      commitType = 'feat'
    } else if (cmdLower.includes('review') || cmdLower.includes('fix')) {
      commitType = 'fix'
    } else if (cmdLower.includes('test') || cmdLower.includes('playtest')) {
      commitType = 'test'
    } else if (cmdLower.includes('doc') || cmdLower.includes('prd') || cmdLower.includes('draft') || cmdLower.includes('arch')) {
      commitType = 'docs'
    } else if (cmdLower.includes('ux') || cmdLower.includes('design') || cmdLower.includes('style')) {
      commitType = 'style'
    }

    return `git add . && git commit -m "${commitType}(${branchName}): ${actionPart} story ${story.epicId}.${story.storyNumber}"`
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
        ref={setNodeRef}
        elevation={0}
        sx={{
          border: 1,
          borderColor: runningAgent ? 'success.main' : isDragging ? 'primary.main' : 'divider',
          position: 'relative',
          cursor: isDragging ? 'grabbing' : 'pointer',
          // Hide the original card when being dragged (DragOverlay shows the copy)
          opacity: isBeingDragged ? 0.3 : isDragging ? 0.9 : 1,
          boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.2)' : 'none',
          '&:hover': {
            borderColor: runningAgent ? 'success.main' : 'primary.main',
            transform: isDragging ? 'none' : 'translateY(-2px)',
            boxShadow: isDragging ? '0 8px 20px rgba(0,0,0,0.2)' : '0 4px 12px rgba(0,0,0,0.1)'
          },
          ...dragStyle,
          // Override transition for non-drag states to keep hover effects smooth
          transition: isBeingDragged ? dragStyle.transition : 'all 0.15s ease'
        }}
        onClick={handleClick}
      >
        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
          {/* Header: Epic Badge + Story ID + Quick Actions Menu */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            {/* Drag Handle */}
            <Box
              {...attributes}
              {...listeners}
              sx={{
                display: 'flex',
                alignItems: 'center',
                cursor: 'grab',
                color: 'text.disabled',
                ml: -0.5,
                mr: -0.5,
                '&:hover': { color: 'text.secondary' },
                '&:active': { cursor: 'grabbing' }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <DragIndicatorIcon sx={{ fontSize: 18 }} />
            </Box>
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
                {(effectiveStatus === 'in-progress' || effectiveStatus === 'review') && (runningAgent || isActivelyWorking) && (
                  <Tooltip title={runningAgent ? 'Agent running' : 'Recent git activity'} arrow placement="top">
                    <AutorenewIcon
                      sx={{
                        fontSize: 14,
                        color: runningAgent ? 'success.main' : effectiveStatus === 'review' ? 'info.main' : 'warning.main',
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

          {/* Human Review Progress Badge - only shows for human-review status */}
          {effectiveStatus === 'human-review' && totalItems > 0 && (
            <Tooltip
              title={allApproved ? 'All items approved' : `${checkedCount}/${totalItems} reviewed`}
              arrow
              placement="top"
            >
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 8,
                  right: branchExists ? 36 : 8,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  bgcolor: allApproved ? 'success.main' : 'warning.main',
                  color: 'white',
                  px: 0.75,
                  py: 0.25,
                  borderRadius: 1,
                  fontSize: '0.7rem'
                }}
              >
                {allApproved ? (
                  <CheckCircleOutlineIcon sx={{ fontSize: 14 }} />
                ) : (
                  <>
                    <ChecklistIcon sx={{ fontSize: 14 }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: 'inherit', lineHeight: 1 }}>
                      {checkedCount}/{totalItems}
                    </Typography>
                  </>
                )}
              </Box>
            </Tooltip>
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
        {effectiveStatus === 'ready-for-dev' && (
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

        {/* Git Commit Command - For review (commit implementation) and done (complete) - only when on story branch with uncommitted changes */}
        {(effectiveStatus === 'review' || effectiveStatus === 'done') && isOnStoryBranch && hasUncommittedChanges && (
          <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <GitHubIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
              <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                {effectiveStatus === 'review' ? 'Commit Implementation' : 'Commit & Complete'}
              </Typography>
              <Button
                size="small"
                variant="contained"
                onClick={handleCommit}
                disabled={committing}
                startIcon={committing ? <CircularProgress size={12} color="inherit" /> : undefined}
                sx={{ fontSize: '0.7rem', py: 0.25, px: 1, minWidth: 0 }}
              >
                {committing ? 'Committing...' : 'Commit'}
              </Button>
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
              <Tooltip title="Copy command">
                <IconButton
                  size="small"
                  onClick={(e) => handleCopySingle(gitCommitCommand, e)}
                  sx={{ color: 'text.secondary', '&:hover': { color: 'primary.main' } }}
                >
                  <ContentCopyIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
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
                <Typography variant="body2" fontWeight={500} sx={{ flex: 1 }}>
                  {step.label}
                </Typography>
                {step.primary && (
                  <Chip label="Primary" size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                )}
                {step.command && isOnStoryBranch && hasUncommittedChanges && (
                  <Tooltip title={`Copy git commit for ${transformCommand(step.command)}`}>
                    <IconButton
                      size="small"
                      onClick={(e) => handleCopySingle(getAgentGitCommand(step.command), e)}
                      sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                    >
                      <GitHubIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
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
                    {transformCommand(agent.commands[0])}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopySingle(transformCommand(agent.commands[0]), e)}
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
                    {transformCommand(step.command)} {story.id}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleCopySingle(`${transformCommand(step.command)} ${story.id}`, e)}
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
        branchName={branchName}
      />
    </>
  )
}
