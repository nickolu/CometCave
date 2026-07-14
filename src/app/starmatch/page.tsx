import StarmatchGame from './StarmatchGame'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Starmatch — CometCave',
  description: 'Two star charts, one shared sign. Trace the twin before anyone else.',
}

export default function StarmatchPage() {
  return <StarmatchGame />
}
