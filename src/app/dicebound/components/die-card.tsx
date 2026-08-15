'use client'

/**
 * The die card — the most important thing on the screen.
 *
 * It shows its work: the attempt, the difficulty it was judged at, every
 * modifier that applied and why, the raw d20, and how far over or under the
 * line it landed. All of it, always, even when the news is bad.
 *
 * That transparency is doing real work. The dungeon master is a model, and a
 * player who cannot see the arithmetic has no way to tell a fair ruling from a
 * flattering one — so the game would feel arbitrary exactly when it was being
 * most honest. Showing the DC *and* the reasons behind each modifier also
 * teaches the loop: mention his daughter and the number moves, and you can see
 * it move.
 *
 * The roll animation only ever plays on a card that has just arrived, and only
 * when the player has not asked for less motion. A transcript scrolled back
 * through is a record, not a performance.
 */
import { useEffect, useState } from 'react'

import { ATTRIBUTES, SKILLS } from '@/app/dicebound/domain/attributes'
import type { CheckEntry } from '@/app/dicebound/domain/campaign'
import { BAND_LABEL, type OutcomeBand } from '@/app/dicebound/domain/dice'

const TONE: Record<OutcomeBand, { text: string; border: string; glow: string }> = {
  'critical-success': {
    text: 'text-ds-tertiary',
    border: 'border-ds-tertiary/60',
    glow: 'shadow-[0_0_24px_-4px_var(--ds-tertiary)]',
  },
  'strong-success': {
    text: 'text-ds-primary',
    border: 'border-ds-primary/50',
    glow: '',
  },
  success: {
    text: 'text-ds-primary',
    border: 'border-ds-primary/30',
    glow: '',
  },
  failure: {
    text: 'text-on-surface-variant',
    border: 'border-outline',
    glow: '',
  },
  'strong-failure': {
    text: 'text-ds-error',
    border: 'border-ds-error/40',
    glow: '',
  },
  'critical-failure': {
    text: 'text-ds-error',
    border: 'border-ds-error/60',
    glow: 'shadow-[0_0_24px_-4px_var(--ds-error)]',
  },
}

const ROLL_MS = 700

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return true
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Tumbling numbers while the die settles. Decorative, and never announced.
 *
 * The face lives in state and is rolled by the interval rather than computed
 * during render — a component that calls `Math.random()` on the way out
 * produces a different die every time React happens to re-render it, which is
 * a genuinely confusing thing to watch.
 *
 * Returns null once settled, which is the signal to show the real roll.
 */
function useTumble(active: boolean): number | null {
  const [face, setFace] = useState<number | null>(active ? 20 : null)

  useEffect(() => {
    if (!active) return
    const interval = setInterval(() => setFace(1 + Math.floor(Math.random() * 20)), 60)
    const timer = setTimeout(() => {
      clearInterval(interval)
      setFace(null)
    }, ROLL_MS)
    return () => {
      clearInterval(interval)
      clearTimeout(timer)
    }
  }, [active])

  return face
}

export function DieCard({ entry, fresh = false }: { entry: CheckEntry; fresh?: boolean }) {
  const [animate] = useState(() => fresh && !prefersReducedMotion())
  const tumbling = useTumble(animate)
  const settled = tumbling === null

  const tone = TONE[entry.band]
  const shown = tumbling ?? entry.roll
  const skillName = entry.skill ? SKILLS[entry.skill].name : null
  // The struck-through die is aria-hidden, so the announcement has to carry it
  // in words — otherwise a screen reader user is told a 17 was rolled and never
  // told a 3 was thrown away, and the sighted card says more than the spoken one.
  const twiceSaid = entry.twice
    ? ` Rolled twice with ${entry.twice.direction}${entry.twice.reason ? `, ${entry.twice.reason}` : ''}, discarding ${entry.twice.discarded}.`
    : ''

  return (
    <div
      className={`rounded-ds-sm border-2 bg-surface-container-low px-4 py-3 transition-shadow duration-500 ${tone.border} ${settled ? tone.glow : ''}`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-label text-label-caps uppercase tracking-widest text-on-surface-variant">
          {entry.attempt}
        </p>
        <p className="shrink-0 text-xs text-on-surface-variant">
          DC {entry.dc} · {entry.dcLabel}
        </p>
      </div>

      <div className="mt-3 flex items-center gap-4">
        {/* The die itself. aria-hidden while tumbling so a screen reader is
            told the outcome once, at the end, rather than twenty times.

            When the die was thrown twice, the discarded one sits beside the
            kept one, struck through and dimmed. It is laid out as a plain flex
            row with no animation of its own, so it reads the same whether the
            card just arrived or is being scrolled back through under
            prefers-reduced-motion — the two-dice arrangement must not depend on
            the roll animation to make sense. A discarded 17 is the most
            interesting number on the card and it is never hidden. */}
        <div className="flex shrink-0 items-center gap-2">
          <div
            aria-hidden={!settled}
            className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-ds-sm border-2 bg-surface-container-high font-headline text-2xl font-extrabold tabular-nums ${tone.border} ${tone.text}`}
          >
            {shown}
          </div>
          {settled && entry.twice && (
            <div
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-ds-sm border border-outline-variant bg-surface-container font-headline text-base font-bold tabular-nums text-on-surface-variant line-through opacity-60"
            >
              {entry.twice.discarded}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className={`font-headline text-lg font-extrabold ${tone.text}`}>
            {settled ? BAND_LABEL[entry.band] : 'Rolling…'}
          </p>
          {settled && (
            <p className="text-sm text-on-surface-variant tabular-nums">
              {entry.roll}
              {entry.modifier >= 0 ? ' + ' : ' − '}
              {Math.abs(entry.modifier)} ={' '}
              <strong className="text-on-surface">{entry.total}</strong> vs {entry.dc}
              <span className="ml-2 opacity-70">
                ({entry.margin >= 0 ? '+' : ''}
                {entry.margin})
              </span>
            </p>
          )}
          {/* Deliberately not a modifier chip. Advantage has no number, and
              putting it in the row of ±values would invite the player — and the
              next person editing this — to think of it as one. */}
          {settled && entry.twice && (
            <p className="mt-0.5 text-xs text-on-surface-variant">
              <span className="font-semibold uppercase tracking-wide">
                {entry.twice.direction === 'advantage' ? 'Advantage' : 'Disadvantage'}
              </span>
              {entry.twice.reason ? ` · ${entry.twice.reason}` : ''}
            </p>
          )}
        </div>
      </div>

      {settled && entry.modifiers.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {entry.modifiers.map((modifier, index) => (
            <li
              key={`${modifier.label}-${index}`}
              className="rounded-full border border-outline-variant bg-surface-container px-2.5 py-1 text-xs text-on-surface-variant"
            >
              {modifier.label}{' '}
              <span
                className={`tabular-nums font-semibold ${
                  modifier.value > 0
                    ? 'text-ds-primary'
                    : modifier.value < 0
                      ? 'text-ds-error'
                      : 'text-on-surface-variant'
                }`}
              >
                {modifier.value >= 0 ? '+' : ''}
                {modifier.value}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Announced once, after the die settles, as a single sentence. */}
      <p className="sr-only" aria-live="polite">
        {settled
          ? `${entry.attempt}. ${skillName ?? ATTRIBUTES[entry.attribute].name} check, difficulty ${entry.dc}.${twiceSaid} Rolled ${entry.roll}, total ${entry.total}. ${BAND_LABEL[entry.band]}.`
          : ''}
      </p>
    </div>
  )
}
