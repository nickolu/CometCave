'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { useMemo } from 'react'

import { GhostButton, PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import {
  LAST_ANTE_MEMORY_MAX_DISCARDS,
  LAST_ANTE_MEMORY_MAX_PER_HAND,
  LAST_ANTE_REROLLS_BEHIND,
  LAST_ANTE_ROUNDS_BEHIND,
} from '@/app/comet-cards/domain/daily/constants'
import { countAllocated , summariseJokerMemory } from '@/app/comet-cards/domain/daily/memories'
import { getRememberableHands } from '@/app/comet-cards/domain/daily/remembered-hands'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { pokerHands } from '@/app/comet-cards/domain/hand/hands'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useGameState } from '@/app/comet-cards/useGameState'

import { ViewTemplate } from './view-template'

const mono = { fontFamily: 'var(--cc-font-mono)' as const }

function BossBanner() {
  const { game } = useGameState()
  const round = game.rounds[game.roundIndex]
  const boss = bossBlinds.find(blind => blind.name === round.bossBlindName)
  if (!boss) return null

  return (
    <div
      style={{
        border: '1px solid var(--cc-pink-border)',
        background: 'var(--cc-pink-bg)',
        borderRadius: 10,
        padding: '12px 16px',
      }}
    >
      <div style={{ ...mono, fontSize: 10, letterSpacing: 2, opacity: 0.6, textTransform: 'uppercase' }}>
        Waiting for you
      </div>
      <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: 'var(--cc-pink)', marginTop: 4 }}>
        {boss.name}
      </div>
      <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, lineHeight: 1.45 }}>
        {boss.description}
      </div>
    </div>
  )
}

/**
 * One hand type the player can claim to have played, with the count they are
 * claiming. Disabled counts are not shown at all — a deck that cannot make a
 * Full House never offers to remember one.
 */
