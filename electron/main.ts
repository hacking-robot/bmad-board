import { app, BrowserWindow, ipcMain, dialog, Menu, screen, Notification } from 'electron'
import { join, dirname, basename, resolve } from 'path'
import { readFile, readdir, stat, writeFile, mkdir } from 'fs/promises'
import { existsSync, watch, FSWatcher } from 'fs'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import { spawn as spawnChild, spawnSync } from 'child_process'
import { agentManager } from './agentManager'
import { detectTool, detectAllTools, clearDetectionCache } from './cliToolManager'
import { getAugmentedEnv } from './envUtils'

// Set app name (shows in menu bar on macOS)
app.setName('BMad Board')

let mainWindow: BrowserWindow | null = null
let watchDebounceTimer: NodeJS.Timeout | null = null

// Settings file path in user data directory
const getSettingsPath = () => join(app.getPath('userData'), 'settings.json')

type ProjectType = 'bmm' | 'bmgd'

interface AgentHistoryEntry {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: 'running' | 'completed' | 'error' | 'interrupted'
  output: string[]
  startTime: number
  endTime?: number
  exitCode?: number
}

interface RecentProject {
  path: string
  projectType: ProjectType
  name: string
}

type AITool = 'claude-code' | 'cursor' | 'windsurf' | 'roo-code' | 'aider'
type ClaudeModel = 'sonnet' | 'opus' | 'haiku'

interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
  isMaximized?: boolean
}

// Human Review checklist types
interface HumanReviewChecklistItem {
  id: string
  label: string
  description?: string
}

interface StoryReviewState {
  storyId: string
  checkedItems: string[]
  lastUpdated: number
}

// Status change tracking types
type StoryStatus = 'backlog' | 'ready-for-dev' | 'in-progress' | 'review' | 'human-review' | 'done' | 'optional'
type StatusChangeSource = 'user' | 'external'

interface StatusChangeEntry {
  id: string
  storyId: string
  storyTitle: string
  oldStatus: StoryStatus
  newStatus: StoryStatus
  timestamp: number
  source: StatusChangeSource
}

type BmadVersion = 'stable' | 'alpha'

interface AppSettings {
  themeMode: 'light' | 'dark'
  aiTool: AITool
  claudeModel: ClaudeModel
  projectPath: string | null
  projectType: ProjectType | null
  bmadVersion: BmadVersion | null
  selectedEpicId: number | null
  collapsedColumnsByEpic: Record<string, string[]>
  agentHistory?: AgentHistoryEntry[]
  recentProjects: RecentProject[]
  windowBounds?: WindowBounds
  storyOrder: Record<string, Record<string, string[]>> // { [epicId]: { [status]: [storyIds...] } }
  // Git settings
  baseBranch: 'main' | 'master' | 'develop'
  allowDirectEpicMerge: boolean // Allow merging epic branches to base without PR
  bmadInGitignore: boolean // When true, bmad folders are gitignored so branch restrictions are relaxed
  bmadInGitignoreUserSet: boolean // When true, user has manually set bmadInGitignore (don't auto-detect)
  enableEpicBranches: boolean // When true, show epic branch features
  disableGitBranching: boolean // When true, bypass all branch restrictions and hide branch UI
  fullCycleReviewCount: number // 0-5, how many code review rounds in full cycle
  // Human Review feature
  enableHumanReviewColumn: boolean
  humanReviewChecklist: HumanReviewChecklistItem[]
  humanReviewStates: Record<string, StoryReviewState>
  humanReviewStories: string[] // story IDs in human-review (app-level override)
  // Chat settings
  maxThreadMessages: number
  // Status history
  statusHistoryByStory: Record<string, StatusChangeEntry[]>
  globalStatusHistory: StatusChangeEntry[]
  lastViewedStatusHistoryAt: number
}

const defaultSettings: AppSettings = {
  themeMode: 'light',
  aiTool: 'claude-code',
  claudeModel: 'opus',
  projectPath: null,
  projectType: null,
  bmadVersion: null,
  selectedEpicId: null,
  collapsedColumnsByEpic: {},
  agentHistory: [],
  recentProjects: [],
  storyOrder: {},
  // Git defaults
  baseBranch: 'main',
  allowDirectEpicMerge: false,
  bmadInGitignore: false,
  bmadInGitignoreUserSet: false,
  enableEpicBranches: false,
  disableGitBranching: true,
  fullCycleReviewCount: 1,
  // Human Review defaults
  enableHumanReviewColumn: false,
  humanReviewChecklist: [
    { id: 'approved', label: 'Approved', description: 'Story implementation has been reviewed and approved' }
  ],
  humanReviewStates: {},
  humanReviewStories: [],
  // Chat defaults
  maxThreadMessages: 100,
  // Status history defaults
  statusHistoryByStory: {},
  globalStatusHistory: [],
  lastViewedStatusHistoryAt: 0
}

async function loadSettings(): Promise<AppSettings> {
  const settingsPath = getSettingsPath()
  try {
    if (existsSync(settingsPath)) {
      const content = await readFile(settingsPath, 'utf-8')
      if (content.trim()) {
        const parsed = JSON.parse(content)
        return { ...defaultSettings, ...parsed }
      }
    }
  } catch (error) {
    console.error('Failed to load settings:', error)
    // If settings are corrupted, delete the file and return defaults
    try {
      if (existsSync(settingsPath)) {
        const { unlink } = await import('fs/promises')
        await unlink(settingsPath)
        console.log('Deleted corrupted settings file')
      }
    } catch {
      // Ignore deletion errors
    }
  }
  return defaultSettings
}

