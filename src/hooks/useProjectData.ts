import { useCallback, useEffect } from 'react'
import { useStore } from '../store'
import { parseSprintStatus } from '../utils/parseSprintStatus'
import { parseEpics, getAllStories } from '../utils/parseEpics'
import { parseStoryContent } from '../utils/parseStory'

export function useProjectData() {
  const {
    _hasHydrated,
    projectPath,
    setProjectPath,
    setEpics,
    setStories,
    setLoading,
    setError,
    setStoryContent,
    selectedStory
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

    if (result.path) {
      setProjectPath(result.path)
      return true
    }

    return false
  }, [setProjectPath, setError])

  const loadProjectData = useCallback(async () => {
    if (!projectPath) return

    setLoading(true)
    setError(null)

    try {
      // Load sprint-status.yaml
      const sprintStatusPath = `${projectPath}/_bmad-output/implementation-artifacts/sprint-status.yaml`
      const statusResult = await window.fileAPI.readFile(sprintStatusPath)

      if (statusResult.error || !statusResult.content) {
        throw new Error(statusResult.error || 'Failed to read sprint-status.yaml')
      }

      const sprintStatus = parseSprintStatus(statusResult.content)

      // Load epics.md
      const epicsPath = `${projectPath}/_bmad-output/epics.md`
      const epicsResult = await window.fileAPI.readFile(epicsPath)

      if (epicsResult.error || !epicsResult.content) {
        throw new Error(epicsResult.error || 'Failed to read epics.md')
      }

      const epics = parseEpics(epicsResult.content, sprintStatus)
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project data')
    } finally {
      setLoading(false)
    }
  }, [projectPath, setEpics, setStories, setLoading, setError])

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
    if (_hasHydrated && projectPath) {
      loadProjectData()

      // Start watching for file changes
      window.fileAPI.startWatching(projectPath)

      // Listen for file changes
      const cleanup = window.fileAPI.onFilesChanged(() => {
        console.log('Files changed, reloading project data...')
        loadProjectData()
      })

      // Cleanup watcher and listener on unmount or path change
      return () => {
        cleanup()
        window.fileAPI.stopWatching()
      }
    }
  }, [_hasHydrated, projectPath, loadProjectData])

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
    loadProjectData,
    loadStoryContent
  }
}
