import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Badge,
  Chip
} from '@mui/material'
import logoDark from '../../assets/logo-dark.svg'
import logoLight from '../../assets/logo-light.svg'
import RefreshIcon from '@mui/icons-material/Refresh'
import TerminalIcon from '@mui/icons-material/Terminal'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import SearchBar from '../SearchBar/SearchBar'
import EpicFilter from '../EpicFilter/EpicFilter'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import SettingsMenu from '../SettingsMenu'
import ProjectSwitcher from '../ProjectSwitcher'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'

export default function Header() {
  const agents = useStore((state) => state.agents)
  const agentPanelOpen = useStore((state) => state.agentPanelOpen)
  const toggleAgentPanel = useStore((state) => state.toggleAgentPanel)
  const enableAgents = useStore((state) => state.enableAgents)
  const toggleEnableAgents = useStore((state) => state.toggleEnableAgents)
  const setHelpPanelOpen = useStore((state) => state.setHelpPanelOpen)
  const projectType = useStore((state) => state.projectType)
  const themeMode = useStore((state) => state.themeMode)
  const { loadProjectData } = useProjectData()

  const isGameProject = projectType === 'bmgd'
  const logoSrc = themeMode === 'dark' ? logoDark : logoLight

  const runningAgentsCount = enableAgents
    ? Object.values(agents).filter((a) => a.status === 'running').length
    : 0

  const handleLogoClick = (e: React.MouseEvent) => {
    // Triple-click to toggle hidden agents feature
    if (e.detail === 3) {
      toggleEnableAgents()
    }
  }

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
        <Box
          onClick={handleLogoClick}
          sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'default', userSelect: 'none', WebkitAppRegion: 'no-drag' }}
        >
          <Box
            component="img"
            src={logoSrc}
            alt="BMad Board"
            sx={{
              width: 36,
              height: 36,
              borderRadius: 1.5
            }}
          />
          <Typography
            variant="subtitle1"
            color="text.secondary"
            fontWeight={500}
            sx={{ whiteSpace: 'nowrap' }}
          >
            BMad Board
          </Typography>
          {isGameProject && (
            <Chip
              icon={<SportsEsportsIcon sx={{ fontSize: 16 }} />}
              label="Game"
              size="small"
              sx={{
                ml: 1,
                height: 24,
                bgcolor: '#8B5CF6',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.7rem',
                '& .MuiChip-icon': {
                  color: 'white'
                }
              }}
            />
          )}
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
            {enableAgents && (
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
            )}
            <Tooltip title="BMAD Guide (F1)">
              <IconButton
                onClick={() => setHelpPanelOpen(true)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <HelpOutlineIcon />
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
            <ThemeToggle />
            <SettingsMenu />
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
