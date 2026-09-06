import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Clusters — CometCave',
  description: 'Sixteen words hide four groups of four. A new puzzle every day.',
}

export default function ClustersLayout({ children }: { children: ReactNode }) {
  return <>{children}</>
}
