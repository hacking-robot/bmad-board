// Full Cycle Automation Types

export type FullCycleStepType = 'git' | 'agent' | 'status'

export type FullCycleStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'error'

export interface FullCycleStep {
  id: string
  name: string
  type: FullCycleStepType
  description: string
  // For agent steps
  agentId?: string
  command?: string
  // For git steps
  gitAction?: 'create-branch' | 'commit' | 'merge'
  commitMessage?: string
}

export interface FullCycleState {
  isRunning: boolean
  storyId: string | null
  currentStep: number
  totalSteps: number
  stepName: string
  stepType: FullCycleStepType
  stepStatus: FullCycleStepStatus
  error: string | null
  logs: string[]
  sessionId: string | null // For Claude session continuity
  minimized: boolean
  // Track step statuses for the stepper
  stepStatuses: FullCycleStepStatus[]
  // Timestamps for duration tracking
  startTime: number | null
  stepStartTime: number | null
}

// Initial state for the full cycle
export const initialFullCycleState: FullCycleState = {
  isRunning: false,
  storyId: null,
  currentStep: 0,
  totalSteps: 0,
  stepName: '',
  stepType: 'agent',
  stepStatus: 'pending',
  error: null,
  logs: [],
  sessionId: null,
  minimized: false,
  stepStatuses: [],
  startTime: null,
  stepStartTime: null
}

// Full cycle step definitions for BMM projects
export const FULL_CYCLE_STEPS_BMM: FullCycleStep[] = [
  {
    id: 'create-story',
    name: 'Create Story File',
    type: 'agent',
    description: 'SM agent creates story markdown with acceptance criteria',
    agentId: 'sm',
    command: '/bmad:bmm:workflows:create-story'
  },
  {
    id: 'create-branch',
    name: 'Create Git Branch',
    type: 'git',
    description: 'Create a feature branch for this story',
    gitAction: 'create-branch'
  },
  {
    id: 'commit-story',
    name: 'Commit Story',
    type: 'git',
    description: 'Commit the new story file',
    gitAction: 'commit',
    commitMessage: 'docs: add story file'
  },
  {
    id: 'implement',
    name: 'Implement Story',
    type: 'agent',
    description: 'DEV agent implements the feature',
    agentId: 'dev',
    command: '/bmad:bmm:workflows:dev-story'
  },
  {
    id: 'commit-implementation',
    name: 'Commit Implementation',
    type: 'git',
    description: 'Commit all implementation changes',
    gitAction: 'commit',
    commitMessage: 'feat: implement story'
  },
  {
    id: 'code-review-1',
    name: 'Code Review #1',
    type: 'agent',
    description: 'DEV agent reviews the code',
    agentId: 'dev',
    command: '/bmad:bmm:workflows:code-review'
  },
  {
    id: 'commit-review-1',
    name: 'Commit Review Fixes',
    type: 'git',
    description: 'Commit any fixes from first review',
    gitAction: 'commit',
    commitMessage: 'fix: address code review feedback'
  },
  {
    id: 'code-review-2',
    name: 'Code Review #2',
    type: 'agent',
    description: 'Second DEV review for verification',
    agentId: 'dev',
    command: '/bmad:bmm:workflows:code-review'
  },
  {
    id: 'commit-review-2',
    name: 'Commit Final Fixes',
    type: 'git',
    description: 'Commit any remaining fixes',
    gitAction: 'commit',
    commitMessage: 'fix: final review fixes'
  },
  {
    id: 'mark-done',
    name: 'Mark Done',
    type: 'status',
    description: 'Update story status to done'
  },
  {
    id: 'commit-done',
    name: 'Commit Status',
    type: 'git',
    description: 'Commit the done status update',
    gitAction: 'commit',
    commitMessage: 'docs: mark story as done'
  },
  {
    id: 'merge-to-base',
    name: 'Merge to Base',
    type: 'git',
    description: 'Merge story branch back to base branch',
    gitAction: 'merge'
  }
]

