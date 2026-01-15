import { useMemo } from 'react'
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material'
import { useStore } from './store'
import { lightTheme, darkTheme } from './theme'
import Header from './components/Header/Header'
import Board from './components/Board/Board'
import StoryDialog from './components/StoryDialog/StoryDialog'
import WelcomeDialog from './components/WelcomeDialog/WelcomeDialog'
import AgentPanel from './components/AgentPanel/AgentPanel'
import CommandPalette from './components/CommandPalette'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import StatusBar from './components/StatusBar'

const AGENT_PANEL_WIDTH = 500

export default function App() {
  const hasHydrated = useStore((state) => state._hasHydrated)
  const themeMode = useStore((state) => state.themeMode)
  const projectPath = useStore((state) => state.projectPath)
  const enableAgents = useStore((state) => state.enableAgents)
  const agentPanelOpen = useStore((state) => state.agentPanelOpen)

  const showAgentPanel = agentPanelOpen && enableAgents

  const theme = useMemo(
    () => (themeMode === 'dark' ? darkTheme : lightTheme),
    [themeMode]
  )

  // Show loading while hydrating persisted state
  if (!hasHydrated) {
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CommandPalette />
      <KeyboardShortcuts />
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          overflow: 'hidden'
        }}
      >
        {!projectPath ? (
          <WelcomeDialog />
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                overflow: 'hidden',
                transition: 'margin-right 225ms cubic-bezier(0, 0, 0.2, 1)',
                marginRight: showAgentPanel ? `${AGENT_PANEL_WIDTH}px` : 0
              }}
            >
              <Header />
              <Board />
              <StatusBar />
            </Box>
            {enableAgents && <AgentPanel />}
            <StoryDialog />
          </>
        )}
      </Box>
    </ThemeProvider>
  )
}
