'use client'

import { useState } from 'react'

import { GhostButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { Hands } from '@/app/comet-cards/components/hands/hands'
import { Modal } from '@/app/comet-cards/components/ui/modal'
import { Vouchers } from '@/app/comet-cards/components/voucher/vouchers'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { implementedTags as tags } from '@/app/comet-cards/domain/tag/tags'
import { useGameState } from '@/app/comet-cards/useGameState'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'

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
  const isLandscape = useLandscapeMobile()
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
    <div className="relative" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top stat strip — keeps every view aligned with gameplay */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-4"
        style={{
          padding: isLandscape ? '8px 12px' : '12px 22px',
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
          gridTemplateColumns: isLandscape ? '1fr' : 'minmax(240px, 280px) minmax(0, 1fr)',
          gap: 18,
          padding: isLandscape ? '8px 12px' : '14px 22px 22px',
          alignItems: 'stretch',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Sidebar */}
        <aside id="game-sidebar" className="cc-scroll flex flex-col gap-4" style={{ display: isLandscape ? 'none' : undefined, overflowY: 'auto', minHeight: 0 }}>
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
        <main id="game-content" className="cc-scroll min-w-0" style={{ overflowY: 'auto', minHeight: 0 }}>
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
