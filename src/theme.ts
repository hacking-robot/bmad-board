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
      main: '#E97451',
      light: '#F09A7C',
      dark: '#D4563A'
    },
    secondary: {
      main: '#8B5CF6',
      light: '#A78BFA',
      dark: '#7C3AED'
    },
    background: {
      default: '#FAFAFA',
      paper: '#FFFFFF'
    },
    text: {
      primary: '#1A1A1A',
      secondary: '#6B7280'
    },
    divider: '#E5E5E5'
  }
})

export const darkTheme = createTheme({
  ...commonOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#E97451',
      light: '#F09A7C',
      dark: '#D4563A'
    },
    secondary: {
      main: '#A78BFA',
      light: '#C4B5FD',
      dark: '#8B5CF6'
    },
    background: {
      default: '#0D0D0D',
      paper: '#1A1A1A'
    },
    text: {
      primary: '#E5E5E5',
      secondary: '#A3A3A3'
    },
    divider: '#2E2E2E'
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
