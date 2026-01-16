import { useState, useEffect, useCallback, useRef } from 'react'
import { Box, Typography, Tooltip, CircularProgress } from '@mui/material'
import ForkRightIcon from '@mui/icons-material/ForkRight'
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp'
import SearchableDropdown, { SearchableDropdownItem } from '../common/SearchableDropdown'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

export default function BranchSwitcher() {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [branches, setBranches] = useState<string[]>([])
  const [currentBranch, setCurrentBranch] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)

  const projectPath = useStore((state) => state.projectPath)
  const { loadProjectData } = useProjectData()

  const open = Boolean(anchorEl)

  // Load current branch on mount and when project changes
  const loadCurrentBranch = useCallback(async () => {
    if (!projectPath) {
      setCurrentBranch(null)
      return
    }

    try {
      const result = await window.gitAPI.getCurrentBranch(projectPath)
      if (result.error) {
        setCurrentBranch(null)
      } else {
        setCurrentBranch(result.branch || null)
      }
    } catch {
      setCurrentBranch(null)
    }
  }, [projectPath])

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

  // Load current branch on mount and project change
  useEffect(() => {
    loadCurrentBranch()
  }, [loadCurrentBranch])

  // Load branches when dropdown opens
  useEffect(() => {
    if (open) {
      loadBranches()
    }
  }, [open, loadBranches])

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
  const branchItems: SearchableDropdownItem[] = branches.map((branch) => ({
    id: branch,
    label: branch
  }))

  return (
    <Tooltip
      title={error || 'Switch git branch'}
      placement="top"
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
