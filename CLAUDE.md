# BMadBoard

Electron desktop application for visualizing and managing BMAD projects as a story board with integrated AI agent automation.

## Tech Stack

- **Frontend**: React 18, TypeScript, MUI 6, Zustand
- **Desktop**: Electron 33
- **Build**: Vite, electron-builder
- **Styling**: Emotion (CSS-in-JS)

## Key Commands

```bash
npm run dev              # Start Vite dev server only
npm run electron:dev     # Start full Electron app in dev mode
npm run build            # Production build + package
npm run typecheck        # TypeScript type checking
```

## Project Structure

```
src/
├── components/
│   ├── AgentChat/       # AI agent chat interface with message handling
│   ├── AgentPanel/      # Agent sidebar panel
│   ├── AgentsTab/       # Agents tab view
│   ├── Board/           # Story board and columns
│   ├── BranchSwitcher/  # Git branch switching
│   ├── CommandPalette/  # Keyboard-driven command palette
│   ├── common/          # Shared utility components
│   ├── EpicFilter/      # Filter by epic
│   ├── FullCycleDialog/ # Full cycle & epic cycle automation UI
│   ├── GitDiffDialog/   # View git diff for stories
│   ├── Header/          # App header with controls
│   ├── HelpPanel/       # Help docs, agent info, artifact viewer
│   ├── KeyboardShortcuts/ # Keyboard shortcut handling
│   ├── NewProjectDialog/ # New project guidance
│   ├── ProjectSwitcher/ # Switch between projects
│   ├── ProjectWizard/   # Guided new project setup wizard
│   ├── ProjectWorkflowsDialog/ # View and run project workflows
│   ├── SearchBar/       # Story search
│   ├── SettingsMenu/    # Application settings (AI tool, theme, etc.)
│   ├── StatusBar/       # Bottom status bar
│   ├── StatusHistoryPanel/ # Story status change history timeline
│   ├── StoryCard/       # Story card display
│   ├── StoryDialog/     # Story detail modal
│   ├── ThemeToggle/     # Light/dark mode
│   ├── UncommittedChanges/ # Show uncommitted git changes
│   └── WelcomeDialog/   # Project folder selection
├── hooks/
│   ├── useChatMessageHandler.ts  # Agent chat message processing
│   ├── useFullCycle.ts           # Full cycle automation state
│   ├── usePlanningArtifacts.ts   # Planning artifact file loading
│   ├── useProjectData.ts         # Project data loading & refresh
│   └── useWorkflow.ts            # Workflow config resolution
├── utils/
│   ├── chatUtils.ts              # Chat history save/load per story
│   ├── commandTransform.ts       # BMAD command path transforms
│   ├── parseEpicsUnified.ts      # Unified epic parser
│   ├── parseSprintStatus.ts      # Sprint status YAML parser
│   ├── parseStory.ts             # Story markdown parser
│   ├── projectTypes.ts           # Project type detection
│   └── workflowMerge.ts          # Merge scanned & static workflows
├── data/
│   ├── flow-bmm.json             # BMM alpha workflow config
│   ├── flow-bmm-stable.json      # BMM stable workflow config
│   ├── flow-bmgd.json            # BMGD workflow config
│   ├── board-overlay-bmm.json    # BMM board overlay config
│   ├── board-overlay-bmgd.json   # BMGD board overlay config
│   └── wizardSteps.ts            # Project wizard step definitions
├── types/
│   ├── index.ts                  # Core types (Story, Epic, etc.)
│   ├── flow.ts                   # Workflow config types
│   ├── fullCycle.ts              # Full cycle & epic cycle types
│   ├── bmadScan.ts               # BMAD filesystem scan types
│   └── projectWizard.ts          # Project wizard types
├── store.ts             # Zustand state management
├── theme.ts             # MUI theme configuration
└── App.tsx              # Root component

electron/
├── main.ts              # Electron main process
├── preload.ts           # IPC bridge to renderer
├── agentManager.ts      # AI agent process management
├── bmadScanner.ts       # BMAD project filesystem scanner
├── cliToolManager.ts    # CLI tool detection & management
└── envUtils.ts          # Environment utilities
```

## Key Features

- **Sprint Board**: Kanban board with story cards across status columns
- **Full Cycle Automation**: End-to-end story processing (create, branch, implement, review, merge)
- **Epic Cycle**: Batch-run full cycle across all backlog stories in an epic
- **Agent Chat**: Sidebar chat interface for communicating with BMAD AI agents
- **Workflow Engine**: JSON-driven workflow configs with agent/command/status mappings
- **Project Wizard**: Guided new project setup with BMAD installation
- **BMAD Scanner**: Filesystem scanning to discover agents, workflows, and version info
- **Git Integration**: Branch creation/switching, commits, diffs, uncommitted changes
- **Status History**: Timeline of story status changes with source tracking
- **Project Workflows Dialog**: Browse and launch available project workflows
- **Settings**: AI tool selection (Claude Code, Anthropic API, custom endpoint), theme, review count

## BMAD Project Types

The app supports two BMAD project types, each with alpha and stable variants:

**BMM (BMAD Method)** - Standard projects:
- `docs/planning-artifacts/epics.md` - Epic definitions
- `docs/planning-artifacts/stories/*.md` - Story files
- `docs/implementation-artifacts/sprint-status.yaml` - Story status tracking

**BMGD (BMAD Game Dev)** - Game development projects:
- `epics.md` at project root - Epic definitions
- `docs/stories/epic-N/*.md` - Story files per epic

**BMAD Versions**: Alpha (colon-separated commands like `/bmad:bmm:workflows:dev-story`) and Stable (hyphen-separated like `/bmad-bmm-dev-story`)

Story statuses: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `optional`

<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Jan 14, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #39 | 10:40 PM | 🟣 | HTML Entry Point Created with Inter Font and Base Styling | ~513 |
| #38 | " | 🟣 | Vite Configuration Created Integrating React and Electron Build Pipelines | ~509 |
| #37 | " | 🟣 | Node.js TypeScript Configuration Created for Build Tooling and Electron Main Process | ~468 |
| #36 | 10:39 PM | 🟣 | TypeScript Configuration Created with Strict Mode and Path Aliases | ~492 |
| #35 | " | 🟣 | Package.json Created with Electron and React Dependencies | ~538 |
</claude-mem-context>