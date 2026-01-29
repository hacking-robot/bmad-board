import { useState } from 'react'
import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert, IconButton, Tooltip, Snackbar } from '@mui/material'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useStore } from '../../store'
import { AI_TOOLS, AITool, ProjectType } from '../../types'

interface Command {
  command: string  // Base command without prefix (e.g., 'workflow-init')
  description: string
  agent: string
  example: string  // Base example without prefix
  category: 'workflow' | 'agent' | 'story' | 'utility'
}

// Check if tool uses Claude CLI syntax
function usesClaudeSyntax(aiTool: AITool): boolean {
  return aiTool === 'claude-code' || aiTool === 'custom-endpoint'
}

// Transform command based on AI tool
// Claude Code/Custom Endpoint uses full paths: /bmad:bmm:workflows:workflow-init
// Others use simplified: *workflow-init
function formatCommand(baseCommand: string, aiTool: AITool, projectType: ProjectType | null): string {
  if (usesClaudeSyntax(aiTool)) {
    const pt = projectType || 'bmm'
    return `/bmad:${pt}:workflows:${baseCommand}`
  }
  return `*${baseCommand}`
}

// Format agent invocation command
// Claude Code/Custom Endpoint: /bmad:bmm:agents:pm
// Others: @pm
function formatAgentInvocation(agentId: string, aiTool: AITool, projectType: ProjectType | null): string {
  if (usesClaudeSyntax(aiTool)) {
    const pt = projectType || 'bmm'
    return `/bmad:${pt}:agents:${agentId}`
  }
  const tool = AI_TOOLS.find(t => t.id === aiTool)
  return `${tool?.agentPrefix || '@'}${agentId}`
}

// Commands for BMM (BMAD Method)
const bmmCommands: Command[] = [
  // Workflow commands
  {
    command: 'workflow-init',
    description: 'Analyze project and recommend a development track',
    agent: 'Any',
    example: 'workflow-init to get started',
    category: 'workflow'
  },
  // Story commands
  {
    command: 'create-story',
    description: 'Draft a new user story with acceptance criteria',
    agent: 'PM (John)',
    example: 'create-story for user authentication',
    category: 'story'
  },
  {
    command: 'create-epics-and-stories',
    description: 'Break work into epics and stories',
    agent: 'PM (John)',
    example: 'create-epics-and-stories for payment system',
    category: 'story'
  },
  {
    command: 'check-implementation-readiness',
    description: 'Verify story is ready for development',
    agent: 'SM (Bob)',
    example: 'check-implementation-readiness for story 2.3',
    category: 'story'
  },
  {
    command: 'sprint-status',
    description: 'Generate current sprint status report',
    agent: 'SM (Bob)',
    example: 'sprint-status to see progress',
    category: 'story'
  },
  {
    command: 'dev-story',
    description: 'Implement a story following acceptance criteria',
    agent: 'DEV (Amelia)',
    example: 'dev-story 1.2',
    category: 'story'
  },
  {
    command: 'code-review',
    description: 'Request a code review for completed work',
    agent: 'DEV (Amelia)',
    example: 'code-review for the auth changes',
    category: 'story'
  },
  // Agent commands
  {
    command: 'menu',
    description: 'Show available actions for the current agent',
    agent: 'All agents',
    example: 'menu to see options',
    category: 'agent'
  },
  {
    command: 'dismiss',
    description: 'End the current agent session',
    agent: 'All agents',
    example: 'dismiss when done',
    category: 'agent'
  },
  {
    command: 'party-mode',
    description: 'Enable multi-agent collaboration',
    agent: 'All agents',
    example: 'party-mode for complex tasks',
    category: 'agent'
  },
  // Utility commands
  {
    command: 'quick-dev',
    description: 'Quick implementation without full planning',
    agent: 'Quick Flow (Barry)',
    example: 'quick-dev the login fix',
    category: 'utility'
  },
  {
    command: 'quick-spec',
    description: 'Quick specification for small features',
    agent: 'Quick Flow (Barry)',
    example: 'quick-spec add dark mode toggle',
    category: 'utility'
  },
  {
    command: 'testarch-framework',
    description: 'Initialize testing framework for the project',
    agent: 'TEA (Murat)',
    example: 'testarch-framework to set up E2E tests',
    category: 'utility'
  }
]

