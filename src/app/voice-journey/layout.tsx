import { Fredoka, Nunito } from 'next/font/google'

import type { Metadata } from 'next'
import type React from 'react'

/**
 * This page keeps the fonts it was designed with rather than the cave's.
 * It is not a game on the arcade floor — it is one child's practice tracker,
 * unlisted and unlinked, so the shared chrome would only be in the way.
 */
const fredoka = Fredoka({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-voice-display',
  display: 'swap',
})

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-voice-body',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'My Voice Journey',
  description: 'A singing practice tracker.',
  // Unlisted, not secret — but there is no reason for it to turn up in search.
  robots: { index: false, follow: false },
}

export default function VoiceJourneyLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${fredoka.variable} ${nunito.variable}`}>{children}</div>
}
