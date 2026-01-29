import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { parseSprintStatus } from '../utils/parseSprintStatus'
import { parseEpicsUnified, getAllStories } from '../utils/parseEpicsUnified'
import { parseStoryContent } from '../utils/parseStory'
import { getEpicsFullPath, getSprintStatusFullPath } from '../utils/projectTypes'

export function useProjectData() {
  const {
    _hasHydrated,
    projectPath,
    projectType,
    setProjectPath,
    setProjectType,
    addRecentProject,
    setEpics,
    setStories,
    setLoading,
    setError,
    setLastRefreshed,
    setIsWatching,
    setStoryContent,
    selectedStory,
    setNewProjectDialogOpen,
    setPendingNewProject,
    setBmadInGitignore
  } = useStore()

  const selectProject = useCallback(async () => {
    const result = await window.fileAPI.selectDirectory()

    if (!result) {
      return false // User cancelled
    }

    if (result.error) {
      setError(result.error)
      return false
    }

    if (result.path && result.projectType) {
      // Check if this is a new/empty project
      if (result.isNewProject) {
        setPendingNewProject({
          path: result.path,
          projectType: result.projectType
        })
        setNewProjectDialogOpen(true)
        return false // Don't set project yet - let dialog handle it
      }

      const projectName = result.path.split('/').pop() || 'Unknown'
      setProjectPath(result.path)
      setProjectType(result.projectType)
      addRecentProject({
        path: result.path,
        projectType: result.projectType,
        name: projectName
      })
      return true
    }

    return false
  }, [setProjectPath, setProjectType, setError, addRecentProject, setNewProjectDialogOpen, setPendingNewProject])

  const switchToProject = useCallback((path: string, type: typeof projectType) => {
    if (!type) return
    const projectName = path.split('/').pop() || 'Unknown'
    setProjectPath(path)
    setProjectType(type)
    addRecentProject({
      path,
      projectType: type,
      name: projectName
    })
  }, [setProjectPath, setProjectType, addRecentProject])

  const loadProjectData = useCallback(async () => {
    if (!projectPath || !projectType) return

    // Get current state values (don't use reactive values to avoid infinite loops)
    const { stories: currentStories, notificationsEnabled, isUserDragging, setIsUserDragging } = useStore.getState()

    // Capture previous statuses before loading new data
    const previousStatuses = new Map(currentStories.map(s => [s.id, s.status]))

    setLoading(true)
    setError(null)

    try {
      // Load sprint-status.yaml
      const sprintStatusPath = getSprintStatusFullPath(projectPath, projectType)
      const statusResult = await window.fileAPI.readFile(sprintStatusPath)

      if (statusResult.error || !statusResult.content) {
        throw new Error(statusResult.error || 'Failed to read sprint-status.yaml')
      }

      const sprintStatus = parseSprintStatus(statusResult.content)

      // Load epics.md from correct location based on project type
      const epicsPath = getEpicsFullPath(projectPath, projectType)
      const epicsResult = await window.fileAPI.readFile(epicsPath)

      if (epicsResult.error || !epicsResult.content) {
        throw new Error(epicsResult.error || 'Failed to read epics.md')
      }

      // Use unified parser with project type
      const epics = parseEpicsUnified(epicsResult.content, sprintStatus, projectType)
      const stories = getAllStories(epics)

      // Update file paths for stories that have files
      const implementationPath = `${projectPath}/_bmad-output/implementation-artifacts`
      const filesResult = await window.fileAPI.listDirectory(implementationPath)

      if (filesResult.files) {
        const storyFiles = filesResult.files.filter((f) => f.endsWith('.md') && !f.startsWith('story-'))

        for (const story of stories) {
          // Try to find a matching file
          const matchingFile = storyFiles.find((f) => {
            // Match by story ID pattern: 1-1-slug.md
            const prefix = `${story.epicId}-${story.storyNumber}-`
            return f.startsWith(prefix)
          })

          if (matchingFile) {
            story.filePath = `${implementationPath}/${matchingFile}`
            // Update status from sprint-status if the file exists
            const storyKey = matchingFile.replace('.md', '')
            const fileStatus = sprintStatus.developmentStatus[storyKey]
            if (fileStatus) {
              story.status = fileStatus
            }
          }
        }
      }

      setEpics(epics)
      setStories(stories)
      setLastRefreshed(new Date())

      // Get human review settings and status change recording
      const { enableHumanReviewColumn, humanReviewStories, addToHumanReview, isInHumanReview, recordStatusChange } = useStore.getState()

      // Check for status changes (only for external changes, not user drags)
      if (!isUserDragging && previousStatuses.size > 0) {
        for (const story of stories) {
          const oldStatus = previousStatuses.get(story.id)
          if (oldStatus && oldStatus !== story.status) {
            // If human review is enabled and story moved to "done" from "review" or was in human-review,
            // automatically redirect it to human-review instead
            if (enableHumanReviewColumn && story.status === 'done') {
              const wasInHumanReview = humanReviewStories.includes(story.id)
              // Intercept if it was in review OR was already in human-review column
              if (oldStatus === 'review' || wasInHumanReview) {
                // Add to human review list if not already there
                if (!isInHumanReview(story.id)) {
                  addToHumanReview(story.id)
                }
                // Record the status change (from old status to human-review, since that's the effective status)
                recordStatusChange(story.id, story.title, story.epicId, story.storyNumber, oldStatus, 'human-review', 'external')
                // Show notification about the interception
                if (notificationsEnabled) {
                  window.fileAPI.showNotification(
                    'Story Ready for Review',
                    `"${story.title}" moved to Human Review (was marked done by AI)`
                  )
                }
                continue // Skip the normal notification
              }
            }

            // Record the external status change
            recordStatusChange(story.id, story.title, story.epicId, story.storyNumber, oldStatus, story.status, 'external')
            // Show normal status change notification
            if (notificationsEnabled) {
              window.fileAPI.showNotification(
                'Story Status Changed',
                `"${story.title}" moved from ${oldStatus} to ${story.status}`
              )
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setLoading(false)
      // Delay resetting user dragging flag to allow file watcher events to be ignored
      // File watcher events can be delayed significantly (1-2 seconds)
      setTimeout(() => {
        setIsUserDragging(false)
      }, 2000)
    }
  }, [projectPath, projectType, setEpics, setStories, setLoading, setError, setLastRefreshed])

  const loadStoryContent = useCallback(async (story: typeof selectedStory) => {
    if (!story?.filePath) {
      setStoryContent(null)
      return
    }

    try {
      const result = await window.fileAPI.readFile(story.filePath)

      if (result.error || !result.content) {
        setStoryContent(null)
        return
      }

      const content = parseStoryContent(result.content)
      setStoryContent(content)
    } catch {
      setStoryContent(null)
    }
  }, [setStoryContent])

  // Refs to hold latest callbacks - allows file watcher effect to call them without re-running
  const loadProjectDataRef = useRef(loadProjectData)
  const loadStoryContentRef = useRef(loadStoryContent)

  // Keep refs up to date
  useEffect(() => {
    loadProjectDataRef.current = loadProjectData
    loadStoryContentRef.current = loadStoryContent
  }, [loadProjectData, loadStoryContent])

  // Load project data when path changes or after hydration
  useEffect(() => {
    if (_hasHydrated && projectPath && projectType) {
      loadProjectData()

      // Check if bmad folders are in .gitignore (affects branch restrictions)
      // Defer this check so it doesn't compete with initial project load
      setTimeout(() => {
        const { bmadInGitignoreUserSet } = useStore.getState()
        if (!bmadInGitignoreUserSet) {
          window.fileAPI.checkBmadInGitignore(projectPath).then((result) => {
            setBmadInGitignore(result.inGitignore)
          })
        }
      }, 100)
    }
  // Note: setBmadInGitignore is stable (Zustand setter) and intentionally omitted from deps
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_hasHydrated, projectPath, projectType, loadProjectData])

  // File watcher setup - separate effect with minimal deps to avoid repeated start/stop
  useEffect(() => {
    if (!_hasHydrated || !projectPath || !projectType) return

    // Start watching for file changes
    window.fileAPI.startWatching(projectPath, projectType)
    setIsWatching(true)

    // Listen for file changes - use refs to get latest callbacks without triggering effect
    const cleanup = window.fileAPI.onFilesChanged(() => {
      // Skip reload if user is currently dragging (they already triggered a reload)
      const { isUserDragging, selectedStory } = useStore.getState()
      if (isUserDragging) {
        return
      }
      // Call the latest callbacks via refs
      loadProjectDataRef.current()
      // Also reload story content if a story dialog is open
      if (selectedStory?.filePath) {
        loadStoryContentRef.current(selectedStory)
      }
    })

    // Cleanup watcher and listener on unmount or path change
    return () => {
      cleanup()
      window.fileAPI.stopWatching()
      setIsWatching(false)
    }
  // Only re-run when project path/type actually changes, not on callback recreation
  }, [_hasHydrated, projectPath, projectType, setIsWatching])

  // Load story content when selected story changes
  useEffect(() => {
    if (selectedStory) {
      loadStoryContent(selectedStory)
    } else {
      setStoryContent(null)
    }
  }, [selectedStory, loadStoryContent, setStoryContent])

  return {
    selectProject,
    switchToProject,
    loadProjectData,
    loadStoryContent
  }
}
