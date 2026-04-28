const config = {
  darkMode: ['class'],
  content: [
    // Scanning all `.ts` can be surprisingly expensive and can accidentally
    // traverse into `node_modules` (e.g. via symlinks). Most Tailwind classes
    // live in JSX/TSX/MDX templates, so keep the glob tight.
    './src/**/*.{jsx,tsx,mdx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        /* ── Design-system semantic colors (from globals.css :root) ── */
        'ds-surface': 'var(--surface)',
        'surface-dim': 'var(--surface-dim)',
        'surface-bright': 'var(--surface-bright)',
        'surface-variant': 'var(--surface-variant)',
        'surface-container': 'var(--surface-container)',
        'surface-container-lowest': 'var(--surface-container-lowest)',
        'surface-container-low': 'var(--surface-container-low)',
        'surface-container-high': 'var(--surface-container-high)',
        'surface-container-highest': 'var(--surface-container-highest)',
        'surface-tint': 'var(--surface-tint)',
        'ds-background': 'var(--ds-background)',
        'on-background': 'var(--on-background)',
        'ds-primary': 'var(--ds-primary)',
        'on-primary': 'var(--on-primary)',
        'primary-container': 'var(--primary-container)',
        'on-primary-container': 'var(--on-primary-container)',
        'primary-fixed': 'var(--primary-fixed)',
        'primary-fixed-dim': 'var(--primary-fixed-dim)',
        'on-primary-fixed': 'var(--on-primary-fixed)',
        'on-primary-fixed-variant': 'var(--on-primary-fixed-variant)',
        'inverse-primary': 'var(--inverse-primary)',
        'ds-secondary': 'var(--ds-secondary)',
        'on-secondary': 'var(--on-secondary)',
        'secondary-container': 'var(--secondary-container)',
        'on-secondary-container': 'var(--on-secondary-container)',
        'secondary-fixed': 'var(--secondary-fixed)',
        'secondary-fixed-dim': 'var(--secondary-fixed-dim)',
        'on-secondary-fixed': 'var(--on-secondary-fixed)',
        'on-secondary-fixed-variant': 'var(--on-secondary-fixed-variant)',
        'ds-tertiary': 'var(--ds-tertiary)',
        'on-tertiary': 'var(--on-tertiary)',
        'tertiary-container': 'var(--tertiary-container)',
        'on-tertiary-container': 'var(--on-tertiary-container)',
        'tertiary-fixed': 'var(--tertiary-fixed)',
        'tertiary-fixed-dim': 'var(--tertiary-fixed-dim)',
        'on-tertiary-fixed': 'var(--on-tertiary-fixed)',
        'on-tertiary-fixed-variant': 'var(--on-tertiary-fixed-variant)',
        'ds-error': 'var(--ds-error)',
        'on-error': 'var(--on-error)',
        'error-container': 'var(--error-container)',
        'on-error-container': 'var(--on-error-container)',
        'ds-outline': 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
        'inverse-surface': 'var(--inverse-surface)',
        'inverse-on-surface': 'var(--inverse-on-surface)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',

        /* ── Legacy aliases — temporary, removed in issue #566 ────── */
        'space-black': 'var(--surface-dim)',
        'space-dark': 'var(--surface-container)',
        'space-grey': 'var(--surface-container-highest)',
        'space-purple': 'var(--surface-variant)',
        'space-purple-light': 'var(--on-surface-variant)',
        'space-blue': 'var(--surface-container-high)',
        'cream-white': 'var(--on-surface)',
        'space-gold': 'var(--ds-tertiary)',
        'grey-500': 'var(--outline)',

        /* ── shadcn/ui HSL-based colors (existing) ──────────────── */
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        chart: {
          1: 'hsl(var(--chart-1))',
          2: 'hsl(var(--chart-2))',
          3: 'hsl(var(--chart-3))',
          4: 'hsl(var(--chart-4))',
          5: 'hsl(var(--chart-5))',
        },
      },

      /* ── Spacing (from --space-* tokens) ─────────────────────── */
      spacing: {
        'unit': 'var(--space-unit)',
        'stack-gap': 'var(--space-stack-gap)',
        'gutter': 'var(--space-gutter)',
        'margin': 'var(--space-margin)',
        'component-px': 'var(--space-component-padding-x)',
        'component-py': 'var(--space-component-padding-y)',
      },

      /* ── Border radius ───────────────────────────────────────── */
      borderRadius: {
        // shadcn
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        // Design-system semantic
        'ds-sm': 'var(--radius-sm)',
        'ds-lg': 'var(--radius-lg)',
        'ds-xl': 'var(--radius-xl)',
        'ds-full': 'var(--radius-full)',
      },

      /* ── Font family ─────────────────────────────────────────── */
      fontFamily: {
        headline: 'var(--font-headline)',
        body: 'var(--font-body)',
        label: 'var(--font-label)',
      },

      /* ── Font size (semantic text styles) ─────────────────────── */
      fontSize: {
        'headline-lg': ['var(--text-headline-lg-size)', {
          lineHeight: 'var(--text-headline-lg-line-height)',
          letterSpacing: 'var(--text-headline-lg-tracking)',
          fontWeight: 'var(--text-headline-lg-weight)',
        }],
        'headline-md': ['var(--text-headline-md-size)', {
          lineHeight: 'var(--text-headline-md-line-height)',
          fontWeight: 'var(--text-headline-md-weight)',
        }],
        'body-lg': ['var(--text-body-lg-size)', {
          lineHeight: 'var(--text-body-lg-line-height)',
          fontWeight: 'var(--text-body-lg-weight)',
        }],
        'body-md': ['var(--text-body-md-size)', {
          lineHeight: 'var(--text-body-md-line-height)',
          fontWeight: 'var(--text-body-md-weight)',
        }],
        'label-caps': ['var(--text-label-caps-size)', {
          lineHeight: 'var(--text-label-caps-line-height)',
          letterSpacing: 'var(--text-label-caps-tracking)',
          fontWeight: 'var(--text-label-caps-weight)',
        }],
      },

      /* ── Box shadow ──────────────────────────────────────────── */
      boxShadow: {
        'card': 'var(--shadow-card)',
        'hero': 'var(--shadow-hero)',
        'button': 'var(--shadow-button)',
        'button-sm': 'var(--shadow-button-sm)',
        'pressed': 'var(--shadow-pressed)',
        'glow-primary': 'var(--shadow-glow-primary)',
        'glow-secondary': 'var(--shadow-glow-secondary)',
        'glow-tertiary': 'var(--shadow-glow-tertiary)',
        'glow-error': 'var(--shadow-glow-error)',
        'rim-top': 'var(--shadow-rim-top)',
        'rim-inset-deep': 'var(--shadow-rim-inset-deep)',
      },

      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        'float-up': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(-40px) scale(0.8)' },
        },
        'crit-flash': {
          '0%': { opacity: '0.7' },
          '100%': { opacity: '0' },
        },
        'combo-pulse': {
          '0%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(251, 146, 60, 0.7)' },
          '50%': { transform: 'scale(1.15)', boxShadow: '0 0 12px 4px rgba(251, 146, 60, 0.4)' },
          '100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgba(251, 146, 60, 0)' },
        },
        'particle-burst': {
          '0%':   { opacity: '1', transform: 'translate(0, 0) scale(1)' },
          '80%':  { opacity: '0.6', transform: 'translate(var(--tx), var(--ty)) scale(0.5)' },
          '100%': { opacity: '0', transform: 'translate(var(--tx), var(--ty)) scale(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'float-up': 'float-up 1s ease-out forwards',
        'crit-flash': 'crit-flash 0.5s ease-out forwards',
        'combo-pulse': 'combo-pulse 0.6s ease-out',
        'particle-burst': 'particle-burst 0.8s ease-out forwards',
      },
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  plugins: [require('tailwindcss-animate')],
}

export default config
