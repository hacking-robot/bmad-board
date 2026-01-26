// Orchestration types for Oracle auto-workflow

export type OrchestrationEventType =
  | 'status_change'
  | 'agent_completion'
  | 'manual_trigger'
  | 'timer_tick'      // Periodic check
  | 'human_response'  // Human answered a question

export interface OrchestrationEvent {
  id: string
  type: OrchestrationEventType
  timestamp: number
  payload: {
    storyId?: string
    storyTitle?: string
    oldStatus?: string
    newStatus?: string
    agentId?: string
    agentName?: string
    exitCode?: number
    // For agent_completion events - include the agent's last message
    agentLastMessage?: string
    // For human_response events
    questionId?: string
    question?: string
    answer?: string
  }
}

// Timer configuration for periodic Oracle triggers
export interface TimerConfig {
  enabled: boolean
  intervalMs: number  // default 300000 (5 min)
  lastTick: number
}

// Human question queue - Oracle asks questions, humans answer non-blocking
export interface HumanQuestion {
  id: string
  timestamp: number
  question: string
  context: {
    storyId?: string
    storyTitle?: string
  }
  status: 'pending' | 'answered' | 'dismissed'
  answer?: string
}

export interface DelegationCommand {
  targetAgentId: string
  message: string
  storyId?: string
}

export interface PendingDelegation {
  id: string
  eventId: string
  command: DelegationCommand
  status: 'pending' | 'executing' | 'completed' | 'failed'
  startedAt?: number
  completedAt?: number
  error?: string
}

// Safety limits
export const ORCHESTRATION_LIMITS = {
  MAX_DELEGATIONS_PER_RESPONSE: 3,
  MAX_CHAIN_DEPTH: 10,  // Increased for autonomous operation
  DEBOUNCE_MS: 2000,
  QUEUE_POLL_MS: 500,
  DEFAULT_TIMER_INTERVAL_MS: 300000,  // 5 minutes
  MIN_TIMER_INTERVAL_MS: 60000,       // 1 minute minimum
  MAX_TIMER_INTERVAL_MS: 1800000,     // 30 minutes maximum
  TIMER_CHECK_MS: 30000,              // Check timer every 30 seconds
  MAX_PENDING_QUESTIONS: 20
}

export interface OrchestrationState {
  // Toggles
  automationEnabled: boolean
  autoTriggerOnStatusChange: boolean
  autoTriggerOnAgentComplete: boolean

  // State
  isProcessing: boolean
  eventQueue: OrchestrationEvent[]
  pendingDelegations: PendingDelegation[]
  lastOracleCall: number
  debounceMs: number
  chainDepth: number // Track consecutive auto-delegations

  // Event History - recent events for Oracle context
  eventHistory: OrchestrationEvent[]

  // Timer
  timerConfig: TimerConfig

  // Human Questions
  pendingQuestions: HumanQuestion[]

  // Actions
  setAutomationEnabled: (enabled: boolean) => void
  setAutoTriggerOnStatusChange: (enabled: boolean) => void
  setAutoTriggerOnAgentComplete: (enabled: boolean) => void
  queueEvent: (event: OrchestrationEvent) => void
  processNextEvent: () => OrchestrationEvent | null
  clearEventQueue: () => void
  addPendingDelegation: (d: PendingDelegation) => void
  completeDelegation: (id: string, success: boolean, error?: string) => void
  setIsProcessing: (processing: boolean) => void
  setLastOracleCall: (timestamp: number) => void
  incrementChainDepth: () => void
  resetChainDepth: () => void
  setTimerConfig: (config: Partial<TimerConfig>) => void
  addQuestion: (question: HumanQuestion) => void
  answerQuestion: (id: string, answer: string) => void
  dismissQuestion: (id: string) => void
}
