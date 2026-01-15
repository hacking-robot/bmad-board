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
      // Match: 1. As a player, I can place NAND gates...
      const storyMatch = line.match(/^\d+\.\s+As a .+?, I (?:can|want) (.+?)(?:,| so that)/)
      if (storyMatch) {
        storyNumber++
        // Extract the main action/title from the story
        let title = storyMatch[1].trim()
        // Clean up the title
        title = title.replace(/^to\s+/, '') // Remove leading "to"
        title = title.charAt(0).toUpperCase() + title.slice(1) // Capitalize
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
