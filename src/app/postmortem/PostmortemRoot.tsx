'use client'

import dynamic from 'next/dynamic'

// Hands are shuffled at random, so skip server rendering to avoid a hydration mismatch.
const PostmortemGame = dynamic(() => import('./PostmortemGame').then(m => m.PostmortemGame), { ssr: false })

export function PostmortemRoot() {
  return <PostmortemGame />
}
