// BMAD project filesystem scanner
// Scans _bmad/ directory and .claude/commands/ to dynamically discover agents, workflows, and version info

import { join } from 'path'
import { readFile, readdir, stat } from 'fs/promises'
import { existsSync } from 'fs'

// Types duplicated here for electron main process (no access to src/types)
export interface ScannedAgent {
  id: string
  name: string
  title: string
  icon: string
  role: string
  identity: string
  communicationStyle: string
  principles: string
  module: string
  commands: ScannedCommand[]
}

export interface ScannedCommand {
  name: string
  module: string
  type: 'workflows' | 'agents'
  label: string
}

export interface ScannedWorkflow {
  name: string
  description: string
  module: string
}

export interface BmadScanResult {
  version: string | null
  modules: string[]
  agents: ScannedAgent[]
  workflows: ScannedWorkflow[]
  detectedDeveloperMode: 'ai' | 'human' | null
  scannedAt: string
}

/**
 * Extract workflow/agent info from a menu item path attribute.
 * e.g. "_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml" -> { module: "bmm", name: "dev-story", type: "workflows" }
 * e.g. "_bmad/core/workflows/brainstorming/workflow.md" -> { module: "core", name: "brainstorming", type: "workflows" }
 */
function extractFromPath(path: string): { name: string; module: string; type: 'workflows' | 'agents' } | null {
  // Workflow path: _bmad/{module}/workflows/.../{name}/workflow.{ext}
  const workflowMatch = path.match(/_bmad\/([^/]+)\/workflows\/(?:.*\/)?([^/]+)\/workflow\.\w+$/)
  if (workflowMatch) {
    return { module: workflowMatch[1], name: workflowMatch[2], type: 'workflows' }
  }

  // Agent path: _bmad/{module}/agents/{name} (strip multiple extensions like .agent.yaml)
  const agentMatch = path.match(/_bmad\/([^/]+)\/agents\/([^/]+?)(?:\.\w+)*$/)
  if (agentMatch) {
    return { module: agentMatch[1], name: agentMatch[2], type: 'agents' }
  }

  return null
}

/**
 * Extract text between XML-like tags (non-greedy).
 */
function extractTag(content: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const match = content.match(regex)
  return match ? match[1].trim() : ''
}

/**
 * Extract attribute value from an XML-like opening tag.
 */
function extractAttr(attrs: string, name: string): string {
  const regex = new RegExp(`${name}="([^"]*)"`)
  const match = attrs.match(regex)
  return match ? match[1] : ''
}

/**
 * Parse an agent markdown file to extract metadata and menu commands.
 */
function parseAgentFile(content: string, module: string): ScannedAgent | null {
  // Extract <agent ...> attributes
  const agentTagMatch = content.match(/<agent\s+([^>]+)>/)
  if (!agentTagMatch) return null

  const attrs = agentTagMatch[1]
  const rawId = extractAttr(attrs, 'id')
  if (!rawId) return null

  // BMAD agent files use filename as ID (e.g. "game-dev.agent.yaml", "dev.agent.yaml")
  // Strip file extension suffixes to get the clean agent ID (e.g. "game-dev", "dev")
  const id = rawId.replace(/\.agent\.\w+$/, '').replace(/\.\w+$/, '')

  const name = extractAttr(attrs, 'name') || id
  const title = extractAttr(attrs, 'title') || ''
  const icon = extractAttr(attrs, 'icon') || ''

  // Extract content sections
  const role = extractTag(content, 'role')
  const identity = extractTag(content, 'identity')
  const communicationStyle = extractTag(content, 'communication_style')
  const principles = extractTag(content, 'principles')

  // Parse <menu> -> <item> entries
  const commands: ScannedCommand[] = []
  const menuContent = extractTag(content, 'menu')

  if (menuContent) {
    const itemRegex = /<item\s+([^>]*?)>([^<]*)<\/item>/g
    let itemMatch
    while ((itemMatch = itemRegex.exec(menuContent)) !== null) {
      const itemAttrs = itemMatch[1]
      const itemLabel = itemMatch[2].trim()

      // Look for workflow= or exec= attributes
      const workflowPath = extractAttr(itemAttrs, 'workflow')
      const execPath = extractAttr(itemAttrs, 'exec')
      const pathValue = workflowPath || execPath

      if (pathValue) {
        const extracted = extractFromPath(pathValue)
        if (extracted) {
          commands.push({
            name: extracted.name,
            module: extracted.module,
            type: extracted.type,
            label: itemLabel
          })
        }
      }
    }
  }

  return {
    id,
    name,
    title,
    icon,
    role,
    identity,
    communicationStyle,
    principles,
    module,
    commands
  }
}

