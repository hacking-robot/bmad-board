import { useEffect, useRef, useCallback } from 'react'
import { Box } from '@mui/material'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'
import { useStore } from '../../store'
import { useWorkflow } from '../../hooks/useWorkflow'
import type { AgentDefinition } from '../../types/flow'
import ChatMessage from './ChatMessage'
import ChatInput from './ChatInput'
import TypingIndicator from './TypingIndicator'

// Helper to show system notification for new messages
function showChatNotification(agent: AgentDefinition, messageContent: string) {
  const notificationsEnabled = useStore.getState().notificationsEnabled
  if (!notificationsEnabled) return

  // Only show if app is not focused
  if (document.hasFocus()) return

  // Show system notification
  const preview = messageContent.length > 100
    ? messageContent.substring(0, 100) + '...'
    : messageContent

  window.fileAPI.showNotification(
    `Message from ${agent.name}`,
    preview || `${agent.name} sent a response`
  )
}

interface ChatThreadProps {
  agentId: string
}

// Debounce utility for saving threads
let saveTimeout: NodeJS.Timeout | null = null
function debouncedSaveThread(agentId: string, thread: unknown) {
  if (saveTimeout) clearTimeout(saveTimeout)
  saveTimeout = setTimeout(() => {
    window.chatAPI.saveThread(agentId, thread as Parameters<typeof window.chatAPI.saveThread>[1])
  }, 1000)
}

// Map Claude tool names to human-readable activity descriptions
function getToolActivity(toolName: string, input?: Record<string, unknown>): string {
  const toolMap: Record<string, (input?: Record<string, unknown>) => string> = {
    Read: (i) => i?.file_path ? `Reading ${(i.file_path as string).split('/').pop()}` : 'Reading file',
    Edit: (i) => i?.file_path ? `Editing ${(i.file_path as string).split('/').pop()}` : 'Editing file',
    Write: (i) => i?.file_path ? `Writing ${(i.file_path as string).split('/').pop()}` : 'Writing file',
    Glob: () => 'Searching for files',
    Grep: (i) => i?.pattern ? `Searching for "${i.pattern}"` : 'Searching code',
    Bash: (i) => i?.command ? `Running: ${(i.command as string).split(' ')[0]}` : 'Running command',
    Task: () => 'Launching subagent',
    WebFetch: () => 'Fetching web content',
    WebSearch: (i) => i?.query ? `Searching: "${i.query}"` : 'Searching web',
    TodoWrite: () => 'Updating task list',
    NotebookEdit: () => 'Editing notebook',
    AskUserQuestion: () => 'Preparing question',
    EnterPlanMode: () => 'Planning approach',
    ExitPlanMode: () => 'Finalizing plan',
  }

  const formatter = toolMap[toolName]
  if (formatter) {
    return formatter(input)
  }

  // Handle MCP tools (mcp__*)
  if (toolName.startsWith('mcp__')) {
    return 'Using MCP tool'
  }

  return `Using ${toolName}`
}

