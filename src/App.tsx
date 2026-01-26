import { useMemo, useEffect, useCallback, useRef } from 'react'
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
import AgentPanel from './components/AgentPanel/AgentPanel'
import CommandPalette from './components/CommandPalette'
import KeyboardShortcuts from './components/KeyboardShortcuts'
import HelpPanel from './components/HelpPanel'
import StatusBar from './components/StatusBar'
import { AgentChat } from './components/AgentChat'
import StatusHistoryPanel from './components/StatusHistoryPanel/StatusHistoryPanel'
import { ensureStoryBranch, mergeStoryBranch, autoCommitChanges } from './utils/workflowAutomation'

// Map BMM agent IDs to BMGD agent IDs (for cross-project compatibility)
const BMM_TO_BMGD_AGENT_MAP: Record<string, string> = {
  'dev': 'game-dev',
  'sm': 'game-scrum-master',
  'architect': 'game-architect',
  'tea': 'game-qa',
  'barry': 'game-solo-dev'
}

// Map BMGD agent IDs to BMM agent IDs (for cross-project compatibility)
const BMGD_TO_BMM_AGENT_MAP: Record<string, string> = {
  'game-dev': 'dev',
  'game-scrum-master': 'sm',
  'game-architect': 'architect',
  'game-qa': 'tea',
  'game-solo-dev': 'barry'
}

const AGENT_PANEL_WIDTH = 500

