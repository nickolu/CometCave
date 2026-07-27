import type { Viewport } from 'next'
import type React from 'react'

export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default function SpeckWarsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
