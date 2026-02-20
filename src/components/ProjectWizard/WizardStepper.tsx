import { Box, Typography, Chip, IconButton, Tooltip } from '@mui/material'
import CircularProgress from '@mui/material/CircularProgress'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import TerminalIcon from '@mui/icons-material/Terminal'
import { WizardStep, WizardStepStatus, WizardPhase } from '../../types/projectWizard'
import { PHASE_LABELS } from '../../data/wizardSteps'

interface WizardStepperProps {
  steps: WizardStep[]
  currentStep: number
  stepStatuses: WizardStepStatus[]
  onSkipStep?: (stepIndex: number) => void
  onStartStep?: (stepIndex: number) => void
}

function getStatusIcon(status: WizardStepStatus, isActive: boolean) {
  if (isActive && status === 'active') {
    return <CircularProgress size={20} color="primary" />
  }

  switch (status) {
    case 'completed':
      return <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
    case 'error':
      return <ErrorIcon sx={{ fontSize: 20, color: 'error.main' }} />
    case 'skipped':
      return <SkipNextIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
    case 'active':
      return <CircularProgress size={20} color="primary" />
    case 'pending':
    default:
      return <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: 'text.disabled' }} />
  }
}

function getStepTypeIcon(step: WizardStep) {
  return step.type === 'system'
    ? <TerminalIcon sx={{ fontSize: 14 }} />
    : <SmartToyIcon sx={{ fontSize: 14 }} />
}

function getPhaseColor(phase: WizardPhase): string {
  switch (phase) {
    case 'install': return '#6366F1'
    case 'analysis': return '#8B5CF6'
    case 'planning': return '#3B82F6'
    case 'solutioning': return '#10B981'
    default: return '#6B7280'
  }
}

export default function WizardStepper({ steps, currentStep, stepStatuses, onSkipStep, onStartStep }: WizardStepperProps) {
  let lastPhase: WizardPhase | null = null

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, py: 1 }}>
      {steps.map((step, index) => {
        const status = stepStatuses[index] || 'pending'
        const isActive = index === currentStep
        const isPast = status === 'completed' || status === 'skipped'
        const isFuture = index > currentStep && status === 'pending'
        const showPhaseHeader = step.phase !== lastPhase
        lastPhase = step.phase

        return (
          <Box key={step.id}>
            {/* Phase header */}
            {showPhaseHeader && (
              <Box sx={{ px: 1.5, pt: index === 0 ? 0 : 1.5, pb: 0.5 }}>
                <Chip
                  label={PHASE_LABELS[step.phase] || step.phase}
                  size="small"
                  sx={{
                    bgcolor: getPhaseColor(step.phase),
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    height: 22
                  }}
                />
              </Box>
            )}

            {/* Step row */}
            <Box
              onClick={() => {
                if (isActive && status === 'pending' && onStartStep) {
                  onStartStep(index)
                }
              }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 0.75,
                borderRadius: 1,
                bgcolor: isActive ? 'action.selected' : 'transparent',
                opacity: isFuture ? 0.5 : 1,
                transition: 'all 0.2s',
                cursor: isActive && status === 'pending' ? 'pointer' : 'default',
                '&:hover': isActive && status === 'pending' ? { bgcolor: 'action.hover' } : {}
              }}
            >
              {/* Status icon */}
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, flexShrink: 0 }}>
                {getStatusIcon(status, isActive)}
              </Box>

              {/* Step type icon */}
              <Box sx={{ color: 'text.disabled', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {getStepTypeIcon(step)}
              </Box>

              {/* Step name + agent */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Typography
                  variant="body2"
                  sx={{
                    fontWeight: isActive ? 600 : 400,
                    color: status === 'error' ? 'error.main' : status === 'skipped' ? 'text.disabled' : isActive ? 'text.primary' : isPast ? 'text.secondary' : 'text.secondary',
                    textDecoration: status === 'skipped' ? 'line-through' : 'none',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: step.agentName ? 1.3 : 1.5
                  }}
                >
                  {step.name}
                </Typography>
                {step.agentName && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      color: isActive ? 'primary.main' : 'text.disabled',
                      fontStyle: 'italic',
                      lineHeight: 1.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {step.agentName}
                  </Typography>
                )}
              </Box>

              {/* Required badge */}
              {step.required && status === 'pending' && (
                <Chip label="Required" size="small" sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'warning.light', color: 'warning.contrastText' }} />
              )}

              {/* Skip button for optional steps */}
              {!step.required && isActive && status === 'pending' && onSkipStep && (
                <Tooltip title="Skip this step">
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); onSkipStep(index) }} sx={{ p: 0.25 }}>
                    <SkipNextIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Tooltip>
              )}

              {/* Status label for completed/error */}
              {status !== 'pending' && status !== 'active' && (
                <Typography
                  variant="caption"
                  sx={{
                    color: status === 'completed' ? 'success.main' : status === 'error' ? 'error.main' : 'text.disabled',
                    textTransform: 'capitalize',
                    flexShrink: 0
                  }}
                >
                  {status}
                </Typography>
              )}
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