/**
 * Discover BMAD modules by checking subdirectories of _bmad/ that contain agents/.
 */
async function discoverModules(bmadPath: string): Promise<string[]> {
  const modules: string[] = []

  try {
    const entries = await readdir(bmadPath)
    for (const entry of entries) {
      if (entry.startsWith('_') || entry.startsWith('.')) continue
      const entryPath = join(bmadPath, entry)
      const stats = await stat(entryPath)
      if (!stats.isDirectory()) continue

      // Check if this directory has an agents/ subfolder
      const agentsDir = join(entryPath, 'agents')
      if (existsSync(agentsDir)) {
        modules.push(entry)
      }
    }
  } catch {
    // ignore
  }

  return modules
}

/**
 * Read manifest.yaml if it exists to get version info.
 */
async function readManifest(bmadPath: string): Promise<{ version: string | null; modules: string[] | null }> {
  const manifestPath = join(bmadPath, '_config', 'manifest.yaml')
  if (!existsSync(manifestPath)) {
    return { version: null, modules: null }
  }

  try {
    const content = await readFile(manifestPath, 'utf-8')

    // Simple YAML parsing for version field (handles both top-level and nested under installation:)
    const versionMatch = content.match(/^\s*version:\s*['"]?([^'"\n]+)['"]?/m)
    const version = versionMatch ? versionMatch[1].trim() : null

    // Parse modules list — handles both simple (`- core`) and V6 object (`- name: core\n  version: ...`) formats
    // Capture everything under `modules:` until the next top-level key or EOF
    const modulesMatch = content.match(/^modules:\s*\n([\s\S]*?)(?=^\S|\Z)/m)
    let modules: string[] | null = null
    if (modulesMatch) {
      const block = modulesMatch[1]
      // Extract dash-prefixed lines (each starts a list item)
      const dashLines = block.split('\n').filter(l => /^\s+-/.test(l))
      modules = dashLines.map(line => {
        const stripped = line.replace(/^\s*-\s*/, '').trim()
        // V6 format: "name: core" (object with name key) → extract just the name
        const nameMatch = stripped.match(/^name:\s*(.+)/)
        return nameMatch ? nameMatch[1].trim() : stripped
      }).filter(Boolean)
    }

    return { version, modules }
  } catch {
    return { version: null, modules: null }
  }
}

/**
 * Scan agents for a given module directory.
 */
async function scanModuleAgents(bmadPath: string, module: string): Promise<ScannedAgent[]> {
  const agentsDir = join(bmadPath, module, 'agents')
  if (!existsSync(agentsDir)) {
    console.log(`[Scanner] No agents dir: ${agentsDir}`)
    return []
  }

  const agents: ScannedAgent[] = []

  try {
    const files = await readdir(agentsDir)
    console.log(`[Scanner] Module ${module}: ${files.length} entries in agents/: ${files.join(', ')}`)
    for (const file of files) {
      if (!file.endsWith('.md')) continue
      const filePath = join(agentsDir, file)
      try {
        const content = await readFile(filePath, 'utf-8')
        const agent = parseAgentFile(content, module)
        if (agent) {
          console.log(`[Scanner] Parsed agent: ${agent.id} (${agent.name})`)
          agents.push(agent)
        } else {
          console.log(`[Scanner] Failed to parse agent from: ${file} (no <agent> tag?)`)
          // Log first 200 chars to see format
          console.log(`[Scanner] File starts with: ${content.substring(0, 200)}`)
        }
      } catch (err) {
        console.error(`[Scanner] Error reading ${file}:`, err)
      }
    }
  } catch (err) {
    console.error(`[Scanner] Error reading agents dir:`, err)
  }

  return agents
}

