import { Epic, Story } from '../types'
import type { SprintStatusData } from './parseSprintStatus'
import { getStoryStatus, getEpicStatus } from './parseSprintStatus'

interface ParsedEpic {
  id: number
  name: string
  goal: string
  stories: { title: string; storyNumber: number }[]
}

export function parseEpics(
  markdownContent: string,
  sprintStatus: SprintStatusData
): Epic[] {
  const lines = markdownContent.split('\n')
  const epics: ParsedEpic[] = []
  let currentEpic: ParsedEpic | null = null
  let inStoriesSection = false
  let storyNumber = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match Epic header: ## Epic 1: HDL & Chips Foundation
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
      inStoriesSection = false
      storyNumber = 0
      continue
    }

    // Match Goal section
    if (currentEpic && line.startsWith('### Goal')) {
      // Read the next non-empty lines as the goal
      let goalLines: string[] = []
      for (let j = i + 1; j < lines.length && !lines[j].startsWith('#'); j++) {
        if (lines[j].trim()) {
          goalLines.push(lines[j].trim())
        }
        if (goalLines.length >= 2) break // Usually 2-3 sentences
      }
      currentEpic.goal = goalLines.join(' ')
      continue
    }

    // Match Stories section
    if (currentEpic && line.startsWith('### Stories')) {
      inStoriesSection = true
      continue
    }

    // Match story lines (numbered list)
    if (currentEpic && inStoriesSection) {
      // Match any numbered line: 1. Some story text...
      const numberedMatch = line.match(/^\d+\.\s+(.+)$/)
      if (numberedMatch) {
        storyNumber++
        const fullText = numberedMatch[1].trim()
        // Try to extract a cleaner title from user story format, fall back to full text
        const title = extractStoryTitle(fullText)
        currentEpic.stories.push({ title, storyNumber })
      }
    }

    // Stop stories section on next section
    if (currentEpic && inStoriesSection && line.startsWith('---')) {
      inStoriesSection = false
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
      // Generate the story key for status lookup
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

function extractStoryTitle(text: string): string {
  // Try to extract action from "As a X, I [verb] Y so that Z" format
  // Matches common verbs: can, want, see, use, have, am able to, etc.
  const userStoryMatch = text.match(/^As a .+?, I (?:can |want to |see |use |have |am able to |no longer |clearly )?(.+?)(?:,| so that|$)/)
  if (userStoryMatch) {
    let title = userStoryMatch[1].trim()
    title = title.replace(/^to\s+/, '') // Remove leading "to"
    title = title.charAt(0).toUpperCase() + title.slice(1) // Capitalize
    return title
  }
  // Fall back to full text (truncated if too long)
  return text.length > 80 ? text.substring(0, 77) + '...' : text
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 50) // Limit length
}

export function getAllStories(epics: Epic[]): Story[] {
  return epics.flatMap((epic) => epic.stories)
}
