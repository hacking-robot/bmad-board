import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Badge,
  Chip,
} from '@mui/material'
import logoDark from '../../assets/logo-dark.svg'
import logoLight from '../../assets/logo-light.svg'
import RefreshIcon from '@mui/icons-material/Refresh'
import TerminalIcon from '@mui/icons-material/Terminal'
import HelpOutlineIcon from '@mui/icons-material/HelpOutline'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import HistoryIcon from '@mui/icons-material/History'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import SearchBar from '../SearchBar/SearchBar'
import EpicFilter from '../EpicFilter/EpicFilter'
import ThemeToggle from '../ThemeToggle/ThemeToggle'
import SettingsMenu from '../SettingsMenu'
import ProjectSwitcher from '../ProjectSwitcher'
import { useStore } from '../../store'
import { useProjectData } from '../../hooks/useProjectData'
import { AI_TOOLS } from '../../types'

export default function Header() {
  const agents = useStore((state) => state.agents)
  const agentPanelOpen = useStore((state) => state.agentPanelOpen)
  const toggleAgentPanel = useStore((state) => state.toggleAgentPanel)
  const enableAgents = useStore((state) => state.enableAgents)
  const toggleEnableAgents = useStore((state) => state.toggleEnableAgents)
  const setHelpPanelOpen = useStore((state) => state.setHelpPanelOpen)
  const statusHistoryPanelOpen = useStore((state) => state.statusHistoryPanelOpen)
  const setStatusHistoryPanelOpen = useStore((state) => state.setStatusHistoryPanelOpen)
  const getUnreadStatusHistoryCount = useStore((state) => state.getUnreadStatusHistoryCount)
  const projectType = useStore((state) => state.projectType)
  const themeMode = useStore((state) => state.themeMode)
  const viewMode = useStore((state) => state.viewMode)
  const chatThreads = useStore((state) => state.chatThreads)
  const aiTool = useStore((state) => state.aiTool)
  const selectedEpicId = useStore((state) => state.selectedEpicId)
  const stories = useStore((state) => state.stories)
  const epicCycle = useStore((state) => state.epicCycle)
  const setEpicCycleDialogOpen = useStore((state) => state.setEpicCycleDialogOpen)
  const { loadProjectData } = useProjectData()

  // Count chat agents currently running (isTyping)
  const runningChatAgents = Object.values(chatThreads).filter(
    (thread) => thread?.isTyping
  ).length


  // Run Epic button visibility
  const selectedToolInfo = AI_TOOLS.find(t => t.id === aiTool)
  const toolSupportsHeadless = selectedToolInfo?.cli.supportsHeadless ?? false
  const backlogCount = selectedEpicId !== null
    ? stories.filter((s) => s.epicId === selectedEpicId && s.status === 'backlog').length
    : 0
  const showRunEpic = selectedEpicId !== null && toolSupportsHeadless && backlogCount > 0 && viewMode === 'board'

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


          {/* Running Agents Indicator */}
          {runningChatAgents > 0 && (
            <Chip
              label={`${runningChatAgents} agent${runningChatAgents > 1 ? 's' : ''} working`}
              size="small"
              sx={{
                ml: 1,
                height: 22,
                bgcolor: 'success.main',
                color: 'white',
                fontWeight: 500,
                fontSize: '0.7rem',
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 }
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
          {viewMode === 'board' && <SearchBar />}
          {viewMode === 'board' && <EpicFilter />}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {enableAgents && viewMode === 'board' && (
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
            {showRunEpic && (
              <Tooltip title={epicCycle.isRunning ? 'Epic cycle running...' : `Run Epic (${backlogCount} backlog)`}>
                <IconButton
                  onClick={() => setEpicCycleDialogOpen(true)}
                  size="small"
                  sx={{
                    color: epicCycle.isRunning ? 'primary.main' : 'text.secondary',
                    ...(epicCycle.isRunning && {
                      animation: 'pulse 1.5s ease-in-out infinite',
                      '@keyframes pulse': {
                        '0%, 100%': { opacity: 1 },
                        '50%': { opacity: 0.5 }
                      }
                    })
                  }}
                >
                  <RocketLaunchIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Status History">
              <IconButton
                onClick={() => setStatusHistoryPanelOpen(!statusHistoryPanelOpen)}
                size="small"
                sx={{ color: statusHistoryPanelOpen ? 'primary.main' : 'text.secondary' }}
              >
                <Badge
                  badgeContent={getUnreadStatusHistoryCount()}
                  color="primary"
                  invisible={getUnreadStatusHistoryCount() === 0}
                  max={99}
                >
                  <HistoryIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Tooltip title="BMAD Guide (F1)">
              <IconButton
                onClick={() => setHelpPanelOpen(true)}
                size="small"
                sx={{ color: 'text.secondary' }}
              >
                <HelpOutlineIcon />
              </IconButton>
            </Tooltip>
            {viewMode === 'board' && (
              <Tooltip title="Refresh">
                <IconButton
                  onClick={loadProjectData}
                  size="small"
                  sx={{ color: 'text.secondary' }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            <ThemeToggle />
            <SettingsMenu />
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  )
}
