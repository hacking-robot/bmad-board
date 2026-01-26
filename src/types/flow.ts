import type { StoryStatus } from './index'

export interface StatusDefinition {
  id: StoryStatus
  label: string
  color: string
  description: string
  displayOrder: number
  visible: boolean
}

export interface StatusTransition {
  from: StoryStatus
  to: StoryStatus
}

export interface NextStepAction {
  label: string
  agentId: string
  command: string
  description: string
  primary?: boolean
}

export interface StatusActions {
  nextSteps: NextStepAction[]
}

export interface AgentDefinition {
  id: string
  name: string
  role: string
  avatar: string
  description: string
  whenToUse: string
  color: string
  commands: string[]
  examplePrompts: string[]
  agentType?: 'orchestrator' | 'worker' // orchestrator = Oracle, worker = regular agents
}

export interface WorkflowConfig {
  version: string
  statuses: StatusDefinition[]
  transitions: StatusTransition[]
  statusActions: Record<StoryStatus, StatusActions>
  agents: AgentDefinition[]
}
