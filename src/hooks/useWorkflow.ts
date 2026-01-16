import { useMemo } from 'react'
import flowData from '../data/flow.json'
import type { StoryStatus } from '../types'
import type { WorkflowConfig, StatusDefinition, AgentDefinition, NextStepAction } from '../types/flow'

// Cast the imported JSON to our typed config
const workflow = flowData as unknown as WorkflowConfig

export function useWorkflow() {
  // Memoize the helper functions so they don't change on every render
  const helpers = useMemo(() => ({
    // Get all statuses
    statuses: workflow.statuses,

    // Get all agents
    agents: workflow.agents,

    // Get all transitions
    transitions: workflow.transitions,

    // Get a specific status definition
    getStatus: (id: StoryStatus): StatusDefinition | undefined => {
      return workflow.statuses.find((s) => s.id === id)
    },

    // Get visible statuses for the board (in display order)
    getVisibleStatuses: (): StatusDefinition[] => {
      return workflow.statuses
        .filter((s) => s.visible)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    },

    // Get next steps for a status
    getNextSteps: (status: StoryStatus): NextStepAction[] => {
      return workflow.statusActions[status]?.nextSteps || []
    },

    // Get the primary next step for a status (if any)
    getPrimaryNextStep: (status: StoryStatus): NextStepAction | undefined => {
      const steps = workflow.statusActions[status]?.nextSteps || []
      return steps.find((s) => s.primary) || steps[0]
    },

    // Get an agent by ID
    getAgent: (id: string): AgentDefinition | undefined => {
      return workflow.agents.find((a) => a.id === id)
    },

    // Get agent name by ID (for display)
    getAgentName: (id: string): string => {
      const agent = workflow.agents.find((a) => a.id === id)
      return agent ? `${agent.role} (${agent.name})` : id
    },

    // Get valid transitions from a status
    getValidTransitions: (fromStatus: StoryStatus): StoryStatus[] => {
      return workflow.transitions
        .filter((t) => t.from === fromStatus)
        .map((t) => t.to as StoryStatus)
    },

    // Check if a transition is valid
    isValidTransition: (from: StoryStatus, to: StoryStatus): boolean => {
      return workflow.transitions.some((t) => t.from === from && t.to === to)
    }
  }), [])

  return helpers
}

// Export the raw workflow config for components that need direct access
export { workflow }
