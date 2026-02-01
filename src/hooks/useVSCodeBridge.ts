import { useState, useCallback, useEffect } from 'react'

export interface VSCodeTab {
  fileName: string
  filePath: string
  language: string
  content: string
  lineCount: number
  isDirty: boolean
}

export interface VSCodeTabsResponse {
  tabs: VSCodeTab[]
  activeTab: VSCodeTab | null
}

export interface BridgeConnectionState {
  online: boolean
  error: string | null
  lastChecked: number
}

const DEFAULT_BRIDGE_URL = 'http://localhost:34152'

export function useVSCodeBridge() {
  const [connectionState, setConnectionState] = useState<BridgeConnectionState>({
    online: false,
    error: null,
    lastChecked: 0
  })
  const [tabs, setTabs] = useState<VSCodeTabsResponse | null>(null)

  // Test bridge connection
  const testBridge = useCallback(async (bridgeUrl?: string): Promise<boolean> => {
    const url = bridgeUrl || DEFAULT_BRIDGE_URL
    try {
      const response = await fetch(`${url}/health`, {
        signal: AbortSignal.timeout(3000)
      })
      const online = response.ok
      setConnectionState({
        online,
        error: online ? null : `Bridge returned ${response.status}`,
        lastChecked: Date.now()
      })
      return online
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      setConnectionState({
        online: false,
        error: errorMessage,
        lastChecked: Date.now()
      })
      return false
    }
  }, [])

  // Fetch open tabs from VSCode bridge
  const fetchTabs = useCallback(async (bridgeUrl?: string): Promise<VSCodeTabsResponse | null> => {
    const url = bridgeUrl || DEFAULT_BRIDGE_URL
    try {
      console.log('Fetching tabs from:', `${url}/tabs`)
      const response = await fetch(`${url}/tabs`, {
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      })
      console.log('Response status:', response.status, 'ok:', response.ok)

      if (!response.ok) {
        const text = await response.text()
        console.error('Error response:', text)
        throw new Error(`Bridge returned ${response.status}: ${text}`)
      }

      const responseData = await response.json()
      console.log('Raw tabs response:', responseData)

      // VSCode bridge wraps response in { success, data } format
      if (!responseData.success || !responseData.data) {
        throw new Error(responseData.error || 'Invalid response from bridge')
      }

      const data: VSCodeTabsResponse = {
        tabs: responseData.data.tabs || [],
        activeTab: responseData.data.activeTab || null
      }

      console.log('Parsed tabs data:', data)
      setTabs(data)
      // Update connection state to online on successful fetch
      setConnectionState({
        online: true,
        error: null,
        lastChecked: Date.now()
      })
      return data
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Fetch tabs error:', errorMessage)
      setConnectionState({
        online: false,
        error: errorMessage,
        lastChecked: Date.now()
      })
      return null
    }
  }, [])

  // Format tabs as text for AI prompt
  const formatTabsAsText = useCallback((tabsResponse: VSCodeTabsResponse): string => {
    const { tabs, activeTab } = tabsResponse
    let text = `Open Tabs (${tabs.length}):\n`

    tabs.forEach((tab, index) => {
      const isActive = activeTab && tab.filePath === activeTab.filePath
      text += `  ${index + 1}. ${isActive ? '*ACTIVE* ' : ''}${tab.fileName}`
      if (tab.isDirty) text += ' [unsaved]'
      text += `\n`
      text += `     Language: ${tab.language}\n`
      text += `     Lines: ${tab.lineCount}\n`
    })

    if (activeTab) {
      text += `\nActive Tab Content:\n`
      text += `File: ${activeTab.fileName}\n`
      text += `Language: ${activeTab.language}\n`
      text += `--- Content Start ---\n`
      text += activeTab.content
      text += `\n--- Content End ---\n`
    } else {
      text += `\nNo active tab.\n`
    }

    return text
  }, [])

  // Auto-test connection on mount
  useEffect(() => {
    testBridge()
  }, [testBridge])

  return {
    connectionState,
    tabs,
    testBridge,
    fetchTabs,
    formatTabsAsText
  }
}
