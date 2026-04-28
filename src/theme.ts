'use client'

import { createTheme } from '@mui/material/styles'

// MUI theme aligned to the cosmic-chunky design system tokens.
// MUI's createTheme requires actual color values (not CSS vars), so we
// duplicate the hex values from globals.css here. If a token changes in
// globals.css, update the matching value below.
//
// Decision (issue #536): KEEP MUI temporarily. It's used across 18 files
// in Chat Room, Oracle, and Daily Card Game. Each Phase 6 per-game refresh
// will migrate MUI components to Radix/shadcn equivalents. Once all games
// are migrated, MUI + Emotion dependencies can be removed entirely.

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#00ffc2',           // --ds-primary
      contrastText: '#003b2e',   // --on-primary
    },
    secondary: {
      main: '#14d1ff',           // --ds-secondary
      contrastText: '#003544',   // --on-secondary
    },
    error: {
      main: '#ff5449',           // --ds-error
      contrastText: '#690005',   // --on-error
    },
    background: {
      default: '#0e0f1a',        // --surface
      paper: '#1a1c2e',          // --surface-variant
    },
    text: {
      primary: '#e4e1d6',        // --on-surface
      secondary: '#c4c5d0',      // --on-surface-variant
    },
  },
  typography: {
    fontFamily: '"Be Vietnam Pro", Arial, sans-serif', // --font-body
    h1: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',   // --font-headline
      fontSize: '2.5rem',                              // --text-headline-lg-size
      fontWeight: 800,
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: '"Plus Jakarta Sans", sans-serif',   // --font-headline
      fontSize: '2rem',                                // --text-headline-md-size
      fontWeight: 800,
      lineHeight: 1.2,
    },
    body1: {
      fontSize: '1rem',   // --text-body-md-size
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '1rem',   // --text-body-md-size
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 16, // ~1rem (--radius-sm)
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 16, // --radius-sm
          textTransform: 'none' as const,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 16, // --radius-sm
          backgroundImage: 'none', // remove MUI's default gradient overlay
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 32, // --radius-lg
          backgroundColor: '#1e2038', // --surface-container-high
        },
      },
    },
  },
})
