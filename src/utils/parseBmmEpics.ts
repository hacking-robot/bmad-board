import { Epic, Story } from '../types'
import type { SprintStatusData } from './parseSprintStatus'
import { getStoryStatus, getEpicStatus } from './parseSprintStatus'

interface ParsedEpic {
  id: number
  name: string
  goal: string
  stories: { title: string; storyNumber: number }[]
}

export function parseBmmEpics(
  markdownContent: string,
  sprintStatus: SprintStatusData
): Epic[] {
  const lines = markdownContent.split('\n')
  const epics: ParsedEpic[] = []
  let currentEpic: ParsedEpic | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match Epic header: ## Epic 1: Orchestrator Core & REST Workflow Execution
    const epicMatch = line.match(/^## Epic (\d+): (.+)$/)
    if (epicMatch) {
      if (currentEpic) {
        epics.push(currentEpic)
      }
      currentEpic = {
        id: parseInt(epicMatch[1]),
        name: epicMatch[2].trim(),
        goal: '',
        stories: []
      }
      continue
    }

    // Match BMM Goal format: **Goal:** text here
    if (currentEpic && line.startsWith('**Goal:**')) {
      currentEpic.goal = line.replace('**Goal:**', '').trim()
      continue
    }

    // Match BMM Story header: ### Story 1.1: Title Here
    const storyMatch = line.match(/^### Story (\d+)\.(\d+): (.+)$/)
    if (storyMatch && currentEpic) {
      const epicNumber = parseInt(storyMatch[1])
      const storyNumber = parseInt(storyMatch[2])
      const title = storyMatch[3].trim()

      // Only add if this story belongs to the current epic
      if (epicNumber === currentEpic.id) {
        currentEpic.stories.push({ title, storyNumber })
      }
      continue
    }
  }

  // Don't forget the last epic
  if (currentEpic) {
    epics.push(currentEpic)
  }

  // Convert to Epic[] with status information
  return epics.map((epic) => {
    const epicStatus = getEpicStatus(sprintStatus, epic.id)

    const stories: Story[] = epic.stories.map((story) => {
      const slug = generateSlug(story.title)
      const storyKey = `${epic.id}-${story.storyNumber}-${slug}`

      return {
        id: storyKey,
        epicId: epic.id,
        storyNumber: story.storyNumber,
        title: story.title,
        slug,
        status: getStoryStatus(sprintStatus, storyKey)
      }
    })

    return {
      id: epic.id,
      name: epic.name,
      goal: epic.goal,
      status: epicStatus,
      stories
    }
  })
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50)
}