async function saveSettings(settings: Partial<AppSettings>): Promise<boolean> {
  try {
    const settingsPath = getSettingsPath()
    const dir = app.getPath('userData')

    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    // Load existing settings and merge
    const existing = await loadSettings()
    const merged = { ...existing, ...settings }

    await writeFile(settingsPath, JSON.stringify(merged, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save settings:', error)
    return false
  }
}

// Minimum window dimensions for usability
const MIN_WINDOW_WIDTH = 800
const MIN_WINDOW_HEIGHT = 600
const DEFAULT_WINDOW_WIDTH = 1400
const DEFAULT_WINDOW_HEIGHT = 900

// Validate and sanitize window bounds
function getValidWindowBounds(savedBounds?: WindowBounds): { x?: number; y?: number; width: number; height: number } {
  const displays = screen.getAllDisplays()

  // Default bounds (centered on primary display)
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize
  const defaultBounds = {
    width: Math.min(DEFAULT_WINDOW_WIDTH, screenWidth),
    height: Math.min(DEFAULT_WINDOW_HEIGHT, screenHeight)
  }

  if (!savedBounds) {
    return defaultBounds
  }

  // Validate dimensions - ensure minimum size
  let width = savedBounds.width
  let height = savedBounds.height

  if (width < MIN_WINDOW_WIDTH || height < MIN_WINDOW_HEIGHT) {
    console.log('Window too small, resetting to defaults')
    return defaultBounds
  }

  // Check if window is visible on any display
  const windowRect = {
    x: savedBounds.x,
    y: savedBounds.y,
    width: width,
    height: height
  }

  // Window is considered visible if at least 100x100 pixels are on screen
  const minVisibleArea = 100
  let isVisible = false

  for (const display of displays) {
    const { x: displayX, y: displayY, width: displayWidth, height: displayHeight } = display.bounds

    // Calculate overlap
    const overlapX = Math.max(0, Math.min(windowRect.x + windowRect.width, displayX + displayWidth) - Math.max(windowRect.x, displayX))
    const overlapY = Math.max(0, Math.min(windowRect.y + windowRect.height, displayY + displayHeight) - Math.max(windowRect.y, displayY))

    if (overlapX >= minVisibleArea && overlapY >= minVisibleArea) {
      isVisible = true
      break
    }
  }

  if (!isVisible) {
    console.log('Window off-screen, resetting position')
    return defaultBounds
  }

  return {
    x: savedBounds.x,
    y: savedBounds.y,
    width: width,
    height: height
  }
}

// Debounce timer for saving window bounds
let windowBoundsTimer: NodeJS.Timeout | null = null

// Save window bounds with debounce
function saveWindowBounds() {
  if (!mainWindow) return

  if (windowBoundsTimer) {
    clearTimeout(windowBoundsTimer)
  }

  windowBoundsTimer = setTimeout(async () => {
    if (!mainWindow) return

    const isMaximized = mainWindow.isMaximized()
    const bounds = mainWindow.getBounds()

    // Only save non-maximized bounds (so we restore to the right size when un-maximizing)
    if (!isMaximized) {
      await saveSettings({
        windowBounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
          isMaximized: false
        }
      })
    } else {
      // Just update the maximized flag, keep the previous bounds
      const settings = await loadSettings()
      if (settings.windowBounds) {
        await saveSettings({
          windowBounds: {
            ...settings.windowBounds,
            isMaximized: true
          }
        })
      }
    }
  }, 500) // Debounce 500ms
}

async function createWindow() {
  // Load saved window bounds
  const settings = await loadSettings()
  const validBounds = getValidWindowBounds(settings.windowBounds)

  mainWindow = new BrowserWindow({
    ...validBounds,
    minWidth: MIN_WINDOW_WIDTH,
    minHeight: MIN_WINDOW_HEIGHT,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 }
  })

  // Restore maximized state if it was saved
  if (settings.windowBounds?.isMaximized) {
    mainWindow.maximize()
  }

  // Listen for window bounds changes
  mainWindow.on('resize', saveWindowBounds)
  mainWindow.on('move', saveWindowBounds)
  mainWindow.on('maximize', saveWindowBounds)
  mainWindow.on('unmaximize', saveWindowBounds)

  // Set main window for agent manager
  agentManager.setMainWindow(mainWindow)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    agentManager.setMainWindow(null)
    mainWindow = null
  })
}

function createMenu() {
  const isMac = process.platform === 'darwin'

  const template: Electron.MenuItemConstructorOptions[] = [
    // App menu (macOS only)
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac
          ? [
              { type: 'separator' as const },
              { role: 'front' as const },
              { type: 'separator' as const },
              { role: 'window' as const }
            ]
          : [{ role: 'close' as const }])
      ]
    },
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Keyboard Shortcuts',
          accelerator: isMac ? 'Cmd+/' : 'Ctrl+/',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('show-keyboard-shortcuts')
            }
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createWindow()
  createMenu()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// IPC Handlers for file operations

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select BMAD Project Folder'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  const projectPath = result.filePaths[0]
  const bmadOutputPath = join(projectPath, '_bmad-output')

  // Check if _bmad-output directory exists - if not, it's a new project for the wizard
  if (!existsSync(bmadOutputPath)) {
    return { path: projectPath, projectType: 'bmm' as ProjectType, isNewProject: true }
  }

  // Check for required files
  const sprintStatusPath = join(bmadOutputPath, 'implementation-artifacts', 'sprint-status.yaml')
  const bmgdEpicsPath = join(bmadOutputPath, 'epics.md')
  const bmmEpicsPath = join(bmadOutputPath, 'planning-artifacts', 'epics.md')

  const hasSprintStatus = existsSync(sprintStatusPath)
  const hasBmgdEpics = existsSync(bmgdEpicsPath)
  const hasBmmEpics = existsSync(bmmEpicsPath)

  // Detect project type: BMGD if epics.md at root, otherwise BMM (default)
  let projectType: ProjectType = hasBmgdEpics ? 'bmgd' : 'bmm'

  // Check if this is a new/empty project
  const isNewProject = !hasSprintStatus || (!hasBmgdEpics && !hasBmmEpics)

  return { path: projectPath, projectType, isNewProject }
})

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = await readFile(filePath, 'utf-8')
    return { content }
  } catch (error) {
    return { error: `Failed to read file: ${filePath}` }
  }
})

ipcMain.handle('list-directory', async (_, dirPath: string) => {
  try {
    const entries = await readdir(dirPath)
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(dirPath, entry)
      const stats = await stat(fullPath)
      if (stats.isFile()) {
        files.push(entry)
      }
    }

    return { files }
  } catch (error) {
    return { error: `Failed to list directory: ${dirPath}` }
  }
})

// Settings IPC handlers
ipcMain.handle('get-settings', async () => {
  return await loadSettings()
})

ipcMain.handle('save-settings', async (_, settings: Partial<AppSettings>) => {
  return await saveSettings(settings)
})

// File watching for auto-refresh
let fileWatchers: FSWatcher[] = []

function startWatching(projectPath: string, projectType: ProjectType) {
  // Stop any existing watchers
  stopWatching()

  const watchPaths: string[] = [
    join(projectPath, '_bmad-output', 'implementation-artifacts')
  ]

  // For BMM projects, also watch planning-artifacts (where epics.md lives)
  if (projectType === 'bmm') {
    watchPaths.push(join(projectPath, '_bmad-output', 'planning-artifacts'))
  }

  for (const watchPath of watchPaths) {
    if (!existsSync(watchPath)) {
      console.log('Watch path does not exist:', watchPath)
      continue
    }

    try {
      const watcher = watch(watchPath, { recursive: true }, (_eventType, filename) => {
        // Only care about .yaml and .md files
        if (!filename || (!filename.endsWith('.yaml') && !filename.endsWith('.md'))) {
          return
        }

        // Debounce to avoid multiple rapid refreshes
        if (watchDebounceTimer) {
          clearTimeout(watchDebounceTimer)
        }

        watchDebounceTimer = setTimeout(() => {
          console.log('File changed:', filename)
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('files-changed')
          }
        }, 500)
      })

      fileWatchers.push(watcher)
      console.log('Started watching:', watchPath)
    } catch (error) {
      console.error('Failed to start file watcher:', error)
    }
  }
}

