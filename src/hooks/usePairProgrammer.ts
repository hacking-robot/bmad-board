import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import type { StoryContent, StoryStatus } from '../types'

export interface PairProgrammerFeedback {
  content: string
  timestamp: number
  codeHash: string
  fileName: string
}

interface FileChangeEvent {
  filename: string
  fullPath: string
  isSourceFile: boolean
  timestamp: number
}

interface UsePairProgrammerReturn {
  enabled: boolean
  latestFeedback: PairProgrammerFeedback | null
  isAnalyzing: boolean
  analyzeNow: () => Promise<void>
  clearFeedback: () => void
}

// Simple hash function to detect code changes
function generateCodeHash(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) - hash) + content.charCodeAt(i)
    hash |= 0
  }
  return hash.toString(36)
}

// Extract file mentions from story content
function extractFileMentions(storyContent: StoryContent | null): string[] {
  if (!storyContent) return []

  const filePattern = /(?:`([^`]+\.(?:ts|tsx|js|jsx|py|rs|go|java|cs|cpp|c|h|css|scss|json|yaml|yml|md))`|([\w/.-]+\.(?:ts|tsx|js|jsx|py|rs|go|java|cs|cpp|c|h|css|scss|json|yaml|yml|md)))/gi
  const mentions = new Set<string>()

  // Search in description
  const descMatches = storyContent.description.match(filePattern)
  if (descMatches) {
    descMatches.forEach(m => {
      const clean = m.replace(/`/g, '').trim()
      if (clean) mentions.add(clean)
    })
  }

  // Search in acceptance criteria
  storyContent.acceptanceCriteria.forEach(ac => {
    const acMatches = (ac.title + ' ' + ac.description).match(filePattern)
    if (acMatches) {
      acMatches.forEach(m => {
        const clean = m.replace(/`/g, '').trim()
        if (clean) mentions.add(clean)
      })
    }
  })

  // Search in tasks
  storyContent.tasks.forEach(task => {
    const taskMatches = task.title.match(filePattern)
    if (taskMatches) {
      taskMatches.forEach(m => {
        const clean = m.replace(/`/g, '').trim()
        if (clean) mentions.add(clean)
      })
    }
  })

  return Array.from(mentions)
}

// Get language from file extension
function getLanguageFromPath(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    'ts': 'TypeScript',
    'tsx': 'TypeScript',
    'js': 'JavaScript',
    'jsx': 'JavaScript',
    'py': 'Python',
    'rs': 'Rust',
    'go': 'Go',
    'java': 'Java',
    'cs': 'C#',
    'cpp': 'C++',
    'c': 'C',
    'h': 'C',
    'css': 'CSS',
    'scss': 'SCSS',
    'json': 'JSON',
    'yaml': 'YAML',
    'yml': 'YAML',
    'md': 'Markdown'
  }
  return langMap[ext] || 'Text'
}

