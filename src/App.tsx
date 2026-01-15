import { useMemo } from 'react'
import { ThemeProvider, CssBaseline, Box, CircularProgress } from '@mui/material'
import { useStore } from './store'
import { lightTheme, darkTheme } from './theme'
import Header from './components/Header/Header'
import Board from './components/Board/Board'
import StoryDialog from './components/StoryDialog/StoryDialog'
import WelcomeDialog from './components/WelcomeDialog/WelcomeDialog'
import CommandPalette from './components/CommandPalette'
import KeyboardShortcuts from './components/KeyboardShortcuts'

export default function App() {
  const hasHydrated = useStore((state) => state._hasHydrated)
  const themeMode = useStore((state) => state.themeMode)
  const projectPath = useStore((state) => state.projectPath)

  const theme = useMemo(
    () => (themeMode === 'dark' ? darkTheme : lightTheme),
    [themeMode]
  )

  // Show loading while hydrating persisted state
  if (!hasHydrated) {
    return (
      <ThemeProvider theme={lightTheme}>
        <CssBaseline />
        <Box
          sx={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default'
          }}
        >
          <CircularProgress />
        </Box>
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <CommandPalette />
      <KeyboardShortcuts />
      <Box
        sx={{
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default',
          overflow: 'hidden'
        }}
      >
        {!projectPath ? (
          <WelcomeDialog />
        ) : (
          <>
            <Header />
            <Board />
            <StoryDialog />
          </>
        )}
      </Box>
    </ThemeProvider>
  )
}