function stopWatching() {
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer)
    watchDebounceTimer = null
  }

  for (const watcher of fileWatchers) {
    watcher.close()
  }
  if (fileWatchers.length > 0) {
    console.log('Stopped file watchers')
  }
  fileWatchers = []
}

ipcMain.handle('start-watching', async (_, projectPath: string, projectType: ProjectType) => {
  startWatching(projectPath, projectType)
  return true
})

ipcMain.handle('stop-watching', async () => {
  stopWatching()
  return true
})

// Clean up watcher and agents when app closes
app.on('before-quit', () => {
  stopWatching()
  agentManager.killAll()
})

// Agent IPC handlers
ipcMain.handle('spawn-agent', async (_, options: {
  storyId: string
  storyTitle: string
  projectPath: string
  initialPrompt: string
}) => {
  console.log('spawn-agent IPC called:', options)
  try {
    const agentId = agentManager.spawn(options)
    console.log('Agent spawned successfully:', agentId)
    return { success: true, agentId }
  } catch (error) {
    console.error('Agent spawn failed:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Failed to spawn agent' }
  }
})

ipcMain.handle('send-agent-input', async (_, agentId: string, input: string) => {
  return agentManager.sendInput(agentId, input)
})

ipcMain.handle('kill-agent', async (_, agentId: string) => {
  return agentManager.kill(agentId)
})

ipcMain.handle('get-agents', async () => {
  return agentManager.getAgents()
})

ipcMain.handle('get-agent', async (_, agentId: string) => {
  return agentManager.getAgent(agentId)
})

ipcMain.handle('get-agent-for-story', async (_, storyId: string) => {
  return agentManager.hasAgentForStory(storyId)
})

// Detect BMAD version (stable vs alpha) based on command file structure
ipcMain.handle('detect-bmad-version', async (_, projectPath: string) => {
  // Alpha uses nested: .claude/commands/bmad/bmm/ or .claude/commands/bmad/bmgd/
  const nestedPath = join(projectPath, '.claude', 'commands', 'bmad')
  if (existsSync(nestedPath)) {
    return 'alpha'
  }
  // Stable uses flat: .claude/commands/bmad-agent-bmm-*.md
  const flatPath = join(projectPath, '.claude', 'commands')
  if (existsSync(flatPath)) {
    try {
      const files = await readdir(flatPath)
      if (files.some(f => f.startsWith('bmad-'))) {
        return 'stable'
      }
    } catch {
      // Directory might not be readable
    }
  }
  return null // No bmad detected
})

// Detect project type (bmm vs bmgd structure)
ipcMain.handle('detect-project-type', async (_, projectPath: string) => {
  // Check for BMGD structure (epics.md at root of _bmad-output)
  const bmgdEpicsPath = join(projectPath, '_bmad-output', 'epics.md')

  if (existsSync(bmgdEpicsPath)) {
    return 'bmgd'
  }

  // Default to BMM (standard BMAD Method)
  return 'bmm'
})

