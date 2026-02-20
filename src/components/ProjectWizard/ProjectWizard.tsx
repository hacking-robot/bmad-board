import { useCallback, useEffect, useRef } from 'react'
import { Box, Typography, Button, Stack, Divider, IconButton, Tooltip, Alert } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { useStore } from '../../store'
import { WIZARD_STEPS } from '../../data/wizardSteps'
import WizardStepper from './WizardStepper'
import InstallStep from './InstallStep'

// Simple path join for renderer (no Node path module available)
function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

export default function ProjectWizard() {
  const {
    projectWizard,
    advanceWizardStep,
    skipWizardStep,
    updateWizardStep,
    completeWizard,
    cancelWizard,
    setProjectPath,
    setProjectType,
    addRecentProject,
    setViewMode,
    setSelectedChatAgent,
    setPendingChatMessage
  } = useStore()

  const { isActive, projectPath, currentStep, stepStatuses, error } = projectWizard
  const persistRef = useRef(false)
  const resumeChecked = useRef(false)

  // On mount, check for saved wizard state and resume if found
  useEffect(() => {
    if (!isActive || !projectPath || resumeChecked.current) return
    resumeChecked.current = true

    window.wizardAPI.loadState(projectPath).then((savedState) => {
      if (savedState && typeof savedState === 'object' && 'stepStatuses' in (savedState as Record<string, unknown>)) {
        const { resumeWizard } = useStore.getState()
        const ws = savedState as import('../../types/projectWizard').ProjectWizardState
        // Only resume if wizard was active
        if (ws.isActive && ws.projectPath === projectPath) {
          resumeWizard(ws)
        }
      }
    })
  }, [isActive, projectPath])

  // Persist wizard state on changes
  useEffect(() => {
    if (!isActive || !projectPath) return
    // Skip first render
    if (!persistRef.current) {
      persistRef.current = true
      return
    }
    window.wizardAPI.saveState(projectPath, projectWizard)
  }, [isActive, projectPath, currentStep, stepStatuses, projectWizard])

  // Start wizard file watcher when active
  useEffect(() => {
    if (!isActive || !projectPath) return
    window.wizardAPI.startWatching(projectPath)
    return () => { window.wizardAPI.stopWatching() }
  }, [isActive, projectPath])

  // Listen for file changes to auto-detect step completion
  useEffect(() => {
    if (!isActive || !projectPath) return

    const cleanup = window.wizardAPI.onFileChanged(async () => {
      // Check each pending agent step for output file existence
      for (let i = 0; i < WIZARD_STEPS.length; i++) {
        const step = WIZARD_STEPS[i]
        const status = stepStatuses[i]
        if (status !== 'pending' && status !== 'active') continue
        if (!step.outputFile) continue

        const filePath = joinPath(projectPath, '_bmad-output', 'planning-artifacts', step.outputFile)
        const exists = await window.wizardAPI.checkFileExists(filePath)
        if (exists) {
          updateWizardStep(i, 'completed')
        }
      }
    })

    return cleanup
  }, [isActive, projectPath, stepStatuses, updateWizardStep])

  const handleInstallComplete = useCallback(() => {
    advanceWizardStep()
  }, [advanceWizardStep])

  const handleStartAgentStep = useCallback((stepIndex: number) => {
    const step = WIZARD_STEPS[stepIndex]
    if (!step || step.type !== 'agent' || !step.agentId || !step.command) return

    updateWizardStep(stepIndex, 'active')

    // Switch to chat view with the correct agent and command
    setSelectedChatAgent(step.agentId)
    setViewMode('chat')
    setPendingChatMessage({
      agentId: step.agentId,
      message: step.command
    })
  }, [updateWizardStep, setSelectedChatAgent, setViewMode, setPendingChatMessage])

  const handleMarkStepComplete = useCallback((stepIndex: number) => {
    updateWizardStep(stepIndex, 'completed')
    // If this was the current step, advance
    if (stepIndex === currentStep) {
      advanceWizardStep()
    }
  }, [currentStep, updateWizardStep, advanceWizardStep])

  const handleSkipStep = useCallback((stepIndex: number) => {
    skipWizardStep(stepIndex)
  }, [skipWizardStep])

  const handleFinishSetup = useCallback(async () => {
    if (!projectPath) return

    // Delete wizard state file
    await window.wizardAPI.deleteState(projectPath)
    await window.wizardAPI.stopWatching()

    // Set the project as loaded
    const projectName = projectPath.split('/').pop() || 'Unknown'
    setProjectPath(projectPath)
    setProjectType('bmm')
    addRecentProject({
      path: projectPath,
      projectType: 'bmm',
      name: projectName
    })

    completeWizard()
  }, [projectPath, setProjectPath, setProjectType, addRecentProject, completeWizard])

  const handleCancel = useCallback(async () => {
    if (projectPath) {
      await window.wizardAPI.deleteState(projectPath)
      await window.wizardAPI.stopWatching()
    }
    cancelWizard()
  }, [projectPath, cancelWizard])

  if (!isActive) return null

  const currentStepData = WIZARD_STEPS[currentStep]
  const isInstallStep = currentStep === 0
  const allRequiredDone = WIZARD_STEPS.every((step, i) =>
    !step.required || stepStatuses[i] === 'completed'
  )
  const isFinished = currentStep >= WIZARD_STEPS.length || allRequiredDone

  return (
    <Box
      sx={{
        width: 360,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRight: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        flexShrink: 0
      }}
    >
      {/* Header */}
      <Box sx={{ pt: 5, px: 2, pb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Stack direction="row" alignItems="center" spacing={1}>
            <FolderOpenIcon color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              New Project Setup
            </Typography>
          </Stack>
          <Tooltip title="Cancel wizard">
            <IconButton size="small" onClick={handleCancel}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {projectPath?.split('/').pop() || 'Unknown'}
        </Typography>
      </Box>

      {/* Stepper */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <WizardStepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          stepStatuses={stepStatuses}
          onSkipStep={handleSkipStep}
          onStartStep={handleStartAgentStep}
        />

        {/* Current step detail area */}
        <Divider />
        <Box sx={{ p: 2 }}>
          {isInstallStep && stepStatuses[0] !== 'completed' ? (
            <InstallStep onComplete={handleInstallComplete} />
          ) : currentStepData && !isFinished ? (
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                {currentStepData.description}
              </Typography>

              {currentStepData.type === 'agent' && stepStatuses[currentStep] === 'pending' && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrowIcon />}
                  onClick={() => handleStartAgentStep(currentStep)}
                  fullWidth
                >
                  Start with {currentStepData.agentName}
                </Button>
              )}

              {currentStepData.type === 'agent' && stepStatuses[currentStep] === 'active' && (
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  Chat with {currentStepData.agentName} in the chat panel. When done, return here and mark the step complete.
                </Alert>
              )}

              {stepStatuses[currentStep] === 'active' && (
                <Button
                  variant="outlined"
                  startIcon={<CheckIcon />}
                  onClick={() => handleMarkStepComplete(currentStep)}
                  fullWidth
                >
                  Mark Complete
                </Button>
              )}
            </Stack>
          ) : null}

          {/* Finish button when all required steps done */}
          {isFinished && (
            <Stack spacing={2}>
              <Alert severity="success">
                All required steps are complete! Your project is ready to use.
              </Alert>
              <Button
                variant="contained"
                color="success"
                onClick={handleFinishSetup}
                fullWidth
                size="large"
              >
                Finish Setup
              </Button>
            </Stack>
          )}

          {/* Error display */}
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </Box>
      </Box>
    </Box>
  )
}
