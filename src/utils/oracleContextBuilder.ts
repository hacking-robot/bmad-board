// Build rich project context for Oracle autonomous orchestration
import type { Story, Epic } from '../types'
import type { HumanQuestion, OrchestrationEvent } from '../types/orchestration'
import type { OracleProjectContext, StatusActionInfo, EventSummary, GitStateInfo } from './orchestrationParser'
import type { WorkflowConfig } from '../types/flow'

/**
 * Convert an OrchestrationEvent to a human-readable summary
 */
function summarizeEvent(event: OrchestrationEvent): string {
  const { type, payload } = event

  switch (type) {
    case 'status_change':
      return `Story "${payload.storyTitle || payload.storyId}" moved from ${payload.oldStatus} to ${payload.newStatus}`

    case 'agent_completion': {
      const agentInfo = payload.agentName || payload.agentId || 'Unknown agent'
      const storyInfo = payload.storyId ? ` (${payload.storyTitle || payload.storyId})` : ''
      const msgPreview = payload.agentLastMessage
        ? `: "${payload.agentLastMessage.slice(0, 100)}${payload.agentLastMessage.length > 100 ? '...' : ''}"`
        : ''
      return `${agentInfo} completed${storyInfo}${msgPreview}`
    }

    case 'manual_trigger':
      return 'User requested workflow automation'

    case 'timer_tick':
      return 'Periodic autonomous check'

    case 'human_response':
      return `Human answered: "${payload.answer?.slice(0, 50)}${(payload.answer?.length || 0) > 50 ? '...' : ''}" for question about ${payload.storyTitle || payload.storyId || 'project'}`

    default:
      return `Event: ${type}`
  }
}

/**
 * Git settings needed for Oracle context
 */
export interface GitSettings {
  currentBranch: string
  baseBranch: string
  enableEpicBranches: boolean
}

/**
 * Build project context for Oracle from the current app state
 * This provides Oracle with visibility into the project to make intelligent decisions
 */
export function buildOracleContext(
  stories: Story[],
  epics: Epic[],
  pendingQuestions: HumanQuestion[],
  selectedEpicId: number | null,
  workflow?: WorkflowConfig,
  eventHistory?: OrchestrationEvent[],
  gitSettings?: GitSettings
): OracleProjectContext {
  // Filter stories by selected epic if applicable
  const filteredStories = selectedEpicId !== null
    ? stories.filter(s => s.epicId === selectedEpicId)
    : stories

  // Group stories by status
  const storiesByStatus: Record<string, { id: string; title: string; epicId: number }[]> = {}

  for (const story of filteredStories) {
    if (!storiesByStatus[story.status]) {
      storiesByStatus[story.status] = []
    }
    storiesByStatus[story.status].push({
      id: story.id,
      title: story.title,
      epicId: story.epicId
    })
  }

  // Calculate epic counts
  const totalEpics = epics.length
  const inProgressEpics = epics.filter(e => {
    const epicStories = stories.filter(s => s.epicId === e.id)
    const hasInProgress = epicStories.some(s => s.status === 'in-progress')
    const hasReadyForDev = epicStories.some(s => s.status === 'ready-for-dev')
    return hasInProgress || hasReadyForDev
  }).length
  const doneEpics = epics.filter(e => {
    const epicStories = stories.filter(s => s.epicId === e.id)
    return epicStories.length > 0 && epicStories.every(s => s.status === 'done' || s.status === 'optional')
  }).length

  // Format pending questions (only pending ones)
  const activePendingQuestions = pendingQuestions
    .filter(q => q.status === 'pending')
    .map(q => ({
      id: q.id,
      question: q.question,
      context: q.context
    }))

  // Build status actions map from workflow config
  let statusActions: Record<string, StatusActionInfo[]> | undefined
  if (workflow?.statusActions) {
    statusActions = {}
    for (const [status, actions] of Object.entries(workflow.statusActions)) {
      if (actions.nextSteps && actions.nextSteps.length > 0) {
        statusActions[status] = actions.nextSteps.map(step => {
          // Look up agent name for better context
          const agent = workflow.agents.find(a => a.id === step.agentId)
          return {
            label: step.label,
            agentId: step.agentId,
            agentName: agent?.name,
            command: step.command,
            description: step.description,
            primary: step.primary
          }
        })
      }
    }
  }

  // Convert event history to summaries (exclude current event which will be shown separately)
  const recentEvents: EventSummary[] | undefined = eventHistory && eventHistory.length > 0
    ? eventHistory.slice(0, -1).map(event => ({  // Exclude last event (current one)
        type: event.type,
        timestamp: event.timestamp,
        summary: summarizeEvent(event)
      }))
    : undefined

  // Build git state info
  let gitState: GitStateInfo | undefined
  if (gitSettings) {
    const { currentBranch, baseBranch, enableEpicBranches } = gitSettings
    const isOnBaseBranch = currentBranch === baseBranch
    const isOnEpicBranch = currentBranch.startsWith('epic-')
    // Story branches match pattern: {epicId}-{storyNum}-{slug}
    const storyBranchMatch = currentBranch.match(/^(\d+)-(\d+)-/)
    const isOnStoryBranch = !!storyBranchMatch && !isOnEpicBranch

    gitState = {
      currentBranch,
      baseBranch,
      enableEpicBranches,
      isOnBaseBranch,
      isOnEpicBranch,
      isOnStoryBranch,
      currentEpicId: isOnEpicBranch
        ? parseInt(currentBranch.replace('epic-', '').split('-')[0], 10)
        : isOnStoryBranch && storyBranchMatch
          ? parseInt(storyBranchMatch[1], 10)
          : undefined,
      currentStoryId: isOnStoryBranch ? currentBranch : undefined
    }
  }

  return {
    storiesByStatus,
    epicCounts: {
      total: totalEpics,
      inProgress: inProgressEpics,
      done: doneEpics
    },
    pendingQuestions: activePendingQuestions,
    statusActions,
    recentEvents: recentEvents && recentEvents.length > 0 ? recentEvents : undefined,
    gitState
  }
}

/**
 * Create a question ID for tracking
 */
export function generateQuestionId(): string {
  return `q-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * Build a HumanQuestion object from extracted question data
 */
export function createHumanQuestion(
  question: string,
  storyId?: string,
  storyTitle?: string
): HumanQuestion {
  return {
    id: generateQuestionId(),
    timestamp: Date.now(),
    question,
    context: {
      storyId,
      storyTitle
    },
    status: 'pending'
  }
}