// Check if bmad folders are in .gitignore
// When bmad is gitignored, the data persists across branch switches since it's not tracked
ipcMain.handle('check-bmad-in-gitignore', async (_, projectPath: string) => {
  try {
    const gitignorePath = join(projectPath, '.gitignore')
    if (!existsSync(gitignorePath)) {
      return { inGitignore: false }
    }

    const content = await readFile(gitignorePath, 'utf-8')
    const lines = content.split('\n').map(line => line.trim())

    // Check for patterns that would ignore bmad folders
    // Common patterns: bmad, _bmad-output, _bmad-output/, docs/planning-artifacts, etc.
    const bmadPatterns = [
      'bmad',
      '_bmad-output',
      '_bmad-output/',
      '_bmad-output/*',
      'docs/planning-artifacts',
      'docs/implementation-artifacts'
    ]

    const inGitignore = lines.some(line => {
      // Skip comments and empty lines
      if (!line || line.startsWith('#')) return false
      // Check if any bmad pattern matches
      return bmadPatterns.some(pattern => line === pattern || line.startsWith(pattern))
    })

    return { inGitignore }
  } catch (error) {
    console.error('Failed to check .gitignore:', error)
    return { inGitignore: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
})

// Agent output file management
const getAgentOutputDir = () => join(app.getPath('userData'), 'agent-outputs')
const getAgentOutputPath = (agentId: string) => join(getAgentOutputDir(), `${agentId}.jsonl`)

// Ensure agent output directory exists
async function ensureAgentOutputDir() {
  const dir = getAgentOutputDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

// Append output lines to agent's file (JSON Lines format)
ipcMain.handle('append-agent-output', async (_, agentId: string, lines: string[]) => {
  try {
    await ensureAgentOutputDir()
    const filePath = getAgentOutputPath(agentId)
    // Each line is a JSON string, write one per line
    const content = lines.map(line => JSON.stringify(line)).join('\n') + '\n'
    await writeFile(filePath, content, { flag: 'a' }) // Append mode
    return true
  } catch (error) {
    console.error('Failed to append agent output:', error)
    return false
  }
})

// Load all output for an agent
ipcMain.handle('load-agent-output', async (_, agentId: string) => {
  try {
    const filePath = getAgentOutputPath(agentId)
    if (!existsSync(filePath)) {
      return []
    }
    const content = await readFile(filePath, 'utf-8')
    // Parse JSON Lines format
    const lines = content.trim().split('\n').filter(Boolean)
    return lines.map(line => {
      try {
        return JSON.parse(line)
      } catch {
        return line // Return as-is if not valid JSON
      }
    })
  } catch (error) {
    console.error('Failed to load agent output:', error)
    return []
  }
})

// Delete output file for an agent
ipcMain.handle('delete-agent-output', async (_, agentId: string) => {
  try {
    const filePath = getAgentOutputPath(agentId)
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises')
      await unlink(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to delete agent output:', error)
    return false
  }
})

// List all agent output files (for cleanup)
ipcMain.handle('list-agent-outputs', async () => {
  try {
    const dir = getAgentOutputDir()
    if (!existsSync(dir)) {
      return []
    }
    const files = await readdir(dir)
    return files
      .filter(f => f.endsWith('.jsonl'))
      .map(f => f.replace('.jsonl', ''))
  } catch (error) {
    console.error('Failed to list agent outputs:', error)
    return []
  }
})

// Git IPC handlers

// Security: Validate git ref names (branch names, commit hashes, tags)
// Only allows alphanumeric, dash, underscore, slash, dot, and caret (for parent refs like HEAD^)
function isValidGitRef(ref: string): boolean {
  if (!ref || ref.length > 256) return false
  // Disallow shell metacharacters and dangerous patterns
  if (/[;&|`$(){}[\]<>!\\'"*?\n\r]/.test(ref)) return false
  // Disallow .. (parent directory traversal in paths, also dangerous in git refs)
  if (ref.includes('..') && !ref.match(/^[a-f0-9]+\.\.[a-f0-9]+$/)) return false
  // Must match safe git ref pattern
  return /^[\w\-./^~@]+$/.test(ref)
}

// Security: Validate file paths and prevent directory traversal
function isValidFilePath(filePath: string): boolean {
  if (!filePath || filePath.length > 1024) return false
  // Disallow shell metacharacters
  if (/[;&|`$(){}[\]<>!\\'"*?\n\r]/.test(filePath)) return false
  // Disallow null bytes
  if (filePath.includes('\0')) return false
  return true
}

// Security: Ensure resolved path stays within project directory
function isPathWithinProject(projectPath: string, filePath: string): boolean {
  const resolvedProject = resolve(projectPath)
  const resolvedFile = resolve(projectPath, filePath)
  return resolvedFile.startsWith(resolvedProject + '/')
}

// Helper to run git commands safely using spawnSync with array arguments
function runGitCommand(args: string[], cwd: string, maxBuffer?: number): { stdout: string; error?: string } {
  // Remove GPG_TTY from environment so gpg-agent uses GUI pinentry instead of terminal
  // This prevents blocking when running from Electron (no TTY available)
  const env = { ...process.env }
  delete env.GPG_TTY
  
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf-8',
    maxBuffer: maxBuffer || 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
    env
  })

  if (result.error) {
    return { stdout: '', error: result.error.message }
  }
  if (result.status !== 0) {
    return { stdout: result.stdout, error: result.stderr || result.stdout?.trim() || 'Git command failed' }
  }
  return { stdout: result.stdout }
}

// Get current git branch name
ipcMain.handle('git-current-branch', async (_, projectPath: string) => {
  const result = runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
  if (result.error) {
    return { error: 'Failed to get current branch' }
  }
  return { branch: result.stdout.trim() }
})

// List all local branches
ipcMain.handle('git-list-branches', async (_, projectPath: string) => {
  const result = runGitCommand(['branch', '--format=%(refname:short)'], projectPath)
  if (result.error) {
    return { branches: [], error: 'Failed to list branches' }
  }
  const branches = result.stdout.trim().split('\n').filter(Boolean)
  return { branches }
})

// Checkout a branch
ipcMain.handle('git-checkout-branch', async (_, projectPath: string, branchName: string) => {
  // Security: Validate branch name
  if (!isValidGitRef(branchName)) {
    return { success: false, error: 'Invalid branch name' }
  }

  const result = runGitCommand(['checkout', branchName], projectPath)
  if (result.error) {
    // Parse common git checkout errors for better messages
    if (result.error.includes('Your local changes')) {
      return { success: false, error: 'You have uncommitted changes. Commit or stash them before switching branches.' }
    }
    if (result.error.includes('did not match any')) {
      return { success: false, error: `Branch '${branchName}' does not exist.` }
    }
    return { success: false, error: result.error }
  }
  return { success: true }
})

// Create and switch to a new branch
ipcMain.handle('git-create-branch', async (_, projectPath: string, branchName: string, fromBranch?: string) => {
  // Security: Validate branch name
  if (!isValidGitRef(branchName)) {
    return { success: false, error: 'Invalid branch name' }
  }
  // Security: Validate fromBranch if provided
  if (fromBranch && !isValidGitRef(fromBranch)) {
    return { success: false, error: 'Invalid source branch name' }
  }

  // If fromBranch is specified, create from that branch; otherwise create from current branch
  const args = fromBranch ? ['checkout', '-b', branchName, fromBranch] : ['checkout', '-b', branchName]
  const result = runGitCommand(args, projectPath)
  if (result.error) {
    // Parse common git checkout -b errors for better messages
    if (result.error.includes('already exists')) {
      return { success: false, error: `Branch '${branchName}' already exists.`, alreadyExists: true }
    }
    if (result.error.includes('Your local changes')) {
      return { success: false, error: 'You have uncommitted changes. Commit or stash them before creating a new branch.' }
    }
    return { success: false, error: result.error }
  }
  return { success: true }
})

// Check if a branch exists
ipcMain.handle('git-branch-exists', async (_, projectPath: string, branchName: string) => {
  // Security: Validate branch name
  if (!isValidGitRef(branchName)) {
    return { exists: false }
  }
  const result = runGitCommand(['rev-parse', '--verify', branchName], projectPath)
  return { exists: !result.error }
})

// Check if there are uncommitted changes
ipcMain.handle('git-has-changes', async (_, projectPath: string) => {
  const result = runGitCommand(['status', '--porcelain'], projectPath)
  if (result.error) {
    return { hasChanges: false, error: result.error }
  }
  const hasChanges = result.stdout.trim().length > 0
  return { hasChanges }
})

// Stage all changes and commit with a message
ipcMain.handle('git-commit', async (_, projectPath: string, message: string, noVerify?: boolean) => {
  // Security: Basic validation of commit message
  if (!message || message.length > 1000) {
    return { success: false, error: 'Invalid commit message' }
  }

  // First, stage all changes
  const addResult = runGitCommand(['add', '.'], projectPath)
  if (addResult.error) {
    return { success: false, error: `Failed to stage changes: ${addResult.error}` }
  }

  // Then commit (optionally bypassing hooks for automated workflows)
  const commitArgs = ['commit', '-m', message]
  if (noVerify) {
    commitArgs.push('--no-verify')
  }
  const commitResult = runGitCommand(commitArgs, projectPath)

  if (commitResult.error) {
    // Check for common errors
    if (commitResult.error.includes('nothing to commit')) {
      return { success: false, error: 'Nothing to commit' }
    }
    return { success: false, error: commitResult.error }
  }

  return { success: true }
})

// Check if a branch has recent activity (recently modified files or recent commits)
ipcMain.handle('git-branch-activity', async (_, projectPath: string, branchName: string) => {
  // Security: Validate branch name
  if (!isValidGitRef(branchName)) {
    return {
      isOnBranch: false,
      hasRecentFileChanges: false,
      lastCommitTime: null,
      hasRecentCommit: false,
      isActive: false
    }
  }

  // Get current branch
  const currentBranchResult = runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
  if (currentBranchResult.error) {
    return {
      isOnBranch: false,
      hasRecentFileChanges: false,
      lastCommitTime: null,
      hasRecentCommit: false,
      isActive: false
    }
  }

  const currentBranch = currentBranchResult.stdout.trim()
  const isOnBranch = currentBranch === branchName
  const oneMinuteAgo = Date.now() - (1 * 60 * 1000)

  // Check for recently modified files (only if we're on the branch)
  let hasRecentFileChanges = false
  if (isOnBranch) {
    // Get list of modified/new files from git status
    const statusResult = runGitCommand(['status', '--porcelain'], projectPath)
    const status = statusResult.stdout.trim()

    if (status.length > 0) {
      // Check modification time of changed files
      const changedFiles = status.split('\n').map(line => line.substring(3).trim())
      for (const file of changedFiles) {
        // Security: Validate file path stays within project
        if (!isValidFilePath(file) || !isPathWithinProject(projectPath, file)) {
          continue
        }
        try {
          const filePath = join(projectPath, file)
          if (existsSync(filePath)) {
            const stats = await stat(filePath)
            if (stats.mtimeMs > oneMinuteAgo) {
              hasRecentFileChanges = true
              break
            }
          }
        } catch {
          // File might not exist (deleted)
        }
      }
    }
  }

  // Get the last commit timestamp on the branch
  let lastCommitTime: number | null = null
  const logResult = runGitCommand(['log', '-1', '--format=%ct', branchName], projectPath)
  if (!logResult.error && logResult.stdout.trim()) {
    lastCommitTime = parseInt(logResult.stdout.trim(), 10) * 1000 // Convert to milliseconds
  }

  const hasRecentCommit = lastCommitTime !== null && lastCommitTime > oneMinuteAgo

  return {
    isOnBranch,
    hasRecentFileChanges,
    lastCommitTime,
    hasRecentCommit,
    isActive: hasRecentFileChanges || hasRecentCommit
  }
})

// Get the default branch (main or master)
ipcMain.handle('git-default-branch', async (_, projectPath: string) => {
  // Try to get the default branch from remote
  const remoteResult = runGitCommand(['remote', 'show', 'origin'], projectPath)
  if (!remoteResult.error) {
    const match = remoteResult.stdout.match(/HEAD branch: (.+)/)
    if (match) {
      return { branch: match[1].trim() }
    }
  }

  // Fallback: check if main or master exists
  const mainResult = runGitCommand(['rev-parse', '--verify', 'main'], projectPath)
  if (!mainResult.error) {
    return { branch: 'main' }
  }

  const masterResult = runGitCommand(['rev-parse', '--verify', 'master'], projectPath)
  if (!masterResult.error) {
    return { branch: 'master' }
  }

  return { error: 'Could not determine default branch' }
})

// Get list of changed files between a feature branch and default branch
ipcMain.handle('git-changed-files', async (_, projectPath: string, baseBranch: string, featureBranch?: string) => {
  // Security: Validate branch names
  if (!isValidGitRef(baseBranch)) {
    return { error: 'Invalid base branch name' }
  }
  const targetBranch = featureBranch || 'HEAD'
  if (featureBranch && !isValidGitRef(featureBranch)) {
    return { error: 'Invalid feature branch name' }
  }

  // Get the merge base to find where branches diverged
  const mergeBaseResult = runGitCommand(['merge-base', baseBranch, targetBranch], projectPath)
  if (mergeBaseResult.error) {
    return { error: 'Failed to get merge base' }
  }
  const mergeBase = mergeBaseResult.stdout.trim()

  // Get the current branch to check if we should include uncommitted changes
  const currentBranchResult = runGitCommand(['rev-parse', '--abbrev-ref', 'HEAD'], projectPath)
  const currentBranch = currentBranchResult.stdout.trim()
  const isOnBranch = currentBranch === featureBranch

  // When on the target branch, compare merge-base to working directory to include uncommitted changes
  // Otherwise compare merge-base to the branch's committed state
  const diffTarget = isOnBranch ? '' : targetBranch
  const diffArgs = diffTarget
    ? ['diff', '--name-status', mergeBase, diffTarget]
    : ['diff', '--name-status', mergeBase]

  const diffResult = runGitCommand(diffArgs, projectPath)
  if (diffResult.error) {
    return { error: 'Failed to get changed files' }
  }

  // Build a map of files from committed diff
  const fileMap = new Map<string, { status: string; mtime: number | null; lastCommitTime: number | null }>()

  // Parse the diff output
  const diffLines = diffResult.stdout.trim().split('\n').filter(Boolean)
  for (const line of diffLines) {
    const [status, ...pathParts] = line.split('\t')
    const filePath = pathParts.join('\t')
    if (filePath) {
      fileMap.set(filePath, { status, mtime: null, lastCommitTime: null })
    }
  }

  // Process all files and get their metadata
  const files = await Promise.all(
    Array.from(fileMap.entries()).map(async ([filePath, data]) => {
      // Security: Validate file path
      if (!isValidFilePath(filePath) || !isPathWithinProject(projectPath, filePath)) {
        return {
          status: data.status as 'A' | 'M' | 'D' | 'R' | 'C',
          path: filePath,
          mtime: null,
          lastCommitTime: null
        }
      }

      // Get file modification time if we're on the branch and file exists
      let mtime: number | null = null
      if (isOnBranch && data.status !== 'D') {
        try {
          const fullPath = join(projectPath, filePath)
          if (existsSync(fullPath)) {
            const stats = await stat(fullPath)
            mtime = stats.mtimeMs
          }
        } catch {
          // File might not exist
        }
      }

      // For commits, get the last commit time for this file on the branch
      let lastCommitTime: number | null = null
      const commitTimeResult = runGitCommand(['log', '-1', '--format=%ct', targetBranch, '--', filePath], projectPath)
      if (!commitTimeResult.error && commitTimeResult.stdout.trim()) {
        lastCommitTime = parseInt(commitTimeResult.stdout.trim(), 10) * 1000
      }

      return {
        status: data.status as 'A' | 'M' | 'D' | 'R' | 'C',
        path: filePath,
        mtime,
        lastCommitTime
      }
    })
  )

  return { files, mergeBase }
})

// Get file content at a specific commit
ipcMain.handle('git-file-content', async (_, projectPath: string, filePath: string, commit: string) => {
  // Security: Validate inputs
  if (!isValidFilePath(filePath)) {
    return { content: '' }
  }
  if (!isValidGitRef(commit)) {
    return { content: '' }
  }

  const result = runGitCommand(['show', `${commit}:${filePath}`], projectPath)
  return { content: result.stdout || '' }
})

// Get current file content from working directory
ipcMain.handle('git-working-file-content', async (_, projectPath: string, filePath: string) => {
  // Security: Validate file path and prevent directory traversal
  if (!isValidFilePath(filePath) || !isPathWithinProject(projectPath, filePath)) {
    return { content: '' }
  }

  try {
    const fullPath = join(projectPath, filePath)
    const content = await readFile(fullPath, 'utf-8')
    return { content }
  } catch {
    return { content: '' }
  }
})

// Get commit history for a branch (since it diverged from base)
ipcMain.handle('git-commit-history', async (_, projectPath: string, baseBranch: string, featureBranch: string) => {
  // Security: Validate branch names
  if (!isValidGitRef(baseBranch) || !isValidGitRef(featureBranch)) {
    return { commits: [], error: 'Invalid branch name' }
  }

  // Get merge base
  const mergeBaseResult = runGitCommand(['merge-base', baseBranch, featureBranch], projectPath)
  if (mergeBaseResult.error) {
    return { commits: [], error: 'Failed to get merge base' }
  }
  const mergeBase = mergeBaseResult.stdout.trim()

  // Get commits from merge-base to feature branch
  // Format: hash|author|timestamp|subject
  const logResult = runGitCommand(['log', '--format=%H|%an|%at|%s', `${mergeBase}..${featureBranch}`], projectPath)
  if (logResult.error) {
    return { commits: [], error: 'Failed to get commit history' }
  }

  const logOutput = logResult.stdout.trim()
  if (!logOutput) {
    return { commits: [] }
  }

  const commits = logOutput.split('\n').map(line => {
    const [hash, author, timestamp, subject] = line.split('|')
    return {
      hash,
      author,
      timestamp: parseInt(timestamp, 10) * 1000,
      subject
    }
  })

  return { commits }
})

// Get diff for a specific commit
ipcMain.handle('git-commit-diff', async (_, projectPath: string, commitHash: string) => {
  // Security: Validate commit hash
  if (!isValidGitRef(commitHash)) {
    return { files: [], error: 'Invalid commit hash' }
  }

  // Get files changed in this commit with status
  const diffResult = runGitCommand(['diff-tree', '--no-commit-id', '--name-status', '-r', commitHash], projectPath)
  if (diffResult.error) {
    return { files: [], error: 'Failed to get commit diff' }
  }

  const diffOutput = diffResult.stdout.trim()
  if (!diffOutput) {
    return { files: [] }
  }

  const files = diffOutput.split('\n').map(line => {
    const [status, ...pathParts] = line.split('\t')
    return {
      status: status as 'A' | 'M' | 'D' | 'R' | 'C',
      path: pathParts.join('\t')
    }
  })

  return { files }
})

// Get file content at a specific commit's parent (for diff comparison)
ipcMain.handle('git-file-at-parent', async (_, projectPath: string, filePath: string, commitHash: string) => {
  // Security: Validate inputs
  if (!isValidFilePath(filePath) || !isValidGitRef(commitHash)) {
    return { content: '' }
  }

  const result = runGitCommand(['show', `${commitHash}^:${filePath}`], projectPath)
  return { content: result.stdout || '' }
})

// Get file content at a specific commit
ipcMain.handle('git-file-at-commit', async (_, projectPath: string, filePath: string, commitHash: string) => {
  // Security: Validate inputs
  if (!isValidFilePath(filePath) || !isValidGitRef(commitHash)) {
    return { content: '' }
  }

  const result = runGitCommand(['show', `${commitHash}:${filePath}`], projectPath)
  return { content: result.stdout || '' }
})

// Check if a branch is merged into another branch
ipcMain.handle('git-is-merged', async (_, projectPath: string, branchToCheck: string, targetBranch: string) => {
  // Security: Validate branch names
  if (!isValidGitRef(branchToCheck) || !isValidGitRef(targetBranch)) {
    return { merged: false, error: 'Invalid branch name' }
  }

  // Use merge-base --is-ancestor to check if branchToCheck is merged into targetBranch
  // Exit code 0 = merged (is ancestor), 1 = not merged
  const result = spawnSync('git', ['merge-base', '--is-ancestor', branchToCheck, targetBranch], {
    cwd: projectPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (result.error) {
    return { merged: false, error: result.error.message }
  }

  // Exit code 0 means branchToCheck is an ancestor of targetBranch (i.e., merged)
  return { merged: result.status === 0 }
})

// Merge a branch into the current branch
ipcMain.handle('git-merge-branch', async (_, projectPath: string, branchToMerge: string) => {
  // Security: Validate branch name
  if (!isValidGitRef(branchToMerge)) {
    return { success: false, error: 'Invalid branch name' }
  }

  // Check for uncommitted changes first
  const changesResult = runGitCommand(['status', '--porcelain'], projectPath)
  if (changesResult.error) {
    return { success: false, error: 'Failed to check for changes' }
  }
  if (changesResult.stdout.trim().length > 0) {
    return { success: false, error: 'You have uncommitted changes. Commit or stash them before merging.' }
  }

  // Perform the merge with --no-edit (use default merge message) and --no-ff (always create merge commit)
  const mergeResult = spawnSync('git', ['merge', branchToMerge, '--no-edit', '--no-ff'], {
    cwd: projectPath,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })

  if (mergeResult.error) {
    return { success: false, error: mergeResult.error.message }
  }

  // Check for merge conflicts (exit code 1 with conflict markers)
  if (mergeResult.status !== 0) {
    // Check if it's a conflict
    const statusAfter = runGitCommand(['status', '--porcelain'], projectPath)
    const hasConflicts = statusAfter.stdout.includes('UU') || statusAfter.stdout.includes('AA') || statusAfter.stdout.includes('DD')

    if (hasConflicts) {
      // Abort the merge
      runGitCommand(['merge', '--abort'], projectPath)
      return { success: false, error: 'Merge has conflicts - resolve in terminal', hasConflicts: true }
    }

    // Some other error
    return { success: false, error: mergeResult.stderr || 'Merge failed' }
  }

  return { success: true }
})

// Update story status in sprint-status.yaml
ipcMain.handle('update-story-status', async (_, filePath: string, newStatus: string) => {
  try {
    // Extract story key from file path (filename without .md)
    // Story path: {projectPath}/_bmad-output/implementation-artifacts/{story-key}.md
    const storyKey = basename(filePath, '.md')

    // Derive sprint-status.yaml path from story file path
    // Sprint-status.yaml is in the same directory as story files (implementation-artifacts/)
    const implementationDir = dirname(filePath)
    const sprintStatusPath = join(implementationDir, 'sprint-status.yaml')

    if (!existsSync(sprintStatusPath)) {
      return { success: false, error: 'sprint-status.yaml not found' }
    }

    // Read and parse sprint-status.yaml
    const content = await readFile(sprintStatusPath, 'utf-8')
    const sprintStatus = parseYaml(content)

    // Update the story status in development_status section
    if (!sprintStatus.development_status) {
      sprintStatus.development_status = {}
    }
    sprintStatus.development_status[storyKey] = newStatus

    // Write the file back with proper YAML formatting
    const updatedContent = stringifyYaml(sprintStatus, {
      lineWidth: 0, // Don't wrap lines
      nullStr: '' // Use empty string for null values
    })
    await writeFile(sprintStatusPath, updatedContent, 'utf-8')

    return { success: true }
  } catch (error) {
    console.error('Failed to update story status:', error)
    return { success: false, error: String(error) }
  }
})

// Show native notification
ipcMain.handle('show-notification', async (_, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show()
  }
})

// Chat thread storage
const getChatThreadsDir = () => join(app.getPath('userData'), 'chat-threads')
const getChatThreadPath = (agentId: string) => join(getChatThreadsDir(), `${agentId}.json`)

// Ensure chat threads directory exists
async function ensureChatThreadsDir() {
  const dir = getChatThreadsDir()
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }
}

// Chat thread IPC handlers
ipcMain.handle('load-chat-thread', async (_, agentId: string) => {
  try {
    const filePath = getChatThreadPath(agentId)
    if (!existsSync(filePath)) {
      return null
    }
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    console.error('Failed to load chat thread:', error)
    return null
  }
})

ipcMain.handle('save-chat-thread', async (_, agentId: string, thread: unknown) => {
  try {
    await ensureChatThreadsDir()
    const filePath = getChatThreadPath(agentId)
    await writeFile(filePath, JSON.stringify(thread, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save chat thread:', error)
    return false
  }
})

ipcMain.handle('clear-chat-thread', async (_, agentId: string) => {
  try {
    const filePath = getChatThreadPath(agentId)
    if (existsSync(filePath)) {
      const { unlink } = await import('fs/promises')
      await unlink(filePath)
    }
    return true
  } catch (error) {
    console.error('Failed to clear chat thread:', error)
    return false
  }
})

ipcMain.handle('list-chat-threads', async () => {
  try {
    const dir = getChatThreadsDir()
    if (!existsSync(dir)) {
      return []
    }
    const files = await readdir(dir)
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''))
  } catch (error) {
    console.error('Failed to list chat threads:', error)
    return []
  }
})

// Story chat history storage (linked to stories, persisted in project and user data)
import { homedir } from 'os'

interface StoryChatHistory {
  storyId: string
  storyTitle: string
  sessions: unknown[]
  lastUpdated: number
}

const getProjectStoryChatDir = (projectPath: string) => join(projectPath, '_bmad-output', 'chat-history')
const getProjectStoryChatPath = (projectPath: string, storyId: string) => join(getProjectStoryChatDir(projectPath), `${storyId}.json`)
const getUserStoryChatDir = () => join(homedir(), '.config', 'bmadboard', 'story-chats')
const getUserStoryChatPath = (storyId: string) => join(getUserStoryChatDir(), `${storyId}.json`)

// Ensure story chat directories exist
async function ensureStoryChatDirs(projectPath: string) {
  const projectDir = getProjectStoryChatDir(projectPath)
  const userDir = getUserStoryChatDir()
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true })
  }
  if (!existsSync(userDir)) {
    await mkdir(userDir, { recursive: true })
  }
}

// Save story chat history to both project and user data locations
ipcMain.handle('save-story-chat-history', async (_, projectPath: string, storyId: string, history: StoryChatHistory) => {
  try {
    await ensureStoryChatDirs(projectPath)
    const projectFilePath = getProjectStoryChatPath(projectPath, storyId)
    const userFilePath = getUserStoryChatPath(storyId)
    const content = JSON.stringify(history, null, 2)

    // Save to both locations
    await Promise.all([
      writeFile(projectFilePath, content),
      writeFile(userFilePath, content)
    ])
    return true
  } catch (error) {
    console.error('Failed to save story chat history:', error)
    return false
  }
})

// Load story chat history - user dir first (primary), fallback to project dir (backup)
// If found in project dir but not user dir, sync to user dir
ipcMain.handle('load-story-chat-history', async (_, projectPath: string, storyId: string) => {
  try {
    const projectFilePath = getProjectStoryChatPath(projectPath, storyId)
    const userFilePath = getUserStoryChatPath(storyId)

    // Try user directory first (primary)
    if (existsSync(userFilePath)) {
      const content = await readFile(userFilePath, 'utf-8')
      return JSON.parse(content) as StoryChatHistory
    }

    // Fallback to project directory (backup)
    if (existsSync(projectFilePath)) {
      const content = await readFile(projectFilePath, 'utf-8')
      const history = JSON.parse(content) as StoryChatHistory

      // Sync to user directory for future access
      try {
        const userDir = getUserStoryChatDir()
        if (!existsSync(userDir)) {
          await mkdir(userDir, { recursive: true })
        }
        await writeFile(userFilePath, content)
        console.log('Synced story chat history from project to user data:', storyId)
      } catch (syncError) {
        console.error('Failed to sync story chat history to user data:', syncError)
      }

      return history
    }

    return null
  } catch (error) {
    console.error('Failed to load story chat history:', error)
    return null
  }
})

// List all story IDs that have chat history
ipcMain.handle('list-story-chat-histories', async (_, projectPath: string) => {
  try {
    const storyIds = new Set<string>()

    // Check project directory
    const projectDir = getProjectStoryChatDir(projectPath)
    if (existsSync(projectDir)) {
      const files = await readdir(projectDir)
      files.filter(f => f.endsWith('.json')).forEach(f => storyIds.add(f.replace('.json', '')))
    }

    // Check user directory
    const userDir = getUserStoryChatDir()
    if (existsSync(userDir)) {
      const files = await readdir(userDir)
      files.filter(f => f.endsWith('.json')).forEach(f => storyIds.add(f.replace('.json', '')))
    }

    return Array.from(storyIds)
  } catch (error) {
    console.error('Failed to list story chat histories:', error)
    return []
  }
})

// Chat agent - simple spawn per message
import { chatAgentManager } from './agentManager'

// Set mainWindow for chatAgentManager when app is ready
app.whenReady().then(() => {
  chatAgentManager.setMainWindow(mainWindow)
})

ipcMain.handle('chat-load-agent', async (_, options: {
  agentId: string
  projectPath: string
  projectType: 'bmm' | 'bmgd'
  tool?: AITool
  model?: ClaudeModel
  customEndpoint?: { name: string; baseUrl: string; apiKey: string; modelName: string } | null
}) => {
  chatAgentManager.setMainWindow(mainWindow)
  return chatAgentManager.loadAgent(options)
})

ipcMain.handle('chat-send-message', async (_, options: {
  agentId: string
  projectPath: string
  message: string
  sessionId?: string
  tool?: AITool
  model?: ClaudeModel
  customEndpoint?: { name: string; baseUrl: string; apiKey: string; modelName: string } | null
}) => {
  chatAgentManager.setMainWindow(mainWindow)
  return chatAgentManager.sendMessage(options)
})

ipcMain.handle('chat-cancel-message', async (_, agentId: string) => {
  return chatAgentManager.cancelMessage(agentId)
})

ipcMain.handle('chat-is-agent-running', async (_, agentId: string) => {
  return chatAgentManager.isRunning(agentId)
})

ipcMain.handle('chat-has-session', async () => {
  return chatAgentManager.hasSession()
})

ipcMain.handle('chat-is-session-ready', async () => {
  return chatAgentManager.isSessionReady()
})

ipcMain.handle('chat-kill-session', async () => {
  return chatAgentManager.killSession()
})

ipcMain.handle('chat-get-active-sessions', async () => {
  return []
})

// CLI Tool detection IPC handlers
ipcMain.handle('cli-detect-tool', async (_, toolId: string) => {
  return detectTool(toolId)
})

ipcMain.handle('cli-detect-all-tools', async () => {
  return detectAllTools()
})

ipcMain.handle('cli-clear-cache', async () => {
  clearDetectionCache()
})

// BMAD Install handler - runs npx bmad-method install
let bmadInstallProcess: ReturnType<typeof spawnChild> | null = null

ipcMain.handle('bmad-install', async (_, projectPath: string, useAlpha?: boolean) => {
  if (bmadInstallProcess) {
    return { success: false, error: 'Installation already in progress' }
  }

  try {
    const packageName = useAlpha ? 'bmad-method@alpha' : 'bmad-method'
    // Stable v6 supports non-interactive flags; alpha does not
    const args = useAlpha
      ? [packageName, 'install']
      : [
          packageName, 'install',
          '--directory', projectPath,
          '--modules', 'bmm',
          '--tools', 'claude-code',
          '--output-folder', '_bmad-output',
          '--yes'
        ]

    console.log('[BMAD Install] Running: npx', args.join(' '))

    const proc = spawnChild('npx', args, {
      cwd: projectPath,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: getAugmentedEnv()
    })

    bmadInstallProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString('utf-8')
      console.log('[BMAD Install stdout]', chunk)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bmad:install-output', { type: 'stdout', chunk })
      }
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const chunk = data.toString('utf-8')
      console.log('[BMAD Install stderr]', chunk)
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bmad:install-output', { type: 'stderr', chunk })
      }
    })

    proc.on('exit', (code, signal) => {
      console.log('[BMAD Install] Exited:', { code, signal })
      bmadInstallProcess = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bmad:install-complete', {
          success: code === 0,
          code,
          signal
        })
      }
    })

    proc.on('error', (error) => {
      console.error('[BMAD Install] Error:', error)
      bmadInstallProcess = null
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('bmad:install-complete', {
          success: false,
          error: error.message
        })
      }
    })

    return { success: true }
  } catch (error) {
    bmadInstallProcess = null
    return { success: false, error: error instanceof Error ? error.message : 'Failed to start install' }
  }
})

