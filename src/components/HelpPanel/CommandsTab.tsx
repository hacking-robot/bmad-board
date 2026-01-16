import { Box, Typography, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Alert } from '@mui/material'
import { useStore } from '../../store'
import { AI_TOOLS } from '../../types'

interface Command {
  command: string
  description: string
  agent: string
  example: string
  category: 'workflow' | 'agent' | 'story' | 'utility'
}

const commands: Command[] = [
  // Workflow commands
  {
    command: '*workflow-init',
    description: 'Analyze project and recommend a development track (Quick Flow, BMad Method, or Enterprise)',
    agent: 'Any',
    example: 'Run *workflow-init to get started with your project',
    category: 'workflow'
  },
  // Story commands
  {
    command: '*story-draft',
    description: 'Draft a new user story with acceptance criteria',
    agent: 'PM (John)',
    example: '*story-draft for user authentication feature',
    category: 'story'
  },
  {
    command: '*story-prep',
    description: 'Prepare a story for development by refining details',
    agent: 'SM (Bob)',
    example: '*story-prep for story 2.3',
    category: 'story'
  },
  {
    command: '*epic-create',
    description: 'Create a new epic to group related stories',
    agent: 'PM (John)',
    example: '*epic-create for payment system',
    category: 'story'
  },
  {
    command: '*sprint-status',
    description: 'Generate current sprint status report',
    agent: 'SM (Bob)',
    example: '*sprint-status to see progress',
    category: 'story'
  },
  {
    command: '*implement',
    description: 'Start implementing a story following acceptance criteria',
    agent: 'DEV (Amelia)',
    example: '*implement story 1.2',
    category: 'story'
  },
  {
    command: '*code-review',
    description: 'Request a code review for completed work',
    agent: 'DEV (Amelia)',
    example: '*code-review for the auth changes',
    category: 'story'
  },
  // Agent commands
  {
    command: '*menu',
    description: 'Show the menu of available actions for the current agent',
    agent: 'All agents',
    example: '*menu to see what the agent can do',
    category: 'agent'
  },
  {
    command: '*dismiss',
    description: 'End the current agent session',
    agent: 'All agents',
    example: '*dismiss when done with the agent',
    category: 'agent'
  },
  {
    command: '*party-mode',
    description: 'Enable multi-agent collaboration for complex tasks',
    agent: 'All agents',
    example: '*party-mode for cross-functional work',
    category: 'agent'
  },
  // Utility commands
  {
    command: '*quick-fix',
    description: 'Quick bug fix without full planning overhead',
    agent: 'Quick Flow (Barry)',
    example: '*quick-fix the login button issue',
    category: 'utility'
  },
  {
    command: '*quick-feature',
    description: 'Quick feature implementation for small enhancements',
    agent: 'Quick Flow (Barry)',
    example: '*quick-feature add dark mode toggle',
    category: 'utility'
  },
  {
    command: '*test-init',
    description: 'Initialize testing framework for the project',
    agent: 'TEA (Murat)',
    example: '*test-init to set up E2E tests',
    category: 'utility'
  },
  {
    command: '*e2e-gen',
    description: 'Generate E2E tests for a feature or flow',
    agent: 'TEA (Murat)',
    example: '*e2e-gen for checkout flow',
    category: 'utility'
  }
]

const categoryColors = {
  workflow: '#10B981',
  story: '#3B82F6',
  agent: '#8B5CF6',
  utility: '#F59E0B'
}

const categoryLabels = {
  workflow: 'Workflow',
  story: 'Story Management',
  agent: 'Agent Control',
  utility: 'Utility'
}

export default function CommandsTab() {
  const aiTool = useStore((state) => state.aiTool)
  const selectedTool = AI_TOOLS.find((t) => t.id === aiTool) || AI_TOOLS[0]

  const groupedCommands = commands.reduce((acc, cmd) => {
    if (!acc[cmd.category]) acc[cmd.category] = []
    acc[cmd.category].push(cmd)
    return acc
  }, {} as Record<string, Command[]>)

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Using <strong>{selectedTool.name}</strong>. To invoke agents, use{' '}
        <code style={{ fontWeight: 600 }}>{selectedTool.agentPrefix}agent</code> syntax
        (e.g., <code>{selectedTool.agentPrefix}pm</code>, <code>{selectedTool.agentPrefix}dev</code>).
        Change your tool in Settings.
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Use these <code>*commands</code> to trigger BMAD workflows.
        Commands starting with <code>*</code> work universally across all AI tools.
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
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>Agent</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: '20%' }}>Example</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {cmds.map((cmd) => (
                  <TableRow key={cmd.command} hover>
                    <TableCell>
                      <Typography
                        variant="body2"
                        sx={{
                          fontFamily: 'monospace',
                          fontWeight: 600,
                          color: categoryColors[category as keyof typeof categoryColors]
                        }}
                      >
                        {cmd.command}
                      </Typography>
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
                        {cmd.example}
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
            Start a session with <code>{selectedTool.agentPrefix}pm</code> or <code>{selectedTool.agentPrefix}dev</code> to invoke a BMAD agent
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Run <code>*workflow-init</code> to let BMAD analyze your project and recommend the best track
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            Use <code>*menu</code> with any agent to see their available actions
          </Typography>
          <Typography component="li" variant="body2" color="text.secondary">
            For quick fixes, use <code>{selectedTool.agentPrefix}quick-flow</code> with Barry and <code>*quick-fix</code>
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
