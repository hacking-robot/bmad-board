# Plan: Add z.ai GLM 4.7 as a New AI Tool

## Summary

Add z.ai (Zhipu AI) GLM 4.7 as a new AI provider option in bmadboard. z.ai provides full Anthropic API compatibility, allowing it to work as a drop-in replacement with only API key and base URL changes.

## Key Details from Research

**z.ai API Compatibility:**
- Base URL: `https://api.z.ai/api/anthropic`
- API Timeout: `3000000` (50 minutes)
- Models: `glm-4.7` (flagship), `glm-4.5-air` (high value), `glm-4.5-flash` (free)
- Uses standard Anthropic SDK with custom base URL
- Compatible with Claude Code's stream-json format
- API Key stored in UI/settings (not environment variable)

## Implementation Steps

### 1. Update Type Definitions

**File:** `src/types/index.ts`

Add the new AI tool type and extend the tool config interface:

```typescript
export type AITool = 'claude-code' | 'cursor' | 'windsurf' | 'roo-code' | 'aider' | 'zai-glm'

export interface CLIToolConfig {
  id: string
  cliCommand: string
  versionFlag?: string
  hasStreamJson: boolean
  hasResume: boolean
  hasPromptFlag: boolean
  supportsHeadless: boolean
  extraFlags?: string[]
  // New fields for z.ai
  baseUrl?: string
  apiKeyEnv?: string
  envMapping?: Record<string, string>
  requiresApiKey?: boolean  // UI should show API key input
  apiKeySetting?: string    // Store key for API key in settings
}
```

### 2. Add Tool Configuration

**File:** `electron/cliToolManager.ts`

Add the z.ai tool to the `CLI_TOOLS` configuration:

```typescript
const CLI_TOOLS: Record<string, CLIToolConfig> = {
  // ... existing tools

  'zai-glm': {
    id: 'zai-glm',
    cliCommand: 'claude', // Use claude CLI with custom config
    versionFlag: '--version',
    hasStreamJson: true,
    hasResume: true,
    hasPromptFlag: true,
    supportsHeadless: true,
    extraFlags: ['--dangerously-skip-permissions'],
    baseUrl: 'https://api.z.ai/api/anthropic',
    apiKeyEnv: 'ZAI_API_KEY',
    requiresApiKey: true,
    apiKeySetting: 'zaiApiKey',
    envMapping: {
      'ANTHROPIC_API_KEY': 'ZAI_API_KEY',
      'ANTHROPIC_BASE_URL': 'https://api.z.ai/api/anthropic',
      'API_TIMEOUT_MS': '3000000'
    }
  }
}
```

### 3. Update Command Builder

**File:** `electron/cliToolManager.ts`

Modify the `buildArgs()` function to handle z.ai tool:

```typescript
function buildArgs(tool: string, options: CommandOptions): string[] {
  const toolConfig = CLI_TOOLS[tool]
  const args = []

  // Common args for stream-json tools
  if (toolConfig.hasStreamJson) {
    args.push('--output-format', 'stream-json')
  }

  // Tool-specific configuration
  switch (tool) {
    case 'zai-glm':
      args.push('--print')
      if (options.verbose !== false) args.push('--verbose')
      if (toolConfig.extraFlags) args.push(...toolConfig.extraFlags)
      if (options.model) args.push('--model', options.model)
      if (options.sessionId) args.push('--resume', options.sessionId)
      args.push('-p', options.prompt)
      break
    // ... existing cases
  }

  return args
}
```

### 4. Update Environment Handling

**File:** `electron/envUtils.ts`

Add environment variable mapping for z.ai that reads from store/settings:

```typescript
export function getAugmentedEnv(tool?: string, settings?: any): NodeJS.ProcessEnv {
  const env = { ...process.env }

  // Map z.ai environment variables from settings
  if (tool === 'zai-glm') {
    const zaiApiKey = settings?.zaiApiKey || env.ZAI_API_KEY
    if (zaiApiKey) {
      env.ANTHROPIC_API_KEY = zaiApiKey
    }
    env.ANTHROPIC_BASE_URL = 'https://api.z.ai/api/anthropic'
    env.API_TIMEOUT_MS = '3000000'
  }

  return {
    ...env,
    PATH: getAugmentedPath()
  }
}
```