function MemoryRow({
  label,
  count,
  max,
  scale,
  onChange,
}: {
  label: string
  count: number
  max: number
  scale: number
  onChange: (count: number) => void
}) {
  const reducedMotion = useReducedMotion()

  return (
    <div
      className="flex items-center gap-3"
      style={{ padding: '8px 12px', borderBottom: '1px solid var(--cc-panel-divider)' }}
    >
      <div style={{ flex: '1 1 auto', minWidth: 0 }}>
        <div style={{ ...mono, fontSize: 12, fontWeight: 600 }}>{label}</div>
        <div
          aria-hidden
          style={{
            height: 4,
            borderRadius: 2,
            marginTop: 6,
            background: 'rgba(255,255,255,0.08)',
            overflow: 'hidden',
          }}
        >
          <motion.div
            initial={false}
            animate={{ width: `${Math.min(100, (count / scale) * 100)}%` }}
            transition={reducedMotion ? { duration: 0 } : { duration: 0.2 }}
            style={{ height: '100%', background: 'var(--cc-mint)' }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2" style={{ flex: '0 0 auto' }}>
        <GhostButton
          aria-label={`Remember one fewer ${label}`}
          disabled={count <= 0}
          onClick={() => onChange(count - 1)}
          style={{ padding: '4px 10px', fontSize: 13 }}
        >
          −
        </GhostButton>
        <span
          aria-live="polite"
          style={{ ...mono, fontSize: 14, fontWeight: 700, minWidth: 26, textAlign: 'center' }}
        >
          {count}
        </span>
        <GhostButton
          aria-label={`Remember one more ${label}`}
          disabled={count >= max}
          onClick={() => onChange(count + 1)}
          style={{ padding: '4px 10px', fontSize: 13 }}
        >
          +
        </GhostButton>
      </div>
    </div>
  )
}

/**
 * The right-hand column: what the declared history does to the jokers the
 * player drafted. Jokers that do not accumulate are still listed, dimmed —
 * learning which jokers remember is most of the puzzle.
 */
function JokerCharges() {
  const { game } = useGameState()

  const summaries = useMemo(() => {
    const declaration = {
      hands: game.lastAnte?.allocation ?? {},
      discards: game.lastAnte?.discardsRemembered ?? 0,
    }
    return game.jokers.map(joker => summariseJokerMemory(game, declaration, joker.id))
  }, [game])

  if (game.jokers.length === 0) {
    return (
      <div style={{ ...mono, fontSize: 11, opacity: 0.45, padding: '14px 12px', lineHeight: 1.6 }}>
        You drafted no jokers. History with nothing to remember it is just time passing.
      </div>
    )
  }

  return (
    <div>
      {game.jokers.map((joker, index) => {
        const definition = jokers[joker.jokerId]
        const summary = summaries[index]
        const inert = !summary || summary.inert

        // A joker can gain on more than one axis at once, so show them all.
        const parts: string[] = []
        if (summary && !summary.inert) {
          if (summary.addMult !== 0) parts.push(`${summary.addMult > 0 ? '+' : ''}${summary.addMult} Mult`)
          if (Math.abs(summary.xMult - 1) > 1e-9) parts.push(`x${summary.xMult.toFixed(2)} Mult`)
          if (summary.chips !== 0) parts.push(`${summary.chips > 0 ? '+' : ''}${summary.chips} Chips`)
          if (summary.levels !== 0) parts.push(`${summary.levels > 0 ? '+' : ''}${summary.levels} lvl`)
          if (summary.sellValue !== 0) parts.push(`${summary.sellValue > 0 ? '+' : ''}$${summary.sellValue} sell`)
        }

        const lost =
          !!summary &&
          (summary.addMult < 0 ||
            summary.chips < 0 ||
            summary.levels < 0 ||
            summary.xMult < 1 - 1e-9)

        return (
          <div
            key={joker.id}
            className="flex items-baseline justify-between gap-3"
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--cc-panel-divider)',
              opacity: inert ? 0.4 : 1,
            }}
          >
            <span style={{ ...mono, fontSize: 12, fontWeight: 600 }}>{definition?.name}</span>
            <span
              style={{
                ...mono,
                fontSize: 12,
                fontWeight: 700,
                color: lost
                  ? 'var(--cc-pink)'
                  : inert
                    ? 'var(--cc-text-default)'
                    : 'var(--cc-mint)',
                whiteSpace: 'nowrap',
                textAlign: 'right',
              }}
            >
              {inert ? '—' : parts.join(' · ')}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function MemoriesView() {
  const isLandscape = useLandscapeMobile()
  const autoFocusRef = useAutoFocus()
  const { game } = useGameState()

  const lastAnte = game.lastAnte
  const allocation = lastAnte?.allocation ?? {}
  const budget = lastAnte?.memoryBudget ?? 0
  const discards = lastAnte?.discardsRemembered ?? 0
  // Hands and discards share one budget.
  const spent = countAllocated(allocation) + discards
  const remaining = budget - spent

  const rememberable = useMemo(() => getRememberableHands(game), [game])

  if (!lastAnte) return null

  return (
    <ViewTemplate
      sidebarContentTop={
        <div className="flex flex-col gap-3">
          <BossBanner />
          <Panel title="What they remember">
            <JokerCharges />
          </Panel>
        </div>
      }
    >
      <div
        ref={autoFocusRef}
        className="cc-scroll flex flex-col"
        style={{ gap: 16, padding: isLandscape ? 12 : 20, height: '100%', overflowY: 'auto' }}
      >
        <div>
          <h1
            style={{
              fontSize: isLandscape ? 22 : 30,
              fontWeight: 200,
              letterSpacing: -0.5,
              margin: 0,
            }}
          >
            How did you get here?
          </h1>
          <p style={{ fontSize: 13, opacity: 0.65, marginTop: 8, maxWidth: 520, lineHeight: 1.55 }}>
            You have played a long run to reach this table. Say what was in it. Your jokers have
            been keeping count all along — they will remember whatever you tell them.
          </p>
        </div>

        <div className="flex items-baseline justify-between gap-3">
          <span style={{ ...mono, fontSize: 10, letterSpacing: 2, opacity: 0.55, textTransform: 'uppercase' }}>
            Past spent
          </span>
          <span
            aria-live="polite"
            style={{
              ...mono,
              fontSize: 15,
              fontWeight: 700,
              color: remaining === 0 ? 'var(--cc-mint)' : 'var(--cc-text-default)',
            }}
          >
            {spent} / {budget}
          </span>
        </div>

        <Panel title="Hands you played">
          {rememberable.map(handId => (
            <MemoryRow
              key={handId}
              label={pokerHands[handId].name}
              count={allocation[handId] ?? 0}
              max={Math.min(LAST_ANTE_MEMORY_MAX_PER_HAND, (allocation[handId] ?? 0) + remaining)}
              scale={LAST_ANTE_MEMORY_MAX_PER_HAND}
              onChange={count => eventEmitter.emit({ type: 'MEMORY_ALLOCATED', handId, count })}
            />
          ))}
        </Panel>

        <Panel title="Hands you threw away" subtitle="from the same budget">
          <MemoryRow
            label="Discards"
            count={discards}
            max={Math.min(LAST_ANTE_MEMORY_MAX_DISCARDS, discards + remaining)}
            scale={LAST_ANTE_MEMORY_MAX_DISCARDS}
            onChange={count => eventEmitter.emit({ type: 'DISCARDS_REMEMBERED', count })}
          />
        </Panel>

        <div
          style={{
            ...mono,
            fontSize: 11,
            opacity: 0.45,
            lineHeight: 1.7,
            borderLeft: '2px solid var(--cc-panel-divider)',
            paddingLeft: 12,
          }}
        >
          However you played it, you survived {LAST_ANTE_ROUNDS_BEHIND} antes to sit down here and
          rerolled {LAST_ANTE_REROLLS_BEHIND} shops on the way. Whatever your jokers made of that is
          already counted.
        </div>

        <div className="flex flex-wrap items-center gap-3" style={{ paddingBottom: 8 }}>
          <PrimaryButton onClick={() => eventEmitter.emit({ type: 'MEMORIES_CONFIRMED' })}>
            Begin the last ante
          </PrimaryButton>
          {remaining > 0 && (
            <span style={{ ...mono, fontSize: 11, opacity: 0.5 }}>
              {remaining} {remaining === 1 ? 'hand' : 'hands'} unspent — they do not carry.
            </span>
          )}
        </div>
      </div>
    </ViewTemplate>
  )
}
