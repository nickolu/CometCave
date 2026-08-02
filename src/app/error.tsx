'use client'

import { useEffect } from 'react'
import { ChunkyButton } from '@/components/ui/chunky-button'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-6 text-center">
      <div className="text-8xl font-bold text-on-surface/10 select-none mb-2">!</div>
      <h1 className="text-2xl font-bold text-on-surface mb-3">
        The cave is sleeping…
      </h1>
      <p className="text-on-surface/50 text-sm max-w-sm mb-8">
        Something stirred in the dark and the lights went out. It may wake on its own — or you can try calling it back.
      </p>
      <ChunkyButton variant="secondary" size="md" onClick={reset}>
        Try again
      </ChunkyButton>
    </div>
  )
}