Update spawn calls in `electron/cliToolManager.ts` to pass settings:

```typescript
const env = getAugmentedEnv(tool, storeSettings)
const proc = spawn(command, args, { env, cwd })
```

### 5. Add Store State for API Key

**File:** `src/store.ts`

Add the z.ai API key to the store interface and initial state:

```typescript
interface AppStore {
  // ... existing properties
  zaiApiKey: string
}

interface StoreState {
  // ... existing properties
  zaiApiKey: string
}

const initialStoreState: StoreState = {
  // ... existing initial state
  zaiApiKey: ''
}

export const useStore = create<AppStore>()(
  persist(
    (set) => ({
      // ... existing implementations
      zaiApiKey: initialStoreState.zaiApiKey,
      setZaiApiKey: (key: string) => set({ zaiApiKey: key }),
    }),
    {
      name: 'bmadboard-storage',
      // ... existing persist config
    }
  )
)
```

### 6. Add Settings UI for API Key

**File:** `src/components/SettingsMenu/SettingsMenu.tsx`

Add an API key input field that appears when zai-glm is selected:

```typescript
// Add to component imports and hooks
const { aiTool, zaiApiKey, setZaiApiKey } = useStore()

// In the settings render, add after AI tool selection
{aiTool === 'zai-glm' && (
  <div className="settings-group">
    <label>Z.ai API Key</label>
    <input
      type="password"
      value={zaiApiKey}
      onChange={(e) => setZaiApiKey(e.target.value)}
      placeholder="Enter your z.ai API key"
      className="api-key-input"
    />
    <p className="help-text">
      Get your API key from{' '}
      <a href="https://api.z.ai" target="_blank" rel="noopener noreferrer">
        api.z.ai
      </a>
    </p>
  </div>
)}
```

### 7. Pass Settings to Electron

**File:** `electron/main/index.ts` (or IPC handler file)

Update IPC handlers to receive and pass settings to environment utils:

```typescript
ipcMain.handle('chat:sendMessage', async (event, { prompt, sessionId, tool, settings }) => {
  const env = getAugmentedEnv(tool, settings)
  // ... rest of handler
})
```

**File:** `src/hooks/useChat.ts` (or wherever chat is initiated)

Pass settings when calling the IPC:

```typescript
const settings = { zaiApiKey }
await invoke('chat:sendMessage', {
  prompt,
  sessionId,
  tool: aiTool,
  settings
})
```

### 8. Add Model Options

**File:** `src/components/SettingsMenu/SettingsMenu.tsx`

Add GLM model options:

```typescript
const GLM_MODELS = [
  { id: 'glm-4.7', name: 'GLM 4.7', tier: 'Flagship' },
  { id: 'glm-4.5-air', name: 'GLM 4.5 Air', tier: 'High Value' },
  { id: 'glm-4.5-flash', name: 'GLM 4.5 Flash', tier: 'Free' }
]
```

Update model selection logic to show GLM models when zai-glm is selected.

### 9. Update Settings UI

**File:** `src/components/SettingsMenu/SettingsMenu.tsx`

Add z.ai to the AI tools list:

```typescript
const AI_TOOLS: AIToolInfo[] = [
  // ... existing tools
  {
    id: 'zai-glm',
    name: 'Z.ai GLM 4.7',
    agentPrefix: '/',
    description: 'Zhipu AI GLM 4.7 - Anthropic API compatible',
    requiresSetup: true,
    setupUrl: 'https://open.bigmodel.cn',
    cli: {
      cliCommand: 'claude',
      hasStreamJson: true,
      hasResume: true,
      supportsHeadless: true
    }
  }
]
```

### 10. Update Default Configuration

**File:** `/Users/david/Documents/Projects/bmadboard/config.json`

Add default model mapping for z.ai:

```json
{
  "defaults": {
    "model": "claude-sonnet-4-5-20250929",
    "aiTool": "claude-code"
  },
  "toolDefaults": {
    "zai-glm": {
      "model": "glm-4.7",
      "haikuModel": "glm-4.5-flash",
      "sonnetModel": "glm-4.7",
      "opusModel": "glm-4.7"
    }
  }
}
```

### 11. Add Claude Code Settings Documentation

**File:** Create new documentation or update existing

Document the required `~/.claude/settings.json` configuration for users:

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
  }
}
```

### 12. Verify Claude Code Settings Compatibility

**User's `~/.claude/settings.json`**

Users can optionally configure their local Claude Code settings to use GLM models by default:

```json
{
  "env": {
    "ANTHROPIC_DEFAULT_HAIKU_MODEL": "glm-4.5-flash",
    "ANTHROPIC_DEFAULT_SONNET_MODEL": "glm-4.7",
    "ANTHROPIC_DEFAULT_OPUS_MODEL": "glm-4.7"
  }
}
```

**Note:** This is optional since bmadboard will pass the model explicitly via `--model` flag.

## Testing Checklist

- [ ] Verify z.ai API key is properly loaded from store/settings
- [ ] Test API key input in settings UI saves correctly
- [ ] Test session creation with `zai-glm` tool
- [ ] Test message sending with resume capability
- [ ] Verify stream-json parsing works correctly
- [ ] Test model switching between GLM variants
- [ ] Verify UI shows correct models for z.ai tool
- [ ] Test error handling for invalid/missing API keys
- [ ] Verify base URL is correctly set in API calls
- [ ] Verify timeout is set to 3000000ms

## User Setup Requirements

Users will need to:

1. **Get API Key**: Register at [api.z.ai](https://api.z.ai)
2. **Enter API Key in Settings**: Use the bmadboard settings UI to enter the z.ai API key
3. **Select Z.ai GLM**: Choose "Z.ai GLM 4.7" from the AI Tool dropdown in settings
4. **Optional**: Configure `~/.claude/settings.json` with GLM model defaults (not required)

## Benefits

- **Cost Effective**: GLM 4.5-flash is free, GLM 4.5-air is high value
- **Drop-in Compatibility**: No code changes needed beyond configuration
- **Chinese Language Support**: Strong multilingual capabilities
- **High Context**: Up to 200K tokens context window

## Architecture Diagram

```
User Settings (bmadboard UI)
    │
    ├─── zaiApiKey (stored in Zustand persist)
    │
    ▼
Settings Menu Component
    │
    ├─── Shows API key input when aiTool === 'zai-glm'
    │
    ▼
Store (zaiApiKey)
    │
    ▼
IPC Handler (chat:sendMessage)
    │
    ├─── Passes settings.zaiApiKey
    │
    ▼
getAugmentedEnv('zai-glm', settings)
    │
    ├─── Sets ANTHROPIC_API_KEY = zaiApiKey
    ├─── Sets ANTHROPIC_BASE_URL = https://api.z.ai/api/anthropic
    ├─── Sets API_TIMEOUT_MS = 3000000
    │
    ▼
spawn('claude', args, { env, cwd })
    │
    ▼
Z.ai GLM API
```

## Files to Modify

1. `src/types/index.ts` - Add AITool type and CLIToolConfig fields
2. `src/store.ts` - Add zaiApiKey state and setter
3. `src/components/SettingsMenu/SettingsMenu.tsx` - Add API key input UI
4. `src/hooks/useChat.ts` - Pass settings to IPC
5. `electron/cliToolManager.ts` - Add zai-glm tool config and buildArgs case
6. `electron/envUtils.ts` - Update getAugmentedEnv to accept settings and map z.ai vars
7. `electron/main/index.ts` - Update IPC handlers to receive settings
8. `/Users/david/Documents/Projects/bmadboard/config.json` - Add tool defaults

## Notes

- The implementation reuses existing Claude Code CLI with custom environment
- No new CLI installation required for users
- All existing session management and streaming logic is reused
- The z.ai API is fully compatible with Anthropic's message format
- API key is securely stored in bmadboard's persist storage (not in git)
- Environment variables are set per-process when spawning Claude CLI
