import CoinPusherApp from './CoinPusherApp'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coin Pusher — CometCave',
  description: 'Drop pucks onto a moving shelf and push the pile over the edge.',
}

export default function CoinPusherPage() {
  return <CoinPusherApp />
}
