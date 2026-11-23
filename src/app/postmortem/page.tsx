import { PostmortemRoot } from './PostmortemRoot'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Postmortem | CometCave',
  description: 'Match cause cards to outage stories and learn the 38 causal factors.',
}

export default function PostmortemPage() {
  return (
    <div className="fixed inset-0 z-40">
      <PostmortemRoot />
    </div>
  )
}
