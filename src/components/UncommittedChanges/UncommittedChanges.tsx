import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Tooltip,
  IconButton,
  Popover,
  Alert,
  Button,
  CircularProgress
} from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import CheckIcon from '@mui/icons-material/Check'
import CompareArrowsIcon from '@mui/icons-material/CompareArrows'
import { useStore } from '../../store'
import GitDiffDialog from '../GitDiffDialog'

export default function UncommittedChanges() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null)
  const [committing, setCommitting] = useState(false)
  const [commitError, setCommitError] = useState<string | null>(null)
  const [diffDialogOpen, setDiffDialogOpen] = useState(false)

  const projectPath = useStore((state) => state.projectPath)
  const stories = useStore((state) => state.stories)
  const currentBranch = useStore((state) => state.currentBranch)
  const hasChanges = useStore((state) => state.hasUncommittedChanges)
  const setCurrentBranch = useStore((state) => state.setCurrentBranch)
  const setHasUncommittedChanges = useStore((state) => state.setHasUncommittedChanges)

  // Parse branch name to find matching story
  // Branch format: epicId-storyId (e.g., "1-1-6-load-built-in-chips")
  const getStoryFromBranch = useCallback((branchName: string) => {
    // Try to match branch name pattern: epicId-storyId-...
    // The storyId format is like "1-6" which becomes "1-6-..." in branch
    for (const story of stories) {
      const storyBranchPrefix = `${story.epicId}-${story.id}`
      if (branchName === storyBranchPrefix || branchName.startsWith(`${storyBranchPrefix}-`)) {
        return story
      }
    }
    return null
  }, [stories])

  // Check for uncommitted changes
  const checkChanges = useCallback(async () => {
    if (!projectPath) {
      setHasUncommittedChanges(false)
      setCurrentBranch(null)
      return
    }

    try {
      const [changesResult, branchResult] = await Promise.all([
        window.gitAPI.hasChanges(projectPath),
        window.gitAPI.getCurrentBranch(projectPath)
      ])

      setHasUncommittedChanges(changesResult.hasChanges)
      setCurrentBranch(branchResult.branch || null)
    } catch {
      setHasUncommittedChanges(false)
      setCurrentBranch(null)
    }
  }, [projectPath, setCurrentBranch, setHasUncommittedChanges])

  // Poll for changes
  useEffect(() => {
    checkChanges()

    // Re-check every 5 seconds
    const interval = setInterval(checkChanges, 5000)

    return () => clearInterval(interval)
  }, [checkChanges])

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
    setCommitError(null)
  }

  const handleCopy = (command: string) => {
    navigator.clipboard.writeText(command)
    setCopiedCommand(command)
    setTimeout(() => setCopiedCommand(null), 2000)
  }

  // Don't render if no project or no changes
  if (!projectPath || !hasChanges || !currentBranch) {
    return null
  }

  const matchingStory = getStoryFromBranch(currentBranch)
  const branchName = currentBranch

  // Generate commit message based on story context
  const getCommitMessage = () => {
    if (matchingStory) {
      return `feat(${branchName}): update story ${matchingStory.epicId}.${matchingStory.storyNumber}`
    }
    return `chore(${branchName}): update`
  }

  const commitMessage = getCommitMessage()
  const commitCommand = `git add . && git commit -m "${commitMessage}"`

  const handleCommit = async () => {
    if (!projectPath) return

    setCommitting(true)
    setCommitError(null)

    try {
      const result = await window.gitAPI.commit(projectPath, commitMessage)
      if (result.success) {
        // Update store to notify all components
        setHasUncommittedChanges(false)
        handleClose()
      } else {
        setCommitError(result.error || 'Failed to commit')
      }
    } catch {
      setCommitError('Failed to commit changes')
    } finally {
      setCommitting(false)
    }
  }

  return (
    <>
      <Tooltip title="Uncommitted changes - click to commit">
        <IconButton
          size="small"
          onClick={handleClick}
          sx={{
            p: 0.25,
            color: 'warning.main',
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <CompareArrowsIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'top',
          horizontal: 'center'
        }}
        transformOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              maxWidth: 450,
              borderRadius: 1.5
            }
          }
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Commit Changes
        </Typography>

        {matchingStory ? (
          <Alert severity="info" sx={{ mb: 1.5, py: 0.5 }}>
            Story {matchingStory.epicId}.{matchingStory.storyNumber}: {matchingStory.title.slice(0, 40)}...
          </Alert>
        ) : (
          <Alert severity="warning" sx={{ mb: 1.5, py: 0.5 }}>
            No matching story found for branch
          </Alert>
        )}

        {commitError && (
          <Alert severity="error" sx={{ mb: 1.5, py: 0.5 }}>
            {commitError}
          </Alert>
        )}

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            bgcolor: 'action.hover',
            p: 1,
            borderRadius: 1,
            fontFamily: 'monospace',
            fontSize: '0.8rem',
            mb: 1.5
          }}
        >
          <Typography
            component="code"
            sx={{ flex: 1, fontFamily: 'inherit', fontSize: 'inherit', wordBreak: 'break-all' }}
          >
            {commitCommand}
          </Typography>
          <Tooltip title="Copy command">
            <IconButton
              size="small"
              onClick={() => handleCopy(commitCommand)}
              sx={{ flexShrink: 0 }}
            >
              {copiedCommand === commitCommand ? (
                <CheckIcon fontSize="small" color="success" />
              ) : (
                <ContentCopyIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </Box>

        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => {
              setDiffDialogOpen(true)
              handleClose()
            }}
            startIcon={<CompareArrowsIcon />}
            sx={{ flex: 1 }}
          >
            View Diff
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleCommit}
            disabled={committing}
            startIcon={committing ? <CircularProgress size={14} /> : undefined}
            sx={{ flex: 1 }}
          >
            {committing ? 'Committing...' : 'Commit'}
          </Button>
        </Box>
      </Popover>

      {/* Git Diff Dialog */}
      <GitDiffDialog
        open={diffDialogOpen}
        onClose={() => setDiffDialogOpen(false)}
        branchName={branchName}
      />
    </>
  )
}
