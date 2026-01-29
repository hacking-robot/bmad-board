import { useEffect, useRef, useCallback } from 'react'
import { useStore } from '../../store'
import { FULL_CYCLE_STEPS_BMM, FULL_CYCLE_STEPS_BMGD, FullCycleStep } from '../../types/fullCycle'
import { transformCommand } from '../../utils/commandTransform'

/**
 * FullCycleOrchestrator - Runs the full cycle automation in the background
 *
 * This component should be mounted at the App level so it persists
 * even when the FullCycleDialog is closed. It orchestrates the steps
 * and sends commands to the chat agents in the sidebar.
 */
export default function FullCycleOrchestrator() {
  const projectPath = useStore((state) => state.projectPath)
  const projectType = useStore((state) => state.projectType)
  const stories = useStore((state) => state.stories)
  const aiTool = useStore((state) => state.aiTool)
  const claudeModel = useStore((state) => state.claudeModel)
  const baseBranch = useStore((state) => state.baseBranch)
  const enableEpicBranches = useStore((state) => state.enableEpicBranches)
  const setCurrentBranch = useStore((state) => state.setCurrentBranch)
  const setHasUncommittedChanges = useStore((state) => state.setHasUncommittedChanges)

  // Chat state
  const chatThreads = useStore((state) => state.chatThreads)
  const addChatMessage = useStore((state) => state.addChatMessage)
  const updateChatMessage = useStore((state) => state.updateChatMessage)
  const setChatTyping = useStore((state) => state.setChatTyping)
  const setThreadContext = useStore((state) => state.setThreadContext)
  const setChatSessionId = useStore((state) => state.setChatSessionId)
  const clearChatThread = useStore((state) => state.clearChatThread)

  // Full cycle state
  const fullCycle = useStore((state) => state.fullCycle)
  const updateFullCycleStep = useStore((state) => state.updateFullCycleStep)
  const appendFullCycleLog = useStore((state) => state.appendFullCycleLog)
  const setFullCycleError = useStore((state) => state.setFullCycleError)
  const completeFullCycle = useStore((state) => state.completeFullCycle)
  const setFullCycleSessionId = useStore((state) => state.setFullCycleSessionId)
  const skipFullCycleStep = useStore((state) => state.skipFullCycleStep)
  const advanceFullCycleStep = useStore((state) => state.advanceFullCycleStep)

  // Track the current run
  const currentRunIdRef = useRef<string | null>(null)
  const isProcessingRef = useRef(false)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Get steps based on project type
  const getSteps = useCallback((): FullCycleStep[] => {
    return projectType === 'bmgd' ? FULL_CYCLE_STEPS_BMGD : FULL_CYCLE_STEPS_BMM
  }, [projectType])

  // Execute an agent step - mimics ChatThread's handleSendMessage
  const executeAgentStep = useCallback(async (
    agentId: string,
    command: string,
    storyId: string,
    branchName: string,
    runId: string
  ): Promise<'success' | 'error'> => {
    if (!projectPath) return 'error'

    appendFullCycleLog(`Sending to ${agentId}: ${command}`)

    // Set context for this agent's thread
    setThreadContext(agentId, storyId, branchName)

    // Get current session (if any)
    const currentThread = chatThreads[agentId]
    const hasSession = !!currentThread?.sessionId

    // Add user message to the chat thread
    const userMsgId = `fullcycle-user-${Date.now()}`
    addChatMessage(agentId, {
      id: userMsgId,
      role: 'user',
      content: command,
      timestamp: Date.now(),
      status: 'complete'
    })

    // Add assistant placeholder message
    const assistantMsgId = `fullcycle-assistant-${Date.now()}`
    addChatMessage(agentId, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending'
    })

    // Set typing indicator
    setChatTyping(agentId, true)

    return new Promise<'success' | 'error'>((resolve) => {
      let resolved = false
      let accumulatedOutput = ''
      let currentSessionId = currentThread?.sessionId || null

      const cleanup = () => {
        unsubExit()
        unsubAgentLoaded()
        unsubOutput()
        if (cleanupRef.current === cleanup) {
          cleanupRef.current = null
        }
      }

      // Detect if output contains a question prompt that needs auto-response
      const isQuestionPrompt = (text: string): boolean => {
        // Common patterns for agent questions requiring user choice
        const patterns = [
          /Choose \[\d+\]/i,
          /Select \[\d+\]/i,
          /\[\d+\].*\[\d+\]/,  // Multiple numbered options
          /Which option/i,
          /What should I do/i,
          /Do you want me to/i,
          /Should I proceed/i,
          /\?\s*$/  // Ends with question mark
        ]
        return patterns.some(p => p.test(text))
      }

      // Subscribe to output to detect question prompts
      // ChatThread handles display, we just track content for question detection
      const unsubOutput = window.chatAPI.onChatOutput((event) => {
        if (event.agentId !== agentId) return
        if (event.chunk) {
          accumulatedOutput += event.chunk
        }
      })

      // Handle agent loaded (for first message)
      const unsubAgentLoaded = window.chatAPI.onAgentLoaded(async (event) => {
        if (event.agentId !== agentId) return
        if (currentRunIdRef.current !== runId) {
          cleanup()
          resolve('error')
          return
        }

        if (event.code === 0 && event.sessionId) {
          // Agent loaded successfully, save session and send the actual message
          appendFullCycleLog(`Agent ${agentId} ready`)
          setChatSessionId(agentId, event.sessionId)
          setFullCycleSessionId(event.sessionId)

          // Small delay for session file to be written
          await new Promise(r => setTimeout(r, 150))

          // Now send the actual message
          appendFullCycleLog(`Executing command...`)
          const result = await window.chatAPI.sendMessage({
            agentId,
            projectPath,
            message: command,
            sessionId: event.sessionId,
            tool: aiTool,
            model: aiTool === 'claude-code' ? claudeModel : undefined
          })

          if (!result.success) {
            cleanup()
            setChatTyping(agentId, false)
            updateChatMessage(agentId, assistantMsgId, {
              content: result.error || 'Failed to send message',
              status: 'error'
            })
            appendFullCycleLog(`Failed to send: ${result.error}`)
            resolve('error')
          }
        } else if (event.code !== 0) {
          // Agent load failed
          cleanup()
          setChatTyping(agentId, false)
          updateChatMessage(agentId, assistantMsgId, {
            content: event.error || 'Failed to load agent',
            status: 'error'
          })
          appendFullCycleLog(`Agent load failed: ${event.error}`)
          resolve('error')
        }
      })

      // Handle process exit
      const unsubExit = window.chatAPI.onChatExit(async (event) => {
        if (event.agentId !== agentId) return
        if (resolved) return

        // Update session ID if provided
        if (event.sessionId) {
          currentSessionId = event.sessionId
          setChatSessionId(agentId, event.sessionId)
          setFullCycleSessionId(event.sessionId)
        }

        if (currentRunIdRef.current !== runId) {
          resolved = true
          cleanup()
          setChatTyping(agentId, false)
          resolve('error')
          return
        }

        if (event.cancelled) {
          resolved = true
          cleanup()
          setChatTyping(agentId, false)
          appendFullCycleLog(`${agentId} cancelled`)
          resolve('error')
          return
        }

        if (event.code !== 0 && event.code !== null) {
          resolved = true
          cleanup()
          setChatTyping(agentId, false)
          appendFullCycleLog(`${agentId} failed with code: ${event.code}`)
          resolve('error')
          return
        }

        // Check if output contains a question that needs auto-response
        if (isQuestionPrompt(accumulatedOutput) && currentSessionId) {
          appendFullCycleLog(`Detected question prompt, auto-responding with "1" (fix automatically)`)

          // Add auto-response message to chat
          const autoResponseMsgId = `fullcycle-auto-${Date.now()}`
          addChatMessage(agentId, {
            id: autoResponseMsgId,
            role: 'user',
            content: '1',
            timestamp: Date.now(),
            status: 'complete'
          })

          // Add new assistant placeholder
          const newAssistantMsgId = `fullcycle-assistant-${Date.now()}`
          addChatMessage(agentId, {
            id: newAssistantMsgId,
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
            status: 'pending'
          })

          // Clear accumulated output for next round
          accumulatedOutput = ''

          // Send the auto-response
          await new Promise(r => setTimeout(r, 150))

          try {
            const result = await window.chatAPI.sendMessage({
              agentId,
              projectPath,
              message: '1',
              sessionId: currentSessionId,
              tool: aiTool,
              model: aiTool === 'claude-code' ? claudeModel : undefined
            })

            if (!result.success) {
              resolved = true
              cleanup()
              setChatTyping(agentId, false)
              appendFullCycleLog(`Failed to send auto-response: ${result.error}`)
              resolve('error')
            }
            // Otherwise, wait for next exit event
          } catch (err) {
            resolved = true
            cleanup()
            setChatTyping(agentId, false)
            appendFullCycleLog(`Failed to send auto-response: ${err}`)
            resolve('error')
          }
          return
        }

        // No question detected, mark as complete
        resolved = true
        cleanup()
        setChatTyping(agentId, false)
        appendFullCycleLog(`${agentId} completed successfully`)
        resolve('success')
      })

      cleanupRef.current = cleanup

      // Start the process
      if (!hasSession) {
        // First message - need to load agent first
        appendFullCycleLog(`Loading ${agentId} agent...`)
        window.chatAPI.loadAgent({
          agentId,
          projectPath,
          projectType: projectType || 'bmm',
          tool: aiTool,
          model: aiTool === 'claude-code' ? claudeModel : undefined
        }).catch((err) => {
          if (!resolved) {
            resolved = true
            cleanup()
            setChatTyping(agentId, false)
            updateChatMessage(agentId, assistantMsgId, {
              content: `Failed to load agent: ${err}`,
              status: 'error'
            })
            appendFullCycleLog(`Failed to load agent: ${err}`)
            resolve('error')
          }
        })
      } else {
        // Have session - send message directly
        appendFullCycleLog(`Using existing session, executing command...`)
        window.chatAPI.sendMessage({
          agentId,
          projectPath,
          message: command,
          sessionId: currentThread.sessionId,
          tool: aiTool,
          model: aiTool === 'claude-code' ? claudeModel : undefined
        }).catch((err) => {
          if (!resolved) {
            resolved = true
            cleanup()
            setChatTyping(agentId, false)
            updateChatMessage(agentId, assistantMsgId, {
              content: `Failed to send: ${err}`,
              status: 'error'
            })
            appendFullCycleLog(`Failed to send: ${err}`)
            resolve('error')
          }
        })
      }
    })
  }, [
    projectPath,
    projectType,
    aiTool,
    claudeModel,
    chatThreads,
    appendFullCycleLog,
    addChatMessage,
    updateChatMessage,
    setChatTyping,
    setThreadContext,
    setChatSessionId,
    setFullCycleSessionId
  ])

  // Execute a single step
  const executeStep = useCallback(async (stepIndex: number, runId: string, storyId: string): Promise<'success' | 'skipped' | 'error'> => {
    if (!projectPath) return 'error'
    if (currentRunIdRef.current !== runId) return 'error'

    const steps = getSteps()
    const step = steps[stepIndex]
    const story = stories.find((s) => s.id === storyId)
    if (!step || !story) return 'error'

    const branchName = story.id

    appendFullCycleLog(`\n--- Step ${stepIndex + 1}/${steps.length}: ${step.name} ---`)
    updateFullCycleStep(stepIndex, step.name, step.type)

    try {
      switch (step.type) {
        case 'agent': {
          // Skip create-story if file already exists
          if (step.id === 'create-story' && story.filePath) {
            appendFullCycleLog('Story file already exists, skipping creation')
            return 'skipped'
          }

          // Skip implementation if story is already past ready-for-dev
          if (step.id === 'implement') {
            const skipStatuses = ['in-progress', 'review', 'human-review']
            if (skipStatuses.includes(story.status)) {
              appendFullCycleLog(`Story is in ${story.status}, skipping implementation`)
              return 'skipped'
            }
          }

          const agentId = step.agentId!

          // Clear chat thread before key steps to start fresh without polluted context
          const stepsThatNeedFreshContext = ['create-story', 'implement', 'code-review-1', 'code-review-2']
          if (stepsThatNeedFreshContext.includes(step.id)) {
            appendFullCycleLog(`Clearing ${agentId} chat for fresh context`)
            clearChatThread(agentId)
          }

          const command = transformCommand(step.command!, aiTool)
          const fullCommand = `${command} ${story.id}`

          const result = await executeAgentStep(agentId, fullCommand, story.id, branchName, runId)
          return result === 'success' ? 'success' : 'error'
        }

        case 'git': {
          if (step.gitAction === 'create-branch') {
            appendFullCycleLog(`Creating branch: ${branchName}`)

            const fromBranch = enableEpicBranches ? undefined : baseBranch
            const result = await window.gitAPI.createBranch(projectPath, branchName, fromBranch)

            if (currentRunIdRef.current !== runId) return 'error'

            if (result.alreadyExists) {
              appendFullCycleLog(`Branch ${branchName} already exists, checking out`)
              const checkoutResult = await window.gitAPI.checkoutBranch(projectPath, branchName)
              if (!checkoutResult.success) {
                appendFullCycleLog(`Failed to checkout: ${checkoutResult.error}`)
                return 'error'
              }
            } else if (!result.success) {
              appendFullCycleLog(`Failed to create branch: ${result.error}`)
              return 'error'
            }

            setCurrentBranch(branchName)
            appendFullCycleLog('Branch ready')
            return 'success'
          }

          if (step.gitAction === 'commit') {
            const changesResult = await window.gitAPI.hasChanges(projectPath)
            if (currentRunIdRef.current !== runId) return 'error'

            if (!changesResult.hasChanges) {
              appendFullCycleLog('No changes to commit, skipping')
              return 'skipped'
            }

            const commitType = step.commitMessage?.startsWith('fix') ? 'fix' : step.commitMessage?.startsWith('docs') ? 'docs' : 'feat'
            const message = `${commitType}(${branchName}): ${step.commitMessage?.replace(/^(fix|docs|feat): /, '') || 'update'}`

            appendFullCycleLog(`Committing: ${message}`)
            const result = await window.gitAPI.commit(projectPath, message)

            if (currentRunIdRef.current !== runId) return 'error'

            if (!result.success) {
              appendFullCycleLog(`Failed to commit: ${result.error}`)
              return 'error'
            }

            setHasUncommittedChanges(false)
            appendFullCycleLog('Committed successfully')
            return 'success'
          }

          return 'success'
        }

        case 'status': {
          if (story.filePath) {
            appendFullCycleLog('Updating story status to done')
            const result = await window.fileAPI.updateStoryStatus(story.filePath, 'done')

            if (currentRunIdRef.current !== runId) return 'error'

            if (!result.success) {
              appendFullCycleLog(`Failed to update status: ${result.error}`)
              return 'error'
            }
            appendFullCycleLog('Story marked as done')
          } else {
            appendFullCycleLog('No story file to update status')
          }
          return 'success'
        }

        default:
          return 'success'
      }
    } catch (error) {
      appendFullCycleLog(`Error: ${error}`)
      return 'error'
    }
  }, [
    projectPath,
    stories,
    aiTool,
    baseBranch,
    enableEpicBranches,
    getSteps,
    executeAgentStep,
    appendFullCycleLog,
    updateFullCycleStep,
    setCurrentBranch,
    setHasUncommittedChanges,
    clearChatThread
  ])

  // Run all steps sequentially
  const runAllSteps = useCallback(async (runId: string, storyId: string) => {
    const steps = getSteps()

    for (let i = 0; i < steps.length; i++) {
      if (currentRunIdRef.current !== runId) return

      const result = await executeStep(i, runId, storyId)

      if (currentRunIdRef.current !== runId) return

      if (result === 'error') {
        setFullCycleError(`Step "${steps[i]?.name}" failed`)
        return
      } else if (result === 'skipped') {
        skipFullCycleStep(i)
      } else {
        advanceFullCycleStep()
      }
    }

    if (currentRunIdRef.current === runId) {
      appendFullCycleLog('\n=== Full cycle complete! ===')
      completeFullCycle()
    }
  }, [getSteps, executeStep, skipFullCycleStep, advanceFullCycleStep, setFullCycleError, appendFullCycleLog, completeFullCycle])

  // Watch for new full cycle runs to start
  useEffect(() => {
    if (!fullCycle.isRunning) return
    if (fullCycle.currentStep !== 0) return
    if (fullCycle.error) return
    if (!fullCycle.storyId) return
    if (isProcessingRef.current) return

    // Generate run ID
    currentRunIdRef.current = `${fullCycle.storyId}-${Date.now()}`
    isProcessingRef.current = true
    const runId = currentRunIdRef.current
    const storyId = fullCycle.storyId

    runAllSteps(runId, storyId).finally(() => {
      isProcessingRef.current = false
    })
  }, [fullCycle.isRunning, fullCycle.currentStep, fullCycle.error, fullCycle.storyId, runAllSteps])

  // Reset run ID when cycle completes or is cancelled
  useEffect(() => {
    if (!fullCycle.isRunning) {
      currentRunIdRef.current = null
    }
  }, [fullCycle.isRunning])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current()
      }
    }
  }, [])

  return null
}
