import { spawn, ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { BrowserWindow } from 'electron'

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
      const args: string[] = ['--output-format', 'stream-json', '--print', '--verbose']

      if (options.initialPrompt) {
        args.push('-p', options.initialPrompt)
      }

      console.log('Spawning claude with args:', args, 'in:', options.projectPath)

      const proc = spawn('claude', args, {
        cwd: options.projectPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH || ''}`
        }
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
