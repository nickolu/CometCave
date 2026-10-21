import MeteorCoinsApp from './MeteorCoinsApp'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Meteor Coins — CometCave',
  description:
    'Time your drops from a swinging arm and push a heap of coins over the edge. Fifty coins, one score.',
}

export default function MeteorCoinsPage() {
  return <MeteorCoinsApp />
}
