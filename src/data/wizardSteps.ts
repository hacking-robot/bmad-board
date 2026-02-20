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
    commandRef: 'brainstorming',
    commandModule: 'core',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst',
    outputFile: 'brainstorming-report.md'
  },
  {
    id: 'market-research',
    name: 'Market Research',
    phase: 'analysis',
    type: 'agent',
    description: 'Market size, growth, competition, and customer insights',
    required: false,
    commandRef: 'market-research',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst'
  },
  {
    id: 'domain-research',
    name: 'Domain Research',
    phase: 'analysis',
    type: 'agent',
    description: 'Industry analysis, regulations, technology trends, and ecosystem dynamics',
    required: false,
    commandRef: 'domain-research',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst'
  },
  {
    id: 'technical-research',
    name: 'Technical Research',
    phase: 'analysis',
    type: 'agent',
    description: 'Technology evaluation, architecture decisions, and implementation approaches',
    required: false,
    commandRef: 'technical-research',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst'
  },
  {
    id: 'product-brief',
    name: 'Product Brief',
    phase: 'analysis',
    type: 'agent',
    description: 'Create a high-level product brief summarizing the vision',
    required: false,
    commandRef: 'create-product-brief',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst',
    outputFile: 'product-brief.md'
  },
  {
    id: 'create-prd',
    name: 'Create PRD',
    phase: 'planning',
    type: 'agent',
    description: 'Create the Product Requirements Document with the PM',
    required: true,
    commandRef: 'create-prd',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'pm',
    agentName: 'PM',
    outputFile: 'PRD.md'
  },
  {
    id: 'create-ux-design',
    name: 'Create UX Design',
    phase: 'planning',
    type: 'agent',
    description: 'Design the user experience and interface',
    required: false,
    commandRef: 'create-ux-design',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'ux-designer',
    agentName: 'UX Designer',
    outputFile: 'ux-spec.md'
  },
  {
    id: 'create-architecture',
    name: 'Create Architecture',
    phase: 'solutioning',
    type: 'agent',
    description: 'Design the system architecture with the Architect',
    required: true,
    commandRef: 'create-architecture',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'architect',
    agentName: 'Architect',
    outputFile: 'architecture.md'
  },
  {
    id: 'generate-project-context',
    name: 'Generate Project Context',
    phase: 'solutioning',
    type: 'agent',
    description: 'Generate a project context file for AI-assisted development',
    required: true,
    commandRef: 'generate-project-context',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'analyst',
    agentName: 'Analyst',
    outputFile: 'project-context.md'
  },
  {
    id: 'create-epics-and-stories',
    name: 'Create Epics & Stories',
    phase: 'solutioning',
    type: 'agent',
    description: 'Break the project into epics and stories with the PM',
    required: true,
    commandRef: 'create-epics-and-stories',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'pm',
    agentName: 'PM',
    outputFile: 'epics.md'
  },
  {
    id: 'readiness-check',
    name: 'Readiness Check',
    phase: 'solutioning',
    type: 'agent',
    description: 'Verify the project is ready for implementation',
    required: true,
    commandRef: 'check-implementation-readiness',
    commandModule: 'bmm',
    commandType: 'workflows',
    agentId: 'architect',
    agentName: 'Architect'
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
