import { useCallback, useEffect } from 'react'
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
    setPendingNewProject
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

      // Check for status changes and show notifications (only for external changes)
      if (notificationsEnabled && !isUserDragging && previousStatuses.size > 0) {
        for (const story of stories) {
          const oldStatus = previousStatuses.get(story.id)
          if (oldStatus && oldStatus !== story.status) {
            window.fileAPI.showNotification(
              'Story Status Changed',
              `"${story.title}" moved from ${oldStatus} to ${story.status}`
            )
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setLoading(false)
      // Reset user dragging flag after load completes
      setIsUserDragging(false)
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

  // Load project data when path changes or after hydration
  useEffect(() => {
    if (_hasHydrated && projectPath && projectType) {
      loadProjectData()

      // Start watching for file changes
      window.fileAPI.startWatching(projectPath, projectType)
      setIsWatching(true)

      // Listen for file changes
      const cleanup = window.fileAPI.onFilesChanged(() => {
        console.log('Files changed, reloading project data...')
        loadProjectData()
        // Also reload story content if a story dialog is open
        // Get current selectedStory from store since it may have changed
        const currentSelectedStory = useStore.getState().selectedStory
        if (currentSelectedStory?.filePath) {
          loadStoryContent(currentSelectedStory)
        }
      })

      // Cleanup watcher and listener on unmount or path change
      return () => {
        cleanup()
        window.fileAPI.stopWatching()
        setIsWatching(false)
      }
    }
  }, [_hasHydrated, projectPath, projectType, loadProjectData, loadStoryContent, setIsWatching])

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
