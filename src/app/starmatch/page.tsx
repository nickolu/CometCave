import StarmatchGame from './StarmatchGame'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Starmatch — CometCave',
  description: 'Find the one symbol that appears in both star charts. The faster player wins the point.',
}

export default function StarmatchPage() {
  return <StarmatchGame />
}
