import StageMap from './StageMap'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meteor Coins — CometCave',
  description:
    'Twelve coin-pusher machines. Time your drops from a swinging arm and push coins over the edge, one stage at a time.',
}

export default function MeteorCoinsPage() {
  return <StageMap />
}
