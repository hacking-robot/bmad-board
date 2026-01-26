// Parse Oracle responses for delegation commands and questions
import type { DelegationCommand, OrchestrationEventType } from '../types/orchestration'
import { ORCHESTRATION_LIMITS } from '../types/orchestration'

export interface ExtractedQuestion {
  question: string
  storyId?: string
  storyTitle?: string
}

export interface ParsedOracleResponse {
  hasDelegation: boolean
  delegations: DelegationCommand[]
  hasQuestions: boolean
  questions: ExtractedQuestion[]
  cleanContent: string
  warnings: string[]
}

// Patterns Oracle can use to delegate:
// @agent message - e.g., "@dev implement the login feature"
// delegate to agent: message - e.g., "delegate to pm: review requirements"
const AT_PATTERN = /^@(\w+)\s+(.+)$/gm
const DELEGATE_PATTERN = /delegate\s+to\s+(\w+):\s*(.+)/gi

// Pattern for human questions - Oracle asks humans for clarification
// [QUESTION]: Your question here
// [QUESTION for story-id]: Your question here
const QUESTION_PATTERN = /\[QUESTION(?:\s+for\s+([^\]]+))?\]:\s*(.+)/gi

/**
 * Parse Oracle's response for delegation commands and questions
 * @param response The Oracle's full response text
 * @param validAgentIds List of valid agent IDs that can be delegated to
 * @param currentStoryContext Optional current story context for questions
 * @returns Parsed result with delegations, questions, and warnings
 */
export function parseOracleResponse(
  response: string,
  validAgentIds: string[],
  currentStoryContext?: { storyId?: string; storyTitle?: string }
): ParsedOracleResponse {
  const delegations: DelegationCommand[] = []
  const questions: ExtractedQuestion[] = []
  const warnings: string[] = []
  let cleanContent = response

  // Normalize valid agent IDs for case-insensitive matching
  const normalizedAgentIds = validAgentIds.map(id => id.toLowerCase())

  // Parse @agent pattern
  let match: RegExpExecArray | null
  AT_PATTERN.lastIndex = 0
  while ((match = AT_PATTERN.exec(response)) !== null) {
    const [fullMatch, agentId, message] = match
    const normalizedAgentId = agentId.toLowerCase()

    // Skip self-reference (orchestrator delegating to itself)
    if (normalizedAgentId === 'orchestrator' || normalizedAgentId === 'oracle') {
      warnings.push(`Ignored self-reference: ${fullMatch}`)
      continue
    }

    // Check if agent is valid
    const matchingAgentIndex = normalizedAgentIds.indexOf(normalizedAgentId)
    if (matchingAgentIndex === -1) {
      warnings.push(`Unknown agent "${agentId}" in: ${fullMatch}`)
      continue
    }

    // Use the original casing from validAgentIds
    delegations.push({
      targetAgentId: validAgentIds[matchingAgentIndex],
      message: message.trim()
    })

    // Remove delegation command from clean content
    cleanContent = cleanContent.replace(fullMatch, '').trim()
  }

  // Parse "delegate to agent:" pattern
  DELEGATE_PATTERN.lastIndex = 0
  while ((match = DELEGATE_PATTERN.exec(response)) !== null) {
    const [fullMatch, agentId, message] = match
    const normalizedAgentId = agentId.toLowerCase()

    // Skip self-reference
    if (normalizedAgentId === 'orchestrator' || normalizedAgentId === 'oracle') {
      warnings.push(`Ignored self-reference: ${fullMatch}`)
      continue
    }

    // Check if agent is valid
    const matchingAgentIndex = normalizedAgentIds.indexOf(normalizedAgentId)
    if (matchingAgentIndex === -1) {
      warnings.push(`Unknown agent "${agentId}" in: ${fullMatch}`)
      continue
    }

    // Avoid duplicates if same delegation appeared in both patterns
    const isDuplicate = delegations.some(
      d => d.targetAgentId.toLowerCase() === normalizedAgentId &&
           d.message.toLowerCase() === message.trim().toLowerCase()
    )
    if (isDuplicate) continue

    delegations.push({
      targetAgentId: validAgentIds[matchingAgentIndex],
      message: message.trim()
    })

    cleanContent = cleanContent.replace(fullMatch, '').trim()
  }

  // Apply safety limit on delegations per response
  if (delegations.length > ORCHESTRATION_LIMITS.MAX_DELEGATIONS_PER_RESPONSE) {
    warnings.push(
      `Too many delegations (${delegations.length}), limited to ${ORCHESTRATION_LIMITS.MAX_DELEGATIONS_PER_RESPONSE}`
    )
    delegations.splice(ORCHESTRATION_LIMITS.MAX_DELEGATIONS_PER_RESPONSE)
  }

  // Parse [QUESTION]: pattern for human questions
  QUESTION_PATTERN.lastIndex = 0
  while ((match = QUESTION_PATTERN.exec(response)) !== null) {
    const [fullMatch, storyRef, questionText] = match

    const question: ExtractedQuestion = {
      question: questionText.trim(),
      // If story ref is provided in the pattern, use it; otherwise use context
      storyId: storyRef?.trim() || currentStoryContext?.storyId,
      storyTitle: currentStoryContext?.storyTitle
    }

    questions.push(question)

    // Remove question from clean content
    cleanContent = cleanContent.replace(fullMatch, '').trim()
  }

  return {
    hasDelegation: delegations.length > 0,
    delegations,
    hasQuestions: questions.length > 0,
    questions,
    cleanContent: cleanContent.replace(/\n{3,}/g, '\n\n').trim(),
    warnings
  }
}

