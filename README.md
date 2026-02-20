<div align="center">
  <img src="assets/banner.svg" alt="BMad Board" width="500">
  <p><strong>Visualize and automate your BMAD sprint workflow with AI-powered agents</strong></p>

  ![License](https://img.shields.io/badge/license-MIT-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Electron](https://img.shields.io/badge/electron-33-47848F)
</div>

---

<img src="assets/screenshot1.png" alt="BMad Board Screenshot" width="100%">

## Features

### Sprint Board
- **Kanban Board**: Visualize stories across columns (Backlog, Ready for Dev, In Progress, Review, Done)
- **Epic Organization**: Stories grouped by epic with color-coded badges
- **Story Details**: View acceptance criteria, tasks, subtasks, and file changes
- **Search & Filter**: Find stories by text or filter by epic
- **Collapsible Columns**: Minimize columns to focus on active work
- **Status History**: Timeline of story status changes with source tracking (manual vs agent)

### AI Agent Automation
- **Full Cycle**: One-click end-to-end story processing — creates story file, branches, implements, reviews, commits, and merges
- **Epic Cycle**: Batch-run the full cycle across all backlog stories in an epic with configurable review rounds
- **Agent Chat**: Sliding sidebar panel to communicate with AI agents (`Cmd+Shift+A`)
- **Project Workflows**: Browse and launch available BMAD workflows directly from the UI
- **AI Tool Support**: Works with Claude Code, Anthropic API, or custom API endpoints
- **Smart Auto-Response**: Orchestrator detects agent prompts and provides intelligent responses during automation

### Project Management
- **Project Wizard**: Guided new project setup with BMAD installation and configuration
- **Project Switcher**: Quickly switch between multiple BMAD projects
- **BMAD Scanner**: Auto-discovers agents, workflows, and version info from project files
- **Planning Artifacts**: View epics and planning documents within the app

### Developer Experience
- **Dark/Light Mode**: Toggle between themes
- **Command Palette**: Quick access to actions with keyboard shortcuts
- **Git Integration**: Branch creation/switching, commits, diffs, and uncommitted changes view
- **Auto-Refresh**: File watching detects changes to story files
- **Keyboard Shortcuts**: Comprehensive shortcuts for efficient navigation

## Compatibility

| Requirement | Supported |
|-------------|-----------|
| BMAD Version | **BMAD 6** (alpha & stable) |
| Project Types | BMM (BMAD Method), BMGD (BMAD Game Dev) |
| AI Tools | Claude Code, Anthropic API, Custom Endpoints |

> **Note**: BMad Board has only been tested on **BMAD 6** projects. Earlier versions of BMAD may not work. Both **alpha** (colon-separated commands) and **stable** (hyphen-separated commands) formats are supported.

## Download

[![Latest Release](https://img.shields.io/github/v/release/hacking-robot/bmad-board?label=Latest&color=E97451)](https://github.com/hacking-robot/bmad-board/releases/latest)

| Platform | Download |
|----------|----------|
| macOS | [![Download for macOS](https://img.shields.io/badge/Download-.dmg-E97451)](https://github.com/hacking-robot/bmad-board/releases/latest) |
| Windows | [![Download for Windows](https://img.shields.io/badge/Download-.exe-E97451)](https://github.com/hacking-robot/bmad-board/releases/latest) |
| Linux | [![Download for Linux](https://img.shields.io/badge/Download-.AppImage-E97451)](https://github.com/hacking-robot/bmad-board/releases/latest) |

## Build from Source

```bash
# Clone the repository
git clone https://github.com/yourusername/bmadboard.git
cd bmadboard

# Install dependencies
npm install

# Run in development mode
npm run electron:dev

# Build for production
npm run build
```

## Usage

1. Launch BMad Board
2. Select your BMAD or BMAD game project folder
3. View your stories organized by status
4. Click a story card to view full details
5. Use `Cmd+P` to open the command palette for quick actions

### Supported Project Structures

**BMM (BMAD Method)** projects:
```
your-project/
├── _bmad/                    # BMAD agent & workflow definitions
├── docs/
│   ├── planning-artifacts/
│   │   ├── epics.md          # Epic definitions
│   │   └── stories/
│   │       ├── story-1.md
│   │       └── story-2.md
│   └── implementation-artifacts/
│       └── sprint-status.yaml  # Story status tracking
```

**BMGD (BMAD Game Dev)** projects:
```
your-project/
├── _bmad/                    # BMAD agent & workflow definitions
├── epics.md                  # Epic definitions at root
└── docs/
    └── stories/
        ├── epic-1/
        │   ├── 1-1-story-slug.md
        │   └── 1-2-another-story.md
        └── epic-2/
            └── 2-1-story-name.md
```

### Story Status

Stories use frontmatter to define their status:

```yaml
---
status: ready-for-dev
---
```

Valid statuses: `backlog`, `ready-for-dev`, `in-progress`, `review`, `done`, `optional`

## Development

```bash
npm run dev              # Vite dev server only
npm run electron:dev     # Full Electron app in dev mode
npm run build            # Production build
npm run typecheck        # Type checking
```

## Tech Stack

- React 18 + TypeScript
- Electron 33
- MUI (Material UI) 6
- Zustand for state management
- Vite + electron-builder
- Emotion (CSS-in-JS)

## License

MIT
