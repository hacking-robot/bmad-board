import { Box, Switch, FormControlLabel, Typography, IconButton, Tooltip, Chip, Collapse, Slider, Badge } from '@mui/material'
import ClearIcon from '@mui/icons-material/Clear'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import TimerIcon from '@mui/icons-material/Timer'
import QuestionAnswerIcon from '@mui/icons-material/QuestionAnswer'
import { useState } from 'react'
import { useStore } from '../../store'
import { ORCHESTRATION_LIMITS } from '../../types/orchestration'

export default function OrchestrationControl() {
  const [expanded, setExpanded] = useState(false)

  const orchestration = useStore((state) => state.orchestration)
  const setAutomationEnabled = useStore((state) => state.setOrchestrationAutomationEnabled)
  const setAutoTriggerOnStatusChange = useStore((state) => state.setOrchestrationAutoTriggerOnStatusChange)
  const setAutoTriggerOnAgentComplete = useStore((state) => state.setOrchestrationAutoTriggerOnAgentComplete)
  const clearEventQueue = useStore((state) => state.clearOrchestrationEventQueue)
  const resetChainDepth = useStore((state) => state.resetOrchestrationChainDepth)
  const setTimerConfig = useStore((state) => state.setOrchestrationTimerConfig)

  const {
    automationEnabled,
    autoTriggerOnStatusChange,
    autoTriggerOnAgentComplete,
    isProcessing,
    eventQueue,
    chainDepth,
    timerConfig,
    pendingQuestions
  } = orchestration

  const queueSize = eventQueue.length
  const pendingQuestionCount = pendingQuestions.filter(q => q.status === 'pending').length

  // Convert interval to minutes for display
  const intervalMinutes = Math.round(timerConfig.intervalMs / 60000)

  const handleIntervalChange = (_: unknown, value: number | number[]) => {
    const minutes = value as number
    setTimerConfig({ intervalMs: minutes * 60000 })
  }

  const handlePauseResume = () => {
    if (automationEnabled) {
      // Pause - clear queue and disable
      clearEventQueue()
      resetChainDepth()
      setAutomationEnabled(false)
    } else {
      // Resume
      setAutomationEnabled(true)
    }
  }

  const handleClearQueue = () => {
    clearEventQueue()
    resetChainDepth()
  }

  const isAtChainLimit = chainDepth >= ORCHESTRATION_LIMITS.MAX_CHAIN_DEPTH

  return (
    <Box
      sx={{
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper'
      }}
    >
      {/* Collapsed header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          px: 2,
          py: 1,
          cursor: 'pointer',
          '&:hover': { bgcolor: 'action.hover' }
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', flex: 1 }}>
          AUTO-WORKFLOW
        </Typography>

        {/* Status indicators */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 1 }}>
          {automationEnabled && (
            <>
              {timerConfig.enabled && (
                <Tooltip title={`Timer: ${intervalMinutes}min`}>
                  <Chip
                    icon={<TimerIcon sx={{ fontSize: '0.85rem' }} />}
                    label={`${intervalMinutes}m`}
                    size="small"
                    color="info"
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Tooltip>
              )}
              {isProcessing && (
                <Chip
                  label="Processing"
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {queueSize > 0 && (
                <Chip
                  label={`Queue: ${queueSize}`}
                  size="small"
                  color="warning"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
              {isAtChainLimit && (
                <Chip
                  label="Chain limit"
                  size="small"
                  color="error"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </>
          )}
          {pendingQuestionCount > 0 && (
            <Tooltip title={`${pendingQuestionCount} pending question${pendingQuestionCount > 1 ? 's' : ''}`}>
              <Badge badgeContent={pendingQuestionCount} color="secondary">
                <QuestionAnswerIcon fontSize="small" color="action" />
              </Badge>
            </Tooltip>
          )}
          <Switch
            checked={automationEnabled}
            onChange={(e) => setAutomationEnabled(e.target.checked)}
            size="small"
            onClick={(e) => e.stopPropagation()}
          />
        </Box>

        {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </Box>

      {/* Expanded controls */}
      <Collapse in={expanded}>
        <Box sx={{ px: 2, pb: 2 }}>
          {/* Trigger options */}
          <Box sx={{ mb: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoTriggerOnStatusChange}
                  onChange={(e) => setAutoTriggerOnStatusChange(e.target.checked)}
                  size="small"
                  disabled={!automationEnabled}
                />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Trigger on status change
                </Typography>
              }
              sx={{ ml: 0 }}
            />
          </Box>

          <Box sx={{ mb: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={autoTriggerOnAgentComplete}
                  onChange={(e) => setAutoTriggerOnAgentComplete(e.target.checked)}
                  size="small"
                  disabled={!automationEnabled}
                />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Trigger on agent complete
                </Typography>
              }
              sx={{ ml: 0 }}
            />
          </Box>

          {/* Timer controls */}
          <Box sx={{ mb: 1.5, mt: 2, borderTop: 1, borderColor: 'divider', pt: 1.5 }}>
            <FormControlLabel
              control={
                <Switch
                  checked={timerConfig.enabled}
                  onChange={(e) => setTimerConfig({ enabled: e.target.checked })}
                  size="small"
                  disabled={!automationEnabled}
                />
              }
              label={
                <Typography variant="caption" color="text.secondary">
                  Periodic timer (autonomous checks)
                </Typography>
              }
              sx={{ ml: 0 }}
            />

            {timerConfig.enabled && automationEnabled && (
              <Box sx={{ px: 1, mt: 1 }}>
                <Typography variant="caption" color="text.secondary" gutterBottom>
                  Interval: {intervalMinutes} minute{intervalMinutes !== 1 ? 's' : ''}
                </Typography>
                <Slider
                  value={intervalMinutes}
                  onChange={handleIntervalChange}
                  min={1}
                  max={30}
                  step={1}
                  marks={[
                    { value: 1, label: '1m' },
                    { value: 5, label: '5m' },
                    { value: 15, label: '15m' },
                    { value: 30, label: '30m' }
                  ]}
                  size="small"
                  sx={{ mt: 0.5 }}
                />
              </Box>
            )}
          </Box>

          {/* Actions */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title={automationEnabled ? 'Pause automation' : 'Resume automation'}>
              <IconButton
                size="small"
                onClick={handlePauseResume}
                sx={{
                  bgcolor: automationEnabled ? 'warning.main' : 'success.main',
                  color: 'white',
                  '&:hover': {
                    bgcolor: automationEnabled ? 'warning.dark' : 'success.dark'
                  }
                }}
              >
                {automationEnabled ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
              </IconButton>
            </Tooltip>

            <Tooltip title="Clear event queue">
              <span>
                <IconButton
                  size="small"
                  onClick={handleClearQueue}
                  disabled={queueSize === 0}
                >
                  <ClearIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          {/* Chain depth info */}
          {chainDepth > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Chain depth: {chainDepth}/{ORCHESTRATION_LIMITS.MAX_CHAIN_DEPTH}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}
