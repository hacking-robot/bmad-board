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
  // Dynamic command resolution (same pattern as overlay/statusActions)
  commandRef?: string
  commandModule?: string
  commandType?: 'workflows' | 'agents'
  // Fallback display values (used before scan data is available)
  agentId?: string
  agentName?: string
  outputFile?: string  // File to check for completion (relative to _bmad-output/planning-artifacts/)
  outputDir?: string   // Directory to check for completion
  tooltip?: string     // Rich tooltip explaining what this step does and why
}

export type WizardStepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'error'

export interface ProjectWizardState {
  isActive: boolean
  projectPath: string | null
  outputFolder?: string // Custom output folder name (defaults to _bmad-output)
  developerMode?: 'ai' | 'human' // Development mode (ai = standard, human = modified workflows)
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
