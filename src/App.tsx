import { useMemo } from 'react'
import { ThemeProvider, CssBaseline, Box } from '@mui/material'
import { useStore } from './store'
import { lightTheme, darkTheme } from './theme'
import Header from './components/Header/Header'
import Board from './components/Board/Board'
import StoryDialog from './components/StoryDialog/StoryDialog'
import WelcomeDialog from './components/WelcomeDialog/WelcomeDialog'

export default function App() {
  const themeMode = useStore((state) => state.themeMode)
  const projectPath = useStore((state) => state.projectPath)

  const theme = useMemo(
    () => (themeMode === 'dark' ? darkTheme : lightTheme),
    [themeMode]
  )

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.default'
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