// Commands for BMGD (BMAD Game Dev)
const bmgdCommands: Command[] = [
  // Workflow commands
  {
    command: 'workflow-init',
    description: 'Analyze project and recommend a development track',
    agent: 'Any',
    example: 'workflow-init to get started',
    category: 'workflow'
  },
  // Story commands
  {
    command: 'brainstorm-game',
    description: 'Brainstorm game ideas and concepts',
    agent: 'Game Designer (GD)',
    example: 'brainstorm-game for puzzle mechanics',
    category: 'story'
  },
  {
    command: 'create-gdd',
    description: 'Create a Game Design Document',
    agent: 'Game Designer (GD)',
    example: 'create-gdd for platformer game',
    category: 'story'
  },
  {
    command: 'create-story',
    description: 'Create a development story with acceptance criteria',
    agent: 'Game Designer (GD)',
    example: 'create-story for player movement',
    category: 'story'
  },
  {
    command: 'sprint-status',
    description: 'Generate current sprint status report',
    agent: 'Game SM (GSM)',
    example: 'sprint-status to see progress',
    category: 'story'
  },
  {
    command: 'dev-story',
    description: 'Implement a story following acceptance criteria',
    agent: 'Game Dev (GDEV)',
    example: 'dev-story 1.2',
    category: 'story'
  },
  {
    command: 'code-review',
    description: 'Request a code review for completed work',
    agent: 'Game Dev (GDEV)',
    example: 'code-review for the physics changes',
    category: 'story'
  },
  // Agent commands
  {
    command: 'menu',
    description: 'Show available actions for the current agent',
    agent: 'All agents',
    example: 'menu to see options',
    category: 'agent'
  },
  {
    command: 'dismiss',
    description: 'End the current agent session',
    agent: 'All agents',
    example: 'dismiss when done',
    category: 'agent'
  },
  {
    command: 'party-mode',
    description: 'Enable multi-agent collaboration',
    agent: 'All agents',
    example: 'party-mode for complex tasks',
    category: 'agent'
  },
  // Utility commands
  {
    command: 'quick-dev',
    description: 'Quick implementation without full planning',
    agent: 'Game Solo Dev (GSOLO)',
    example: 'quick-dev the collision fix',
    category: 'utility'
  },
  {
    command: 'quick-prototype',
    description: 'Quick prototype for testing game mechanics',
    agent: 'Game Solo Dev (GSOLO)',
    example: 'quick-prototype jump mechanic',
    category: 'utility'
  },
  {
    command: 'gametest-playtest-plan',
    description: 'Create a playtest plan for the game',
    agent: 'Game QA (GQA)',
    example: 'gametest-playtest-plan for level 1',
    category: 'utility'
  }
]

// Get commands based on project type
function getCommands(projectType: ProjectType | null): Command[] {
  return projectType === 'bmgd' ? bmgdCommands : bmmCommands
}

const categoryColors = {
  workflow: '#10B981',
  story: '#3B82F6',
  agent: '#8B5CF6',
  utility: '#F59E0B'
}

const categoryLabels = {
  workflow: 'Workflow',
  story: 'Story Management',
  agent: 'Teammate Control',
  utility: 'Utility'
}

export default function CommandsTab() {
  const aiTool = useStore((state) => state.aiTool)
  const projectType = useStore((state) => state.projectType)
  const selectedTool = AI_TOOLS.find((t) => t.id === aiTool) || AI_TOOLS[0]
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setSnackbarOpen(true)
  }

  const commands = getCommands(projectType)
  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Using <strong>{selectedTool.name}</strong>. To invoke teammates, use{' '}
        <code style={{ fontWeight: 600 }}>{usesClaudeSyntax(aiTool) ? `/bmad:${projectType || 'bmm'}:agents:...` : `${selectedTool.agentPrefix}agent`}</code> syntax
        (e.g., <code>{formatAgentInvocation('pm', aiTool, projectType)}</code>, <code>{formatAgentInvocation('dev', aiTool, projectType)}</code>).
        Change your tool in Settings.
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Use these <code>{usesClaudeSyntax(aiTool) ? '/bmad:...' : '*'}commands</code> to trigger BMAD workflows.
        {usesClaudeSyntax(aiTool)
          ? ' Claude CLI uses full path slash commands.'
          : ' Commands starting with * work universally across AI tools.'}
      </Typography>

      {Object.entries(groupedCommands).map(([category, cmds]) => (
        <Box key={category} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>
              {categoryLabels[category as keyof typeof categoryLabels]}
            </Typography>
            <Chip
              label={`${cmds.length} commands`}
              size="small"
              sx={{
                bgcolor: categoryColors[category as keyof typeof categoryColors],
                color: 'white',
                height: 22,
                fontSize: '0.75rem'
              }}
            />
          </Box>

          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 600, width: '25%' }}>Command</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '35%' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>Teammate</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>Example</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cmds.map((cmd) => (
                  <TableRow key={cmd.command} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'monospace',
                            fontWeight: 600,
                            color: categoryColors[category as keyof typeof categoryColors]
                          }}
                        >
                          {formatCommand(cmd.command, aiTool, projectType)}
                        </Typography>
                        <Tooltip title="Copy">
                          <IconButton
                            size="small"
                            onClick={() => handleCopy(formatCommand(cmd.command, aiTool, projectType))}
                            sx={{ p: 0.25, color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                          >
                            <ContentCopyIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {cmd.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {cmd.agent}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontSize: '0.75rem',
                          color: 'text.secondary'
                        }}
                      >
                        {formatCommand(cmd.example, aiTool, projectType)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      ))}

      <Paper
        variant="outlined"
        sx={{
          p: 2,
          bgcolor: 'action.hover',
          mt: 2
        }}
      >
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Pro Tips for {selectedTool.name}
        </Typography>
        <Box component="ul" sx={{ m: 0, pl: 2 }}>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Start a session with <code>{formatAgentInvocation('pm', aiTool, projectType)}</code> or <code>{formatAgentInvocation('dev', aiTool, projectType)}</code> to invoke a BMAD teammate
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Run <code>{formatCommand('workflow-init', aiTool, projectType)}</code> to let BMAD analyze your project and recommend the best track
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Use <code>{formatCommand('menu', aiTool, projectType)}</code> with any teammate to see their available actions
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            For quick fixes, use <code>{formatAgentInvocation('quick-flow', aiTool, projectType)}</code> with Barry and <code>{formatCommand('quick-fix', aiTool, projectType)}</code>
          </Typography>
        </Box>
      </Paper>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={2000}
        onClose={() => setSnackbarOpen(false)}
        message="Copied to clipboard"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
