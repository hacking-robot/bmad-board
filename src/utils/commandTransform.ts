import { AITool, AI_TOOLS } from '../types'

/**
 * Transform a BMAD command based on the selected AI tool.
 *
 * Commands in flow JSON are stored in Claude Code format:
 * - Agent commands: /bmad:bmm:agents:pm
 * - Workflow commands: /bmad:bmm:workflows:dev-story
 *
 * Transformations:
 * - Claude Code: Keep as-is (slash commands)
 * - Cursor/Windsurf/Roo: Convert to universal * syntax
 */
export function transformCommand(command: string | null | undefined, aiTool: AITool): string {
  if (!command) return ''

  const tool = AI_TOOLS.find(t => t.id === aiTool)

  if (aiTool === 'claude-code') {
    // Claude Code uses slash commands as-is
    return command
  }

  // For other tools, convert slash commands to universal * syntax
  // /bmad:bmm:workflows:dev-story -> *dev-story
  // /bmad:bmm:agents:pm -> @pm (agent invocation uses @ prefix)

  // Check if it's an agent command
  const agentMatch = command.match(/^\/bmad:[^:]+:agents:(.+)$/)
  if (agentMatch) {
    // Agent invocation - use the tool's agent prefix
    return `${tool?.agentPrefix || '@'}${agentMatch[1]}`
  }

  // Check if it's a workflow command
  const workflowMatch = command.match(/^\/bmad:[^:]+:workflows:(.+)$/)
  if (workflowMatch) {
    // Workflow command - use * prefix (universal)
    return `*${workflowMatch[1]}`
  }

  // Fallback: just replace leading / with *
  return command.replace(/^\//, '*')
}

/**
 * Get the agent prefix for the current AI tool
 */
export function getAgentPrefix(aiTool: AITool): string {
  const tool = AI_TOOLS.find(t => t.id === aiTool)
  return tool?.agentPrefix || '@'
}

/**
 * Get display name for the AI tool
 */
export function getToolName(aiTool: AITool): string {
  const tool = AI_TOOLS.find(t => t.id === aiTool)
  return tool?.name || aiTool
}
