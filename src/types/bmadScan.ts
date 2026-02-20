// Types for BMAD project filesystem scanning

export interface ScannedAgent {
  id: string              // "analyst", "game-dev"
  name: string            // "Mary", "Link Freeman"
  title: string           // "Business Analyst", "Game Developer"
  icon: string            // "📊", "🕹️"
  role: string            // from <role> tag
  identity: string        // from <identity> tag
  communicationStyle: string
  principles: string
  module: string          // "bmm", "bmgd", "core"
  commands: ScannedCommand[]  // parsed from <menu> items
}

export interface ScannedCommand {
  name: string            // "dev-story", "brainstorming"
  module: string          // "bmm", "core" (extracted from path)
  type: 'workflows' | 'agents'
  label: string           // "[DS] Execute Dev Story workflow"
}

export interface ScannedWorkflow {
  name: string            // "dev-story"
  description: string     // from manifest or frontmatter
  module: string          // "bmm", "bmgd", "core"
}

export interface BmadScanResult {
  version: string | null        // "6.0.1"
  modules: string[]             // ['core', 'bmm'] or ['core', 'bmm', 'bmgd']
  agents: ScannedAgent[]
  workflows: ScannedWorkflow[]
  scannedAt: string             // ISO timestamp
}
