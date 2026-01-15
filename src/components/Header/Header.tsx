import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchBar from '../SearchBar/SearchBar'
import EpicFilter from '../EpicFilter/EpicFilter'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import SettingsMenu from '../SettingsMenu'
import ProjectSwitcher from '../ProjectSwitcher'
import { useProjectData } from '../../hooks/useProjectData'

export default function Header() {
  const { loadProjectData } = useProjectData()

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
        {/* Left section - Logo and App Name */}
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
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
            sx={{ whiteSpace: 'nowrap' }}
          >
            BMad Board
          </Typography>
        </Box>

        {/* Spacer */}
        <Box sx={{ flexGrow: 1 }} />

        {/* Center section - Project Switcher (absolutely positioned) */}
        <ProjectSwitcher />

        {/* Right section - Search, Filter, Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SearchBar />
          <EpicFilter />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={loadProjectData}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <ThemeToggle />
            <SettingsMenu />
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