/**
 * Scan workflows from command files or manifests.
 */
async function scanWorkflows(projectPath: string, modules: string[]): Promise<ScannedWorkflow[]> {
  const workflows: ScannedWorkflow[] = []
  const seen = new Set<string>()

  // Scan .claude/commands/bmad-{module}-{name}.md (stable format)
  const commandsDir = join(projectPath, '.claude', 'commands')
  if (existsSync(commandsDir)) {
    try {
      const files = await readdir(commandsDir)
      for (const file of files) {
        if (!file.startsWith('bmad-') || !file.endsWith('.md')) continue
        const withoutExt = file.replace('.md', '')

        // Skip agent commands
        if (withoutExt.startsWith('bmad-agent-')) continue

        // bmad-{module}-{name} or bmad-{name} (core module omits prefix)
        const rest = withoutExt.substring('bmad-'.length)
        const firstDash = rest.indexOf('-')

        let module: string
        let name: string
        if (firstDash === -1) {
          // No dash — core module workflow (e.g., bmad-brainstorming)
          module = 'core'
          name = rest
        } else {
          // Check if first segment is a known module, otherwise treat as core
          const possibleModule = rest.substring(0, firstDash)
          if (modules.includes(possibleModule)) {
            module = possibleModule
            name = rest.substring(firstDash + 1)
          } else {
            // Not a known module — core workflow with dashes in name (e.g., bmad-party-mode)
            module = 'core'
            name = rest
          }
        }
        const key = `${module}:${name}`
        if (!seen.has(key)) {
          seen.add(key)
          workflows.push({ name, description: '', module })
        }
      }
    } catch { /* ignore */ }
  }

  return workflows
}

/**
 * Detect developer mode by checking workflow file content.
 * Human mode uses "Development Record" while AI mode uses "Dev Agent Record".
 */
async function detectDeveloperMode(bmadPath: string, modules: string[]): Promise<'ai' | 'human' | null> {
  // Check bmm module first (most common), then others
  const modulesToCheck = modules.includes('bmm') ? ['bmm', ...modules.filter(m => m !== 'bmm')] : modules
  for (const module of modulesToCheck) {
    const checklistPath = join(bmadPath, module, 'workflows', '4-implementation', 'dev-story', 'checklist.md')
    try {
      const content = await readFile(checklistPath, 'utf-8')
      if (content.includes('Development Record')) return 'human'
      if (content.includes('Dev Agent Record')) return 'ai'
    } catch {
      // File doesn't exist for this module, try next
    }
  }
  return null
}

/**
 * Main scan function. Scans a project directory for BMAD data.
 * Returns null if no _bmad/ directory exists.
 */
export async function scanBmadProject(projectPath: string): Promise<BmadScanResult | null> {
  const bmadPath = join(projectPath, '_bmad')
  if (!existsSync(bmadPath)) {
    return null
  }

  // Read manifest for version info
  const manifest = await readManifest(bmadPath)

  // Discover modules by scanning directory structure (ground truth)
  // Manifest module list can be incomplete or use different formats across BMAD versions
  let modules = await discoverModules(bmadPath)
  if (modules.length === 0) {
    // Fallback: check for common module directories
    const common = ['core', 'bmm', 'bmgd']
    modules = common.filter(m => existsSync(join(bmadPath, m)))
  }
  console.log(`[Scanner] Discovered modules: ${JSON.stringify(modules)}`)

  // Scan agents from all modules
  const allAgents: ScannedAgent[] = []
  for (const module of modules) {
    const moduleAgents = await scanModuleAgents(bmadPath, module)
    allAgents.push(...moduleAgents)
  }
  console.log(`[Scanner] Total agents found: ${allAgents.length}`)

  // Scan workflows
  const workflows = await scanWorkflows(projectPath, modules)

  // Detect developer mode from workflow content
  const detectedDeveloperMode = await detectDeveloperMode(bmadPath, modules)

  return {
    version: manifest.version,
    modules,
    agents: allAgents,
    workflows,
    detectedDeveloperMode,
    scannedAt: new Date().toISOString()
  }
}
