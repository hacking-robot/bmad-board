import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Divider
} from '@mui/material'
import RefreshIcon from '@mui/icons-material/Refresh'
import SmartToyIcon from '@mui/icons-material/SmartToy'
import CodeIcon from '@mui/icons-material/Code'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import ErrorIcon from '@mui/icons-material/Error'
import InfoIcon from '@mui/icons-material/Info'
import { useStore } from '../../store'
import { useVSCodeBridge, VSCodeTabsResponse } from '../../hooks/useVSCodeBridge'
import { useWorkflow } from '../../hooks/useWorkflow'
import { registerCompletionCallback, unregisterCompletionCallback } from '../../hooks/useChatMessageHandler'

interface CodeAssistantDialogProps {
  open: boolean
  onClose: () => void
  storyId: string
}

interface AnalysisSection {
  title: string
  status: 'success' | 'warning' | 'error' | 'info'
  content: string[]
}

export default function CodeAssistantDialog({ open, onClose }: CodeAssistantDialogProps) {
  const storyContent = useStore((state) => state.storyContent)
  const selectedStory = useStore((state) => state.selectedStory)
  const projectPath = useStore((state) => state.projectPath)
  const projectType = useStore((state) => state.projectType)
  const themeMode = useStore((state) => state.themeMode)
  const chatThreads = useStore((state) => state.chatThreads)

  const { agents } = useWorkflow()
  const codeAssistantAgent = agents.find((a) => a.id === 'code-assistant')

  const {
    connectionState,
    tabs,
    testBridge,
    fetchTabs
  } = useVSCodeBridge()

  const [analysisError, setAnalysisError] = useState<string | null>(null)

  // Test bridge connection when dialog opens
  useEffect(() => {
    if (open) {
      testBridge()
    }
  }, [open, testBridge])

  // Get the code-assistant thread
  const codeAssistantThread = chatThreads['code-assistant']

  // Get the latest assistant message from code-assistant thread
  const latestAssistantMessage = codeAssistantThread?.messages
    .filter(m => m.role === 'assistant')
    .at(-1)

  // Get analysis result from parsed message content
  const analysisResult = latestAssistantMessage?.content || null
  const isAnalyzing = codeAssistantThread?.isTyping ?? false

  // Register completion callback to clear any errors on success
  useEffect(() => {
    const callback = (success: boolean) => {
      if (success) {
        setAnalysisError(null)
      } else {
        setAnalysisError('Analysis failed. Please try again.')
      }
    }
    registerCompletionCallback('code-assistant', callback)
    return () => unregisterCompletionCallback('code-assistant')
  }, [])

  // Build context from story + active tab
  const buildAnalysisContext = (activeTab: VSCodeTabsResponse['activeTab']): string => {
    if (!storyContent || !activeTab) {
      return ''
    }

    // System instructions for conciseness
    let context = `You are a concise code analysis assistant.

IMPORTANT OUTPUT GUIDELINES:
- Respond in 2-4 sections maximum
- Use bullet points for lists
- Keep each point under 20 words
- Focus on: issues blocking AC completion, code quality concerns, specific recommendations
- Avoid: verbose explanations, redundant information, generic advice
- Format: ## Section Name followed by bullet points

`

    // Story Context Section
    context += `## STORY CONTEXT
Title: ${selectedStory?.title || 'Unknown'}

Description:
${storyContent.description}

`

    // Acceptance Criteria Section
    if (storyContent.acceptanceCriteria.length > 0) {
      context += `## ACCEPTANCE CRITERIA
`
      storyContent.acceptanceCriteria.forEach((ac, index) => {
        context += `AC${index + 1}: ${ac.title}\n`
        if (ac.description) {
          context += `  ${ac.description}\n`
        }
      })
      context += '\n'
    }

    // Tasks Section (brief)
    if (storyContent.tasks.length > 0) {
      const pendingTasks = storyContent.tasks.filter(t => !t.completed)
      if (pendingTasks.length > 0) {
        context += `## PENDING TASKS
`
        pendingTasks.forEach((task) => {
          context += `- ${task.title}\n`
        })
        context += '\n'
      }
    }

    // Code Section
    context += `## CURRENT CODE
File: ${activeTab.fileName}
Language: ${activeTab.language}
\`\`\`${activeTab.language.toLowerCase()}
${activeTab.content}
\`\`\`

## REQUEST
Analyze the code against the story requirements. Provide concise feedback on:
1. Which ACs are met/not met
2. Any code quality issues
3. Specific recommendations to complete this story
`

    return context
  }

  // Parse analysis response into sections for TTS-friendly display
  const parseAnalysisSections = (response: string): AnalysisSection[] => {
    const sections: AnalysisSection[] = []
    const lines = response.split('\n')

    let currentSection: AnalysisSection | null = null

    for (const line of lines) {
      // Detect section headers (lines ending with colon, or all caps, or numbered headers)
      const isHeader = /^(#{1,3}\s+|[\d]+\.?\s+|[A-Z][A-Z\s]+:|.*:)$/.test(line.trim())

      if (isHeader && line.trim()) {
        // Save previous section
        if (currentSection && currentSection.content.length > 0) {
          sections.push(currentSection)
        }

        // Determine section status based on keywords
        const titleLower = line.toLowerCase()
        let status: AnalysisSection['status'] = 'info'
        if (titleLower.includes('issue') || titleLower.includes('problem') || titleLower.includes('error')) {
          status = 'error'
        } else if (titleLower.includes('warning') || titleLower.includes('caution')) {
          status = 'warning'
        } else if (titleLower.includes('complete') || titleLower.includes('done') || titleLower.includes('success')) {
          status = 'success'
        }

        currentSection = {
          title: line.replace(/^#+\s*/, '').replace(/:$/, '').trim(),
          status,
          content: []
        }
      } else if (line.trim() && currentSection) {
        currentSection.content.push(line.trim())
      } else if (line.trim() && !currentSection) {
        // Content before first section goes to a general section
        currentSection = {
          title: 'Summary',
          status: 'info',
          content: [line.trim()]
        }
      }
    }

    // Add last section
    if (currentSection && currentSection.content.length > 0) {
      sections.push(currentSection)
    }

    // If no sections found, create a default one
    if (sections.length === 0 && response.trim()) {
      sections.push({
        title: 'Analysis',
        status: 'info',
        content: [response.trim()]
      })
    }

    return sections
  }

  const handleAnalyze = async () => {
    if (!projectPath || !projectType) {
      setAnalysisError('Project not configured')
      return
    }

    setAnalysisError(null)

    try {
      // Fetch latest tabs from VSCode bridge
      const tabsData = await fetchTabs()
      if (!tabsData?.activeTab) {
        throw new Error('No active tab found in VSCode. Make sure a file is open in VSCode.')
      }

      // Build context
      const context = buildAnalysisContext(tabsData.activeTab)

      // Send to code-assistant agent via chat API
      if (!codeAssistantAgent) {
        throw new Error('Code Assistant agent not found')
      }

      // Use the chat API to send message to code-assistant
      const result = await window.chatAPI.sendMessage({
        agentId: 'code-assistant',
        projectPath,
        message: context
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to send analysis request')
      }

      // The response will be handled by the global chat message handler
      // and displayed via the store
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setAnalysisError(errorMessage)
    }
  }

  const sections = analysisResult ? parseAnalysisSections(analysisResult) : []

  const getStatusColor = (status: AnalysisSection['status']) => {
    switch (status) {
      case 'success': return 'success.main'
      case 'warning': return 'warning.main'
      case 'error': return 'error.main'
      default: return 'info.main'
    }
  }

  const getStatusIcon = (status: AnalysisSection['status']) => {
    switch (status) {
      case 'success': return <CheckCircleIcon sx={{ color: 'success.main' }} />
      case 'warning': return <ErrorIcon sx={{ color: 'warning.main' }} />
      case 'error': return <ErrorIcon sx={{ color: 'error.main' }} />
      default: return <InfoIcon sx={{ color: 'info.main' }} />
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { maxHeight: '85vh' }
      }}
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SmartToyIcon sx={{ color: 'primary.main' }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h6">Code Assistant</Typography>
            <Typography variant="caption" color="text.secondary">
              {codeAssistantAgent?.description || 'AI code analysis against story requirements'}
            </Typography>
          </Box>
          <Tooltip title="Test connection">
            <IconButton onClick={() => testBridge()} size="small">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Chip
            icon={connectionState.online ? <CheckCircleIcon /> : <ErrorIcon />}
            label={connectionState.online ? 'Online' : 'Offline'}
            color={connectionState.online ? 'success' : 'error'}
            size="small"
          />
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {/* Connection Status */}
        {!connectionState.online && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            VSCode Bridge is offline. Start the bridge server at localhost:34152.
            {connectionState.error && ` Error: ${connectionState.error}`}
          </Alert>
        )}

        {/* Active Tab Info */}
        {tabs?.activeTab && (
          <Paper
            variant="outlined"
            sx={{
              p: 2,
              mb: 2,
              bgcolor: themeMode === 'dark' ? 'background.default' : 'background.paper'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CodeIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={600}>
                Active Tab
              </Typography>
              {tabs.activeTab.isDirty && (
                <Chip label="Unsaved" size="small" color="warning" />
              )}
            </Box>
            <Typography variant="body2" color="text.secondary">
              {tabs.activeTab.fileName} • {tabs.activeTab.language} • {tabs.activeTab.lineCount} lines
            </Typography>
          </Paper>
        )}

        {/* Loading State */}
        {isAnalyzing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4, gap: 2 }}>
            <CircularProgress />
            <Typography color="text.secondary">Analyzing code against story requirements...</Typography>
          </Box>
        )}

        {/* Analysis Error */}
        {analysisError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {analysisError}
          </Alert>
        )}

        {/* Analysis Results */}
        {sections.length > 0 && !isAnalyzing && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {sections.map((section, index) => (
              <Paper
                key={index}
                variant="outlined"
                sx={{
                  p: 2,
                  borderLeft: 4,
                  borderLeftColor: getStatusColor(section.status)
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  {getStatusIcon(section.status)}
                  <Typography variant="subtitle2" fontWeight={600} color={getStatusColor(section.status)}>
                    {section.title}
                  </Typography>
                </Box>
                <Divider sx={{ my: 1 }} />
                {section.content.map((line, lineIndex) => (
                  <Typography
                    key={lineIndex}
                    variant="body2"
                    sx={{
                      mb: lineIndex < section.content.length - 1 ? 0.5 : 0,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.875rem',
                      lineHeight: 1.6
                    }}
                  >
                    {line}
                  </Typography>
                ))}
              </Paper>
            ))}
          </Box>
        )}

        {/* Empty State */}
        {!isAnalyzing && !analysisResult && !analysisError && connectionState.online && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <SmartToyIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
            <Typography color="text.secondary">
              Click "Analyze" to check your code against story requirements
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={isAnalyzing}>
          Close
        </Button>
        <Button
          onClick={handleAnalyze}
          variant="contained"
          disabled={!connectionState.online || isAnalyzing}
          startIcon={<SmartToyIcon />}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
