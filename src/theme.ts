'use client'

import { createTheme } from '@mui/material/styles'

// MUI theme aligned to the cosmic-chunky design system tokens.
// All values reference CSS custom properties from globals.css so MUI
// components stay in sync with the Tailwind-based design system.
//
// Decision (issue #536): MUI stays temporarily — it's used across 18 files
// in Chat Room, Oracle, and Daily Card Game. Each Phase 6 per-game refresh
// will migrate MUI components to Radix/shadcn equivalents. Once all games
// are migrated, MUI + Emotion dependencies can be removed entirely.

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: 'var(--ds-primary)',
    },
    secondary: {
      main: 'var(--ds-secondary)',
    },
    error: {
      main: 'var(--ds-error)',
    },
    background: {
      default: 'var(--surface)',
      paper: 'var(--surface-variant)',
    },
    text: {
      primary: 'var(--on-surface)',
      secondary: 'var(--on-surface-variant)',
    },
  },
  typography: {
    fontFamily: 'var(--font-body), "Be Vietnam Pro", Arial, sans-serif',
    h1: {
      fontFamily: 'var(--font-headline)',
      fontSize: 'var(--text-headline-lg-size)',
      fontWeight: 800,
      lineHeight: 1.2,
    },
    h2: {
      fontFamily: 'var(--font-headline)',
      fontSize: 'var(--text-headline-md-size)',
      fontWeight: 800,
      lineHeight: 1.2,
    },
    body1: {
      fontSize: 'var(--text-body-md-size)',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: 'var(--text-body-md-size)',
      lineHeight: 1.6,
    },
  },
  shape: {
    borderRadius: 16, // ~var(--radius-sm) = 1rem
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-sm)',
          textTransform: 'none' as const,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderRadius: 'var(--radius-sm)',
          backgroundImage: 'none', // remove MUI's default gradient overlay
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 'var(--radius-lg)',
          backgroundColor: 'var(--surface-container-high)',
        },
      },
    },
  },
})