// Build full cycle steps dynamically based on project type and review count
export function buildFullCycleSteps(projectType: 'bmm' | 'bmgd', reviewCount: number): FullCycleStep[] {
  const isBmgd = projectType === 'bmgd'
  const devAgentId = isBmgd ? 'game-dev' : 'dev'
  const smAgentId = isBmgd ? 'game-scrum-master' : 'sm'
  const createStoryCommand = isBmgd ? '/bmad:bmgd:workflows:create-story' : '/bmad:bmm:workflows:create-story'
  const devStoryCommand = isBmgd ? '/bmad:bmgd:workflows:dev-story' : '/bmad:bmm:workflows:dev-story'
  const codeReviewCommand = isBmgd ? '/bmad:bmgd:workflows:code-review' : '/bmad:bmm:workflows:code-review'
  const smDesc = isBmgd ? 'Game Scrum Master' : 'SM'
  const devDesc = isBmgd ? 'Game DEV' : 'DEV'

  const steps: FullCycleStep[] = [
    {
      id: 'create-story',
      name: 'Create Story File',
      type: 'agent',
      description: `${smDesc} agent creates story markdown with acceptance criteria`,
      agentId: smAgentId,
      command: createStoryCommand
    },
    {
      id: 'create-branch',
      name: 'Create Git Branch',
      type: 'git',
      description: 'Create a feature branch for this story',
      gitAction: 'create-branch'
    },
    {
      id: 'commit-story',
      name: 'Commit Story',
      type: 'git',
      description: 'Commit the new story file',
      gitAction: 'commit',
      commitMessage: 'docs: add story file'
    },
    {
      id: 'implement',
      name: 'Implement Story',
      type: 'agent',
      description: `${devDesc} agent implements the feature`,
      agentId: devAgentId,
      command: devStoryCommand
    },
    {
      id: 'commit-implementation',
      name: 'Commit Implementation',
      type: 'git',
      description: 'Commit all implementation changes',
      gitAction: 'commit',
      commitMessage: 'feat: implement story'
    }
  ]

  // Add review rounds
  for (let i = 1; i <= reviewCount; i++) {
    const isLast = i === reviewCount
    steps.push({
      id: `code-review-${i}`,
      name: `Code Review #${i}`,
      type: 'agent',
      description: i === 1 ? `${devDesc} agent reviews the code` : `${devDesc} review #${i} for verification`,
      agentId: devAgentId,
      command: codeReviewCommand
    })
    steps.push({
      id: `commit-review-${i}`,
      name: isLast && i > 1 ? 'Commit Final Fixes' : 'Commit Review Fixes',
      type: 'git',
      description: isLast && i > 1 ? 'Commit any remaining fixes' : `Commit any fixes from review #${i}`,
      gitAction: 'commit',
      commitMessage: isLast && i > 1 ? 'fix: final review fixes' : 'fix: address code review feedback'
    })
  }

  // Suffix steps
  steps.push(
    {
      id: 'mark-done',
      name: 'Mark Done',
      type: 'status',
      description: 'Update story status to done'
    },
    {
      id: 'commit-done',
      name: 'Commit Status',
      type: 'git',
      description: 'Commit the done status update',
      gitAction: 'commit',
      commitMessage: 'docs: mark story as done'
    },
    {
      id: 'merge-to-base',
      name: 'Merge to Base',
      type: 'git',
      description: 'Merge story branch back to base branch',
      gitAction: 'merge'
    }
  )

  return steps
}

// Full cycle step definitions for BMGD projects (uses game-* agent IDs)
export const FULL_CYCLE_STEPS_BMGD: FullCycleStep[] = [
  {
    id: 'create-story',
    name: 'Create Story File',
    type: 'agent',
    description: 'Game Scrum Master agent creates story markdown with acceptance criteria',
    agentId: 'game-scrum-master',
    command: '/bmad:bmgd:workflows:create-story'
  },
  {
    id: 'create-branch',
    name: 'Create Git Branch',
    type: 'git',
    description: 'Create a feature branch for this story',
    gitAction: 'create-branch'
  },
  {
    id: 'commit-story',
    name: 'Commit Story',
    type: 'git',
    description: 'Commit the new story file',
    gitAction: 'commit',
    commitMessage: 'docs: add story file'
  },
  {
    id: 'implement',
    name: 'Implement Story',
    type: 'agent',
    description: 'Game DEV agent implements the feature',
    agentId: 'game-dev',
    command: '/bmad:bmgd:workflows:dev-story'
  },
  {
    id: 'commit-implementation',
    name: 'Commit Implementation',
    type: 'git',
    description: 'Commit all implementation changes',
    gitAction: 'commit',
    commitMessage: 'feat: implement story'
  },
  {
    id: 'code-review-1',
    name: 'Code Review #1',
    type: 'agent',
    description: 'Game DEV agent reviews the code',
    agentId: 'game-dev',
    command: '/bmad:bmgd:workflows:code-review'
  },
  {
    id: 'commit-review-1',
    name: 'Commit Review Fixes',
    type: 'git',
    description: 'Commit any fixes from first review',
    gitAction: 'commit',
    commitMessage: 'fix: address code review feedback'
  },
  {
    id: 'code-review-2',
    name: 'Code Review #2',
    type: 'agent',
    description: 'Second Game DEV review for verification',
    agentId: 'game-dev',
    command: '/bmad:bmgd:workflows:code-review'
  },
  {
    id: 'commit-review-2',
    name: 'Commit Final Fixes',
    type: 'git',
    description: 'Commit any remaining fixes',
    gitAction: 'commit',
    commitMessage: 'fix: final review fixes'
  },
  {
    id: 'mark-done',
    name: 'Mark Done',
    type: 'status',
    description: 'Update story status to done'
  },
  {
    id: 'commit-done',
    name: 'Commit Status',
    type: 'git',
    description: 'Commit the done status update',
    gitAction: 'commit',
    commitMessage: 'docs: mark story as done'
  },
  {
    id: 'merge-to-base',
    name: 'Merge to Base',
    type: 'git',
    description: 'Merge story branch back to base branch',
    gitAction: 'merge'
  }
]
