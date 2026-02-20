import { useCallback, useEffect, useRef, useMemo } from 'react'
import { Box, Typography, Button, Stack, Divider, IconButton, Tooltip, Alert } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import { useStore } from '../../store'
import { WIZARD_STEPS } from '../../data/wizardSteps'
import { HUMAN_DEV_FILES, HUMAN_DEV_FILES_VERSION } from '../../data/humanDevFiles'
import { resolveCommand, mergeWorkflowConfig } from '../../utils/workflowMerge'
import { useWorkflow } from '../../hooks/useWorkflow'
import { transformCommand } from '../../utils/commandTransform'
import type { BmadScanResult } from '../../types/bmadScan'
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
    setPendingChatMessage,
    clearChatThread,
    bmadScanResult,
    setBmadScanResult,
    setScannedWorkflowConfig,
    aiTool,
    outputFolder
  } = useStore()

  const { getAgentName } = useWorkflow()
  const { isActive, projectPath, currentStep, stepStatuses, error } = projectWizard
  const persistRef = useRef(false)
  const resumeChecked = useRef(false)

  // On mount, check for saved wizard state and resume if found
  useEffect(() => {
    if (!isActive || !projectPath || resumeChecked.current) return
    resumeChecked.current = true

    window.wizardAPI.loadState(projectPath, outputFolder).then((savedState) => {
      if (savedState && typeof savedState === 'object' && 'stepStatuses' in (savedState as Record<string, unknown>)) {
        const { resumeWizard } = useStore.getState()
        const ws = savedState as import('../../types/projectWizard').ProjectWizardState
        // Only resume if wizard was active
        if (ws.isActive && ws.projectPath === projectPath) {
          resumeWizard(ws)
        }
      }
    })
  }, [isActive, projectPath, outputFolder])

  // Persist wizard state on changes
  useEffect(() => {
    if (!isActive || !projectPath) return
    // Skip first render
    if (!persistRef.current) {
      persistRef.current = true
      return
    }
    window.wizardAPI.saveState(projectPath, projectWizard, outputFolder)
  }, [isActive, projectPath, outputFolder, currentStep, stepStatuses, projectWizard])

  // Start wizard file watcher when active
  useEffect(() => {
    if (!isActive || !projectPath) return
    window.wizardAPI.startWatching(projectPath, outputFolder)
    return () => { window.wizardAPI.stopWatching() }
  }, [isActive, projectPath, outputFolder])

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

        const filePath = joinPath(projectPath, outputFolder, 'planning-artifacts', step.outputFile)
        const exists = await window.wizardAPI.checkFileExists(filePath)
        if (exists) {
          updateWizardStep(i, 'completed')
        }
      }
    })

    return cleanup
  }, [isActive, projectPath, stepStatuses, updateWizardStep])

  // Enrich wizard steps with dynamically resolved agent names from scan data
  const resolvedSteps = useMemo(() => {
    return WIZARD_STEPS.map(step => {
      if (step.type !== 'agent' || !step.commandRef || !bmadScanResult) return step
      const resolved = resolveCommand(step.commandRef, step.commandModule || '', step.commandType || 'workflows', bmadScanResult, step.agentId)
      if (!resolved) return step
      return {
        ...step,
        agentId: resolved.agentId,
        agentName: getAgentName(resolved.agentId)
      }
    })
  }, [bmadScanResult, getAgentName])

  const { appendWizardInstallLog, setWizardError } = useStore()

  const handleInstallComplete = useCallback(async () => {
    // Apply human developer mode files if selected
    const { projectWizard: wizState } = useStore.getState()
    if (wizState.developerMode === 'human' && projectPath) {
      appendWizardInstallLog('Applying human development mode...')

      // After install, scan to get installed BMAD version and check compatibility
      try {
        const scanResult = await window.fileAPI.scanBmad(projectPath)
        const scan = scanResult as BmadScanResult | null
        if (scan?.version && scan.version !== HUMAN_DEV_FILES_VERSION) {
          const major = (v: string) => v.split('.')[0]
          if (major(scan.version) !== major(HUMAN_DEV_FILES_VERSION)) {
            appendWizardInstallLog(
              `Warning: Human dev files target BMAD ${HUMAN_DEV_FILES_VERSION}, ` +
              `but installed version is ${scan.version}. Files may need updating.`
            )
          }
        }
      } catch {
        // Scan failure is non-fatal for this check
      }

      const result = await window.wizardAPI.writeProjectFiles(projectPath, HUMAN_DEV_FILES)
      if (!result.success) {
        setWizardError(`Human dev mode setup failed: ${result.error}`)
        return
      }
      appendWizardInstallLog(`Human development mode applied (${result.written} files updated)`)
    }

    advanceWizardStep()
    // Trigger BMAD scan after install so subsequent steps can resolve dynamically
    if (projectPath) {
      console.log('[Wizard] Install complete, scanning:', projectPath)
      window.fileAPI.scanBmad(projectPath).then((scanResult) => {
        const result = scanResult as BmadScanResult | null
        console.log('[Wizard] Scan result:', result ? `${result.agents.length} agents` : 'null')
        setBmadScanResult(result)
        if (result) {
          const { projectType: currentProjectType } = useStore.getState()
          console.log('[Wizard] Merging with projectType:', currentProjectType)
          const merged = mergeWorkflowConfig(result, currentProjectType)
          console.log('[Wizard] Merged config agents:', merged.agents.length)
          setScannedWorkflowConfig(merged)
        }
      }).catch((err) => {
        console.error('[Wizard] Scan failed:', err)
      })
    } else {
      console.warn('[Wizard] No projectPath for scan')
    }
  }, [advanceWizardStep, projectPath, setBmadScanResult, setScannedWorkflowConfig, appendWizardInstallLog, setWizardError])

  const handleStartAgentStep = useCallback((stepIndex: number) => {
    const step = WIZARD_STEPS[stepIndex]
    if (!step || step.type !== 'agent') return

    // Resolve command dynamically from scan data
    let agentId = step.agentId
    let command: string | undefined

    if (step.commandRef && bmadScanResult) {
      const resolved = resolveCommand(step.commandRef, step.commandModule || '', step.commandType || 'workflows', bmadScanResult, step.agentId)
      if (resolved) {
        agentId = resolved.agentId
        command = transformCommand(resolved.command, aiTool)
      }
    }

    if (!agentId) return

    // If command couldn't be resolved from scan, open agent chat without a pre-filled command
    updateWizardStep(stepIndex, 'active')
    // Cancel any running process for this agent before clearing
    window.chatAPI.cancelMessage(agentId).catch(() => {})
    clearChatThread(agentId)
    setSelectedChatAgent(agentId)
    setViewMode('chat')
    if (command) {
      setPendingChatMessage({
        agentId,
        message: command
      })
    }
  }, [updateWizardStep, clearChatThread, setSelectedChatAgent, setViewMode, setPendingChatMessage, bmadScanResult, aiTool])

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
    await window.wizardAPI.deleteState(projectPath, outputFolder)
    await window.wizardAPI.stopWatching()

    // Set the project as loaded
    const projectName = projectPath.split('/').pop() || 'Unknown'
    setProjectPath(projectPath)
    setProjectType('bmm')
    addRecentProject({
      path: projectPath,
      projectType: 'bmm',
      name: projectName,
      outputFolder
    })

    completeWizard()
  }, [projectPath, outputFolder, setProjectPath, setProjectType, addRecentProject, completeWizard])

  const handleCancel = useCallback(async () => {
    if (projectPath) {
      await window.wizardAPI.deleteState(projectPath, outputFolder)
      await window.wizardAPI.stopWatching()
    }
    cancelWizard()
  }, [projectPath, outputFolder, cancelWizard])

  if (!isActive) return null

  const currentStepData = resolvedSteps[currentStep]
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
          steps={resolvedSteps}
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