export function usePairProgrammer(storyId: string): UsePairProgrammerReturn {
  console.log('[PairProgrammer] Hook initialized for story:', storyId)

  const projectPath = useStore((state) => state.projectPath)
  const projectType = useStore((state) => state.projectType)
  const storyContent = useStore((state) => state.storyContent)
  const aiTool = useStore((state) => state.aiTool)
  const claudeModel = useStore((state) => state.claudeModel)
  const customEndpoint = useStore((state) => state.customEndpoint)
  const agents = useStore((state) => state.agents)
  const stories = useStore((state) => state.stories)
  const pairProgrammingEnabledStoryId = useStore((state) => state.pairProgrammingEnabledStoryId)

  // Enabled when this story is the one with pair programming enabled
  const enabled = pairProgrammingEnabledStoryId === storyId

  const [latestFeedback, setLatestFeedback] = useState<PairProgrammerFeedback | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [lastChangedFile, setLastChangedFile] = useState<{ path: string; hash: string } | null>(null)

  // Use refs to prevent overlapping analyses
  const analysisInProgressRef = useRef(false)
  const sessionIdRef = useRef<string | undefined>(undefined)

  // Check if any other agent (non-pair-programmer) is currently running
  const isOtherAgentRunning = useMemo(() => {
    return Object.values(agents).some(a =>
      a.id !== 'pair-programmer' && a.status === 'running'
    )
  }, [agents])

  // Check if any stories are in the appropriate statuses
  const hasActiveDevelopmentStories = useMemo(() => {
    const activeStatuses: StoryStatus[] = ['in-progress', 'ready-for-dev', 'review', 'human-review']
    return stories.some(s => activeStatuses.includes(s.status))
  }, [stories])

  // Log agent and story state
  useEffect(() => {
    console.log('[PairProgrammer] Other agent running:', isOtherAgentRunning)
    console.log('[PairProgrammer] Has active development stories:', hasActiveDevelopmentStories)
  }, [isOtherAgentRunning, hasActiveDevelopmentStories])

  // Log when enabled state changes
  useEffect(() => {
    console.log('[PairProgrammer] Enabled state changed:', enabled)
    if (enabled) {
      console.log('[PairProgrammer] Listening for file changes...')
    }
  }, [enabled])

  // Build context for the AI
  const buildContext = useCallback((filePath: string, fileContent: string, previousFeedback: PairProgrammerFeedback | null): string => {
    const previousFeedbackText = previousFeedback
      ? `PREVIOUS FEEDBACK (do not repeat): "${previousFeedback.content}"`
      : 'PREVIOUS FEEDBACK (do not repeat): None - this is your first message'

    const pendingTasks = storyContent?.tasks
      .filter(t => !t.completed)
      .map(t => `- ${t.title}`)
      .join('\n') || 'None'

    const fileMentions = extractFileMentions(storyContent || null)
    const fileMentionsText = fileMentions.length > 0
      ? `FILES MENTIONED IN STORY:\n${fileMentions.join('\n')}`
      : 'FILES MENTIONED IN STORY: None'

    const fileName = filePath.split('/').pop() || filePath
    const language = getLanguageFromPath(filePath)

    return `You are a pair programmer. Provide 1-2 sentence feedback ONLY.

${previousFeedbackText}

STORY: ${storyContent?.description || 'No description'}
PENDING TASKS:
${pendingTasks}

CURRENT FILE: ${fileName}
LANGUAGE: ${language}
--- Content Start ---
${fileContent}
--- Content End ---

${fileMentionsText}

Respond in 1-2 sentences:
- What to fix/improve next
- Any blocking issues
OR "Looking good - move to next task"`
  }, [storyContent])

  // Perform analysis on a specific file
  const analyzeFile = useCallback(async (filePath: string): Promise<void> => {
    console.log('[PairProgrammer] === analyzeFile START ===')
    console.log('[PairProgrammer] filePath:', filePath)
    console.log('[PairProgrammer] projectPath:', projectPath)
    console.log('[PairProgrammer] projectType:', projectType)

    if (!projectPath || !projectType) {
      console.log('[PairProgrammer] Skipping: no project path or type')
      return
    }

    console.log('[PairProgrammer] Checking conditions...')
    console.log('[PairProgrammer] - isOtherAgentRunning:', isOtherAgentRunning)
    console.log('[PairProgrammer] - hasActiveDevelopmentStories:', hasActiveDevelopmentStories)

    // Check if any other agent is running (not pair-programmer)
    if (isOtherAgentRunning) {
      console.log('[PairProgrammer] Skipping: Another agent is currently working')
      return
    }

    // Check if any stories are in active development statuses
    if (!hasActiveDevelopmentStories) {
      console.log('[PairProgrammer] Skipping: No active development stories (in-progress, ready-for-dev, review, human-review)')
      return
    }

    console.log('[PairProgrammer] All conditions passed, proceeding with analysis')

    try {
      // Read file content
      const readResult = await window.fileAPI.readFile(filePath)
      if (!readResult.content) {
        console.error('[PairProgrammer] Failed to read file:', readResult.error)
        return
      }

      const fileContent = readResult.content
      const currentHash = generateCodeHash(fileContent)
      console.log('[PairProgrammer] File content read, length:', fileContent.length, 'hash:', currentHash)

      // Check if content has changed since last analysis of this file
      if (lastChangedFile?.path === filePath && lastChangedFile.hash === currentHash) {
        console.log('[PairProgrammer] File content unchanged, skipping analysis')
        return
      }

      // Check if analysis is already in progress
      if (analysisInProgressRef.current) {
        console.log('[PairProgrammer] Analysis already in progress, skipping')
        return
      }

      console.log('[PairProgrammer] Starting analysis for:', filePath)
      analysisInProgressRef.current = true
      setIsAnalyzing(true)

      const prompt = buildContext(filePath, fileContent, latestFeedback)
      console.log('[PairProgrammer] Prompt built, length:', prompt.length)

      if (!sessionIdRef.current) {
        // Need to load agent first
        console.log('[PairProgrammer] Loading agent...')
        const loadResult = await window.chatAPI.loadAgent({
          agentId: 'pair-programmer',
          projectPath,
          projectType,
          tool: aiTool,
          model: aiTool === 'claude-code' ? claudeModel : undefined,
          customEndpoint: aiTool === 'custom-endpoint' ? customEndpoint : undefined
        })

        if (!loadResult.success) {
          console.error('[PairProgrammer] Failed to load agent:', loadResult.error)
          setIsAnalyzing(false)
          analysisInProgressRef.current = false
          return
        }

        // Wait for session ID from agent-loaded event
        await new Promise<void>((resolve) => {
          const cleanup = window.chatAPI.onAgentLoaded((event) => {
            if (event.agentId === 'pair-programmer') {
              sessionIdRef.current = event.sessionId
              cleanup()
              resolve()
            }
          })
        })
        console.log('[PairProgrammer] Agent loaded, session:', sessionIdRef.current)
      }

      // Send message
      console.log('[PairProgrammer] Sending message with session:', sessionIdRef.current)
      const sendResult = await window.chatAPI.sendMessage({
        agentId: 'pair-programmer',
        projectPath,
        message: prompt,
        sessionId: sessionIdRef.current,
        tool: aiTool,
        model: aiTool === 'claude-code' ? claudeModel : undefined,
        customEndpoint: aiTool === 'custom-endpoint' ? customEndpoint : undefined
      })

      if (!sendResult.success) {
        console.error('[PairProgrammer] Failed to send message:', sendResult.error)
        setIsAnalyzing(false)
        analysisInProgressRef.current = false
        return
      }
      console.log('[PairProgrammer] Message sent successfully')

      // Wait for response via exit event
      await new Promise<void>((resolve) => {
        const cleanup = window.chatAPI.onChatExit((event) => {
          if (event.agentId === 'pair-programmer' && event.sessionId === sessionIdRef.current) {
            console.log('[PairProgrammer] Received exit event, session:', event.sessionId)
            cleanup()
            resolve()
          }
        })
      })

      // Get the response from the thread
      const thread = await window.chatAPI.loadThread('pair-programmer')
      console.log('[PairProgrammer] Thread loaded, message count:', thread?.messages.length || 0)

      if (thread && thread.messages.length > 0) {
        // Find the last assistant message
        const lastAssistantMsg = [...thread.messages].reverse().find(m => m.role === 'assistant')
        if (lastAssistantMsg && lastAssistantMsg.content) {
          const fileName = filePath.split('/').pop() || filePath
          const feedback: PairProgrammerFeedback = {
            content: lastAssistantMsg.content,
            timestamp: Date.now(),
            codeHash: currentHash,
            fileName
          }
          setLatestFeedback(feedback)
          setLastChangedFile({ path: filePath, hash: currentHash })
          console.log('[PairProgrammer] Feedback received:', feedback.content)
          console.log('[PairProgrammer] Feedback updated in state')
        } else {
          console.log('[PairProgrammer] No assistant message found in thread')
        }
      }
    } catch (error) {
      console.error('[PairProgrammer] Analysis failed:', error)
    } finally {
      analysisInProgressRef.current = false
      setIsAnalyzing(false)
      console.log('[PairProgrammer] Analysis complete')
    }
  }, [projectPath, projectType, latestFeedback, buildContext, aiTool, claudeModel, customEndpoint, isOtherAgentRunning, hasActiveDevelopmentStories])

  // Manual trigger - analyze the most recently changed file
  const analyzeNow = useCallback(async () => {
    console.log('[PairProgrammer] Manual analyze triggered')
    // If we have a last changed file, analyze it
    if (lastChangedFile) {
      await analyzeFile(lastChangedFile.path)
    } else {
      console.log('[PairProgrammer] No file to analyze - waiting for file changes')
    }
  }, [lastChangedFile, analyzeFile])

  // Clear feedback
  const clearFeedback = useCallback(() => {
    console.log('[PairProgrammer] Clearing feedback')
    setLatestFeedback(null)
    setLastChangedFile(null)
  }, [])

  // Listen for file change events when enabled
  useEffect(() => {
    console.log('[PairProgrammer] Setting up file change listener, enabled:', enabled)

    if (!enabled) {
      console.log('[PairProgrammer] Not enabled - skipping file change listener setup')
      return
    }

    console.log('[PairProgrammer] Registering onFileChanged callback with window.fileAPI')
    const cleanup = window.fileAPI.onFileChanged((change: FileChangeEvent) => {
      console.log('[PairProgrammer] *** FILE CHANGED EVENT RECEIVED ***:', change)
      console.log('[PairProgrammer] - filename:', change.filename)
      console.log('[PairProgrammer] - fullPath:', change.fullPath)
      console.log('[PairProgrammer] - isSourceFile:', change.isSourceFile)
      console.log('[PairProgrammer] - timestamp:', new Date(change.timestamp).toISOString())

      // Only process source files
      if (!change.isSourceFile) {
        console.log('[PairProgrammer] Not a source file, ignoring')
        return
      }

      console.log('[PairProgrammer] Source file changed:', change.filename)
      console.log('[PairProgrammer] Calling analyzeFile for:', change.fullPath)
      // Trigger analysis
      analyzeFile(change.fullPath)
    })

    console.log('[PairProgrammer] File change listener registered successfully')
    return () => {
      console.log('[PairProgrammer] Cleaning up file change listener')
      cleanup()
    }
  }, [enabled, analyzeFile])

  // Clear session when disabled or story changes
  useEffect(() => {
    console.log('[PairProgrammer] Story changed or disabled - storyId:', storyId, 'enabled:', enabled)
    if (!enabled) {
      sessionIdRef.current = undefined
      setLastChangedFile(null)
      console.log('[PairProgrammer] Session cleared')
    }
  }, [enabled, storyId])

  return {
    enabled,
    latestFeedback,
    isAnalyzing,
    analyzeNow,
    clearFeedback
  }
}