// Wizard file watcher - watches _bmad-output/planning-artifacts for new files
let wizardWatcher: FSWatcher | null = null
let wizardWatchDebounce: NodeJS.Timeout | null = null

ipcMain.handle('wizard-start-watching', async (_, projectPath: string) => {
  // Stop existing wizard watcher
  if (wizardWatcher) {
    wizardWatcher.close()
    wizardWatcher = null
  }

  const planningDir = join(projectPath, '_bmad-output', 'planning-artifacts')

  // Create the directory if it doesn't exist yet (install may not have completed)
  if (!existsSync(planningDir)) {
    try {
      await mkdir(planningDir, { recursive: true })
    } catch {
      return false
    }
  }

  try {
    wizardWatcher = watch(planningDir, { recursive: true }, (_eventType, filename) => {
      if (!filename || !filename.endsWith('.md')) return

      if (wizardWatchDebounce) clearTimeout(wizardWatchDebounce)
      wizardWatchDebounce = setTimeout(() => {
        console.log('[Wizard Watcher] File changed:', filename)
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('wizard:file-changed', { filename })
        }
      }, 500)
    })
    return true
  } catch (error) {
    console.error('[Wizard Watcher] Failed to start:', error)
    return false
  }
})

ipcMain.handle('wizard-stop-watching', async () => {
  if (wizardWatchDebounce) {
    clearTimeout(wizardWatchDebounce)
    wizardWatchDebounce = null
  }
  if (wizardWatcher) {
    wizardWatcher.close()
    wizardWatcher = null
  }
  return true
})

