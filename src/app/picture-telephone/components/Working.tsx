'use client'

import { useEffect, useRef } from 'react'

import { ChunkyButton } from '@/components/ui/chunky-button'

import type { WorkError } from '@/lib/picture-telephone/types'

interface WorkingProps {
  kind: 'image' | 'describe' | 'starter'
  name: string
  emoji?: string
  error: WorkError | null
  onRetry: () => void
}

/** Says who is busy and with what, never what is on the page. */
export function Working({ kind, name, emoji, error, onRetry }: WorkingProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    headingRef.current?.focus()
  }, [kind, name])

  const message =
    kind === 'image'
      ? 'Drawing…'
      : kind === 'starter'
        ? `${name} is thinking of something to draw…`
        : `${name} is squinting at the picture…`

  return (
    <section className="pt-center" aria-labelledby="pt-working-heading">
      <div className="pt-avatar" aria-hidden>
        {kind === 'image' ? '🖍️' : (emoji ?? '🤖')}
      </div>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        <h2 id="pt-working-heading" ref={headingRef} tabIndex={-1} className="pt-heading">
          {error ? 'That did not work' : message}
        </h2>
        {error ? <p className="pt-sub">{error.message || 'Something went wrong. Try again.'}</p> : <div className="pt-spinner" aria-hidden />}
      </div>
      {error && (
        <div className="pt-actions justify-center">
          <ChunkyButton size="lg" onClick={onRetry}>
            Try again
          </ChunkyButton>
        </div>
      )}
    </section>
  )
}
