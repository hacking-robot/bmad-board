import { Epic, Story } from '../types'
import type { SprintStatusData } from './parseSprintStatus'
import { getStoryStatus, getEpicStatus } from './parseSprintStatus'

interface ParsedStory {
  title: string
  storyNumber: number
  description: string // User story from epics.md (As a... I want... So that...)
  acceptanceCriteriaPreview?: string[]  // First 3 AC items
  technicalNotes?: string               // Technical Notes section
  frsAddressed?: string[]               // FRs addressed list
}

interface ParsedEpic {
  id: number
  name: string
  goal: string
  stories: ParsedStory[]
}

export function parseBmmEpics(
  markdownContent: string,
  sprintStatus: SprintStatusData
): Epic[] {
  const lines = markdownContent.split('\n')
  const epics: ParsedEpic[] = []
  let currentEpic: ParsedEpic | null = null
  let currentStory: ParsedStory | null = null
  let storyDescriptionLines: string[] = []

  const finishCurrentStory = () => {
    if (currentStory && currentEpic) {
      const fullText = storyDescriptionLines.join('\n')

      // Extract the user story description (before any section headers)
      const description = fullText
        .split(/\*\*Acceptance Criteria:\*\*/i)[0]
        .split(/\*\*Technical Notes:\*\*/i)[0]
        .split(/\*\*FRs addressed:\*\*/i)[0]
        .trim()
      currentStory.description = description

      // Extract Acceptance Criteria section
      const acMatch = fullText.match(/\*\*Acceptance Criteria:\*\*\s*([\s\S]*?)(?=\*\*Technical Notes:\*\*|\*\*FRs addressed:\*\*|$)/i)
      if (acMatch) {
        const acText = acMatch[1].trim()
        // Parse bullet points (lines starting with - or *)
        const acItems = acText
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.startsWith('-') || line.startsWith('*'))
          .map(line => line.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
        if (acItems.length > 0) {
          currentStory.acceptanceCriteriaPreview = acItems.slice(0, 3) // First 3 items
        }
      }

      // Extract Technical Notes section
      const techMatch = fullText.match(/\*\*Technical Notes:\*\*\s*([\s\S]*?)(?=\*\*Acceptance Criteria:\*\*|\*\*FRs addressed:\*\*|$)/i)
      if (techMatch) {
        const techText = techMatch[1].trim()
        if (techText) {
          currentStory.technicalNotes = techText
        }
      }

      // Extract FRs addressed section
      const frsMatch = fullText.match(/\*\*FRs addressed:\*\*\s*([\s\S]*?)(?=\*\*Acceptance Criteria:\*\*|\*\*Technical Notes:\*\*|$)/i)
      if (frsMatch) {
        const frsText = frsMatch[1].trim()
        // Parse as comma-separated or line-separated list
        const frsItems = frsText
          .split(/[,\n]/)
          .map(item => item.trim())
          .filter(Boolean)
        if (frsItems.length > 0) {
          currentStory.frsAddressed = frsItems
        }
      }

      currentEpic.stories.push(currentStory)
      currentStory = null
      storyDescriptionLines = []
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Match Epic header: ## Epic 1: Orchestrator Core & REST Workflow Execution
    const epicMatch = line.match(/^## Epic (\d+): (.+)$/)
    if (epicMatch) {
      finishCurrentStory()
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
      finishCurrentStory()
      const epicNumber = parseInt(storyMatch[1])
      const storyNumber = parseInt(storyMatch[2])
      const title = storyMatch[3].trim()

      // Only add if this story belongs to the current epic
      if (epicNumber === currentEpic.id) {
        currentStory = { title, storyNumber, description: '' }
      }
      continue
    }

    // Collect story description lines
    if (currentStory) {
      storyDescriptionLines.push(line)
    }
  }

  // Don't forget the last story and epic
  finishCurrentStory()
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
        status: getStoryStatus(sprintStatus, storyKey),
        epicDescription: story.description || undefined,
        acceptanceCriteriaPreview: story.acceptanceCriteriaPreview,
        technicalNotes: story.technicalNotes,
        frsAddressed: story.frsAddressed
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
