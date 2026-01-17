import { useEffect } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useStore } from '../../store'
import { useWorkflow } from '../../hooks/useWorkflow'
import AgentSidebar from './AgentSidebar'
import ChatThread from './ChatThread'

const SIDEBAR_WIDTH = 240

export default function AgentChat() {
  const selectedChatAgent = useStore((state) => state.selectedChatAgent)
  const setSelectedChatAgent = useStore((state) => state.setSelectedChatAgent)
  const chatThreads = useStore((state) => state.chatThreads)
  const clearChatThread = useStore((state) => state.clearChatThread)
  const setHelpPanelOpen = useStore((state) => state.setHelpPanelOpen)

  // Get agents from workflow (based on current project type)
  const { agents } = useWorkflow()

  const handleClearChat = () => {
    if (selectedChatAgent) {
      clearChatThread(selectedChatAgent)
      // Also clear persisted thread
      window.chatAPI.clearThread(selectedChatAgent)
    }
  }

  // Select first agent if none selected or current selection invalid for project type
  useEffect(() => {
    const validAgent = agents.find((a) => a.id === selectedChatAgent)
    if (!validAgent && agents.length > 0) {
      setSelectedChatAgent(agents[0].id)
    }
  }, [selectedChatAgent, setSelectedChatAgent, agents])

  // Load thread from storage when agent is selected
  useEffect(() => {
    if (selectedChatAgent) {
      // Load persisted thread if not already loaded
      const thread = chatThreads[selectedChatAgent]
      if (!thread) {
        window.chatAPI.loadThread(selectedChatAgent).then((loadedThread) => {
          if (loadedThread && loadedThread.messages.length > 0) {
            // Restore thread from storage
            for (const msg of loadedThread.messages) {
              useStore.getState().addChatMessage(selectedChatAgent, msg)
            }
          }
        })
      }
    }
  }, [selectedChatAgent, chatThreads])

  const selectedAgent = agents.find((a) => a.id === selectedChatAgent)

  return (
    <Box
      sx={{
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}
    >
      {/* Agent Sidebar */}
      <Box
        sx={{
          width: SIDEBAR_WIDTH,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper'
        }}
      >
        <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" color="text.secondary" fontWeight={600}>
            TEAMMATES
          </Typography>
        </Box>
        <AgentSidebar />
      </Box>

      {/* Chat Area */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {selectedAgent ? (
          <>
            {/* Chat Header */}
            <Box
              sx={{
                p: 2,
                borderBottom: 1,
                borderColor: 'divider',
                bgcolor: 'background.paper',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5
              }}
            >
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 600,
                  fontSize: '0.875rem'
                }}
              >
                {selectedAgent.avatar}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="subtitle1" fontWeight={600}>
                    {selectedAgent.name}
                  </Typography>
                  <Tooltip title="View teammate guide">
                    <IconButton
                      onClick={() => setHelpPanelOpen(true, 1, selectedAgent.id)}
                      size="small"
                      sx={{ color: 'text.secondary', p: 0.25 }}
                    >
                      <InfoOutlinedIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {selectedAgent.role} - {selectedAgent.description}
                </Typography>
              </Box>
              <Tooltip title="Clear conversation">
                <IconButton
                  onClick={handleClearChat}
                  size="small"
                  sx={{ color: 'text.secondary' }}
                >
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>

            {/* Chat Thread */}
            <ChatThread agentId={selectedChatAgent!} />
          </>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Typography color="text.secondary">
              Select a teammate to start chatting
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
}
