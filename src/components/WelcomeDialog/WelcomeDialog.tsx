import {
  Box,
  Button,
  Typography,
  Paper,
  Stack
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DashboardIcon from '@mui/icons-material/Dashboard'
import { useProjectData } from '../../hooks/useProjectData'
import { useStore } from '../../store'

export default function WelcomeDialog() {
  const { selectProject } = useProjectData()
  const error = useStore((state) => state.error)

  const handleSelectProject = async () => {
    await selectProject()
  }

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        p: 3
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 6,
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
          border: 1,
          borderColor: 'divider'
        }}
      >
        <Stack spacing={3} alignItems="center">
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 3,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <DashboardIcon sx={{ fontSize: 40, color: 'white' }} />
          </Box>

          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom>
              BMad Board
            </Typography>
            <Typography variant="body1" color="text.secondary">
              A beautiful sprint board for your BMAD projects.
              Select a project folder to get started.
            </Typography>
          </Box>

          {error && (
            <Typography color="error" variant="body2">
              {error}
            </Typography>
          )}

          <Button
            variant="contained"
            size="large"
            startIcon={<FolderOpenIcon />}
            onClick={handleSelectProject}
            sx={{ mt: 2 }}
          >
            Select Project Folder
          </Button>

          <Typography variant="caption" color="text.secondary">
            Choose a folder containing a <code>_bmad-output</code> directory
          </Typography>
        </Stack>
      </Paper>
    </Box>
  )
}