// Check if a file exists (for wizard step completion detection)
ipcMain.handle('check-file-exists', async (_, filePath: string) => {
  return existsSync(filePath)
})

// Wizard state persistence
ipcMain.handle('save-wizard-state', async (_, projectPath: string, state: unknown) => {
  try {
    const wizardDir = join(projectPath, '_bmad-output')
    if (!existsSync(wizardDir)) {
      await mkdir(wizardDir, { recursive: true })
    }
    const wizardPath = join(wizardDir, '.bmadboard-wizard.json')
    await writeFile(wizardPath, JSON.stringify(state, null, 2))
    return true
  } catch (error) {
    console.error('Failed to save wizard state:', error)
    return false
  }
})

ipcMain.handle('load-wizard-state', async (_, projectPath: string) => {
  try {
    const wizardPath = join(projectPath, '_bmad-output', '.bmadboard-wizard.json')
    if (!existsSync(wizardPath)) return null
    const content = await readFile(wizardPath, 'utf-8')
    return JSON.parse(content)
  } catch {
    return null
  }
})

ipcMain.handle('delete-wizard-state', async (_, projectPath: string) => {
  try {
    const wizardPath = join(projectPath, '_bmad-output', '.bmadboard-wizard.json')
    if (existsSync(wizardPath)) {
      const { unlink } = await import('fs/promises')
      await unlink(wizardPath)
    }
    return true
  } catch {
    return false
  }
})

// Allow selecting a directory without validating _bmad-output (for wizard)
ipcMain.handle('select-directory-any', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    properties: ['openDirectory'],
    title: 'Select Project Folder'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return null
  }

  return { path: result.filePaths[0] }
})

// Create a new project directory (for "New Project" flow)
ipcMain.handle('create-project-directory', async (_, parentPath: string, projectName: string) => {
  try {
    const projectPath = join(parentPath, projectName)
    if (existsSync(projectPath)) {
      return { success: false, error: 'A folder with that name already exists' }
    }
    await mkdir(projectPath, { recursive: true })
    return { success: true, path: projectPath }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create directory' }
  }
})
