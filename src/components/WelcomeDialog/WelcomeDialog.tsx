import { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Paper,
  Stack,
  Collapse,
  Link,
  Divider
} from '@mui/material'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import DashboardIcon from '@mui/icons-material/Dashboard'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useProjectData } from '../../hooks/useProjectData'
import { useStore } from '../../store'

export default function WelcomeDialog() {
  const { selectProject } = useProjectData()
  const error = useStore((state) => state.error)
  const [showInfo, setShowInfo] = useState(false)

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
          maxWidth: 520,
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

          <Divider sx={{ width: '100%', my: 1 }} />

          {/* What is BMAD section */}
          <Box sx={{ width: '100%' }}>
            <Button
              onClick={() => setShowInfo(!showInfo)}
              endIcon={showInfo ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              sx={{
                textTransform: 'none',
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'action.hover'
                }
              }}
            >
              What is BMAD?
            </Button>

            <Collapse in={showInfo}>
              <Box
                sx={{
                  mt: 2,
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  textAlign: 'left'
                }}
              >
                <Typography variant="body2" sx={{ mb: 1.5 }}>
                  <strong>BMAD</strong> (Breakthrough Method of Agile AI-Driven Development) is an AI-powered
                  framework that uses specialized agents to guide you through software development.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Each agent has a specific role: <strong>Analyst</strong> (Mary) handles research,{' '}
                  <strong>PM</strong> (John) creates requirements, <strong>Architect</strong> (Winston)
                  designs systems, <strong>SM</strong> (Bob) manages sprints, and <strong>DEV</strong> (Amelia)
                  implements features.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  BMad Board visualizes your project's progress as stories move through the development
                  lifecycle—from backlog to done.
                </Typography>
                <Link
                  href="https://docs.bmad-method.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    fontSize: '0.875rem'
                  }}
                >
                  Learn more about BMAD
                  <OpenInNewIcon sx={{ fontSize: 16 }} />
                </Link>
              </Box>
            </Collapse>
          </Box>
        </Stack>
      </Paper>
    </Box>
  )
}
