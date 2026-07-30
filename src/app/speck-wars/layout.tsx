import type { Metadata, Viewport } from 'next'
import type React from 'react'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'Speck Wars | CometCave',
  description: 'A real-time strategy micro-game. Command your specks, capture outposts, and destroy the enemy base. Play the 10-level campaign or go free-play in skirmish mode.',
}

export default function SpeckWarsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
