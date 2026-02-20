import { WizardStep } from '../types/projectWizard'

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'install',
    name: 'Install BMAD',
    phase: 'install',
    type: 'system',
    description: 'Install the bmad-method package into this project via npx',
    required: true,
    outputDir: '_bmad'
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming',
    phase: 'analysis',
    type: 'agent',
    description: 'Brainstorm ideas and features with the Analyst',
    required: false,
    agentId: 'analyst',
    agentName: 'Mary (Analyst)',
    command: '/bmad:bmm:workflows:brainstorming',
    outputFile: 'brainstorming-report.md'
  },
  {
    id: 'research',
    name: 'Research',
    phase: 'analysis',
    type: 'agent',
    description: 'Research the problem space, competitors, and technologies',
    required: false,
    agentId: 'analyst',
    agentName: 'Mary (Analyst)',
    command: '/bmad:bmm:workflows:research'
  },
  {
    id: 'product-brief',
    name: 'Product Brief',
    phase: 'analysis',
    type: 'agent',
    description: 'Create a high-level product brief summarizing the vision',
    required: false,
    agentId: 'analyst',
    agentName: 'Mary (Analyst)',
    command: '/bmad:bmm:workflows:create-product-brief',
    outputFile: 'product-brief.md'
  },
  {
    id: 'create-prd',
    name: 'Create PRD',
    phase: 'planning',
    type: 'agent',
    description: 'Create the Product Requirements Document with the PM',
    required: true,
    agentId: 'pm',
    agentName: 'John (PM)',
    command: '/bmad:bmm:workflows:create-prd',
    outputFile: 'PRD.md'
  },
  {
    id: 'create-architecture',
    name: 'Create Architecture',
    phase: 'planning',
    type: 'agent',
    description: 'Design the system architecture with the Architect',
    required: true,
    agentId: 'architect',
    agentName: 'Winston (Architect)',
    command: '/bmad:bmm:workflows:create-architecture',
    outputFile: 'architecture.md'
  },
  {
    id: 'create-ux-design',
    name: 'Create UX Design',
    phase: 'solutioning',
    type: 'agent',
    description: 'Design the user experience and interface',
    required: false,
    agentId: 'ux-designer',
    agentName: 'Sally (UX Designer)',
    command: '/bmad:bmm:workflows:create-ux-design',
    outputFile: 'ux-spec.md'
  },
  {
    id: 'generate-project-context',
    name: 'Generate Project Context',
    phase: 'solutioning',
    type: 'agent',
    description: 'Generate a project context file for AI-assisted development',
    required: false,
    agentId: 'analyst',
    agentName: 'Mary (Analyst)',
    command: '/bmad:bmm:workflows:generate-project-context',
    outputFile: 'project-context.md'
  },
  {
    id: 'create-epics-and-stories',
    name: 'Create Epics & Stories',
    phase: 'solutioning',
    type: 'agent',
    description: 'Break the project into epics and stories with the PM',
    required: true,
    agentId: 'pm',
    agentName: 'John (PM)',
    command: '/bmad:bmm:workflows:create-epics-and-stories',
    outputFile: 'epics.md'
  },
  {
    id: 'readiness-check',
    name: 'Readiness Check',
    phase: 'solutioning',
    type: 'agent',
    description: 'Verify the project is ready for implementation',
    required: false,
    agentId: 'architect',
    agentName: 'Winston (Architect)',
    command: '/bmad:bmm:workflows:check-implementation-readiness'
  }
]

export const WIZARD_TOTAL_STEPS = WIZARD_STEPS.length

// Get the indices of required steps
export const REQUIRED_STEP_INDICES = WIZARD_STEPS
  .map((step, index) => step.required ? index : -1)
  .filter(i => i >= 0)

// Phase labels for grouping in the stepper
export const PHASE_LABELS: Record<string, string> = {
  install: 'Setup',
  analysis: 'Analysis (Optional)',
  planning: 'Planning (Required)',
  solutioning: 'Solutioning'
}
