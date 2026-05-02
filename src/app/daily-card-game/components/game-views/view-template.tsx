'use client'

import { useState } from 'react'

import { GhostButton } from '@/app/daily-card-game/components/cosmic/buttons'
import { Panel } from '@/app/daily-card-game/components/cosmic/panel'
import { Hands } from '@/app/daily-card-game/components/hands/hands'
import { Modal } from '@/app/daily-card-game/components/ui/modal'
import { Vouchers } from '@/app/daily-card-game/components/voucher/vouchers'
import { calculateAnte, getBlindDefinition } from '@/app/daily-card-game/domain/game/utils'
import { getInProgressBlind } from '@/app/daily-card-game/domain/round/blinds'
import { implementedTags as tags } from '@/app/daily-card-game/domain/tag/tags'
import { useGameState } from '@/app/daily-card-game/useGameState'

const monoLabel = {
  fontFamily: 'var(--cc-font-mono)',
  textTransform: 'uppercase' as const,
  letterSpacing: 2,
  fontSize: 10,
  opacity: 0.55,
}

function StatRow({
  label,
  value,
  accent,
}: {
  label: string
  value: string | number | bigint
  accent?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
      <span style={{ ...monoLabel, opacity: 0.6 }}>{label}</span>
      <span
        style={{
          fontFamily: 'var(--cc-font-mono)',
          fontSize: 12,
          fontWeight: 600,
          color: accent ?? 'var(--cc-text-default)',
        }}
      >
        {value.toString()}
      </span>
    </div>
  )
}

export function ViewTemplate({
  sidebarContentTop,
  sidebarContentBottom,
  children,
}: {
  sidebarContentTop?: React.ReactNode
  sidebarContentBottom?: React.ReactNode
  children: React.ReactNode
}) {
  const { game } = useGameState()
  const currentBlind = getInProgressBlind(game)
  const [showHands, setShowHands] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)

  const blindDefinition = currentBlind
    ? getBlindDefinition(currentBlind.type, game.rounds[game.roundIndex])
    : undefined
  const targetScore = currentBlind && blindDefinition
    ? calculateAnte(game.rounds[game.roundIndex].baseAnte, blindDefinition.anteMultiplier)
    : 0n

  return (
    <div className="relative">
      {/* Top stat strip — keeps every view aligned with gameplay */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-4"
        style={{
          padding: '12px 22px',
          borderBottom: '1px solid var(--cc-panel-divider)',
        }}
      >
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            color: 'var(--cc-mint)',
          }}
        >
          Cards
        </div>
        <div
          className="flex flex-wrap items-center gap-5"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            textTransform: 'uppercase',
          }}
        >
          <Stat label="Round" value={`${game.roundIndex + 1}/${game.rounds.length}`} />
          <Stat label="Money" value={`$${game.money}`} accent="var(--cc-gold)" />
          <Stat label="Hands" value={String(game.handsPlayed)} />
        </div>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(240px, 280px) minmax(0, 1fr)',
          gap: 18,
          padding: '14px 22px 22px',
          alignItems: 'start',
        }}
      >
        {/* Sidebar */}
        <aside id="game-sidebar" className="flex flex-col gap-4">
          {sidebarContentTop}

          <Panel title="Run Stats">
            <div
              className="flex flex-col"
              style={{
                gap: 6,
                padding: '12px 16px',
              }}
            >
              <StatRow label="Total Score" value={game.totalScore} accent="var(--cc-mint)" />
              <StatRow label="Money" value={`$${game.money}`} accent="var(--cc-gold)" />
              <StatRow label="Hands Played" value={game.handsPlayed} />
            </div>
            <div
              style={{
                padding: '8px 16px 14px',
                borderTop: '1px solid var(--cc-panel-divider)',
                display: 'flex',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              <GhostButton onClick={() => setShowHands(true)}>Show Hands</GhostButton>
              {game.vouchers.length > 0 && (
                <GhostButton onClick={() => setShowVouchers(true)}>Vouchers</GhostButton>
              )}
            </div>
          </Panel>

          {currentBlind && blindDefinition && (
            <Panel title="Current Blind">
              <div
                className="flex flex-col"
                style={{
                  gap: 8,
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--cc-mint)' }}>
                  {blindDefinition.name}
                </div>
                <StatRow
                  label="Score at Least"
                  value={targetScore}
                  accent="var(--cc-pink)"
                />
                <StatRow
                  label="Remaining Hands"
                  value={game.gamePlayState.remainingHands}
                  accent="var(--cc-mint)"
                />
                <StatRow
                  label="Remaining Discards"
                  value={game.gamePlayState.remainingDiscards}
                  accent="var(--cc-pink)"
                />
              </div>
            </Panel>
          )}

          {game.tags.length > 0 && (
            <Panel title="Tags">
              <div
                className="flex flex-wrap"
                style={{ gap: 6, padding: '12px 16px' }}
              >
                {game.tags.map(tag => (
                  <span
                    key={tag.id}
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      letterSpacing: 1.5,
                      padding: '4px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(94,234,212,0.25)',
                      color: 'var(--cc-mint)',
                    }}
                  >
                    {tags[tag.tagType]?.name ?? tag.tagType}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {sidebarContentBottom}

          <div
            style={{
              padding: '4px 16px',
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 9,
              letterSpacing: 1.5,
              opacity: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Seed · {game.gameSeed}
          </div>
        </aside>

        {/* Main */}
        <main id="game-content" className="min-w-0">
          {children}
        </main>
      </div>

      {showHands && (
        <Modal eyebrow="Show Hands" title="Poker Hands" onClose={() => setShowHands(false)}>
          <Hands pokerHandsState={game.pokerHands} />
        </Modal>
      )}
      {showVouchers && (
        <Modal eyebrow="Show Vouchers" title="Active Vouchers" onClose={() => setShowVouchers(false)}>
          <Vouchers vouchers={game.vouchers.map(voucher => voucher.type)} />
        </Modal>
      )}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <div style={{ opacity: 0.45, fontSize: 10 }}>{label}</div>
      <div
        style={{
          color: accent ?? 'var(--cc-text-default)',
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {value}
      </div>
    </div>
  )
}
