// Project Wizard Types

export type WizardStepType = 'system' | 'agent'

export type WizardPhase = 'install' | 'analysis' | 'planning' | 'solutioning'

export interface WizardStep {
  id: string
  name: string
  phase: WizardPhase
  type: WizardStepType
  description: string
  required: boolean
  agentId?: string
  agentName?: string
  command?: string
  outputFile?: string  // File to check for completion (relative to _bmad-output/planning-artifacts/)
  outputDir?: string   // Directory to check for completion
}

export type WizardStepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'error'

export interface ProjectWizardState {
  isActive: boolean
  projectPath: string | null
  currentStep: number
  stepStatuses: WizardStepStatus[]
  installProgress: string[]  // Log lines from npx install
  error: string | null
}

export const initialWizardState: ProjectWizardState = {
  isActive: false,
  projectPath: null,
  currentStep: 0,
  stepStatuses: [],
  installProgress: [],
  error: null
}
