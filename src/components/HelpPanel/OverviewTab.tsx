import { Box, Typography, Link, Paper, Stack, Divider } from '@mui/material'
import AutoStoriesIcon from '@mui/icons-material/AutoStories'
import AnalyticsIcon from '@mui/icons-material/Analytics'
import ArchitectureIcon from '@mui/icons-material/Architecture'
import BuildIcon from '@mui/icons-material/Build'
import SportsEsportsIcon from '@mui/icons-material/SportsEsports'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import { useStore } from '../../store'
import { ProjectType } from '../../types'

interface Phase {
  icon: React.ReactNode
  title: string
  agent: string
  description: string
}

// BMM (BMAD Method) phases
const bmmPhases: Phase[] = [
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
    description: 'Story planning, implementation, code review, and testing. Build and verify features.'
  }
]

// BMGD (BMAD Game Dev) phases
const bmgdPhases: Phase[] = [
  {
    icon: <AutoStoriesIcon fontSize="small" />,
    title: 'Concept',
    agent: 'Game Designer (GD)',
    description: 'Brainstorm game ideas, define core mechanics, and establish the creative vision for your game.'
  },
  {
    icon: <AnalyticsIcon fontSize="small" />,
    title: 'Design',
    agent: 'Game Designer (GD)',
    description: 'Create Game Design Documents, define gameplay systems, and plan game features and progression.'
  },
  {
    icon: <ArchitectureIcon fontSize="small" />,
    title: 'Architecture',
    agent: 'Game Architect (GA)',
    description: 'Design game architecture, plan technical systems, and create component diagrams.'
  },
  {
    icon: <SportsEsportsIcon fontSize="small" />,
    title: 'Development',
    agent: 'Game SM, Game Dev, Game QA',
    description: 'Story planning, game implementation, playtesting, and quality assurance. Build and polish your game.'
  }
]

function getPhases(projectType: ProjectType | null): Phase[] {
  return projectType === 'bmgd' ? bmgdPhases : bmmPhases
}

function getDescription(projectType: ProjectType | null): { title: string; description: string } {
  if (projectType === 'bmgd') {
    return {
      title: 'BMAD Game Dev',
      description: 'BMAD Game Dev is an AI-powered framework for game development. Specialized teammates guide you from concept to playable game, covering design, architecture, implementation, and testing.'
    }
  }
  return {
    title: 'BMAD Method',
    description: 'BMAD (Breakthrough Method of Agile AI-Driven Development) is an AI-powered framework that uses specialized teammates to guide you through software development. Each teammate has a specific role, from analysis through implementation.'
  }
}

export default function OverviewTab() {
  const projectType = useStore((state) => state.projectType)
  const phases = getPhases(projectType)
  const { title, description } = getDescription(projectType)

  return (
    <Box>
      <Typography variant="body1" sx={{ mb: 3 }}>
        <strong>{title}</strong> - {description}
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
        This application visualizes your BMAD project as a story board, showing stories as they progress
        through the development lifecycle. Track your story status, filter by epic, and monitor progress
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
