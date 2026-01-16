import { Box, Typography, Link, Paper, Stack, Divider } from '@mui/material'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import ArchitectureIcon from '@mui/icons-material/Architecture'
import BuildIcon from '@mui/icons-material/Build'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'

const phases = [
  {
    icon: <AutoStoriesIcon fontSize="small" />,
    title: 'Analysis',
    agent: 'Analyst (Mary)',
    description: 'Research, brainstorming, and understanding requirements. Document existing projects and explore market context.'
  },
  {
    icon: <AnalyticsIcon fontSize="small" />,
    title: 'Planning',
    agent: 'PM (John)',
    description: 'Create PRDs, define epics and stories, write acceptance criteria. Break down work into manageable pieces.'
  },
  {
    icon: <ArchitectureIcon fontSize="small" />,
    title: 'Architecture',
    agent: 'Architect (Winston)',
    description: 'Design system architecture, create technical specifications, and produce architecture diagrams.'
  },
  {
    icon: <BuildIcon fontSize="small" />,
    title: 'Implementation',
    agent: 'SM (Bob), DEV (Amelia), TEA (Murat)',
    description: 'Sprint planning, story implementation, code review, and testing. Build and verify features.'
  }
]

export default function OverviewTab() {
  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        <strong>BMAD</strong> (Breakthrough Method of Agile AI-Driven Development) is an AI-powered framework
        that uses specialized agents to guide you through software development. Each agent has a specific role,
        from analysis through implementation.
      </Typography>

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        The Four Phases
      </Typography>

      <Stack spacing={2} sx={{ mb: 3 }}>
        {phases.map((phase, index) => (
          <Paper
            key={phase.title}
            variant="outlined"
            sx={{
              p: 2,
              borderLeft: 4,
              borderLeftColor: 'primary.main'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              {phase.icon}
              <Typography variant="subtitle1" fontWeight={600}>
                {index + 1}. {phase.title}
              </Typography>
            </Box>
            <Typography variant="caption" color="primary.main" sx={{ display: 'block', mb: 0.5 }}>
              {phase.agent}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {phase.description}
            </Typography>
          </Paper>
        ))}
      </Stack>

      <Divider sx={{ my: 3 }} />

      <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
        BMad Board
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        This application visualizes your BMAD project as a Kanban board, showing stories as they progress
        through the development lifecycle. Track your sprint status, filter by epic, and monitor progress
        across all phases.
      </Typography>

      <Link
        href="https://docs.bmad-method.org"
        target="_blank"
        rel="noopener noreferrer"
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 0.5,
          fontWeight: 500
        }}
      >
        Full BMAD Documentation
        <OpenInNewIcon fontSize="small" />
      </Link>
    </Box>
  )
}
