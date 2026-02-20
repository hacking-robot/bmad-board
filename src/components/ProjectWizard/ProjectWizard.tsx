import { useCallback, useEffect, useRef, useMemo, useState } from 'react'
import { Box, Typography, Button, Stack, Divider, IconButton, Tooltip, Alert, Chip, Popover, Badge } from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CheckIcon from '@mui/icons-material/Check'
import CloseIcon from '@mui/icons-material/Close'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import NavigateNextIcon from '@mui/icons-material/NavigateNext'
import ReplayIcon from '@mui/icons-material/Replay'
import SkipNextIcon from '@mui/icons-material/SkipNext'
import DescriptionIcon from '@mui/icons-material/Description'
import { useStore } from '../../store'
import { WIZARD_STEPS } from '../../data/wizardSteps'
import { HUMAN_DEV_FILES, HUMAN_DEV_FILES_VERSION } from '../../data/humanDevFiles'
import { resolveCommand, mergeWorkflowConfig } from '../../utils/workflowMerge'
import { useWorkflow } from '../../hooks/useWorkflow'
import { transformCommand } from '../../utils/commandTransform'
import { CLAUDE_MODELS } from '../../types'
import type { BmadScanResult } from '../../types/bmadScan'
import type { WizardStep } from '../../types/projectWizard'
import WizardStepper from './WizardStepper'
import InstallStep from './InstallStep'
import ArtifactViewer from '../HelpPanel/ArtifactViewer'
import { usePlanningArtifacts, getArtifactTypeLabel, getArtifactTypeColor, PlanningArtifact } from '../../hooks/usePlanningArtifacts'

// Simple path join for renderer (no Node path module available)
function joinPath(...parts: string[]): string {
  return parts.join('/').replace(/\/+/g, '/')
}

// Check if a wizard step's output exists (file or dir+prefix)
// BMAD places some outputs in planning-artifacts/ and others (brainstorming/, research/)
// directly under the output folder, so check both locations.
async function checkStepOutput(step: WizardStep, projectPath: string, outputFolder: string): Promise<boolean> {
  const outputBase = joinPath(projectPath, outputFolder)
  const planBase = joinPath(outputBase, 'planning-artifacts')
  if (step.outputFile) {
    // Check planning-artifacts first, then output folder root
    if (await window.wizardAPI.checkFileExists(joinPath(planBase, step.outputFile))) return true
    return window.wizardAPI.checkFileExists(joinPath(outputBase, step.outputFile))
  }
  if (step.outputDir && step.outputDirPrefix) {
    // Check planning-artifacts first, then output folder root
    if (await window.wizardAPI.checkDirHasPrefix(joinPath(planBase, step.outputDir), step.outputDirPrefix)) return true
    return window.wizardAPI.checkDirHasPrefix(joinPath(outputBase, step.outputDir), step.outputDirPrefix)
  }
  return false
}

