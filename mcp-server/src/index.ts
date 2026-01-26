#!/usr/bin/env node
/**
 * BMadBoard MCP Server
 *
 * Provides tools for the orchestrator agent to:
 * - Delegate work to other BMAD agents
 * - Update story statuses
 * - Perform git operations
 * - Query project state
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js'

// BMadBoard API endpoint (set via environment variable)
const BMADBOARD_API_URL = process.env.BMADBOARD_API_URL || 'http://localhost:45678'

// Helper to call the BMadBoard HTTP API
async function callBMadBoardAPI(endpoint: string, data: Record<string, unknown>): Promise<unknown> {
  const response = await fetch(`${BMADBOARD_API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`BMadBoard API error: ${error}`)
  }

  return response.json()
}

// Tool definitions
const TOOLS = [
  {
    name: 'delegate_to_agent',
    description: 'Delegate a task to another BMAD agent. The agent will be loaded and the message sent to them. Returns when the message has been queued (the agent will work asynchronously).',
    inputSchema: {
      type: 'object',
      properties: {
        agent_id: {
          type: 'string',
          description: 'The ID of the agent to delegate to (e.g., "dev", "pm", "architect", "sm", "analyst", "barry", "tea")'
        },
        message: {
          type: 'string',
          description: 'The task or message to send to the agent'
        },
        story_id: {
          type: 'string',
          description: 'Optional: The story ID this task relates to (for context linking)'
        }
      },
      required: ['agent_id', 'message']
    }
  },
  {
    name: 'update_story_status',
    description: 'Update the status of a story on the board. This moves the story card to a different column.',
    inputSchema: {
      type: 'object',
      properties: {
        story_id: {
          type: 'string',
          description: 'The story ID (e.g., "1-1-setup-auth")'
        },
        new_status: {
          type: 'string',
          enum: ['backlog', 'ready-for-dev', 'in-progress', 'review', 'done', 'optional'],
          description: 'The new status for the story'
        }
      },
      required: ['story_id', 'new_status']
    }
  },
  {
    name: 'git_checkout',
    description: 'Switch to a different git branch',
    inputSchema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description: 'The name of the branch to checkout'
        }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'git_create_branch',
    description: 'Create a new git branch and optionally switch to it',
    inputSchema: {
      type: 'object',
      properties: {
        branch_name: {
          type: 'string',
          description: 'The name of the new branch'
        },
        from_branch: {
          type: 'string',
          description: 'Optional: The branch to create from (defaults to current branch)'
        },
        checkout: {
          type: 'boolean',
          description: 'Whether to switch to the new branch after creating (default: true)'
        }
      },
      required: ['branch_name']
    }
  },
  {
    name: 'git_commit',
    description: 'Stage all changes and create a commit',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'The commit message'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'get_project_state',
    description: 'Get the current state of the project including epics, stories, git status, and available agents',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'list_agents',
    description: 'Get a list of all available BMAD agents with their roles and capabilities',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'get_story_details',
    description: 'Get detailed information about a specific story including its content, acceptance criteria, and tasks',
    inputSchema: {
      type: 'object',
      properties: {
        story_id: {
          type: 'string',
          description: 'The story ID to get details for'
        }
      },
      required: ['story_id']
    }
  }
]

// Create the MCP server
const server = new Server(
  {
    name: 'bmadboard-mcp',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
)

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'delegate_to_agent': {
        const { agent_id, message, story_id } = args as {
          agent_id: string
          message: string
          story_id?: string
        }

        const result = await callBMadBoardAPI('/api/delegate', {
          agentId: agent_id,
          message,
          storyId: story_id
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'update_story_status': {
        const { story_id, new_status } = args as {
          story_id: string
          new_status: string
        }

        const result = await callBMadBoardAPI('/api/story/status', {
          storyId: story_id,
          status: new_status
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'git_checkout': {
        const { branch_name } = args as { branch_name: string }

        const result = await callBMadBoardAPI('/api/git/checkout', {
          branchName: branch_name
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'git_create_branch': {
        const { branch_name, from_branch, checkout = true } = args as {
          branch_name: string
          from_branch?: string
          checkout?: boolean
        }

        const result = await callBMadBoardAPI('/api/git/create-branch', {
          branchName: branch_name,
          fromBranch: from_branch,
          checkout
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'git_commit': {
        const { message } = args as { message: string }

        const result = await callBMadBoardAPI('/api/git/commit', {
          message
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'get_project_state': {
        const result = await callBMadBoardAPI('/api/project/state', {})

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'list_agents': {
        const result = await callBMadBoardAPI('/api/agents', {})

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      case 'get_story_details': {
        const { story_id } = args as { story_id: string }

        const result = await callBMadBoardAPI('/api/story/details', {
          storyId: story_id
        })

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        }
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return {
      content: [{
        type: 'text',
        text: `Error: ${message}`
      }],
      isError: true
    }
  }
})

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('BMadBoard MCP server running')
}

main().catch(console.error)
