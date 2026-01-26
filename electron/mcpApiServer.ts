/**
 * MCP API Server
 *
 * Local HTTP server that the BMadBoard MCP server calls to execute actions.
 * This bridges the MCP server (running as a separate process) with the Electron app.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http'
import { BrowserWindow } from 'electron'

// Port for the API server
export const MCP_API_PORT = 45678

interface APIContext {
  mainWindow: BrowserWindow | null
  projectPath: string | null
  projectType: 'bmm' | 'bmgd' | null
  // Callbacks to access app state
  getEpics: () => Promise<unknown[]>
  getStories: () => Promise<unknown[]>
  getAgents: () => unknown[]
  getCurrentBranch: () => Promise<string | null>
  hasUncommittedChanges: () => Promise<boolean>
  // Action callbacks
  updateStoryStatus: (storyId: string, status: string) => Promise<{ success: boolean; error?: string }>
  gitCheckout: (branchName: string) => Promise<{ success: boolean; error?: string }>
  gitCreateBranch: (branchName: string, fromBranch?: string) => Promise<{ success: boolean; error?: string }>
  gitCommit: (message: string) => Promise<{ success: boolean; error?: string }>
  delegateToAgent: (agentId: string, message: string, storyId?: string) => void
  getStoryDetails: (storyId: string) => Promise<unknown>
}

let apiContext: APIContext | null = null
let server: ReturnType<typeof createServer> | null = null

// Parse JSON body from request
async function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      try {
        const body = Buffer.concat(chunks).toString()
        resolve(body ? JSON.parse(body) : {})
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

// Send JSON response
function sendJSON(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// Handle API requests
async function handleRequest(req: IncomingMessage, res: ServerResponse) {
  // CORS headers for local development
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  if (req.method !== 'POST') {
    sendJSON(res, 405, { error: 'Method not allowed' })
    return
  }

  if (!apiContext) {
    sendJSON(res, 503, { error: 'API not initialized' })
    return
  }

  try {
    const body = await parseBody(req) as Record<string, unknown>
    const url = req.url || ''

    console.log('[MCP API] Request:', url, body)

    switch (url) {
      case '/api/delegate': {
        const { agentId, message, storyId } = body as {
          agentId: string
          message: string
          storyId?: string
        }

        if (!agentId || !message) {
          sendJSON(res, 400, { error: 'Missing agentId or message' })
          return
        }

        // Delegate to the agent (this sends to renderer to handle)
        apiContext.delegateToAgent(agentId, message, storyId)

        sendJSON(res, 200, {
          success: true,
          message: `Task delegated to agent "${agentId}". The agent will work on this asynchronously.`
        })
        break
      }

      case '/api/story/status': {
        const { storyId, status } = body as { storyId: string; status: string }

        if (!storyId || !status) {
          sendJSON(res, 400, { error: 'Missing storyId or status' })
          return
        }

        const result = await apiContext.updateStoryStatus(storyId, status)
        sendJSON(res, result.success ? 200 : 400, result)
        break
      }

      case '/api/git/checkout': {
        const { branchName } = body as { branchName: string }

        if (!branchName) {
          sendJSON(res, 400, { error: 'Missing branchName' })
          return
        }

        const result = await apiContext.gitCheckout(branchName)
        sendJSON(res, result.success ? 200 : 400, result)
        break
      }

      case '/api/git/create-branch': {
        const { branchName, fromBranch, checkout } = body as {
          branchName: string
          fromBranch?: string
          checkout?: boolean
        }

        if (!branchName) {
          sendJSON(res, 400, { error: 'Missing branchName' })
          return
        }

        const result = await apiContext.gitCreateBranch(branchName, fromBranch)

        if (result.success && checkout !== false) {
          await apiContext.gitCheckout(branchName)
        }

        sendJSON(res, result.success ? 200 : 400, result)
        break
      }

      case '/api/git/commit': {
        const { message } = body as { message: string }

        if (!message) {
          sendJSON(res, 400, { error: 'Missing commit message' })
          return
        }

        const result = await apiContext.gitCommit(message)
        sendJSON(res, result.success ? 200 : 400, result)
        break
      }

      case '/api/project/state': {
        const [epics, stories, currentBranch, hasChanges] = await Promise.all([
          apiContext.getEpics(),
          apiContext.getStories(),
          apiContext.getCurrentBranch(),
          apiContext.hasUncommittedChanges()
        ])

        sendJSON(res, 200, {
          projectPath: apiContext.projectPath,
          projectType: apiContext.projectType,
          currentBranch,
          hasUncommittedChanges: hasChanges,
          epics,
          stories,
          agents: apiContext.getAgents()
        })
        break
      }

      case '/api/agents': {
        sendJSON(res, 200, {
          agents: apiContext.getAgents()
        })
        break
      }

      case '/api/story/details': {
        const { storyId } = body as { storyId: string }

        if (!storyId) {
          sendJSON(res, 400, { error: 'Missing storyId' })
          return
        }

        const details = await apiContext.getStoryDetails(storyId)
        sendJSON(res, 200, details)
        break
      }

      default:
        sendJSON(res, 404, { error: 'Endpoint not found' })
    }
  } catch (error) {
    console.error('[MCP API] Error:', error)
    sendJSON(res, 500, { error: error instanceof Error ? error.message : 'Internal server error' })
  }
}

// Start the API server
export function startMcpApiServer(context: APIContext): Promise<void> {
  return new Promise((resolve, reject) => {
    apiContext = context

    server = createServer(handleRequest)

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[MCP API] Port ${MCP_API_PORT} already in use, trying to continue...`)
        resolve()
      } else {
        reject(err)
      }
    })

    server.listen(MCP_API_PORT, '127.0.0.1', () => {
      console.log(`[MCP API] Server listening on http://127.0.0.1:${MCP_API_PORT}`)
      resolve()
    })
  })
}

// Stop the API server
export function stopMcpApiServer(): void {
  if (server) {
    server.close()
    server = null
  }
  apiContext = null
}

// Update context (e.g., when project changes)
export function updateMcpApiContext(updates: Partial<APIContext>): void {
  if (apiContext) {
    apiContext = { ...apiContext, ...updates }
  }
}
