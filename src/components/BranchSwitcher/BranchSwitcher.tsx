import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Box, Typography, Tooltip, CircularProgress } from '@mui/material'
import ForkRightIcon from '@mui/icons-material/ForkRight'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SearchableDropdown, { SearchableDropdownItem } from '../common/SearchableDropdown'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

export default function BranchSwitcher() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const projectPath = useStore((state) => state.projectPath)
  const currentBranch = useStore((state) => state.currentBranch)
  const setCurrentBranch = useStore((state) => state.setCurrentBranch)
  const epics = useStore((state) => state.epics)
  const stories = useStore((state) => state.stories)
  const { loadProjectData } = useProjectData()

  const open = Boolean(anchorEl)

  // Load branches when dropdown opens
  const loadBranches = useCallback(async () => {
    if (!projectPath) return

    setLoading(true)
    try {
      // Check for uncommitted changes first
      const changesResult = await window.gitAPI.hasChanges(projectPath)
      if (changesResult.hasChanges) {
        setError('Commit changes before switching branches')
        setBranches([])
        setLoading(false)
        return
      }

      const result = await window.gitAPI.listBranches(projectPath)
      if (result.error) {
        setError(result.error)
        setBranches([])
      } else {
        setBranches(result.branches)
        setError(null)
      }
    } catch {
      setError('Failed to load branches')
      setBranches([])
    } finally {
      setLoading(false)
    }
  }, [projectPath])

  // Load branches when dropdown opens
  useEffect(() => {
    if (open) {
      loadBranches()
    }
  }, [open, loadBranches])

  // Filter branches to only show relevant ones (epics, stories, main/master)
  // Must be before early return to follow Rules of Hooks
  const filteredBranches = useMemo(() => {
    // Build set of valid branch prefixes
    const epicPrefixes = epics.map(e => `epic-${e.id}-`)
    const storyPrefixes = stories.map(s => `${s.epicId}-${s.id}`)

    return branches.filter(branch => {
      // Always show main/master
      if (branch === 'main' || branch === 'master') return true

      // Show epic branches
      if (epicPrefixes.some(prefix => branch.startsWith(prefix))) return true

      // Show story branches
      if (storyPrefixes.some(prefix => branch === prefix || branch.startsWith(`${prefix}-`))) return true

      return false
    })
  }, [branches, epics, stories])

  const handleClick = () => {
    if (!projectPath || !currentBranch) return

    if (open) {
      setAnchorEl(null)
    } else if (triggerRef.current) {
      setAnchorEl(triggerRef.current)
    }
  }

  const handleClose = () => {
    setAnchorEl(null)
    setError(null)
  }

  const handleBranchSelect = async (branchName: string) => {
    if (!projectPath || branchName === currentBranch) {
      handleClose()
      return
    }

    setCheckoutLoading(true)
    setError(null)

    try {
      const result = await window.gitAPI.checkoutBranch(projectPath, branchName)
      if (result.error) {
        setError(result.error)
        // Keep dropdown open to show error
        return
      }

      // Update current branch
      setCurrentBranch(branchName)
      handleClose()

      // Refresh project data after branch switch
      loadProjectData()
    } catch {
      setError('Failed to switch branches')
    } finally {
      setCheckoutLoading(false)
    }
  }

  // Don't render if not in a git repo
  if (!projectPath || !currentBranch) {
    return null
  }

  // Convert branches to dropdown items
  const branchItems: SearchableDropdownItem[] = filteredBranches.map((branch) => ({
    id: branch,
    label: branch
  }))

  return (
    <Tooltip
      title={error || 'Switch git branch'}
      placement="top"
      open={open ? false : undefined}
      disableHoverListener={open}
      componentsProps={{
        tooltip: {
          sx: error ? { bgcolor: 'error.main' } : {}
        }
      }}
    >
      <Box
        ref={triggerRef}
        onClick={handleClick}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          cursor: 'pointer',
          px: 0.5,
          py: 0.25,
          borderRadius: 0.5,
          '&:hover': {
            bgcolor: 'action.hover'
          }
        }}
      >
        {checkoutLoading ? (
          <CircularProgress size={12} sx={{ color: 'text.secondary' }} />
        ) : (
          <ForkRightIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
        )}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {currentBranch}
        </Typography>
        <KeyboardArrowUpIcon
          sx={{
            fontSize: 14,
            color: 'text.disabled',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'none'
          }}
        />

        <SearchableDropdown
          items={branchItems}
          selectedId={currentBranch}
          onSelect={handleBranchSelect}
          placeholder="Search branches..."
          anchorEl={anchorEl}
          open={open}
          onClose={handleClose}
          loading={loading}
          emptyMessage="No branches found"
        />
      </Box>
    </Tooltip>
  )
}
