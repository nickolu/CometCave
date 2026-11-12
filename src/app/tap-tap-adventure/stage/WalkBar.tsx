'use client'

/**
 * The footlights: the one Comet Mint control in the theatre.
 *
 * Tap to take a step, hold to keep walking (the pointer handlers are the
 * game's own; this component only draws them). While the server is deciding
 * what happens next the bar says so in place; while auto-walking it pulses.
 */
import * as React from 'react'

import { cn } from '@/lib/utils'

export interface WalkBarProps {
  distance: number
  pending: boolean
  autoWalking: boolean
  disabled?: boolean
  onClick: () => void
  onPointerDown: (e: React.PointerEvent) => void
  onPointerUp: (e: React.PointerEvent) => void
  /** Plain words when the last step failed; shown under the label. */
  error?: string | null
  /** Rendered above the bar (floating resource deltas). */
  overlay?: React.ReactNode
  className?: string
}

export function WalkBar({ distance, pending, autoWalking, disabled, onClick, onPointerDown, onPointerUp, error, overlay, className }: WalkBarProps) {
  const label = pending ? 'The scene changes' : autoWalking ? 'Walking' : distance === 0 ? 'Set out' : 'Walk'
  const sub = pending
    ? 'something happens on the road…'
    : autoWalking
      ? 'let go to stop'
      : error
        ? error
        : 'tap to step · hold to keep walking'

  return (
    <div className={cn('relative', className)}>
      {overlay && <div className="pointer-events-none absolute inset-x-0 -top-2 z-10 flex justify-center">{overlay}</div>}
      <button
        type="button"
        onClick={onClick}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onPointerCancel={onPointerUp}
        disabled={disabled || pending}
        aria-label={pending ? 'Waiting for what happens next' : 'Walk: tap to step, hold to keep walking'}
        aria-busy={pending}
        className={cn(
          'flex h-[56px] w-full select-none md:h-[76px] flex-col items-center justify-center rounded-full border-4 border-surface-container-lowest touch-none',
          'bg-ps-footlight text-ps-on-footlight shadow-button',
          'transition-[transform,box-shadow] duration-100 ease-out',
          'hover:shadow-glow-primary',
          'active:translate-y-[var(--press-offset-button)] active:shadow-pressed motion-reduce:active:translate-y-0',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ds-primary',
          'disabled:cursor-wait disabled:translate-y-0 disabled:shadow-pressed disabled:opacity-80',
          autoWalking && 'ps-footlight-pulse'
        )}
      >
        <span className="font-playbill text-xl uppercase leading-none tracking-widest md:text-3xl">
          {label}
          {pending && <span className="ml-1 inline-block animate-pulse motion-reduce:animate-none">…</span>}
        </span>
        <span
          className={cn('mt-1.5 font-label text-xs font-bold uppercase leading-none tracking-widest sm:text-xs', error && !pending && !autoWalking ? 'text-ds-error' : 'opacity-80')}
          role={error && !pending && !autoWalking ? 'alert' : undefined}
        >
          {sub}
        </span>
      </button>
    </div>
  )
}
