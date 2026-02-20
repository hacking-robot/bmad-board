import { WizardStep } from '../types/projectWizard'

export const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'install',
    name: 'Install BMAD',
    phase: 'install',
    type: 'system',
    description: 'Install the bmad-method package into this project via npx',
    required: true,
    outputDir: '_bmad',
    tooltip: 'Runs npx to install the BMAD method framework into your project. This creates the _bmad folder with all agents, workflows, and configuration files needed for the BMAD development process.'
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
    outputDir: 'brainstorming',
    outputDirPrefix: 'brainstorming-session-',
    tooltip: 'An interactive session with the Analyst agent to explore ideas, features, and possibilities for your project. Produces a brainstorming report that feeds into later planning steps. Useful for new projects where the scope is still being defined.'
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
    agentName: 'Analyst',
    outputDir: 'research',
    outputDirPrefix: 'market-',
    tooltip: 'The Analyst agent researches market size, growth potential, competitive landscape, and target customer insights. Helps validate your product idea against real market conditions before investing in development.'
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
    agentName: 'Analyst',
    outputDir: 'research',
    outputDirPrefix: 'domain-',
    tooltip: 'Deep dive into your project\'s industry domain: regulatory requirements, technology trends, ecosystem dynamics, and domain-specific constraints. Especially valuable for projects in regulated industries or unfamiliar domains.'
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
    agentName: 'Analyst',
    outputDir: 'research',
    outputDirPrefix: 'technical-',
    tooltip: 'Evaluates technology options, compares frameworks and tools, and analyzes implementation approaches. Helps make informed tech stack decisions before committing to an architecture.'
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
    outputFile: 'product-brief.md',
    tooltip: 'Creates a concise product brief that captures the project vision, target users, core value proposition, and high-level goals. Serves as the foundation document that aligns all subsequent planning and development work.'
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
    outputFile: 'PRD.md',
    tooltip: 'The PM agent creates a detailed Product Requirements Document (PRD) defining features, user flows, functional and non-functional requirements. This is a required step — the PRD drives all downstream architecture and story creation.'
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
    outputFile: 'ux-spec.md',
    tooltip: 'The UX Designer agent creates a UX specification with user flows, wireframe descriptions, and interface guidelines. Produces a ux-spec.md that developers reference during implementation. Skip this if your project has no UI or you prefer to design as you go.'
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
    outputFile: 'architecture.md',
    tooltip: 'The Architect agent designs the system architecture: tech stack, component structure, data models, APIs, and integration patterns. This required step produces architecture.md, which guides all implementation work and ensures technical consistency.'
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
    outputFile: 'project-context.md',
    tooltip: 'Generates a comprehensive project-context.md that summarizes all planning artifacts into a single reference document. AI agents use this during development to understand the full project scope without re-reading every artifact. Required for efficient AI-assisted development.'
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
    outputFile: 'epics.md',
    tooltip: 'The PM agent breaks down the PRD and architecture into epics (major feature groups) and individual stories with acceptance criteria. Produces epics.md and story files that populate the sprint board. This is what creates the work items you\'ll see on the board.'
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
    agentName: 'Architect',
    tooltip: 'The Architect agent reviews all planning artifacts (PRD, architecture, stories) to verify consistency, completeness, and readiness for implementation. Catches gaps or conflicts between documents before development begins, preventing costly rework later.'
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
