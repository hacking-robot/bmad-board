import { useCallback } from 'react'
import { useStore } from '../store'
import { FULL_CYCLE_STEPS_BMM, FULL_CYCLE_STEPS_BMGD, FullCycleStep } from '../types/fullCycle'

/**
 * useFullCycle - Hook for managing full cycle automation state
 *
 * The actual orchestration is done by FullCycleOrchestrator component.
 * This hook just provides the state and start/cancel functions.
 */
export function useFullCycle() {
  const projectType = useStore((state) => state.projectType)
  const stories = useStore((state) => state.stories)

  // Full cycle state
  const fullCycle = useStore((state) => state.fullCycle)
  const startFullCycle = useStore((state) => state.startFullCycle)
  const appendFullCycleLog = useStore((state) => state.appendFullCycleLog)
  const cancelFullCycle = useStore((state) => state.cancelFullCycle)
  const retryFullCycleStore = useStore((state) => state.retryFullCycle)

  // Get steps based on project type
  const getSteps = useCallback((): FullCycleStep[] => {
    return projectType === 'bmgd' ? FULL_CYCLE_STEPS_BMGD : FULL_CYCLE_STEPS_BMM
  }, [projectType])

  // Start the full cycle for a story
  const start = useCallback((storyId: string) => {
    const steps = getSteps()
    const story = stories.find((s) => s.id === storyId)
    if (!story) {
      console.error('Story not found:', storyId)
      return
    }

    const hasFile = !!story.filePath

    startFullCycle(storyId, steps.length)
    appendFullCycleLog(`Starting full cycle for story: ${story.title}`)
    appendFullCycleLog(`Current status: ${story.status}`)
    if (hasFile) {
      appendFullCycleLog(`Story file exists, will skip creation step`)
    }
    if (['in-progress', 'review', 'human-review'].includes(story.status)) {
      appendFullCycleLog(`Story already in progress, will skip implementation step`)
    }
  }, [stories, getSteps, startFullCycle, appendFullCycleLog])

  // Cancel the full cycle
  const cancel = useCallback(async () => {
    if (!fullCycle.isRunning) return

    appendFullCycleLog('Cancelling full cycle...')

    // Get the current step to find the agent to cancel
    const steps = getSteps()
    const currentStep = steps[fullCycle.currentStep]
    if (currentStep?.agentId) {
      try {
        await window.chatAPI.cancelMessage(currentStep.agentId)
      } catch {
        // Ignore
      }
    }

    cancelFullCycle()
    appendFullCycleLog('Full cycle cancelled')
  }, [fullCycle.isRunning, fullCycle.currentStep, getSteps, cancelFullCycle, appendFullCycleLog])

  // Retry from the failed step (preserves completed steps)
  const retry = useCallback(() => {
    if (!fullCycle.storyId) return

    const story = stories.find((s) => s.id === fullCycle.storyId)
    if (!story) {
      console.error('Story not found:', fullCycle.storyId)
      return
    }

    // Find first non-completed step for logging
    const stepStatuses = fullCycle.stepStatuses
    let resumeStep = 0
    for (let i = 0; i < stepStatuses.length; i++) {
      if (stepStatuses[i] !== 'completed' && stepStatuses[i] !== 'skipped') {
        resumeStep = i
        break
      }
    }

    const steps = getSteps()
    appendFullCycleLog(`\n=== Retrying from step ${resumeStep + 1}: ${steps[resumeStep]?.name} ===`)
    retryFullCycleStore()
  }, [fullCycle.storyId, fullCycle.stepStatuses, stories, getSteps, appendFullCycleLog, retryFullCycleStore])

  return {
    fullCycle,
    steps: getSteps(),
    start,
    cancel,
    retry
  }
}
