import { Box, Typography, Paper, Stack, Chip, Divider, Alert } from '@mui/material'
import PersonIcon from '@mui/icons-material/Person'
import { useStore } from '../../store'
import { AI_TOOLS } from '../../types'
import { useWorkflow } from '../../hooks/useWorkflow'

export default function AgentsTab() {
  const aiTool = useStore((state) => state.aiTool)
  const selectedTool = AI_TOOLS.find((t) => t.id === aiTool) || AI_TOOLS[0]
  const { agents } = useWorkflow()

  return (
    <Box>
      <Alert severity="info" sx={{ mb: 2 }}>
        Commands shown for <strong>{selectedTool.name}</strong>. Agent invocations use{' '}
        <code style={{ fontWeight: 600 }}>{selectedTool.agentPrefix}agent</code> syntax.
        Change your tool in Settings.
      </Alert>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        BMAD uses specialized AI agents, each with a distinct role in the development process.
        Work with these agents in your AI coding assistant to guide your project.
      </Typography>

      <Stack spacing={2}>
        {agents.map((agent) => (
          <Paper
            key={agent.id}
            variant="outlined"
            sx={{
              p: 2,
              borderLeft: 4,
              borderLeftColor: agent.color
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <PersonIcon sx={{ color: agent.color }} />
              <Typography variant="subtitle1" fontWeight={600}>
                {agent.role}
              </Typography>
              <Chip
                label={agent.name}
                size="small"
                sx={{
                  bgcolor: agent.color,
                  color: 'white',
                  fontWeight: 500,
                  height: 22
                }}
              />
              <Chip
                label={`${selectedTool.agentPrefix}${agent.id}`}
                size="small"
                variant="outlined"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  height: 22,
                  borderColor: agent.color,
                  color: agent.color
                }}
              />
            </Box>

            <Typography variant="body2" sx={{ mb: 1.5 }}>
              {agent.description}
            </Typography>

            <Typography variant="caption" fontWeight={600} color="text.secondary">
              When to use:
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {agent.whenToUse}
            </Typography>

            <Divider sx={{ my: 1.5 }} />

            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Example prompts:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2, mb: 1.5 }}>
              {agent.examplePrompts.map((prompt, i) => (
                <Typography
                  key={i}
                  component="li"
                  variant="body2"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.8rem',
                    color: 'text.secondary',
                    mb: 0.5
                  }}
                >
                  "{prompt}"
                </Typography>
              ))}
            </Box>

            <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              Commands:
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {agent.commands.map((cmd) => (
                <Chip
                  key={cmd}
                  label={cmd}
                  size="small"
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    height: 24
                  }}
                />
              ))}
            </Box>
          </Paper>
        ))}
      </Stack>
    </Box>
  )
}