export default function App() {
  const hasHydrated = useStore((state) => state._hasHydrated)
  const themeMode = useStore((state) => state.themeMode)
  const projectPath = useStore((state) => state.projectPath)
  const enableAgents = useStore((state) => state.enableAgents)
  const agentPanelOpen = useStore((state) => state.agentPanelOpen)
  const helpPanelOpen = useStore((state) => state.helpPanelOpen)
  const helpPanelTab = useStore((state) => state.helpPanelTab)
  const setHelpPanelOpen = useStore((state) => state.setHelpPanelOpen)
  const viewMode = useStore((state) => state.viewMode)
  const toggleViewMode = useStore((state) => state.toggleViewMode)
  const aiTool = useStore((state) => state.aiTool)
  const setPendingChatMessage = useStore((state) => state.setPendingChatMessage)
  const setSelectedChatAgent = useStore((state) => state.setSelectedChatAgent)
  const setViewMode = useStore((state) => state.setViewMode)
  const clearChatThread = useStore((state) => state.clearChatThread)
  const currentBranch = useStore((state) => state.currentBranch)
  const baseBranch = useStore((state) => state.baseBranch)
  const enableEpicBranches = useStore((state) => state.enableEpicBranches)
  const setCurrentBranch = useStore((state) => state.setCurrentBranch)
  const projectType = useStore((state) => state.projectType)

  // Agent features available for tools with headless CLI support
  const selectedToolInfo = AI_TOOLS.find(t => t.id === aiTool)
  const toolSupportsHeadless = selectedToolInfo?.cli.supportsHeadless ?? false
  const showAgentPanel = agentPanelOpen && enableAgents && viewMode === 'board' && toolSupportsHeadless
  const showChatView = viewMode === 'chat' && toolSupportsHeadless

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

  // Track ongoing delegations to prevent duplicates
  const delegationInProgressRef = useRef<string | null>(null)

  // Handle delegation with automatic branch management
  const handleDelegation = useCallback(async (data: { agentId: string; message: string; storyId?: string }) => {
    // Map agent ID to the correct one for the current project type
    let targetAgentId = data.agentId
    if (projectType === 'bmgd' && BMM_TO_BMGD_AGENT_MAP[data.agentId]) {
      targetAgentId = BMM_TO_BMGD_AGENT_MAP[data.agentId]
      console.log(`[MCP] Mapped agent ${data.agentId} to ${targetAgentId} for BMGD project`)
    } else if (projectType === 'bmm' && BMGD_TO_BMM_AGENT_MAP[data.agentId]) {
      targetAgentId = BMGD_TO_BMM_AGENT_MAP[data.agentId]
      console.log(`[MCP] Mapped agent ${data.agentId} to ${targetAgentId} for BMM project`)
    }

    // Create a key to identify this delegation
    const delegationKey = `${targetAgentId}:${data.storyId || 'no-story'}`

    // Skip if this delegation is already in progress
    if (delegationInProgressRef.current === delegationKey) {
      console.log(`[MCP] Skipping duplicate delegation for: ${delegationKey}`)
      return
    }

    delegationInProgressRef.current = delegationKey
    console.log('[MCP] Delegation request:', { ...data, targetAgentId })

    // Clear the agent's chat thread to start fresh (avoid stale context)
    clearChatThread(targetAgentId)
    window.chatAPI.clearThread(targetAgentId)

    // Story ID IS the branch name for story branches (e.g., "1-2-user-login")
    const branchName = data.storyId || undefined

    // If there's a story, ensure we're on the correct branch BEFORE delegating
    if (data.storyId && projectPath) {
      console.log(`[Workflow] Ensuring correct branch for story: ${data.storyId}`)
      const branchResult = await ensureStoryBranch({
        projectPath,
        storyId: data.storyId,
        baseBranch: baseBranch || 'main',
        enableEpicBranches: enableEpicBranches || false,
        currentBranch: currentBranch || baseBranch || 'main'
      })

      if (branchResult.success) {
        console.log(`[Workflow] Branch ready: ${branchResult.message}`)
        // Update current branch in store if it changed
        if (branchResult.branchName && branchResult.branchName !== currentBranch) {
          setCurrentBranch(branchResult.branchName)
        }
      } else {
        console.error(`[Workflow] Failed to ensure branch: ${branchResult.error}`)
        // Continue anyway - agent can handle branch creation
      }
    }

    // Switch to chat view and send message to the target agent
    console.log(`[MCP] Setting pending message for agent: ${targetAgentId}`)
    setPendingChatMessage({
      agentId: targetAgentId,
      message: data.message,
      storyId: data.storyId,
      branchName
    })
    setSelectedChatAgent(targetAgentId)
    setViewMode('chat')
    console.log(`[MCP] Switched to chat view with agent: ${targetAgentId}`)

    // Reset delegation guard after a delay to allow for legitimate new delegations
    setTimeout(() => {
      delegationInProgressRef.current = null
    }, 2000)
  }, [clearChatThread, projectPath, baseBranch, enableEpicBranches, currentBranch, setCurrentBranch, setPendingChatMessage, setSelectedChatAgent, setViewMode, projectType])

  // Listen for MCP API events from the orchestrator
  useEffect(() => {
    // Handle delegation requests from MCP API (Oracle orchestrator)
    const cleanupDelegate = window.fileAPI.onMcpDelegateToAgent((data) => {
      handleDelegation(data)
    })

    // Handle story status changes from MCP API
    const cleanupStatus = window.fileAPI.onStoryStatusChanged(async (data) => {
      console.log('[MCP] Story status changed:', data)

      // When a story moves to 'done', commit any changes and merge the branch
      if (data.newStatus === 'done' && data.storyId && projectPath) {
        const storeState = useStore.getState()
        const story = storeState.stories.find(s => s.id === data.storyId)

        // First, commit any uncommitted changes
        console.log(`[Workflow] Story ${data.storyId} moved to done - committing and merging`)
        const commitResult = await autoCommitChanges(
          projectPath,
          data.storyId,
          story?.title,
          'Workflow'
        )
        if (commitResult.success) {
          console.log(`[Workflow] ${commitResult.message}`)
        }

        // Then merge the story branch to parent
        const mergeResult = await mergeStoryBranch({
          projectPath,
          storyId: data.storyId,
          baseBranch: baseBranch || 'main',
          enableEpicBranches: enableEpicBranches || false,
          currentBranch: currentBranch || baseBranch || 'main'
        })

        if (mergeResult.success) {
          console.log(`[Workflow] ${mergeResult.message}`)
          // Update current branch in store after merge (we're now on parent branch)
          const newBranch = await window.gitAPI.getCurrentBranch(projectPath)
          if (newBranch.branch && newBranch.branch !== currentBranch) {
            setCurrentBranch(newBranch.branch)
          }
        } else {
          console.error(`[Workflow] Merge failed: ${mergeResult.error}`)
        }
      }
    })

    // Handle branch changes from MCP API
    // Note: App should reload project data when branch changes are detected
    const cleanupBranch = window.fileAPI.onBranchChanged((data) => {
      console.log('[MCP] Branch changed:', data)
    })

    return () => {
      cleanupDelegate()
      cleanupStatus()
      cleanupBranch()
    }
  }, [handleDelegation])

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
            {enableAgents && !showChatView && toolSupportsHeadless && <AgentPanel />}
            <StoryDialog />
            <StatusHistoryPanel />
          </>
        )}
      </Box>
    </ThemeProvider>
  )
}