export default function ProjectWizard() {
  const {
    projectWizard,
    advanceWizardStep,
    skipWizardStep,
    updateWizardStep,
    goToWizardStep,
    rerunWizardStep,
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
    claudeModel,
    setClaudeModel,
    outputFolder
  } = useStore()

  const { getAgentName } = useWorkflow()
  const { isActive, projectPath, currentStep, stepStatuses, error } = projectWizard
  const persistRef = useRef(false)
  const [docsAnchor, setDocsAnchor] = useState<null | HTMLElement>(null)
  const [selectedArtifact, setSelectedArtifact] = useState<PlanningArtifact | null>(null)
  const { artifacts, refresh: refreshArtifacts } = usePlanningArtifacts()

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

  // On resume, if install step is already done, trigger a BMAD scan so agent commands resolve.
  // The scan normally runs in handleInstallComplete, but on resume it's skipped.
  useEffect(() => {
    if (!isActive || !projectPath || bmadScanResult) return
    if (!stepStatuses.length || stepStatuses[0] !== 'completed') return
    window.fileAPI.scanBmad(projectPath).then((scanResult) => {
      const result = scanResult as BmadScanResult | null
      setBmadScanResult(result)
      if (result) {
        const { projectType: currentProjectType } = useStore.getState()
        const merged = mergeWorkflowConfig(result, currentProjectType)
        setScannedWorkflowConfig(merged)
      }
    }).catch(() => {})
  }, [isActive, projectPath, bmadScanResult, stepStatuses, setBmadScanResult, setScannedWorkflowConfig])

  // After mount, check if any pending/active steps already have their output file.
  // This handles: (1) resume where agent finished but user didn't click "Mark Complete",
  // (2) resume where files were created externally (e.g., by CLI) while wizard was closed.
  // The file watcher only fires on changes, so pre-existing files need this initial scan.
  const initialFileCheckDone = useRef(false)
  useEffect(() => {
    if (!isActive || !projectPath || initialFileCheckDone.current) return
    if (!stepStatuses.length) return
    // Wait for any resume to settle
    const timer = setTimeout(async () => {
      initialFileCheckDone.current = true
      const { projectWizard: wiz } = useStore.getState()
      for (let i = 0; i < WIZARD_STEPS.length; i++) {
        const status = wiz.stepStatuses[i]
        if (status !== 'pending' && status !== 'active') continue
        const step = WIZARD_STEPS[i]
        if (!step.outputFile && !step.outputDir) continue
        const exists = await checkStepOutput(step, projectPath, outputFolder)
        if (exists) {
          const { updateWizardStep, advanceWizardStep, projectWizard: freshWiz } = useStore.getState()
          updateWizardStep(i, 'completed')
          if (i === freshWiz.currentStep) {
            advanceWizardStep()
          }
        }
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [isActive, projectPath, outputFolder, stepStatuses])

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
      // Refresh planning documents list
      refreshArtifacts()

      // Check each pending (not yet started) step for output file existence.
      // Active steps are excluded — the agent may still be building the file,
      // so the user should decide when it's done via "Mark Complete".
      const { projectWizard: wiz } = useStore.getState()
      for (let i = 0; i < WIZARD_STEPS.length; i++) {
        const step = WIZARD_STEPS[i]
        const status = wiz.stepStatuses[i]
        if (status !== 'pending') continue
        // Skip the current step — the user may have navigated back to re-run it,
        // so don't auto-complete based on a pre-existing output file.
        if (i === wiz.currentStep) continue
        if (!step.outputFile && !step.outputDir) continue

        const exists = await checkStepOutput(step, projectPath, outputFolder)
        if (exists) {
          updateWizardStep(i, 'completed')
        }
      }
    })

    return cleanup
  }, [isActive, projectPath, outputFolder, updateWizardStep, advanceWizardStep])

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
      outputFolder,
      developerMode: projectWizard.developerMode
    })

    completeWizard()
  }, [projectPath, outputFolder, setProjectPath, setProjectType, addRecentProject, completeWizard])

  const handleCancel = useCallback(async () => {
    if (projectPath) {
      // Keep the wizard state file so the wizard can be resumed later
      await window.wizardAPI.stopWatching()
    }
    cancelWizard()
  }, [projectPath, cancelWizard])

  if (!isActive) return null

  const currentStepData = resolvedSteps[currentStep]
  const isInstallStep = currentStep === 0
  const allRequiredDone = WIZARD_STEPS.every((step, i) =>
    !step.required || stepStatuses[i] === 'completed'
  )
  const isFinished = currentStep >= WIZARD_STEPS.length

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
          <Stack direction="row" spacing={0.5} alignItems="center">
            {artifacts.length > 0 && (
              <Tooltip title="Planning Documents">
                <IconButton size="small" onClick={(e) => setDocsAnchor(e.currentTarget)}>
                  <Badge badgeContent={artifacts.length} color="primary" max={99}>
                    <DescriptionIcon fontSize="small" />
                  </Badge>
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Cancel wizard">
              <IconButton size="small" onClick={handleCancel}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {projectPath?.split('/').pop() || 'Unknown'}
        </Typography>
        {aiTool === 'claude-code' && (
          <Tooltip title="Applied on the next new conversation" placement="bottom" arrow>
            <Box sx={{ display: 'flex', gap: 0.5, mt: 1 }}>
              {CLAUDE_MODELS.map((model) => (
                <Chip
                  key={model.id}
                  label={model.name}
                  size="small"
                  onClick={() => setClaudeModel(model.id)}
                  color={claudeModel === model.id ? 'primary' : 'default'}
                  variant={claudeModel === model.id ? 'filled' : 'outlined'}
                  sx={{ cursor: 'pointer', fontSize: '0.7rem', height: 22 }}
                />
              ))}
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Stepper */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <WizardStepper
          steps={resolvedSteps}
          currentStep={currentStep}
          stepStatuses={stepStatuses}
          onSkipStep={handleSkipStep}
          onStartStep={handleStartAgentStep}
          onGoToStep={goToWizardStep}
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
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PlayArrowIcon />}
                    onClick={() => handleStartAgentStep(currentStep)}
                    sx={{ flex: 1 }}
                  >
                    Start with {currentStepData.agentName}
                  </Button>
                  {!currentStepData.required && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<SkipNextIcon />}
                      onClick={() => handleSkipStep(currentStep)}
                    >
                      Skip
                    </Button>
                  )}
                </Stack>
              )}

              {currentStepData.type === 'agent' && stepStatuses[currentStep] === 'active' && (
                <Alert severity="info" sx={{ fontSize: '0.8rem' }}>
                  Chat with {currentStepData.agentName} in the chat panel. When done, return here and mark the step complete.
                </Alert>
              )}

              {stepStatuses[currentStep] === 'active' && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CheckIcon />}
                    onClick={() => handleMarkStepComplete(currentStep)}
                    sx={{ flex: 1 }}
                  >
                    Mark Complete
                  </Button>
                  {!currentStepData.required && (
                    <Button
                      variant="outlined"
                      size="small"
                      color="inherit"
                      startIcon={<SkipNextIcon />}
                      onClick={() => handleSkipStep(currentStep)}
                    >
                      Skip
                    </Button>
                  )}
                </Stack>
              )}

              {stepStatuses[currentStep] === 'completed' && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="contained"
                    endIcon={<NavigateNextIcon />}
                    onClick={() => advanceWizardStep()}
                    sx={{ flex: 1 }}
                  >
                    Next Step
                  </Button>
                  {currentStepData.type === 'agent' && (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<ReplayIcon />}
                      onClick={() => rerunWizardStep(currentStep)}
                    >
                      Re-run
                    </Button>
                  )}
                </Stack>
              )}

              {(stepStatuses[currentStep] === 'skipped') && currentStepData.type === 'agent' && (
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<ReplayIcon />}
                    onClick={() => rerunWizardStep(currentStep)}
                    sx={{ flex: 1 }}
                  >
                    Run this step
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    endIcon={<NavigateNextIcon />}
                    onClick={() => advanceWizardStep()}
                  >
                    Next Step
                  </Button>
                </Stack>
              )}

              {allRequiredDone && (
                <Button
                  variant="contained"
                  color="success"
                  onClick={handleFinishSetup}
                  fullWidth
                  size="small"
                  sx={{ mt: 1 }}
                >
                  Finish Setup
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
      {/* Planning Documents Popover */}
      <Popover
        open={Boolean(docsAnchor)}
        anchorEl={docsAnchor}
        onClose={() => setDocsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{
          paper: {
            sx: { p: 2, maxWidth: 360, maxHeight: 400, overflow: 'auto', borderRadius: 1.5 }
          }
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
          Planning Documents
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {artifacts.map((artifact) => (
            <Box
              key={artifact.path}
              onClick={() => { setSelectedArtifact(artifact); setDocsAnchor(null) }}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                p: 0.75,
                borderRadius: 0.5,
                cursor: 'pointer',
                '&:hover': { bgcolor: 'action.selected' }
              }}
            >
              <DescriptionIcon sx={{ fontSize: 16, color: getArtifactTypeColor(artifact.type) }} />
              <Typography variant="body2" sx={{ flex: 1 }}>
                {artifact.displayName}
              </Typography>
              <Typography
                variant="caption"
                sx={{
                  fontSize: '0.65rem',
                  px: 0.5,
                  py: 0.125,
                  borderRadius: 0.5,
                  bgcolor: getArtifactTypeColor(artifact.type),
                  color: 'white'
                }}
              >
                {getArtifactTypeLabel(artifact.type)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Popover>

      {/* Planning Artifact Viewer Dialog */}
      <ArtifactViewer
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />
    </Box>
  )
}
