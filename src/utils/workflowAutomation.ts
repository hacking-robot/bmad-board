/**
 * Workflow Automation Utility
 *
 * Handles deterministic git operations for the story workflow:
 * - Branch creation/checkout before agent work
 * - Auto-commit after agent completion
 * - Merge to parent branch when story is done
 */

export interface WorkflowContext {
  projectPath: string
  storyId: string
  storyTitle?: string
  baseBranch: string
  enableEpicBranches: boolean
  currentBranch: string
}

export interface WorkflowResult {
  success: boolean
  message: string
  branchName?: string
  error?: string
}

/**
 * Get the parent branch for a story branch
 * - If epic branches enabled: parent is the epic branch
 * - If epic branches disabled: parent is the base branch
 */
export function getParentBranch(
  storyId: string,
  baseBranch: string,
  enableEpicBranches: boolean
): string {
  if (!enableEpicBranches) {
    return baseBranch
  }

  // Extract epic ID from story ID (e.g., "1-2-user-login" -> epic 1)
  const epicMatch = storyId.match(/^(\d+)-/)
  if (epicMatch) {
    // Epic branch format: epic-{epicId}-... but we don't know the slug
    // For now, return base branch as fallback - the UI should handle epic branches
    // TODO: Look up epic branch name from epics list
    return baseBranch
  }

  return baseBranch
}

/**
 * Ensure the correct story branch exists and is checked out
 * Call this BEFORE delegating work to an agent
 */
export async function ensureStoryBranch(ctx: WorkflowContext): Promise<WorkflowResult> {
  const { projectPath, storyId, baseBranch, enableEpicBranches, currentBranch } = ctx
  const branchName = storyId // Story ID IS the branch name

  console.log(`[Workflow] Ensuring story branch: ${branchName}`)

  try {
    // Check if already on the correct branch
    if (currentBranch === branchName) {
      console.log(`[Workflow] Already on branch: ${branchName}`)
      return {
        success: true,
        message: `Already on branch ${branchName}`,
        branchName
      }
    }

    // Check if branch exists
    const exists = await window.gitAPI.branchExists(projectPath, branchName)

    if (exists.exists) {
      // Branch exists, checkout
      console.log(`[Workflow] Checking out existing branch: ${branchName}`)
      const result = await window.gitAPI.checkoutBranch(projectPath, branchName)
      if (result.success) {
        return {
          success: true,
          message: `Switched to branch ${branchName}`,
          branchName
        }
      } else {
        return {
          success: false,
          message: `Failed to checkout branch ${branchName}`,
          error: result.error
        }
      }
    } else {
      // Branch doesn't exist, create it from parent
      const parentBranch = getParentBranch(storyId, baseBranch, enableEpicBranches)
      console.log(`[Workflow] Creating branch ${branchName} from ${parentBranch}`)

      const result = await window.gitAPI.createBranch(projectPath, branchName, parentBranch)
      if (result.success) {
        return {
          success: true,
          message: `Created and switched to branch ${branchName} from ${parentBranch}`,
          branchName
        }
      } else {
        return {
          success: false,
          message: `Failed to create branch ${branchName}`,
          error: result.error
        }
      }
    }
  } catch (error) {
    console.error('[Workflow] Error ensuring story branch:', error)
    return {
      success: false,
      message: 'Failed to ensure story branch',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Auto-commit any uncommitted changes with a standard message
 * Call this AFTER an agent completes work
 */
export async function autoCommitChanges(
  projectPath: string,
  storyId: string,
  storyTitle?: string,
  agentName?: string
): Promise<WorkflowResult> {
  console.log(`[Workflow] Checking for uncommitted changes for story: ${storyId}`)

  try {
    // Check if there are changes to commit
    const hasChanges = await window.gitAPI.hasChanges(projectPath)
    if (!hasChanges.hasChanges) {
      console.log('[Workflow] No changes to commit')
      return {
        success: true,
        message: 'No changes to commit'
      }
    }

    // Build commit message
    const title = storyTitle ? `${storyId}: ${storyTitle}` : storyId
    const agent = agentName ? ` by ${agentName}` : ''
    const commitMessage = `feat(${storyId}): Work on ${title}${agent}`

    console.log(`[Workflow] Committing changes: ${commitMessage}`)

    const result = await window.gitAPI.commit(projectPath, commitMessage)
    if (result.success) {
      return {
        success: true,
        message: `Committed changes: ${commitMessage}`
      }
    } else {
      return {
        success: false,
        message: 'Failed to commit changes',
        error: result.error
      }
    }
  } catch (error) {
    console.error('[Workflow] Error auto-committing:', error)
    return {
      success: false,
      message: 'Failed to auto-commit',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Merge the story branch to its parent branch
 * Call this when a story moves to 'done' status
 */
export async function mergeStoryBranch(ctx: WorkflowContext): Promise<WorkflowResult> {
  const { projectPath, storyId, baseBranch, enableEpicBranches, currentBranch } = ctx
  const storyBranch = storyId
  const parentBranch = getParentBranch(storyId, baseBranch, enableEpicBranches)

  console.log(`[Workflow] Merging story branch ${storyBranch} to ${parentBranch}`)

  try {
    // First, check if already merged
    const mergeStatus = await window.gitAPI.isBranchMerged(projectPath, storyBranch, parentBranch)
    if (mergeStatus.merged) {
      console.log(`[Workflow] Branch ${storyBranch} already merged to ${parentBranch}`)
      return {
        success: true,
        message: `Branch ${storyBranch} already merged to ${parentBranch}`
      }
    }

    // Checkout parent branch
    if (currentBranch !== parentBranch) {
      console.log(`[Workflow] Checking out ${parentBranch} for merge`)
      const checkoutResult = await window.gitAPI.checkoutBranch(projectPath, parentBranch)
      if (!checkoutResult.success) {
        return {
          success: false,
          message: `Failed to checkout ${parentBranch} for merge`,
          error: checkoutResult.error
        }
      }
    }

    // Merge the story branch
    const mergeResult = await window.gitAPI.mergeBranch(projectPath, storyBranch)
    if (mergeResult.success) {
      return {
        success: true,
        message: `Merged ${storyBranch} to ${parentBranch}`
      }
    } else if (mergeResult.hasConflicts) {
      return {
        success: false,
        message: `Merge conflicts detected when merging ${storyBranch} to ${parentBranch}`,
        error: 'Merge conflicts - manual resolution required'
      }
    } else {
      return {
        success: false,
        message: `Failed to merge ${storyBranch} to ${parentBranch}`,
        error: mergeResult.error
      }
    }
  } catch (error) {
    console.error('[Workflow] Error merging story branch:', error)
    return {
      success: false,
      message: 'Failed to merge story branch',
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Get the recommended next status based on current status
 */
export function getNextStatus(currentStatus: string): string | null {
  const statusFlow: Record<string, string> = {
    'backlog': 'ready-for-dev',
    'ready-for-dev': 'in-progress',
    'in-progress': 'review',
    'review': 'done'
  }
  return statusFlow[currentStatus] || null
}

/**
 * Determine if branch operations are needed for a status change
 */
export function statusRequiresBranch(newStatus: string): boolean {
  // These statuses require being on the story branch
  return ['in-progress', 'review'].includes(newStatus)
}

/**
 * Determine if a status change should trigger a merge
 */
export function statusRequiresMerge(newStatus: string): boolean {
  return newStatus === 'done'
}
