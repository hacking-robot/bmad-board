import { useState, useCallback, useRef, KeyboardEvent, useEffect } from 'react'
import { Box, Typography, IconButton, Tooltip, CircularProgress, TextField } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import SendIcon from '@mui/icons-material/Send'
import PersonIcon from '@mui/icons-material/Person'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import VolumeOffIcon from '@mui/icons-material/VolumeOff'
import { useStore } from '../../store'
import { usePairProgrammer } from '../../hooks/usePairProgrammer'
import { useWorkflow } from '../../hooks/useWorkflow'
import { initTTS, speak, interruptSpeech } from '../../services/tts'

interface PairProgrammerPanelProps {
  storyId: string
}

export default function PairProgrammerPanel({ storyId }: PairProgrammerPanelProps) {
  console.log('[PairProgrammerPanel] Rendering for story:', storyId)

  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const lastSpokenMessageRef = useRef<string | null>(null)

  // TTS state with localStorage persistence
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    const saved = localStorage.getItem('pair-programmer-tts')
    return saved === 'true'
  })

  // Initialize TTS on mount
  useEffect(() => {
    initTTS()
  }, [])

  const projectPath = useStore((state) => state.projectPath)
  const isWatching = useStore((state) => state.isWatching)
  const setPairProgrammingPanelOpen = useStore((state) => state.setPairProgrammingPanelOpen)
  const { agents } = useWorkflow()

  const {
    enabled,
    messages,
    isAnalyzing,
    analyzeNow,
    clearFeedback,
    sendMessage
  } = usePairProgrammer(storyId)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  console.log('[PairProgrammerPanel] State:', { enabled, messageCount: messages.length, isAnalyzing, isWatching })

  const agentInfo = agents.find((a) => a.id === 'pair-programmer')

  // Connection status based on file watching
  const connectionStatus = {
    label: !projectPath ? 'No project' : isWatching ? 'Watching files' : 'Not watching',
    color: !projectPath ? '#9e9e9e' : isWatching ? '#4caf50' : '#f44336',
    online: !!projectPath && isWatching
  }

  // Format relative time
  const formatRelativeTime = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    if (seconds < 60) return 'just now'
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    return `${Math.floor(seconds / 3600)}h ago`
  }

  const handleClose = () => {
    console.log('[PairProgrammerPanel] Close clicked')
    setPairProgrammingPanelOpen(false)
  }

  const handleAnalyzeNow = async () => {
    console.log('[PairProgrammerPanel] Analyze now clicked')
    await analyzeNow()
  }

  const handleClear = () => {
    console.log('[PairProgrammerPanel] Clear feedback clicked')
    clearFeedback()
  }

  const handleSend = useCallback(async () => {
    if (message.trim() && !isAnalyzing && connectionStatus.online) {
      const messageToSend = message.trim()
      setMessage('')
      await sendMessage(messageToSend)
    }
  }, [message, isAnalyzing, connectionStatus.online, sendMessage])

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Toggle TTS and save to localStorage
  const handleToggleTts = () => {
    const newValue = !ttsEnabled
    setTtsEnabled(newValue)
    localStorage.setItem('pair-programmer-tts', String(newValue))
    // Cancel any ongoing speech when disabling
    if (!newValue) {
      interruptSpeech()
    }
  }

  // Speak new assistant messages when TTS is enabled
  useEffect(() => {
    if (!ttsEnabled || messages.length === 0) return

    // Get the last assistant message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role !== 'assistant') return

    // Skip if we already spoke this message
    if (lastSpokenMessageRef.current === lastMessage.id) return

    // Mark as spoken
    lastSpokenMessageRef.current = lastMessage.id

    // Speak the message using the TTS service
    speak(lastMessage.content, {
      volume: 1.0,
      rate: 1.0,
      pitch: 1.0,
    })
  }, [messages, ttsEnabled])

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bgcolor: 'background.paper'
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          flexShrink: 0
        }}
      >
        {/* Agent Avatar */}
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            bgcolor: agentInfo?.color || '#9C27B0',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 600,
            fontSize: '0.8rem',
            flexShrink: 0
          }}
        >
          {agentInfo?.avatar || 'PP'}
        </Box>

        {/* Agent Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" fontWeight={600} noWrap sx={{ fontSize: '0.95rem' }}>
            {agentInfo?.name || 'Pair Programmer'}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: '0.75rem' }}>
            {agentInfo?.role || 'Real-time coding companion'}
          </Typography>
        </Box>

        {/* Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
          {/* Connection Status */}
          <Tooltip title={connectionStatus.label}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.25,
                px: 0.75,
                py: 0.5,
                borderRadius: 1,
                bgcolor: `${connectionStatus.color}15`,
                color: connectionStatus.color
              }}
            >
              {connectionStatus.online ? (
                <CheckCircleIcon sx={{ fontSize: 12 }} />
              ) : (
                <ErrorIcon sx={{ fontSize: 12 }} />
              )}
            </Box>
          </Tooltip>

          {/* Refresh */}
          <Tooltip title="Analyze now">
            <IconButton
              onClick={handleAnalyzeNow}
              size="small"
              disabled={!connectionStatus.online || isAnalyzing}
              sx={{ color: 'text.secondary', p: 0.5 }}
            >
              {isAnalyzing ? (
                <CircularProgress size={14} />
              ) : (
                <RefreshIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>

          {/* Clear */}
          {messages.length > 0 && (
            <Tooltip title="Clear conversation">
              <IconButton
                onClick={handleClear}
                size="small"
                sx={{ color: 'text.secondary', p: 0.5 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {/* TTS Toggle */}
          <Tooltip title={ttsEnabled ? "Disable voice" : "Enable voice"}>
            <IconButton
              onClick={handleToggleTts}
              size="small"
              sx={{ color: ttsEnabled ? 'primary.main' : 'text.secondary', p: 0.5 }}
            >
              {ttsEnabled ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          {/* Close */}
          <Tooltip title="Close">
            <IconButton
              onClick={handleClose}
              size="small"
              sx={{ color: 'text.secondary', p: 0.5 }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Content Area */}
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          p: 2,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* No messages yet */}
        {messages.length === 0 && !isAnalyzing && (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <Typography variant="body2" gutterBottom>
              Waiting for code changes...
            </Typography>
            <Typography variant="caption">
              Edit source files to get real-time feedback
            </Typography>
          </Box>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <Box
            key={msg.id}
            sx={{
              mb: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {/* Message header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              {msg.role === 'assistant' ? (
                <>
                  <Box
                    sx={{
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      bgcolor: agentInfo?.color || '#9C27B0',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.6rem',
                      fontWeight: 600
                    }}
                  >
                    {agentInfo?.avatar || 'PP'}
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    {agentInfo?.name || 'Pair'}
                  </Typography>
                </>
              ) : (
                <>
                  <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 500 }}>
                    You
                  </Typography>
                </>
              )}
              <Typography variant="caption" color="text.secondary">
                {formatRelativeTime(msg.timestamp)}
              </Typography>
              {msg.fileName && msg.role === 'assistant' && (
                <>
                  <Typography variant="caption" color="text.secondary" sx={{ mx: 0.5 }}>
                    ·
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {msg.fileName}
                  </Typography>
                </>
              )}
            </Box>

            {/* Message content */}
            <Box
              sx={{
                maxWidth: '85%',
                p: 1.5,
                borderRadius: 2,
                bgcolor: msg.role === 'user'
                  ? 'primary.main'
                  : agentInfo?.color ? `${agentInfo.color}08` : 'action.hover',
                color: msg.role === 'user' ? 'primary.contrastText' : 'text.primary',
                border: msg.role === 'user' ? 'none' : 1,
                borderColor: agentInfo?.color ? `${agentInfo.color}20` : 'divider'
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
                {msg.content}
              </Typography>
            </Box>
          </Box>
        ))}

        {/* Analyzing indicator */}
        {isAnalyzing && messages.length > 0 && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="caption" color="text.secondary">
              Analyzing...
            </Typography>
          </Box>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input Box */}
      <Box
        sx={{
          p: 2,
          borderTop: 1,
          borderColor: 'divider',
          flexShrink: 0
        }}
      >
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <TextField
            inputRef={inputRef}
            multiline
            maxRows={4}
            fullWidth
            placeholder="Ask a question..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!connectionStatus.online || isAnalyzing}
            variant="outlined"
            size="small"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2
              }
            }}
          />
          <Tooltip title="Send (Enter)">
            <span>
              <IconButton
                onClick={handleSend}
                disabled={!message.trim() || !connectionStatus.online || isAnalyzing}
                color="primary"
                sx={{
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    bgcolor: 'primary.dark'
                  },
                  '&.Mui-disabled': {
                    bgcolor: 'action.disabledBackground',
                    color: 'action.disabled'
                  }
                }}
              >
                {isAnalyzing ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ display: 'block', mt: 0.5, textAlign: 'right' }}
        >
          Enter to send · Shift+Enter for new line
        </Typography>
      </Box>
    </Box>
  )
}
