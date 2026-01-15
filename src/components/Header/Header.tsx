import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Badge
} from '@mui/material'
import DashboardIcon from '@mui/icons-material/Dashboard'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import RefreshIcon from '@mui/icons-material/Refresh'
import TerminalIcon from '@mui/icons-material/Terminal'
import SearchBar from '../SearchBar/SearchBar'
import EpicFilter from '../EpicFilter/EpicFilter'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

export default function Header() {
  const projectPath = useStore((state) => state.projectPath)
  const agents = useStore((state) => state.agents)
  const agentPanelOpen = useStore((state) => state.agentPanelOpen)
  const toggleAgentPanel = useStore((state) => state.toggleAgentPanel)
  const { selectProject, loadProjectData } = useProjectData()

  const runningAgentsCount = Object.values(agents).filter((a) => a.status === 'running').length

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

        {/* Center section - Project Name (absolutely positioned) */}
        <Typography
          variant="h6"
          color="text.primary"
          fontWeight={600}
          sx={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            whiteSpace: 'nowrap'
          }}
        >
          {projectName}
        </Typography>

        {/* Right section - Search, Filter, Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SearchBar />
          <EpicFilter />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title={agentPanelOpen ? 'Hide Agents' : 'Show Agents'}>
              <IconButton
                onClick={toggleAgentPanel}
                size="small"
                sx={{
                  color: agentPanelOpen ? 'primary.main' : 'text.secondary'
                }}
              >
                <Badge
                  badgeContent={runningAgentsCount}
                  color="success"
                  invisible={runningAgentsCount === 0}
                >
                  <TerminalIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="Refresh">
              <IconButton
                onClick={loadProjectData}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
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
        </Box>
      </Toolbar>
    </AppBar>
  )
}
