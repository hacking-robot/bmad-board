import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '../store'
import { useWorkflow, getWorkflow } from './useWorkflow'
import { buildEventMessage } from '../utils/orchestrationParser'
import { buildOracleContext } from '../utils/oracleContextBuilder'
import { ORCHESTRATION_LIMITS, OrchestrationEvent } from '../types/orchestration'

/**
 * Hook to manage Oracle orchestration event processing
 * Polls the event queue and triggers the Oracle agent when events occur
 */
export function useOrchestration() {
  const orchestration = useStore((state) => state.orchestration)
  const processNextOrchestrationEvent = useStore((state) => state.processNextOrchestrationEvent)
  const setOrchestrationIsProcessing = useStore((state) => state.setOrchestrationIsProcessing)
  const setOrchestrationLastOracleCall = useStore((state) => state.setOrchestrationLastOracleCall)
  const incrementOrchestrationChainDepth = useStore((state) => state.incrementOrchestrationChainDepth)
  const resetOrchestrationChainDepth = useStore((state) => state.resetOrchestrationChainDepth)
  const setOrchestrationTimerConfig = useStore((state) => state.setOrchestrationTimerConfig)
  const queueOrchestrationEvent = useStore((state) => state.queueOrchestrationEvent)
  const cleanupOrchestrationQuestions = useStore((state) => state.cleanupOrchestrationQuestions)
  const trimOrchestratorThread = useStore((state) => state.trimOrchestratorThread)

  const clearChatThread = useStore((state) => state.clearChatThread)
  const setPendingChatMessage = useStore((state) => state.setPendingChatMessage)
  const setSelectedChatAgent = useStore((state) => state.setSelectedChatAgent)
  const setViewMode = useStore((state) => state.setViewMode)

  const { agents } = useWorkflow()

  // Find the orchestrator agent
  const orchestratorAgent = agents.find((a) => a.agentType === 'orchestrator')

  // Track if we're currently processing to avoid double processing
  const processingRef = useRef(false)

  // Process the next event in the queue
  const processQueue = useCallback(async () => {
    const state = useStore.getState()
    const { orchestration: orch } = state

    // Skip if not enabled or already processing
    if (!orch.automationEnabled || orch.isProcessing || processingRef.current) {
      return
    }

    // Check rate limit (debounce)
    if (Date.now() - orch.lastOracleCall < orch.debounceMs) {
      return
    }

    // Check chain depth limit
    if (orch.chainDepth >= ORCHESTRATION_LIMITS.MAX_CHAIN_DEPTH) {
      console.warn('[Orchestration] Chain depth limit reached, pausing automation')
      return
    }

    // Check if we have events to process
    if (orch.eventQueue.length === 0) {
      return
    }

    // Check if orchestrator agent exists
    if (!orchestratorAgent) {
      console.warn('[Orchestration] No orchestrator agent found')
      return
    }

    // Mark as processing
    processingRef.current = true
    const event = processNextOrchestrationEvent()

    if (!event) {
      processingRef.current = false
      return
    }

    console.log('[Orchestration] Processing event:', event)

    // Build project context for Oracle
    const storeState = useStore.getState()
    const workflow = getWorkflow(storeState.projectType)
    const projectContext = buildOracleContext(
      storeState.stories,
      storeState.epics,
      storeState.orchestration.pendingQuestions,
      storeState.selectedEpicId,
      workflow,
      storeState.orchestration.eventHistory,
      {
        currentBranch: storeState.currentBranch || storeState.baseBranch || 'main',
        baseBranch: storeState.baseBranch || 'main',
        enableEpicBranches: storeState.enableEpicBranches || false
      }
    )

    // Build message for Oracle with context
    const message = buildEventMessage(event.type, event.payload, projectContext)

    // Update timestamps
    setOrchestrationLastOracleCall(Date.now())
    incrementOrchestrationChainDepth()

    // Switch to chat view and select orchestrator
    setViewMode('chat')
    setSelectedChatAgent(orchestratorAgent.id)

    // Clear the thread to ensure agent command is sent first (fresh session)
    clearChatThread(orchestratorAgent.id)
    window.chatAPI.clearThread(orchestratorAgent.id)

    // Send message to Oracle using the pending message mechanism
    setPendingChatMessage({
      agentId: orchestratorAgent.id,
      message,
      storyId: event.payload.storyId
    })

    // Trim orchestrator thread to prevent unbounded context growth
    trimOrchestratorThread(orchestratorAgent.id)

    // Processing complete - the ChatThread will handle the response
    // and call parseOracleResponse to detect delegations
    processingRef.current = false
    setOrchestrationIsProcessing(false)
  }, [
    orchestratorAgent,
    processNextOrchestrationEvent,
    setOrchestrationIsProcessing,
    setOrchestrationLastOracleCall,
    incrementOrchestrationChainDepth,
    clearChatThread,
    setPendingChatMessage,
    setSelectedChatAgent,
    setViewMode,
    trimOrchestratorThread
  ])

  // Set up polling interval for processing queue
  useEffect(() => {
    if (!orchestration.automationEnabled) {
      return
    }

    const interval = setInterval(() => {
      processQueue()
    }, ORCHESTRATION_LIMITS.QUEUE_POLL_MS)

    return () => clearInterval(interval)
  }, [orchestration.automationEnabled, processQueue])

  // Reset chain depth when user manually sends a message
  // (detected by checking if queue is empty and not processing)
  useEffect(() => {
    if (
      orchestration.chainDepth > 0 &&
      orchestration.eventQueue.length === 0 &&
      !orchestration.isProcessing
    ) {
      // After a delay, reset chain depth
      const timer = setTimeout(() => {
        resetOrchestrationChainDepth()
      }, 5000) // 5 second delay before resetting

      return () => clearTimeout(timer)
    }
  }, [
    orchestration.chainDepth,
    orchestration.eventQueue.length,
    orchestration.isProcessing,
    resetOrchestrationChainDepth
  ])

  // Timer-based triggering effect
  // Check every 30 seconds if timer should fire
  useEffect(() => {
    if (!orchestration.automationEnabled || !orchestration.timerConfig.enabled) {
      return
    }

    const checkTimer = () => {
      const state = useStore.getState()
      const { orchestration: orch, chatThreads } = state

      // Skip if not enabled
      if (!orch.automationEnabled || !orch.timerConfig.enabled) {
        return
      }

      // Skip if currently processing
      if (orch.isProcessing || processingRef.current) {
        return
      }

      // Skip if at chain limit
      if (orch.chainDepth >= ORCHESTRATION_LIMITS.MAX_CHAIN_DEPTH) {
        return
      }

      // Skip if any agent is currently working (isTyping)
      const anyAgentWorking = Object.values(chatThreads).some(thread => thread?.isTyping)
      if (anyAgentWorking) {
        console.log('[Orchestration] Timer skipped - agent is currently working')
        return
      }

      // Check if enough time has passed since last tick
      const now = Date.now()
      const timeSinceLastTick = now - orch.timerConfig.lastTick

      if (timeSinceLastTick >= orch.timerConfig.intervalMs) {
        console.log('[Orchestration] Timer tick - queuing periodic check')

        // Update last tick time
        setOrchestrationTimerConfig({ lastTick: now })

        // Cleanup old answered/dismissed questions
        cleanupOrchestrationQuestions()

        // Queue timer_tick event
        const timerEvent: OrchestrationEvent = {
          id: `timer-${now}-${Math.random().toString(36).slice(2, 11)}`,
          type: 'timer_tick',
          timestamp: now,
          payload: {}
        }
        queueOrchestrationEvent(timerEvent)
      }
    }

    // Check timer every 30 seconds
    const interval = setInterval(checkTimer, ORCHESTRATION_LIMITS.TIMER_CHECK_MS)

    // Also check immediately on mount/config change
    checkTimer()

    return () => clearInterval(interval)
  }, [
    orchestration.automationEnabled,
    orchestration.timerConfig.enabled,
    // Note: intervalMs intentionally NOT in dependencies - checkTimer reads fresh state
    // This prevents race conditions when user adjusts the interval slider
    setOrchestrationTimerConfig,
    queueOrchestrationEvent
  ])

  return {
    ...orchestration,
    processQueue,
    orchestratorAgent
  }
}
