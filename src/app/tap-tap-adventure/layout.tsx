'use client'

import localFont from 'next/font/local'

// Abril Fatface is the playbill fat-face of the Paper Stage: the Didone a
// Victorian theatre bill was set in. Self-hosted like every other face (see
// src/app/fonts/README.md); the variable is read by the `font-playbill`
// Tailwind family inside `.paper-stage`.
const playbill = localFont({
  src: [
    { path: '../fonts/abril-fatface-400-latin.woff2', weight: '400' },
    { path: '../fonts/abril-fatface-400-latin-ext.woff2', weight: '400' },
  ],
  variable: '--font-playbill',
  display: 'swap',
})

// The route is immersive (see IMMERSIVE_ROUTES in src/components/layout-shell.tsx):
// the theatre owns the whole window and carries its own door back to the cave.
export default function TapTapAdventureLayout({ children }: { children: React.ReactNode }) {
  return <div className={`paper-stage ${playbill.variable} min-h-[100dvh] w-full`}>{children}</div>
}
