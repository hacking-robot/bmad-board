import { createTheme, ThemeOptions } from '@mui/material/styles'

const commonOptions: ThemeOptions = {
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h1: {
      fontSize: '2rem',
      fontWeight: 600
    },
    h2: {
      fontSize: '1.5rem',
      fontWeight: 600
    },
    h3: {
      fontSize: '1.25rem',
      fontWeight: 600
    },
    h4: {
      fontSize: '1.125rem',
      fontWeight: 600
    },
    h5: {
      fontSize: '1rem',
      fontWeight: 600
    },
    h6: {
      fontSize: '0.875rem',
      fontWeight: 600
    },
    body1: {
      fontSize: '0.9375rem'
    },
    body2: {
      fontSize: '0.875rem'
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)'
        }
      }
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 12
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 500
        }
      }
    }
  }
}

export const lightTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0'
    },
    secondary: {
      main: '#7c4dff',
      light: '#b47cff',
      dark: '#3f1dcb'
    },
    background: {
      default: '#f5f7fa',
      paper: '#ffffff'
    },
    text: {
      primary: '#1a1a2e',
      secondary: '#6b7280'
    },
    divider: '#e5e7eb'
  }
})

export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#60a5fa',
      light: '#93c5fd',
      dark: '#2563eb'
    },
    secondary: {
      main: '#a78bfa',
      light: '#c4b5fd',
      dark: '#7c3aed'
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b'
    },
    text: {
      primary: '#f1f5f9',
      secondary: '#94a3b8'
    },
    divider: '#334155'
  },
  components: {
    ...commonOptions.components,
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.3), 0 1px 2px rgba(0,0,0,0.2)',
          backgroundImage: 'none'
        }
      }
    }
  }
})
