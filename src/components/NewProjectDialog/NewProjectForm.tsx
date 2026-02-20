import { useState, useCallback } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Stack,
  TextField,
  Alert
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import AddIcon from '@mui/icons-material/Add'
import { useStore } from '../../store'

interface NewProjectFormProps {
  open: boolean
  onClose: () => void
}

export default function NewProjectForm({ open, onClose }: NewProjectFormProps) {
  const { startProjectWizard } = useStore()
  const [parentPath, setParentPath] = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const reset = useCallback(() => {
    setParentPath(null)
    setProjectName('')
    setError(null)
    setCreating(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handlePickParent = useCallback(async () => {
    const result = await window.wizardAPI.selectDirectoryAny()
    if (result?.path) {
      setParentPath(result.path)
      setError(null)
    }
  }, [])

  const handleCreate = useCallback(async () => {
    if (!parentPath || !projectName.trim()) return

    const name = projectName.trim()
    if (/[/\\:]/.test(name) || name === '.' || name === '..') {
      setError('Invalid project name')
      return
    }

    setCreating(true)
    setError(null)

    const result = await window.wizardAPI.createProjectDirectory(parentPath, name)
    if (!result.success || !result.path) {
      setError(result.error || 'Failed to create project folder')
      setCreating(false)
      return
    }

    startProjectWizard(result.path)
    setCreating(false)
    reset()
    onClose()
  }, [parentPath, projectName, startProjectWizard, reset, onClose])

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { borderRadius: 2 } }}
    >
      <DialogTitle>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <AddIcon sx={{ color: 'white' }} />
          </Box>
          <Typography variant="h6" fontWeight={600}>
            New Project
          </Typography>
        </Stack>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
              Location
            </Typography>
            <Button
              variant="outlined"
              size="small"
              startIcon={<FolderOpenIcon />}
              onClick={handlePickParent}
              fullWidth
              sx={{ justifyContent: 'flex-start', textTransform: 'none', fontFamily: 'monospace', fontSize: '0.8rem' }}
            >
              {parentPath || 'Select parent folder...'}
            </Button>
          </Box>

          <TextField
            label="Project Name"
            size="small"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="my-awesome-project"
            fullWidth
            autoFocus
            disabled={!parentPath}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
            }}
            helperText={parentPath && projectName.trim()
              ? `Will create: ${parentPath}/${projectName.trim()}`
              : 'Choose a location first, then enter a name for your project'
            }
          />

          {error && (
            <Alert severity="error" sx={{ py: 0 }}>
              {error}
            </Alert>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button variant="text" onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={!parentPath || !projectName.trim() || creating}
        >
          {creating ? 'Creating...' : 'Create & Start Wizard'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
