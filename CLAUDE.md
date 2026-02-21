# BMadBoard

Electron desktop application for visualizing and managing BMAD projects as a story board with integrated AI agent automation.

## Tech Stack

- **Frontend**: React 18, TypeScript, MUI 6, Zustand
- **Desktop**: Electron 33
- **Build**: Vite, electron-builder
- **Styling**: Emotion (CSS-in-JS), Gruvbox theme

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
│   ├── AgentChat/       # AI agent chat interface with message threading
│   ├── AgentPanel/      # Agent sidebar panel with terminal view
│   ├── AgentsTab/       # Agents tab view
│   ├── Board/           # Kanban board with drag-and-drop columns
│   ├── BranchSwitcher/  # Git branch switching with activity info
│   ├── CommandPalette/  # Keyboard-driven command palette
│   ├── common/          # Shared utility components (SearchableDropdown)
│   ├── EnvCheckDialog/  # Environment prerequisites check on project open
│   ├── EpicFilter/      # Filter stories by epic
│   ├── FullCycleDialog/ # Full cycle & epic cycle automation UI
│   ├── GitDiffDialog/   # Side-by-side git diff viewer
│   ├── Header/          # App header with controls
│   ├── HelpPanel/       # Help docs, agent info, workflow, commands, artifacts
│   ├── KeyboardShortcuts/ # Keyboard shortcut handling
│   ├── NewProjectDialog/ # New project guidance
│   ├── ProjectSwitcher/ # Switch between recent projects
│   ├── ProjectWizard/   # Guided new project setup wizard with artifact viewer
│   ├── ProjectWorkflowsDialog/ # Browse and launch project workflows
│   ├── SearchBar/       # Story search
│   ├── SettingsMenu/    # Settings (AI tool, model, theme, review count, etc.)
│   ├── StatusBar/       # Bottom bar (branch, cost, update status)
│   ├── StatusHistoryPanel/ # Story status change history timeline
│   ├── StoryCard/       # Story card display with epic badges
│   ├── StoryDialog/     # Story detail modal with chat history
│   ├── ThemeToggle/     # Light/dark mode toggle
│   ├── UncommittedChanges/ # Show uncommitted git changes
│   ├── WelcomeDialog/   # Project folder selection on first launch
│   ├── GlobalChatHandler.tsx      # Chat context provider for message handling
│   └── IncompatibleVersionDialog.tsx # BMAD version compatibility gate
├── hooks/
│   ├── useChatMessageHandler.ts  # Agent chat message processing
│   ├── useFullCycle.ts           # Full cycle automation state
│   ├── usePlanningArtifacts.ts   # Planning artifact file loading
│   ├── useProjectData.ts         # Project data loading & refresh
│   └── useWorkflow.ts            # Workflow config resolution
├── utils/
│   ├── chatUtils.ts              # Chat history save/load per story
│   ├── commandTransform.ts       # BMAD command path transforms
│   ├── parseBmmEpics.ts          # BMM-specific epic parser
│   ├── parseEpics.ts             # GDS epic parser
│   ├── parseEpicsUnified.ts      # Unified epic parser (BMM + GDS)
│   ├── parseSprintStatus.ts      # Sprint status YAML parser
│   ├── parseStory.ts             # Story markdown parser
│   ├── projectTypes.ts           # Project type detection
│   └── workflowMerge.ts          # Merge scanned & static workflows
├── data/
│   ├── flow-bmm.json             # BMM alpha workflow config
│   ├── flow-bmm-stable.json      # BMM stable workflow config
│   ├── flow-gds.json             # GDS workflow config
│   ├── board-overlay-bmm.json    # BMM board overlay config
│   ├── board-overlay-gds.json    # GDS board overlay config
│   ├── humanDevFiles.ts          # BMM human-mode dev file templates
│   ├── humanDevFilesGds.ts       # GDS human-mode dev file templates
│   └── wizardSteps.ts            # Project wizard step definitions
├── types/
│   ├── index.ts                  # Core types (Story, Epic, ClaudeModel, etc.)
│   ├── flow.ts                   # Workflow config types
│   ├── fullCycle.ts              # Full cycle & epic cycle types
│   ├── bmadScan.ts               # BMAD filesystem scan types
│   └── projectWizard.ts          # Project wizard types
├── store.ts             # Zustand state management
├── theme.ts             # MUI theme configuration (Gruvbox)
└── App.tsx              # Root component

