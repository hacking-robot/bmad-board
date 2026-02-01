import { useMemo, useEffect } from 'react'
import { ThemeProvider, CssBaseline, Box, CircularProgress, IconButton, Tooltip } from '@mui/material'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useStore } from './store'
import { lightTheme, darkTheme } from './theme'
import { AI_TOOLS } from './types'
import Header from './components/Header/Header'
import Board from './components/Board/Board'
import StoryDialog from './components/StoryDialog/StoryDialog'
import WelcomeDialog from './components/WelcomeDialog/WelcomeDialog'
import NewProjectDialog from './components/NewProjectDialog'
import CommandPalette from './components/CommandPalette'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import HelpPanel from './components/HelpPanel'
import StatusBar from './components/StatusBar'
import { AgentChat } from './components/AgentChat'
import StatusHistoryPanel from './components/StatusHistoryPanel/StatusHistoryPanel'
import { FullCycleDialog, FullCycleOrchestrator } from './components/FullCycleDialog'
import GlobalChatHandler from './components/GlobalChatHandler'
import { PairProgrammerPanel } from './components/PairProgrammerPanel'

const PAIR_PROGRAMMER_WIDTH = 340

export default function App() {
  const hasHydrated = useStore((state) => state._hasHydrated)
  const themeMode = useStore((state) => state.themeMode)
  const projectPath = useStore((state) => state.projectPath)
  const helpPanelOpen = useStore((state) => state.helpPanelOpen)
  const helpPanelTab = useStore((state) => state.helpPanelTab)
  const setHelpPanelOpen = useStore((state) => state.setHelpPanelOpen)
  const pairProgrammingEnabledStoryId = useStore((state) => state.pairProgrammingEnabledStoryId)
  const pairProgrammingPanelOpen = useStore((state) => state.pairProgrammingPanelOpen)
  const stories = useStore((state) => state.stories)
  const viewMode = useStore((state) => state.viewMode)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const aiTool = useStore((state) => state.aiTool)

  // Agent features available for tools with headless CLI support
  const selectedToolInfo = AI_TOOLS.find(t => t.id === aiTool)
  const toolSupportsHeadless = selectedToolInfo?.cli.supportsHeadless ?? false
  const showChatView = viewMode === 'chat' && toolSupportsHeadless

  // Find the story that has pair programming enabled
  const pairProgrammingStory = stories.find(s => s.id === pairProgrammingEnabledStoryId)

  // Keyboard shortcut for view toggle (Cmd+Shift+A)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        toggleViewMode()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [toggleViewMode])

  // Listen for custom event to open help panel
  useEffect(() => {
    const handleOpen = () => setHelpPanelOpen(true)
    window.addEventListener('open-help-panel', handleOpen)
    return () => window.removeEventListener('open-help-panel', handleOpen)
  }, [setHelpPanelOpen])

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
      <NewProjectDialog />
      <HelpPanel
        open={helpPanelOpen}
        onClose={() => setHelpPanelOpen(false)}
        initialTab={helpPanelTab}
      />
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
          <GlobalChatHandler>
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                flex: 1,
                overflow: 'hidden',
                position: 'relative'
              }}
            >
              {/* Main content area */}
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  overflow: 'hidden',
                  transition: 'width 225ms cubic-bezier(0, 0, 0.2, 1)',
                  width: pairProgrammingStory && pairProgrammingPanelOpen ? `calc(100% - ${PAIR_PROGRAMMER_WIDTH}px)` : '100%'
                }}
              >
                <Header />
                {/* Board with chat sidebar overlay */}
                <Box sx={{ flex: 1, position: 'relative', overflow: 'hidden', minHeight: 0 }}>
                {/* Board view - always full width */}
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden'
                  }}
                >
                  <Board />
                  <StatusBar />
                </Box>

                {/* Backdrop to close sidebar on click outside */}
                {showChatView && (
                  <Box
                    onClick={toggleViewMode}
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      bgcolor: 'rgba(0, 0, 0, 0.3)',
                      zIndex: 9,
                      cursor: 'pointer'
                    }}
                  />
                )}

                {/* Chat sidebar - slides over from left */}
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    bottom: 0,
                    width: '75%',
                    maxWidth: 1200,
                    transform: showChatView ? 'translateX(0)' : 'translateX(-100%)',
                    transition: 'transform 225ms cubic-bezier(0, 0, 0.2, 1)',
                    bgcolor: 'background.paper',
                    borderRight: 1,
                    borderColor: 'divider',
                    display: 'flex',
                    boxShadow: showChatView ? 8 : 0,
                    zIndex: 10
                  }}
                >
                  <AgentChat />
                  {/* Close button on right edge of sidebar */}
                  {showChatView && (
                    <Tooltip title="Close chat (⌘⇧A)" placement="right">
                      <IconButton
                        onClick={toggleViewMode}
                        sx={{
                          position: 'absolute',
                          right: -32,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          bgcolor: 'background.paper',
                          border: 1,
                          borderColor: 'divider',
                          borderLeft: 0,
                          borderRadius: '0 8px 8px 0',
                          width: 32,
                          height: 64,
                          '&:hover': { bgcolor: 'action.hover' }
                        }}
                      >
                        <ChevronLeftIcon sx={{ fontSize: 20 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>

                {/* Toggle button when chat is closed - only for Claude Code */}
                {!showChatView && toolSupportsHeadless && (
                  <Tooltip title="Open teammates chat (⌘⇧A)" placement="right">
                    <IconButton
                      onClick={toggleViewMode}
                      sx={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        bgcolor: 'background.paper',
                        border: 1,
                        borderColor: 'divider',
                        borderLeft: 0,
                        borderRadius: '0 8px 8px 0',
                        width: 32,
                        height: 64,
                        zIndex: 5,
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                    >
                      <ChevronRightIcon sx={{ fontSize: 20 }} />
                    </IconButton>
                  </Tooltip>
                )}
                </Box>
              </Box>

              {/* Backdrop to close pair programming panel on click outside */}
              {pairProgrammingStory && pairProgrammingPanelOpen && (
                <Box
                  onClick={() => {
                    console.log('[App] Pair programmer backdrop clicked')
                    useStore.getState().setPairProgrammingPanelOpen(false)
                  }}
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    bgcolor: 'rgba(0, 0, 0, 0.3)',
                    zIndex: 9,
                    cursor: 'pointer'
                  }}
                />
              )}

              {/* Pair Programmer Panel - shown when a story has pair programming enabled AND panel is open */}
              {pairProgrammingStory && pairProgrammingPanelOpen && (
                <Box
                  onClick={(e) => e.stopPropagation()}
                  sx={{
                    width: PAIR_PROGRAMMER_WIDTH,
                    flexShrink: 0,
                    borderLeft: 1,
                    borderColor: 'divider',
                    bgcolor: 'background.paper',
                    zIndex: 10
                  }}
                >
                  <PairProgrammerPanel storyId={pairProgrammingStory.id} />
                </Box>
              )}

              {/* Pair Programmer Chevron - shown when panel is closed but pair programming is enabled */}
              {pairProgrammingStory && !pairProgrammingPanelOpen && (
                <Tooltip title="Open Pair Programmer" placement="left">
                  <IconButton
                    onClick={() => {
                      console.log('[App] Pair Programmer chevron clicked')
                      useStore.getState().setPairProgrammingPanelOpen(true)
                    }}
                    sx={{
                      position: 'absolute',
                      right: 0,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      bgcolor: 'background.paper',
                      border: 1,
                      borderColor: 'divider',
                      borderRight: 0,
                      borderRadius: '8px 0 0 8px',
                      width: 32,
                      height: 64,
                      zIndex: 10,
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                  >
                    <ChevronLeftIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              )}
            </Box>

            {/* Log pair programmer panel visibility */}
            {(() => {
              if (pairProgrammingStory) {
                console.log('[App] PairProgrammerPanel shown for story:', pairProgrammingStory.id)
              }
              return null
            })()}
            <StoryDialog />
            <StatusHistoryPanel />
            <FullCycleDialog />
            <FullCycleOrchestrator />
          </GlobalChatHandler>
        )}
      </Box>
    </ThemeProvider>
  )
}
