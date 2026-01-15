import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import SearchBar from '../SearchBar/SearchBar'
import EpicFilter from '../EpicFilter/EpicFilter'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

export default function Header() {
  const projectPath = useStore((state) => state.projectPath)
  const { selectProject } = useProjectData()

  // Extract project name from path
  const projectName = projectPath?.split('/').pop() || 'BMad Board'

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        // Make the header draggable for window movement
        WebkitAppRegion: 'drag'
      }}
    >
      <Toolbar
        sx={{
          gap: 2,
          // Add left padding for macOS traffic lights (close/min/max buttons)
          pl: { xs: 2, sm: 10 },
          // Exclude interactive elements from drag region
          '& button, & input, & [role="button"]': {
            WebkitAppRegion: 'no-drag'
          }
        }}
      >
        {/* Logo and Title */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <DashboardIcon sx={{ fontSize: 22, color: 'white' }} />
          </Box>
          <Typography
            variant="h6"
            color="text.primary"
            fontWeight={600}
            sx={{ whiteSpace: 'nowrap' }}
          >
            {projectName}
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Search */}
        <SearchBar />

        {/* Epic Filter */}
        <EpicFilter />

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title="Change Project">
            <IconButton
              onClick={selectProject}
              size="small"
              sx={{ color: 'text.secondary' }}
            >
              <FolderOpenIcon />
            </IconButton>
          </Tooltip>

          <ThemeToggle />
        </Box>
      </Toolbar>
    </AppBar>
  )
}