export default function ChatThread({ agentId }: ChatThreadProps) {
  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const projectPath = useStore((state) => state.projectPath)
  const chatThreads = useStore((state) => state.chatThreads)
  const addChatMessage = useStore((state) => state.addChatMessage)
  const updateChatMessage = useStore((state) => state.updateChatMessage)
  const setChatTyping = useStore((state) => state.setChatTyping)
  const incrementUnread = useStore((state) => state.incrementUnread)
  const setChatSessionId = useStore((state) => state.setChatSessionId)

  const setChatActivity = useStore((state) => state.setChatActivity)
  const setThreadContext = useStore((state) => state.setThreadContext)
  const pendingChatMessage = useStore((state) => state.pendingChatMessage)
  const clearPendingChatMessage = useStore((state) => state.clearPendingChatMessage)

  const thread = chatThreads[agentId]
  const messages = thread?.messages || []
  const isTyping = thread?.isTyping || false
  const thinkingActivity = thread?.thinkingActivity

  // Use refs for values that need to be accessed in event handlers
  const currentMessageIdRef = useRef<string | null>(null)
  const streamBufferRef = useRef<string>('')
  const pendingMessageRef = useRef<{ content: string; assistantMsgId: string } | null>(null)
  const isLoadingAgentRef = useRef<boolean>(false)
  const messageCompletedRef = useRef<boolean>(false) // Track if last message was completed (result received)
  const toolUsedRef = useRef<boolean>(false) // Track if a tool_use block was seen (next text = new turn)

  // Get agents from workflow (based on current project type)
  const { agents } = useWorkflow()
  const agent = agents.find((a) => a.id === agentId)

  // Save thread when messages change
  useEffect(() => {
    if (thread && thread.messages.length > 0) {
      debouncedSaveThread(agentId, thread)
    }
  }, [agentId, thread])

  // Helper to create a new assistant message for a new response turn
  const createNewAssistantMessage = useCallback(() => {
    const newMsgId = `msg-${Date.now()}`
    addChatMessage(agentId, {
      id: newMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming'
    })
    currentMessageIdRef.current = newMsgId
    streamBufferRef.current = ''
    messageCompletedRef.current = false
    toolUsedRef.current = false
    return newMsgId
  }, [agentId, addChatMessage])

  // Subscribe to chat events
  useEffect(() => {
    // Handle chat output
    const unsubOutput = window.chatAPI.onChatOutput((event) => {
      if (event.agentId !== agentId) return

      // Skip message creation during agent load - show as status instead
      if (event.isAgentLoad) {
        // Update activity to show agent is loading
        setChatActivity(agentId, 'Loading agent...')
        return
      }

      // Parse stream-json output and extract text
      const chunk = event.chunk
      const lines = chunk.split('\n').filter(Boolean)

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line)

          // Handle content_block_delta - streaming text
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            const newText = parsed.delta.text

            // If previous message was completed, tool was used, or no current message, create a new one
            if (!currentMessageIdRef.current || messageCompletedRef.current || toolUsedRef.current) {
              createNewAssistantMessage()
              toolUsedRef.current = false // Reset after creating new message
            }

            streamBufferRef.current += newText

            // Update existing message
            if (currentMessageIdRef.current) {
              const currentContent = useStore.getState().chatThreads[agentId]?.messages.find(
                m => m.id === currentMessageIdRef.current
              )?.content || ''

              updateChatMessage(agentId, currentMessageIdRef.current, {
                content: currentContent + newText,
                status: 'streaming'
              })
            }
          }

          // Handle content_block_start for text blocks
          if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'text') {
            // If previous message was completed, tool was used, or no current message, create a new one
            if (!currentMessageIdRef.current || messageCompletedRef.current || toolUsedRef.current) {
              createNewAssistantMessage()
              toolUsedRef.current = false // Reset after creating new message
            } else if (currentMessageIdRef.current) {
              updateChatMessage(agentId, currentMessageIdRef.current, {
                status: 'streaming'
              })
            }
          }

          // Handle assistant message (complete message format)
          // Process text blocks FIRST, then tool_use blocks to avoid order-dependent issues
          if (parsed.type === 'assistant' && parsed.message?.content) {
            // First pass: handle all text blocks
            for (const block of parsed.message.content) {
              if (block.type === 'text' && block.text) {
                // Clear activity when we get text content
                setChatActivity(agentId, undefined)

                // If previous message was completed, tool was used, or no current message, create a new one
                if (!currentMessageIdRef.current || messageCompletedRef.current || toolUsedRef.current) {
                  createNewAssistantMessage()
                  toolUsedRef.current = false // Reset after creating new message
                }

                if (currentMessageIdRef.current) {
                  // Append to existing content instead of replacing
                  const currentContent = useStore.getState().chatThreads[agentId]?.messages.find(
                    m => m.id === currentMessageIdRef.current
                  )?.content || ''
                  const newContent = currentContent ? currentContent + block.text : block.text

                  updateChatMessage(agentId, currentMessageIdRef.current, {
                    content: newContent,
                    status: 'streaming'
                  })
                  streamBufferRef.current = newContent
                }
              }
            }
            // Second pass: handle tool_use blocks (after all text is processed)
            for (const block of parsed.message.content) {
              if (block.type === 'tool_use' && block.name) {
                const activity = getToolActivity(block.name, block.input as Record<string, unknown>)
                setChatActivity(agentId, activity)
                // Only mark message complete and set toolUsedRef if message has actual content
                // This prevents empty placeholders from being "completed" when Claude starts with tools
                if (currentMessageIdRef.current && streamBufferRef.current) {
                  updateChatMessage(agentId, currentMessageIdRef.current, { status: 'complete' })
                  toolUsedRef.current = true
                }
              }
            }
          }

          // Handle result - finalize message
          if (parsed.type === 'result') {
            setChatActivity(agentId, undefined) // Clear activity indicator
            if (currentMessageIdRef.current) {
              updateChatMessage(agentId, currentMessageIdRef.current, { status: 'complete' })
              incrementUnread(agentId)
              // Show system notification if not viewing this chat and app not focused
              if (useStore.getState().selectedChatAgent !== agentId && agent) {
                showChatNotification(agent, streamBufferRef.current)
              }
            }
            // Mark message as completed so next content creates a new message
            // Don't clear currentMessageIdRef yet - wait for next content or exit
            messageCompletedRef.current = true
            streamBufferRef.current = ''
          }
        } catch {
          // Not JSON, ignore
        }
      }
    })

    // Handle agent loaded event - send pending message if any
    const unsubAgentLoaded = window.chatAPI.onAgentLoaded(async (event) => {
      if (event.agentId !== agentId) return

      console.log('[ChatThread] Agent loaded:', event)
      isLoadingAgentRef.current = false
      setChatActivity(agentId, undefined) // Clear loading activity

      // Store session ID
      if (event.sessionId) {
        setChatSessionId(agentId, event.sessionId)
      }

      // If there's a pending message, send it now
      if (pendingMessageRef.current && event.sessionId && event.code === 0) {
        const { content, assistantMsgId } = pendingMessageRef.current
        pendingMessageRef.current = null

        // Set up for streaming response
        currentMessageIdRef.current = assistantMsgId
        streamBufferRef.current = ''
        messageCompletedRef.current = false
        toolUsedRef.current = false

        // Wait a moment for session file to be fully written to disk
        await new Promise(resolve => setTimeout(resolve, 150))

        // Send the actual user message with the session ID
        const result = await window.chatAPI.sendMessage({
          agentId,
          projectPath: projectPath!,
          message: content,
          sessionId: event.sessionId
        })

        if (!result.success) {
          updateChatMessage(agentId, assistantMsgId, {
            content: result.error || 'Failed to send message',
            status: 'error'
          })
          setChatTyping(agentId, false)
          currentMessageIdRef.current = null
        }
      } else if (pendingMessageRef.current && event.code !== 0) {
        // Agent load failed, show error
        const { assistantMsgId } = pendingMessageRef.current
        pendingMessageRef.current = null
        updateChatMessage(agentId, assistantMsgId, {
          content: event.error || 'Failed to load agent',
          status: 'error'
        })
        setChatTyping(agentId, false)
        setChatActivity(agentId, undefined) // Clear activity on error
      }
    })

    // Handle process exit (for message responses)
    const unsubExit = window.chatAPI.onChatExit((event) => {
      if (event.agentId !== agentId) return

      setChatTyping(agentId, false)

      // Store session ID for conversation continuity
      if (event.sessionId) {
        setChatSessionId(agentId, event.sessionId)
      }

      // Finalize any pending message
      if (currentMessageIdRef.current) {
        const finalContent = streamBufferRef.current || 'Response completed.'
        updateChatMessage(agentId, currentMessageIdRef.current, {
          content: finalContent,
          status: event.code === 0 ? 'complete' : 'error'
        })
        incrementUnread(agentId)
        // Show system notification if not viewing this chat and app not focused
        if (useStore.getState().selectedChatAgent !== agentId && agent) {
          showChatNotification(agent, finalContent)
        }
      }
      // Reset all refs on process exit
      currentMessageIdRef.current = null
      streamBufferRef.current = ''
      messageCompletedRef.current = false
      toolUsedRef.current = false
    })

    return () => {
      unsubOutput()
      unsubAgentLoaded()
      unsubExit()
    }
  }, [agentId, projectPath, updateChatMessage, setChatTyping, setChatActivity, incrementUnread, setChatSessionId, createNewAssistantMessage])

  // Sync isTyping state with actual process status on mount/agent change
  // This detects crashed processes that didn't send proper exit events
  useEffect(() => {
    async function syncAgentStatus() {
      const currentThread = useStore.getState().chatThreads[agentId]
      const isTypingInStore = currentThread?.isTyping || false

      // If store says we're typing, verify with main process
      if (isTypingInStore) {
        const isActuallyRunning = await window.chatAPI.isAgentRunning(agentId)

        if (!isActuallyRunning) {
          console.log('[ChatThread] Detected crashed/orphaned agent:', agentId)
          setChatTyping(agentId, false)
          setChatActivity(agentId, undefined)

          // Find and update any pending/streaming message to show error
          const messages = currentThread?.messages || []
          const pendingMsg = messages.find(m => m.status === 'pending' || m.status === 'streaming')
          if (pendingMsg) {
            const errorContent = pendingMsg.content
              ? pendingMsg.content + '\n\n*[Process terminated unexpectedly]*'
              : '*[Process terminated unexpectedly]*'
            updateChatMessage(agentId, pendingMsg.id, {
              content: errorContent,
              status: 'error'
            })
          }

          // Clear any refs
          currentMessageIdRef.current = null
          streamBufferRef.current = ''
          pendingMessageRef.current = null
          isLoadingAgentRef.current = false
          messageCompletedRef.current = false
          toolUsedRef.current = false
        }
      }
    }

    syncAgentStatus()
  }, [agentId, setChatTyping, setChatActivity, updateChatMessage])

  // Auto-scroll to bottom
  useEffect(() => {
    if (virtuosoRef.current && messages.length > 0) {
      virtuosoRef.current.scrollToIndex({
        index: messages.length - 1,
        behavior: 'smooth',
        align: 'end'
      })
    }
  }, [messages.length, isTyping])

  const handleSendMessage = useCallback(async (content: string) => {
    if (!projectPath || !content.trim()) return

    // Get current thread state
    const currentThread = useStore.getState().chatThreads[agentId]
    const currentSessionId = currentThread?.sessionId
    const hasSession = !!currentSessionId

    // Add user message
    const userMsgId = `msg-${Date.now()}`
    addChatMessage(agentId, {
      id: userMsgId,
      role: 'user',
      content: content.trim(),
      timestamp: Date.now(),
      status: 'complete'
    })

    // Show typing indicator
    setChatTyping(agentId, true)

    // Prepare assistant message placeholder
    const assistantMsgId = `msg-${Date.now() + 1}`

    // Add placeholder assistant message
    addChatMessage(agentId, {
      id: assistantMsgId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'pending'
    })

    if (!hasSession) {
      // First message - need to load the agent first, then send the message
      console.log('[ChatThread] No session, loading agent first...')
      isLoadingAgentRef.current = true
      pendingMessageRef.current = { content: content.trim(), assistantMsgId }

      try {
        const currentProjectType = useStore.getState().projectType || 'bmm'
        const result = await window.chatAPI.loadAgent({
          agentId,
          projectPath,
          projectType: currentProjectType
        })

        if (!result.success) {
          updateChatMessage(agentId, assistantMsgId, {
            content: result.error || 'Failed to load agent',
            status: 'error'
          })
          setChatTyping(agentId, false)
          pendingMessageRef.current = null
          isLoadingAgentRef.current = false
        }
        // If successful, the onAgentLoaded handler will send the pending message
      } catch (error) {
        updateChatMessage(agentId, assistantMsgId, {
          content: error instanceof Error ? error.message : 'Failed to load agent',
          status: 'error'
        })
        setChatTyping(agentId, false)
        pendingMessageRef.current = null
        isLoadingAgentRef.current = false
      }
    } else {
      // Have session - send message directly with --resume
      currentMessageIdRef.current = assistantMsgId
      streamBufferRef.current = ''
      messageCompletedRef.current = false
      toolUsedRef.current = false

      try {
        const result = await window.chatAPI.sendMessage({
          agentId,
          projectPath,
          message: content.trim(),
          sessionId: currentSessionId
        })

        if (!result.success) {
          updateChatMessage(agentId, assistantMsgId, {
            content: result.error || 'Failed to send message',
            status: 'error'
          })
          setChatTyping(agentId, false)
          currentMessageIdRef.current = null
        }
      } catch (error) {
        updateChatMessage(agentId, assistantMsgId, {
          content: error instanceof Error ? error.message : 'Failed to send message',
          status: 'error'
        })
        setChatTyping(agentId, false)
        currentMessageIdRef.current = null
      }
    }
  }, [agentId, projectPath, addChatMessage, setChatTyping, updateChatMessage])

  const handleCancel = useCallback(async () => {
    try {
      const result = await window.chatAPI.cancelMessage(agentId)
      if (result) {
        console.log('[ChatThread] Cancelled message for agent:', agentId)
        // Update the current streaming message to show it was cancelled
        if (currentMessageIdRef.current) {
          const currentContent = useStore.getState().chatThreads[agentId]?.messages.find(
            m => m.id === currentMessageIdRef.current
          )?.content || ''

          updateChatMessage(agentId, currentMessageIdRef.current, {
            content: currentContent + '\n\n*[Response cancelled]*',
            status: 'complete'
          })
          currentMessageIdRef.current = null
        }
        setChatTyping(agentId, false)
        streamBufferRef.current = ''
        pendingMessageRef.current = null
        isLoadingAgentRef.current = false
        messageCompletedRef.current = false
        toolUsedRef.current = false
      }
    } catch (error) {
      console.error('[ChatThread] Failed to cancel:', error)
    }
  }, [agentId, setChatTyping, updateChatMessage])

  // Track pending message ID to prevent duplicate sends
  const processedPendingRef = useRef<string | null>(null)

  // Handle pending chat messages from other components (e.g., StoryCard)
  useEffect(() => {
    if (pendingChatMessage && pendingChatMessage.agentId === agentId && projectPath) {
      // Create a unique key for this pending message to prevent duplicate processing
      const pendingKey = `${pendingChatMessage.agentId}:${pendingChatMessage.message}`

      // Skip if we've already processed this exact message
      if (processedPendingRef.current === pendingKey) {
        return
      }

      // Mark as processed
      processedPendingRef.current = pendingKey

      // Store story context if provided
      if (pendingChatMessage.storyId || pendingChatMessage.branchName) {
        setThreadContext(agentId, pendingChatMessage.storyId, pendingChatMessage.branchName)
      }

      // Clear the pending message first to prevent re-triggering
      const messageToSend = pendingChatMessage.message
      clearPendingChatMessage()

      // Send the message after a short delay to ensure UI is ready
      setTimeout(() => {
        handleSendMessage(messageToSend)
        // Reset the processed ref after sending so the same command can be sent again later
        setTimeout(() => {
          processedPendingRef.current = null
        }, 500)
      }, 100)
    }
  }, [pendingChatMessage, agentId, projectPath, clearPendingChatMessage, handleSendMessage, setThreadContext])

  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Messages List */}
      <Box sx={{ flex: 1, overflow: 'hidden' }}>
        {messages.length === 0 ? (
          <Box
            sx={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4
            }}
          >
            <Box sx={{ textAlign: 'center', color: 'text.secondary' }}>
              <Box sx={{ fontSize: '2rem', mb: 1 }}>
                {agent?.avatar}
              </Box>
              <Box sx={{ fontWeight: 500 }}>
                Start a conversation with {agent?.name}
              </Box>
              <Box sx={{ fontSize: '0.875rem', mt: 0.5 }}>
                {agent?.description}
              </Box>
            </Box>
          </Box>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            data={messages}
            followOutput="smooth"
            itemContent={(_index, message) => (
              <ChatMessage
                message={message}
                agentName={agent?.name || 'Teammate'}
                agentAvatar={agent?.avatar || 'A'}
              />
            )}
            style={{ height: '100%' }}
            components={{
              Footer: () =>
                isTyping ? (
                  <Box sx={{ px: 2, pb: 2 }}>
                    <TypingIndicator agentName={agent?.name || 'Teammate'} activity={thinkingActivity} />
                  </Box>
                ) : null
            }}
          />
        )}
      </Box>

      {/* Input */}
      <ChatInput
        onSend={handleSendMessage}
        onCancel={handleCancel}
        disabled={isTyping}
        agentId={agentId}
      />
    </Box>
  )
}
