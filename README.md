<div align="center">
  <img src="assets/banner.svg" alt="BMad Board" width="500">
  <p><strong>Visualize your sprint progress with a clean, intuitive interface</strong></p>

  ![License](https://img.shields.io/badge/license-MIT-blue) ![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey) ![Electron](https://img.shields.io/badge/electron-33-47848F)
</div>

---

<img src="assets/screenshot.png" alt="BMad Board Screenshot" width="100%">

## Features

- **Sprint Board**: Visualize stories across columns (Backlog, Ready for Dev, In Progress, Review, Done)
- **Epic Organization**: Stories grouped by epic with color-coded badges
- **Story Details**: View acceptance criteria, tasks, subtasks, and file changes
- **Search & Filter**: Find stories by text or filter by epic
- **Dark/Light Mode**: Toggle between themes
- **Auto-Refresh**: File watching detects changes to story files
- **Collapsible Columns**: Minimize columns to focus on active work
- **Command Palette**: Quick access to actions with keyboard shortcuts

## Compatibility

| Requirement | Supported |
|-------------|-----------|
| BMAD Version | **BMAD 6** |
| Project Types | BMAD, BMAD Game |

> **Note**: BMad Board has only be tested on **BMAD 6** projects. Earlier versions of BMAD may not work. Only **BMAD** and **BMAD Game** project types have been tested.

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

### Project Structure Requirements

Your BMAD project should have:

```
your-project/
├── docs/
│   ├── epics/
│   │   ├── epic-1.md
│   │   └── epic-2.md
│   └── stories/
│       ├── epic-1/
│       │   ├── 1-1-story-slug.md
│       │   └── 1-2-another-story.md
│       └── epic-2/
│           └── 2-1-story-name.md
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

## License

MIT
