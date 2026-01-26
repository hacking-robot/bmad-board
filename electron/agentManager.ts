import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'
import { getAugmentedEnv, findBinary } from './envUtils'
import { buildArgs, getToolConfig, supportsHeadless, ClaudeModel } from './cliToolManager'

// Supported AI tools
type AITool = 'claude-code' | 'cursor' | 'windsurf' | 'roo-code' | 'aider'

export interface AgentInfo {
  id: string
  storyId: string
  storyTitle: string
  command: string
  status: 'running' | 'completed' | 'error'
  startTime: number
  pid: number | undefined
}

interface ManagedAgent {
  id: string
  process: ChildProcess
  storyId: string
  storyTitle: string
  command: string
  startTime: number
}

class AgentManager extends EventEmitter {
  private agents: Map<string, ManagedAgent> = new Map()
  private mainWindow: BrowserWindow | null = null

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window
  }

  private sendToRenderer(channel: string, data: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  spawn(options: {
    storyId: string
    storyTitle: string
    projectPath: string
    initialPrompt: string
  }): string {
    const agentId = `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

    try {
      const args: string[] = ['--output-format', 'stream-json', '--print', '--verbose', '--dangerously-skip-permissions']

      if (options.initialPrompt) {
        args.push('-p', options.initialPrompt)
      }

      console.log('Spawning claude with args:', args, 'in:', options.projectPath)

      // Find the claude binary using augmented PATH
      const claudePath = findBinary('claude') || 'claude'

      const proc = spawn(claudePath, args, {
        cwd: options.projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: getAugmentedEnv()
      })

      const managed: ManagedAgent = {
        id: agentId,
        process: proc,
        storyId: options.storyId,
        storyTitle: options.storyTitle,
        command: options.initialPrompt,
        startTime: Date.now()
      }

      this.agents.set(agentId, managed)

      // Handle stdout
      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')
        this.sendToRenderer('agent:output', {
          agentId,
          type: 'stdout',
          chunk,
          timestamp: Date.now()
        })
      })

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')
        this.sendToRenderer('agent:output', {
          agentId,
          type: 'stderr',
          chunk,
          timestamp: Date.now()
        })
      })

      // Handle process exit
      proc.on('exit', (code, signal) => {
        console.log('Agent exited:', { agentId, code, signal })
        this.sendToRenderer('agent:exit', {
          agentId,
          code,
          signal,
          timestamp: Date.now()
        })
        this.agents.delete(agentId)
      })

      // Handle errors
      proc.on('error', (error) => {
        console.error('Agent error:', error)
        this.sendToRenderer('agent:error', {
          agentId,
          error: error.message,
          timestamp: Date.now()
        })
        this.agents.delete(agentId)
      })

      // Send spawned event
      this.sendToRenderer('agent:spawned', {
        agentId,
        storyId: options.storyId,
        storyTitle: options.storyTitle,
        command: options.initialPrompt,
        pid: proc.pid,
        timestamp: Date.now()
      })

      console.log('Agent spawned successfully:', agentId, 'PID:', proc.pid)
      return agentId
    } catch (error) {
      console.error('Agent spawn failed:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to spawn agent'
      this.sendToRenderer('agent:error', {
        agentId,
        error: errorMessage,
        timestamp: Date.now()
      })
      throw error
    }
  }

  sendInput(agentId: string, input: string): boolean {
    const managed = this.agents.get(agentId)
    if (!managed || !managed.process.stdin) {
      return false
    }

    try {
      managed.process.stdin.write(input)
      return true
    } catch {
      return false
    }
  }

  kill(agentId: string, signal: NodeJS.Signals = 'SIGTERM'): boolean {
    const managed = this.agents.get(agentId)
    if (!managed) {
      return false
    }

    try {
      managed.process.kill(signal)
      this.agents.delete(agentId)
      return true
    } catch {
      return false
    }
  }

  killAll(): void {
    for (const [agentId, managed] of this.agents) {
      try {
        managed.process.kill('SIGTERM')
      } catch {
        // Ignore errors during cleanup
      }
      this.agents.delete(agentId)
    }
  }

  getAgents(): AgentInfo[] {
    return Array.from(this.agents.values()).map((managed) => ({
      id: managed.id,
      storyId: managed.storyId,
      storyTitle: managed.storyTitle,
      command: managed.command,
      status: 'running' as const,
      startTime: managed.startTime,
      pid: managed.process.pid
    }))
  }

  getAgent(agentId: string): AgentInfo | null {
    const managed = this.agents.get(agentId)
    if (!managed) {
      return null
    }

    return {
      id: managed.id,
      storyId: managed.storyId,
      storyTitle: managed.storyTitle,
      command: managed.command,
      status: 'running',
      startTime: managed.startTime,
      pid: managed.process.pid
    }
  }

  hasAgentForStory(storyId: string): string | null {
    for (const [, managed] of this.agents) {
      if (managed.storyId === storyId) {
        return managed.id
      }
    }
    return null
  }
}

// Singleton instance
export const agentManager = new AgentManager()

// Chat-specific agent manager for the Discord-style chat interface
// Spawns a new Claude process for each message using --print mode
// Uses --resume with session ID for conversation continuity

class ChatAgentManager {
  private mainWindow: BrowserWindow | null = null
  private runningProcesses: Map<string, ChildProcess> = new Map() // Track running processes by agentId

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window
  }

  private sendToRenderer(channel: string, data: unknown) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data)
    }
  }

  // Load a BMAD agent - spawns the AI tool with just the agent command
  // Returns session ID via chat:exit event for subsequent messages (Claude only)
  loadAgent(
    options: {
      agentId: string
      projectPath: string
      projectType: 'bmm' | 'bmgd'
      tool?: AITool
      model?: ClaudeModel
    }
  ): { success: boolean; error?: string } {
    const tool = options.tool || 'claude-code'
    
    // Check if tool supports headless operation
    if (!supportsHeadless(tool)) {
      return { 
        success: false, 
        error: `${tool} does not support headless CLI operation. Use the IDE directly.` 
      }
    }

    const toolConfig = getToolConfig(tool)
    if (!toolConfig || !toolConfig.cliCommand) {
      return { success: false, error: `Unknown tool: ${tool}` }
    }

    try {
      // Build the agent load prompt
      const agentPrompt = `/bmad:${options.projectType}:agents:${options.agentId}`
      
      // Build tool-specific args
      let args: string[]
      let binaryName: string
      
      if (tool === 'claude-code') {
        // Claude: use buildArgs for consistency
        args = buildArgs('claude-code', { prompt: agentPrompt, verbose: true, model: options.model })
        binaryName = 'claude'
      } else if (tool === 'cursor') {
        // Cursor: headless mode with message
        args = ['--headless', '--message', agentPrompt]
        binaryName = 'cursor'
      } else if (tool === 'aider') {
        // Aider: non-interactive mode with message
        args = ['--no-auto-commits', '--yes', '--message', agentPrompt]
        binaryName = 'aider'
      } else {
        return { success: false, error: `Unsupported tool for agent loading: ${tool}` }
      }

      console.log('[ChatAgentManager] ================================')
      console.log('[ChatAgentManager] Loading agent:', options.agentId)
      console.log('[ChatAgentManager] Tool:', tool)
      console.log('[ChatAgentManager] Project path (cwd):', options.projectPath)
      console.log(`[ChatAgentManager] Full command: ${binaryName}`, args.join(' '))
      console.log('[ChatAgentManager] ================================')

      // Find the binary using augmented PATH
      const binaryPath = findBinary(binaryName) || binaryName

      const proc = spawn(binaryPath, args, {
        cwd: options.projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: getAugmentedEnv()
      })

      console.log('[ChatAgentManager] Agent load process spawned, PID:', proc.pid)

      // Track running process for potential cancellation
      this.runningProcesses.set(options.agentId, proc)

      // Track session ID from response
      let capturedSessionId: string | undefined

      // Handle stdout - capture session ID
      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')
        console.log('[ChatAgentManager] Agent load stdout:', chunk.substring(0, 500))

        const lines = chunk.split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            console.log('[ChatAgentManager] Parsed JSON type:', parsed.type)
            if (parsed.type === 'result' && parsed.session_id) {
              capturedSessionId = parsed.session_id
              console.log('[ChatAgentManager] Agent load captured session ID:', capturedSessionId)
            }
          } catch {
            // Not JSON, ignore
          }
        }

        // Send output for agent loading display
        this.sendToRenderer('chat:output', {
          agentId: options.agentId,
          type: 'stdout',
          chunk,
          timestamp: Date.now(),
          isAgentLoad: true
        })
      })

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')
        this.sendToRenderer('chat:output', {
          agentId: options.agentId,
          type: 'stderr',
          chunk,
          timestamp: Date.now(),
          isAgentLoad: true
        })
      })

      // Handle exit - send agent-loaded event with session ID
      proc.on('exit', (code, signal) => {
        console.log('[ChatAgentManager] Agent load completed:', { agentId: options.agentId, code, signal, sessionId: capturedSessionId })
        if (code === 0 && !capturedSessionId) {
          console.warn('[ChatAgentManager] WARNING: Agent load succeeded but no session ID was captured. This may indicate Claude CLI output format has changed or there was a parse error.')
        }
        this.runningProcesses.delete(options.agentId)
        this.sendToRenderer('chat:agent-loaded', {
          agentId: options.agentId,
          code,
          signal,
          sessionId: capturedSessionId,
          timestamp: Date.now()
        })
      })

      // Handle errors
      proc.on('error', (error) => {
        console.error('[ChatAgentManager] Agent load error:', error)
        this.runningProcesses.delete(options.agentId)
        this.sendToRenderer('chat:agent-loaded', {
          agentId: options.agentId,
          code: -1,
          signal: null,
          error: error.message,
          timestamp: Date.now()
        })
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load agent'
      return { success: false, error: errorMessage }
    }
  }

  // Send a message to an agent - spawns a new process each time
  // Uses --resume for conversation continuity when sessionId is provided (Claude only)
  sendMessage(
    options: {
      agentId: string
      projectPath: string
      message: string
      sessionId?: string // Session ID from previous response for --resume (Claude only)
      tool?: AITool
      model?: ClaudeModel
    }
  ): { success: boolean; error?: string } {
    const tool = options.tool || 'claude-code'
    
    // Check if tool supports headless operation
    if (!supportsHeadless(tool)) {
      return { 
        success: false, 
        error: `${tool} does not support headless CLI operation. Use the IDE directly.` 
      }
    }

    const toolConfig = getToolConfig(tool)
    if (!toolConfig || !toolConfig.cliCommand) {
      return { success: false, error: `Unknown tool: ${tool}` }
    }

    try {
      const prompt = options.message
      
      // Build tool-specific args
      let args: string[]
      let binaryName: string
      
      if (tool === 'claude-code') {
        // Claude: use buildArgs, supports --resume for session continuity
        args = buildArgs('claude-code', {
          prompt,
          sessionId: options.sessionId,
          verbose: true,
          model: options.model
        })
        binaryName = 'claude'
      } else if (tool === 'cursor') {
        // Cursor: headless mode with message (no session support)
        args = ['--headless', '--message', prompt]
        binaryName = 'cursor'
      } else if (tool === 'aider') {
        // Aider: non-interactive mode with message (no session support)
        args = ['--no-auto-commits', '--yes', '--message', prompt]
        binaryName = 'aider'
      } else {
        return { success: false, error: `Unsupported tool for messaging: ${tool}` }
      }

      console.log('[ChatAgentManager] ================================')
      console.log('[ChatAgentManager] Sending message')
      console.log('[ChatAgentManager] Tool:', tool)
      console.log('[ChatAgentManager] Project path (cwd):', options.projectPath)
      console.log('[ChatAgentManager] Session ID:', options.sessionId || 'none (or not supported)')
      console.log(`[ChatAgentManager] Full command: ${binaryName}`, args.join(' '))
      console.log('[ChatAgentManager] ================================')

      // Find the binary using augmented PATH
      const binaryPath = findBinary(binaryName) || binaryName

      const proc = spawn(binaryPath, args, {
        cwd: options.projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: getAugmentedEnv()
      })

      console.log('[ChatAgentManager] Process spawned, PID:', proc.pid)

      // Track running process for potential cancellation
      this.runningProcesses.set(options.agentId, proc)

      // Track session ID from response
      let capturedSessionId: string | undefined

      // Handle stdout - also capture session ID from result message
      proc.stdout?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')

        // Try to capture session ID from stream-json output
        const lines = chunk.split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line)
            // Session ID typically comes in the result message
            if (parsed.type === 'result' && parsed.session_id) {
              capturedSessionId = parsed.session_id
              console.log('[ChatAgentManager] Captured session ID:', capturedSessionId)
            }
          } catch {
            // Not JSON, ignore
          }
        }

        this.sendToRenderer('chat:output', {
          agentId: options.agentId,
          type: 'stdout',
          chunk,
          timestamp: Date.now()
        })
      })

      // Handle stderr
      proc.stderr?.on('data', (data: Buffer) => {
        const chunk = data.toString('utf-8')
        this.sendToRenderer('chat:output', {
          agentId: options.agentId,
          type: 'stderr',
          chunk,
          timestamp: Date.now()
        })
      })

      // Handle exit - include session ID if captured
      proc.on('exit', (code, signal) => {
        const wasCancelled = signal === 'SIGTERM' || signal === 'SIGKILL'
        console.log('[ChatAgentManager] Process exited:', { agentId: options.agentId, code, signal, sessionId: capturedSessionId, wasCancelled })
        this.runningProcesses.delete(options.agentId)
        this.sendToRenderer('chat:exit', {
          agentId: options.agentId,
          code,
          signal,
          sessionId: capturedSessionId,
          cancelled: wasCancelled,
          timestamp: Date.now()
        })
      })

      // Handle errors
      proc.on('error', (error) => {
        console.error('[ChatAgentManager] Process error:', error)
        this.runningProcesses.delete(options.agentId)
        this.sendToRenderer('chat:exit', {
          agentId: options.agentId,
          code: -1,
          signal: null,
          error: error.message,
          timestamp: Date.now()
        })
      })

      return { success: true }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      return { success: false, error: errorMessage }
    }
  }

  // Cancel an ongoing message/agent load for a specific agent
  cancelMessage(agentId: string): boolean {
    const proc = this.runningProcesses.get(agentId)
    if (!proc) {
      console.log('[ChatAgentManager] No running process to cancel for agent:', agentId)
      return false
    }

    try {
      console.log('[ChatAgentManager] Cancelling process for agent:', agentId, 'PID:', proc.pid)
      proc.kill('SIGTERM')
      this.runningProcesses.delete(agentId)
      return true
    } catch (error) {
      console.error('[ChatAgentManager] Failed to cancel process:', error)
      return false
    }
  }

  // Check if an agent has a running process
  isRunning(agentId: string): boolean {
    return this.runningProcesses.has(agentId)
  }

  // These methods are no longer needed but kept for API compatibility
  hasSession(): boolean {
    return false
  }

  isSessionReady(): boolean {
    return false
  }

  killSession(): boolean {
    return true
  }

  killAll(): void {
    // Kill all running processes
    for (const [, proc] of this.runningProcesses) {
      try {
        proc.kill('SIGTERM')
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.runningProcesses.clear()
  }

  // Get list of active agent sessions (stub - no persistent sessions in this implementation)
  getActiveSessions(): string[] {
    return []
  }
}

// Singleton instance for chat agents
export const chatAgentManager = new ChatAgentManager()