/**
 * Status action info for Oracle context
 */
export interface StatusActionInfo {
  label: string
  agentId: string
  agentName?: string
  command: string
  description: string
  primary?: boolean
}

/**
 * Event summary for Oracle context
 */
export interface EventSummary {
  type: string
  timestamp: number
  summary: string
}

/**
 * Git state info for Oracle context
 */
export interface GitStateInfo {
  currentBranch: string
  baseBranch: string
  enableEpicBranches: boolean
  isOnBaseBranch: boolean
  isOnEpicBranch: boolean
  isOnStoryBranch: boolean
  currentEpicId?: number
  currentStoryId?: string
}

/**
 * Project context for building rich Oracle messages
 */
export interface OracleProjectContext {
  storiesByStatus?: Record<string, { id: string; title: string; epicId: number }[]>
  epicCounts?: { total: number; inProgress: number; done: number }
  pendingQuestions?: { id: string; question: string; context?: { storyId?: string } }[]
  recentActivity?: string[]
  statusActions?: Record<string, StatusActionInfo[]>
  recentEvents?: EventSummary[]
  gitState?: GitStateInfo
}

/**
 * Build a message to send to Oracle when an event occurs
 */
export function buildEventMessage(
  eventType: OrchestrationEventType,
  payload: {
    storyId?: string
    storyTitle?: string
    oldStatus?: string
    newStatus?: string
    agentId?: string
    agentName?: string
    exitCode?: number
    agentLastMessage?: string
    questionId?: string
    question?: string
    answer?: string
  },
  projectContext?: OracleProjectContext
): string {
  let contextSection = ''

  // Build project context section if provided
  if (projectContext) {
    const contextParts: string[] = []

    if (projectContext.storiesByStatus) {
      const statusSections: string[] = []
      for (const [status, stories] of Object.entries(projectContext.storiesByStatus)) {
        if (stories.length > 0) {
          // List each story with its ID (which is also the branch name)
          const storyList = stories
            .slice(0, 5) // Limit to 5 per status to avoid too much context
            .map(s => `    - ${s.id} (branch: ${s.id}): "${s.title}"`)
            .join('\n')
          const moreNote = stories.length > 5 ? `\n    ... and ${stories.length - 5} more` : ''
          statusSections.push(`  ${status} (${stories.length}):\n${storyList}${moreNote}`)
        }
      }
      if (statusSections.length > 0) {
        contextParts.push(`[Project State - Story ID = Branch Name]\n${statusSections.join('\n')}`)
      }
    }

    // Include available actions for each status that has stories
    if (projectContext.statusActions && projectContext.storiesByStatus) {
      const actionsByStatus: string[] = []
      for (const [status, stories] of Object.entries(projectContext.storiesByStatus)) {
        if (stories.length > 0 && projectContext.statusActions[status]) {
          const actions = projectContext.statusActions[status]
          const actionList = actions
            .map(a => `    - ${a.label}: @${a.agentId} (${a.description})${a.primary ? ' [PRIMARY]' : ''}`)
            .join('\n')
          if (actionList) {
            actionsByStatus.push(`  ${status}:\n${actionList}`)
          }
        }
      }
      if (actionsByStatus.length > 0) {
        contextParts.push(`[Available Actions by Status]\n${actionsByStatus.join('\n')}`)
      }
    }

    if (projectContext.pendingQuestions && projectContext.pendingQuestions.length > 0) {
      const questionsSummary = projectContext.pendingQuestions
        .slice(0, 5)
        .map((q, i) => `  ${i + 1}. ${q.question}${q.context?.storyId ? ` (${q.context.storyId})` : ''}`)
        .join('\n')
      contextParts.push(`[Pending Human Questions - ${projectContext.pendingQuestions.length} total]\n${questionsSummary}`)
    }

    // Include recent event history so Oracle knows what happened before
    if (projectContext.recentEvents && projectContext.recentEvents.length > 0) {
      const eventsSummary = projectContext.recentEvents
        .map((e, i) => `  ${i + 1}. [${e.type}] ${e.summary}`)
        .join('\n')
      contextParts.push(`[Recent Events - for context]\n${eventsSummary}`)
    }

    // Include git state and branch workflow instructions
    if (projectContext.gitState) {
      const git = projectContext.gitState
      const branchInfo: string[] = [
        `  Current branch: ${git.currentBranch}`,
        `  Base branch: ${git.baseBranch}`,
        `  Epic branches: ${git.enableEpicBranches ? 'ENABLED' : 'DISABLED'}`
      ]

      if (git.isOnBaseBranch) {
        branchInfo.push(`  Status: On base branch`)
      } else if (git.isOnEpicBranch && git.currentEpicId) {
        branchInfo.push(`  Status: On epic branch (Epic ${git.currentEpicId})`)
      } else if (git.isOnStoryBranch && git.currentStoryId) {
        branchInfo.push(`  Status: On story branch (${git.currentStoryId})`)
      }

      // Add workflow instructions based on settings
      const workflowInstructions: string[] = []
      if (git.enableEpicBranches) {
        workflowInstructions.push(
          `  BRANCH WORKFLOW (Epic branches enabled):`,
          `  1. Before starting story work: checkout/create story branch FROM the epic branch`,
          `  2. Story branch format: {epicId}-{storyNum}-{slug} (e.g., 1-2-user-login)`,
          `  3. Epic branch format: epic-{epicId}-{slug} (e.g., epic-1-authentication)`,
          `  4. When delegating implementation: use git_create_branch with from_branch=epic branch`
        )
      } else {
        workflowInstructions.push(
          `  BRANCH WORKFLOW (Epic branches disabled):`,
          `  1. Before starting story work: checkout/create story branch FROM ${git.baseBranch}`,
          `  2. Story branch format: {epicId}-{storyNum}-{slug} (e.g., 1-2-user-login)`,
          `  3. When delegating implementation: use git_create_branch with from_branch=${git.baseBranch}`
        )
      }

      contextParts.push(`[Git State]\n${branchInfo.join('\n')}\n\n${workflowInstructions.join('\n')}`)
    }

    if (contextParts.length > 0) {
      contextSection = '\n\n' + contextParts.join('\n\n')
    }
  }

  const delegationHint = `

INSTRUCTIONS:

WORKFLOW ORDER - Follow this sequence for each story:
1. BACKLOG: Story exists but content may be incomplete
   → First check if story file has content. If not, delegate to @sm to create the story content
   → Once story has complete requirements, use update_story_status to move to ready-for-dev
2. READY-FOR-DEV: Story has complete requirements and acceptance criteria
   → Delegate to @dev to implement the story
   → Use update_story_status to move to in-progress when dev starts
3. IN-PROGRESS: Development is active
   → When dev completes, use update_story_status to move to review
4. REVIEW: Code complete, needs verification
   → Delegate to @dev for code-review or @tea for test review
   → Use update_story_status to move to done when approved (or back to in-progress if changes needed)
5. DONE: Story is complete

TOOLS AVAILABLE:
- Use @agent_id <message> to delegate tasks to agents
- Use update_story_status tool to move stories between columns (backlog → ready-for-dev → in-progress → review → done)
- Use get_story_details tool to check if a story has content before delegating development

IMPORTANT - Before delegating development:
- ALWAYS check that the story has content/requirements using get_story_details
- If a story in backlog has no content, delegate to @sm to create it FIRST
- Only delegate to @dev when story is in ready-for-dev status with complete requirements

BRANCH NAMING: The story ID IS the branch name. When delegating story work:
- Include the exact story ID in your message (e.g., "1-2-user-login")
- Tell the agent to checkout/create branch with that exact name
- Example: "@dev Implement story 1-2-user-login. First checkout branch 1-2-user-login, then implement the feature."

BE AUTONOMOUS: Do NOT ask for confirmation on routine tasks like:
- Starting development on a ready story
- Running code review
- Moving stories through the workflow with update_story_status
- Creating branches for stories

ONLY use [QUESTION]: for CRITICAL decisions like:
- Ambiguous requirements that could lead to wrong implementation
- Conflicting information that needs clarification
- Architectural decisions with significant trade-offs
- When you genuinely cannot proceed without human input

When in doubt, ACT rather than ask. You can always course-correct later.`

  switch (eventType) {
    case 'status_change':
      return `[EVENT: Status Changed]
Story "${payload.storyTitle || payload.storyId}" moved from ${payload.oldStatus} to ${payload.newStatus}.

Take the appropriate next action based on the new status. Use the [Available Actions by Status] section to determine what to delegate.${contextSection}${delegationHint}`

    case 'agent_completion': {
      const agentMessage = payload.agentLastMessage
        ? `\n\n[Agent's Last Message]\n${payload.agentLastMessage}`
        : ''
      const storyRef = payload.storyId ? ` (Story: ${payload.storyTitle || payload.storyId})` : ''
      return `[EVENT: Agent Completed]
${payload.agentName || payload.agentId} finished ${payload.exitCode === 0 ? 'successfully' : `with exit code ${payload.exitCode}`}${storyRef}.${agentMessage}

Take the next action based on the agent's output above:
- If work completed successfully: move story to next status or delegate next task
- If agent requested changes/fixes: delegate back to appropriate agent
- If agent reported issues: address them by delegating to the right agent${contextSection}${delegationHint}`
    }

    case 'manual_trigger':
      return `[EVENT: Manual Trigger]
User requested workflow automation.

What should happen?${contextSection}${delegationHint}`

    case 'timer_tick':
      return `[EVENT: Periodic Check]
This is a scheduled autonomous check. Review the project state and take action.

Goals:
- Move stories through the workflow autonomously
- Delegate implementation tasks to appropriate agents
- Perform quality gates (code review, testing) when stories are ready
- Create/switch branches as needed for story work
- Act decisively - do not wait for confirmation on routine workflow tasks${contextSection}${delegationHint}`

    case 'human_response':
      return `[EVENT: Human Response]
Question: "${payload.question}"
Answer: "${payload.answer}"${payload.storyId ? `\n(Related to: ${payload.storyTitle || payload.storyId})` : ''}

The human has answered your question. Use this information to proceed with the workflow.${delegationHint}`

    default:
      return `[EVENT: Unknown]
An event occurred.${contextSection}${delegationHint}`
  }
}
