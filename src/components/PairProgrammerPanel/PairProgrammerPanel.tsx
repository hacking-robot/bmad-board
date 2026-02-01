import { Box, Typography, IconButton, Tooltip, CircularProgress } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import CloseIcon from '@mui/icons-material/Close'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useStore } from '../../store'
import { usePairProgrammer } from '../../hooks/usePairProgrammer'
import { useWorkflow } from '../../hooks/useWorkflow'

interface PairProgrammerPanelProps {
  storyId: string
}

export default function PairProgrammerPanel({ storyId }: PairProgrammerPanelProps) {
  console.log('[PairProgrammerPanel] Rendering for story:', storyId)

  const projectPath = useStore((state) => state.projectPath)
  const isWatching = useStore((state) => state.isWatching)
  const setPairProgrammingPanelOpen = useStore((state) => state.setPairProgrammingPanelOpen)
  const { agents } = useWorkflow()

  const {
    enabled,
    latestFeedback,
    isAnalyzing,
    analyzeNow,
    clearFeedback
  } = usePairProgrammer(storyId)

  console.log('[PairProgrammerPanel] State:', { enabled, hasFeedback: !!latestFeedback, isAnalyzing, isWatching })

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
          {latestFeedback && (
            <Tooltip title="Clear feedback">
              <IconButton
                onClick={handleClear}
                size="small"
                sx={{ color: 'text.secondary', p: 0.5 }}
              >
                <DeleteOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

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
          p: 2
        }}
      >
        {/* No feedback yet */}
        {!latestFeedback && !isAnalyzing && (
          <Box
            sx={{
              height: '100%',
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

        {/* Analyzing */}
        {isAnalyzing && !latestFeedback && (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'text.secondary'
            }}
          >
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography variant="body2">
              Analyzing your code...
            </Typography>
          </Box>
        )}

        {/* Latest Feedback */}
        {latestFeedback && (
          <Box>
            {/* Feedback Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                {latestFeedback.fileName}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatRelativeTime(latestFeedback.timestamp)}
                </Typography>
                {latestFeedback && (
                  <Tooltip title="Clear feedback">
                    <IconButton
                      size="small"
                      onClick={handleClear}
                      sx={{ color: 'text.secondary', p: 0.25 }}
                    >
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </Box>

            {/* Feedback Content */}
            <Box
              sx={{
                p: 2,
                borderRadius: 1,
                bgcolor: agentInfo?.color ? `${agentInfo.color}08` : 'action.hover',
                border: 1,
                borderColor: agentInfo?.color ? `${agentInfo.color}20` : 'divider'
              }}
            >
              <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                {latestFeedback.content}
              </Typography>
            </Box>

            {/* Analyzing indicator */}
            {isAnalyzing && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2, justifyContent: 'center' }}>
                <CircularProgress size={16} />
                <Typography variant="caption" color="text.secondary">
                  Analyzing...
                </Typography>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