electron/
├── main.ts              # Electron main process + auto-updater
├── preload.ts           # IPC bridge to renderer
├── agentManager.ts      # AI agent process management
├── bmadScanner.ts       # BMAD project filesystem scanner
├── cliToolManager.ts    # CLI tool detection & management
└── envUtils.ts          # Environment utilities
```

## Key Features

### Sprint Board
- Kanban board with drag-and-drop story cards across status columns
- Collapsible columns with per-epic state persistence
- Custom story ordering within columns (persisted per epic/status)
- Epic filtering and text search
- Human Review column with configurable checklist

### AI Agent Automation
- **Full Cycle**: End-to-end story processing (create, branch, implement, review, merge) with visual stepper
- **Epic Cycle**: Batch-run full cycle across all backlog stories in an epic
- **Agent Chat**: Sidebar chat with persistent threads, streaming messages, typing indicators, and session resume
- **Agent Terminal**: Raw output view with ANSI color support and tool call filtering
- **CLI Tool Support**: Claude Code, Cursor, Aider, Windsurf, Roo Code, or custom Anthropic-compatible endpoints
- **Model Selection**: Opus or Sonnet for Claude Code
- **Smart Auto-Response**: Orchestrator detects agent prompts and provides context during automation
- **Cost Tracking**: Per-project LLM API cost ledger displayed in status bar

### Project Management
- **Project Wizard**: Guided new project setup with BMAD installation, artifact detection, and template validation
- **Project Switcher**: Quick switch between recent projects (up to 10)
- **BMAD Scanner**: Auto-discovers agents, workflows, and version info from `_bmad/` directory
- **Version Gate**: Incompatible version dialog blocks usage with pre-v6 BMAD
- **Environment Check**: Verifies required tools (Claude CLI, Git, Node.js) on project open
- **Planning Artifacts**: View epics, goals, and planning documents within the app

### Git Integration
- Branch creation/switching with activity timestamps
- Commits, diffs (side-by-side viewer), and uncommitted changes
- Merge story branches to base with merge status checks
- Default branch detection and configurable base branch
- Per-project git settings (base branch, gitignore handling, epic branches)

### Developer Experience
- Dark/Light mode with Gruvbox theme
- Command palette (`Cmd/Ctrl+K`) and comprehensive keyboard shortcuts
- Auto-refresh via file watching for story file changes
- Auto-update with GitHub Releases (check, download, install on quit)
- Window bounds persistence
- System notifications for agent messages
- Verbose mode for detailed tool call inspection

### Help & Documentation
- Overview, Agents, Workflows, Commands, and Epics tabs
- Artifact viewer with markdown rendering
- Status history timeline with source tracking (user vs agent)

### Settings
- AI tool selection and model configuration
- Custom endpoint support (Anthropic-compatible APIs)
- Theme, verbose mode, notifications
- Review count (0–5 rounds), developer mode (AI/Human)
- BMAD profile (user name, language)
- Max thread messages limit

## BMAD Project Types

The app supports two BMAD project types, each with alpha and stable variants:

**BMM (BMAD Method)** - Standard projects:
- `docs/planning-artifacts/epics.md` - Epic definitions
- `docs/planning-artifacts/stories/*.md` - Story files
- `docs/implementation-artifacts/sprint-status.yaml` - Story status tracking

**GDS (BMAD Game Dev)** - Game development projects:
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