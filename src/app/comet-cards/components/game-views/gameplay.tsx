'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { LayoutGroup } from 'framer-motion'

import {
  DangerButton,
  GhostButton,
  PrimaryButton,
  SortPill,
} from '@/app/comet-cards/components/cosmic/buttons'
import { EmptySlot, ItemRow } from '@/app/comet-cards/components/cosmic/item-row'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { Hand, type HandSortKey } from '@/app/comet-cards/components/gameplay/hand'
import { PlayArea } from '@/app/comet-cards/components/gameplay/play-area'
import { Joker } from '@/app/comet-cards/components/gameplay/joker'
import { Deck } from '@/app/comet-cards/components/global/deck'
import { Hands } from '@/app/comet-cards/components/hands/hands'
import { TickingNumber } from '@/app/comet-cards/components/animations/ticking-number'
import { Modal } from '@/app/comet-cards/components/ui/modal'
import { Vouchers } from '@/app/comet-cards/components/voucher/vouchers'
import { getConsumableDefinition } from '@/app/comet-cards/domain/consumable/utils'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { scoreHand as domainScoreHand } from '@/app/comet-cards/domain/game/score-hand'
import { isCustomScoringEvent } from '@/app/comet-cards/domain/game/types'
import { calculateAnte, getBlindDefinition } from '@/app/comet-cards/domain/game/utils'
import { pokerHands } from '@/app/comet-cards/domain/hand/hands'
import { jokers as jokerDefinitions } from '@/app/comet-cards/domain/joker/jokers'
import { getScoringCards } from '@/app/comet-cards/domain/game/card-registry-utils'
import { getInProgressBlind } from '@/app/comet-cards/domain/round/blinds'
import { useCometCardsStore } from '@/app/comet-cards/store'
import { useGameState } from '@/app/comet-cards/useGameState'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'

const RARITY_ACCENT: Record<string, string> = {
  common: 'var(--cc-mint)',
  uncommon: 'var(--cc-rarity-uncommon)',
  rare: 'var(--cc-pink)',
  legendary: 'var(--cc-gold)',
}

const useScoreHand = () => {
  const scoreHand = useCallback(() => {
    domainScoreHand({
      getGameState: () => useCometCardsStore.getState().game,
    })
  }, [])
  return { scoreHand }
}

function TopBarStat({
  label,
  value,
  accent = 'var(--cc-text-default)',
}: {
  label: string
  value: string
  accent?: string
}) {
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <div style={{ opacity: 0.45, fontSize: 10 }}>{label}</div>
      <div style={{ color: accent, fontWeight: 600, fontSize: 13 }}>{value}</div>
    </div>
  )
}

export function GamePlayView() {
  const isLandscape = useLandscapeMobile()
  const { game } = useGameState()
  const { gamePlayState, totalScore } = game
  const { score, selectedHand, selectedCardIds, isScoring, remainingDiscards, remainingHands } =
    gamePlayState

  const currentBlind = getInProgressBlind(game)
  const currentRound = game.rounds[game.roundIndex]
  const blindDefinition = currentBlind
    ? getBlindDefinition(currentBlind.type, currentRound)
    : undefined
  const targetScore = currentBlind
    ? calculateAnte(currentRound.baseAnte, blindDefinition?.anteMultiplier ?? 1)
    : 0n

  const playedCards = useMemo(() => {
    if (!isScoring) return []
    return getScoringCards(game)
  }, [isScoring, game])

  const blindProgressPct = useMemo(() => {
    if (!currentBlind) return 0
    const numerator = Number(currentBlind.score ?? 0n)
    const denom = Number(targetScore || 1n)
    if (!Number.isFinite(numerator) || !Number.isFinite(denom) || denom === 0) return 0
    return Math.min(100, Math.max(0, (numerator / denom) * 100))
  }, [currentBlind, targetScore])

  const activatedJokerNames = useMemo(() => {
    if (!isScoring) return new Set<string>()
    const names = new Set<string>()
    for (const evt of gamePlayState.scoringEvents) {
      if ('source' in evt && evt.source) {
        names.add(evt.source)
      }
    }
    return names
  }, [isScoring, gamePlayState.scoringEvents])

  const prevProgressRef = useRef(0)
  const [blindMet, setBlindMet] = useState(false)

  useEffect(() => {
    if (blindProgressPct >= 100 && prevProgressRef.current < 100) {
      setBlindMet(true)
      const timer = setTimeout(() => setBlindMet(false), 1200)
      return () => clearTimeout(timer)
    }
    prevProgressRef.current = blindProgressPct
  }, [blindProgressPct])

  const selectedHandState =
    selectedHand?.[0] !== undefined ? game.pokerHands[selectedHand[0]] : undefined
  const restingHandState = game.pokerHands.highCard
  const displayHandState = selectedHandState ?? restingHandState
  const displayHandDefinition = pokerHands[displayHandState.handId]
  const displayHandChips =
    displayHandDefinition.baseChips +
    displayHandDefinition.chipIncreasePerLevel * (displayHandState.level - 1)
  const displayHandMult =
    displayHandDefinition.baseMult +
    displayHandDefinition.multIncreasePerLevel * (displayHandState.level - 1)
  const hasSelectedHand = !!selectedHandState

  const [showDeck, setShowDeck] = useState(false)
  const [showHands, setShowHands] = useState(false)
  const [showVouchers, setShowVouchers] = useState(false)
  const [showScoringFeed, setShowScoringFeed] = useState(false)
  const [sortKey, setSortKey] = useState<HandSortKey>('value')

  const { scoreHand } = useScoreHand()

  useEffect(() => {
    eventEmitter.emit({ type: 'HAND_DEALT' })
  }, [])

  const selectedConsumable = gamePlayState.selectedConsumable
  const selectedConsumableDefinition = selectedConsumable
    ? getConsumableDefinition(selectedConsumable)
    : undefined

  const selectedJoker = game.jokers.find(j => j.id === gamePlayState.selectedJokerId)
  const selectedJokerDefinition = selectedJoker
    ? jokerDefinitions[selectedJoker.jokerId]
    : undefined

  return (
    <div className="relative w-full">
      {/* Top stat strip */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-between gap-4"
        style={{
          padding: isLandscape ? '8px 12px' : '12px 22px',
          borderBottom: '1px solid var(--cc-panel-divider)',
        }}
      >
        <div className="flex flex-wrap items-center gap-5">
          <div
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: 'uppercase',
              color: 'var(--cc-mint)',
            }}
          >
            Cards
          </div>
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 2,
              opacity: 0.55,
            }}
          >
            {game.gameSeed && <>Seed · {game.gameSeed}</>}
          </div>
        </div>
        <div
          className="flex flex-wrap items-center gap-5"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            textTransform: 'uppercase',
          }}
        >
          <TopBarStat
            label="Round"
            value={`${game.roundIndex + 1}/${game.rounds.length}`}
          />
          <TopBarStat label="Money" value={`$${game.money}`} accent="var(--cc-gold)" />
          <TopBarStat label="Hands" value={String(game.handsPlayed)} />
        </div>
      </div>

      {isLandscape ? (
        /* ── LANDSCAPE MOBILE: single-column flex ── */
        <div className="relative z-10 flex flex-col" style={{ gap: 0 }}>
          {/* Compact info bar */}
          <div
            className="flex flex-wrap items-center justify-between"
            style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--cc-panel-divider)',
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 11,
              gap: 8,
            }}
          >
            {currentBlind && blindDefinition && (
              <>
                <span style={{ color: 'var(--cc-mint)', fontWeight: 700 }}>{blindDefinition.name}</span>
                <span style={{ color: 'var(--cc-pink)' }}>
                  {currentBlind.score.toString()} / {targetScore.toString()}
                </span>
                <div
                  style={{
                    width: 60,
                    height: 3,
                    background: 'rgba(94,234,212,0.15)',
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                  className={blindMet ? 'blind-met-celebration' : undefined}
                >
                  <div
                    className="blind-progress-fill"
                    style={{
                      height: '100%',
                      width: `${blindProgressPct}%`,
                      background: blindProgressPct >= 90
                        ? 'linear-gradient(90deg, var(--cc-mint), var(--cc-gold, #ffd166))'
                        : 'linear-gradient(90deg, var(--cc-mint), var(--cc-mint-hi))',
                      transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s',
                    }}
                  />
                </div>
                <span style={{ opacity: 0.6 }}>Hands <span style={{ color: 'var(--cc-mint)' }}>{remainingHands}</span></span>
                <span style={{ opacity: 0.6 }}>Discards <span style={{ color: 'var(--cc-pink)' }}>{remainingDiscards}</span></span>
              </>
            )}
            <span style={{ opacity: 0.6 }}>
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'rgba(94,234,212,0.12)',
                  color: 'var(--cc-mint)',
                  marginRight: 4,
                }}
              >
                {score.chips > 0 ? <TickingNumber value={score.chips} /> : displayHandChips}
              </span>
              ×
              <span
                style={{
                  padding: '2px 6px',
                  borderRadius: 3,
                  background: 'rgba(255,107,157,0.12)',
                  color: 'var(--cc-pink)',
                  marginLeft: 4,
                }}
              >
                {score.mult > 0 ? <TickingNumber value={score.mult} /> : displayHandMult}
              </span>
            </span>
            {hasSelectedHand && displayHandDefinition && (
              <span style={{
                padding: '2px 6px',
                borderRadius: 3,
                background: 'rgba(94,234,212,0.08)',
                color: 'var(--cc-mint)',
                fontWeight: 600,
                fontSize: 10,
                letterSpacing: 0.5,
              }}>
                {displayHandDefinition.name} Lv.{displayHandState.level}
              </span>
            )}
          </div>

          {/* Score display */}
          <div className="flex flex-col items-center" style={{ paddingTop: 4 }}>
            {currentBlind && (
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 200,
                  letterSpacing: -1,
                  lineHeight: 1,
                  color: 'var(--cc-mint)',
                  textShadow: '0 0 40px rgba(94,234,212,0.3)',
                  transition: 'transform 0.2s',
                  transform: isScoring ? 'scale(1.04)' : 'scale(1)',
                }}
              >
                <TickingNumber value={Number(currentBlind.score)} duration={400} />
              </div>
            )}
          </div>

          {/* Play area + Hand */}
          <LayoutGroup>
            <PlayArea cards={playedCards} visible={isScoring} />
            <div className="flex items-end justify-center" style={{ paddingBottom: 4, paddingTop: 4 }}>
              <Hand sortKey={sortKey} />
            </div>
          </LayoutGroup>

          {/* Action bar */}
          <div
            className="flex flex-wrap items-center justify-center"
            style={{
              gap: 8,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              padding: '4px 12px',
            }}
          >
            <span style={{ opacity: 0.5, fontFamily: 'var(--cc-font-mono)' }}>Sort:</span>
            <SortPill active={sortKey === 'value'} onClick={() => setSortKey('value')}>Value</SortPill>
            <SortPill active={sortKey === 'suit'} onClick={() => setSortKey('suit')}>Suit</SortPill>
            <div style={{ width: 1, height: 22, background: 'rgba(94,234,212,0.15)' }} />
            <DangerButton
              disabled={selectedCardIds.length === 0 || remainingDiscards === 0 || isScoring}
              onClick={() => eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })}
            >
              Discard <span style={{ opacity: 0.55, marginLeft: 4 }}>{remainingDiscards}</span>
            </DangerButton>
            <PrimaryButton
              disabled={selectedCardIds.length === 0 || remainingHands === 0 || isScoring}
              onClick={scoreHand}
            >
              Play Hand <span style={{ marginLeft: 4 }}>↑</span>
            </PrimaryButton>
          </div>

          {/* Compact jokers + consumables row */}
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              gap: 8,
              padding: '4px 12px',
              borderTop: '1px solid var(--cc-panel-divider)',
            }}
          >
            {game.jokers.map(joker => {
              const def = jokerDefinitions[joker.jokerId]
              return (
                <button
                  key={joker.id}
                  type="button"
                  className={activatedJokerNames.has(def.name) ? 'joker-activated' : undefined}
                  onClick={() => {
                    if (gamePlayState.selectedJokerId === joker.id) {
                      eventEmitter.emit({ type: 'JOKER_DESELECTED', id: joker.id })
                    } else {
                      eventEmitter.emit({ type: 'JOKER_SELECTED', id: joker.id })
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${gamePlayState.selectedJokerId === joker.id ? RARITY_ACCENT[def.rarity] ?? 'var(--cc-mint)' : 'rgba(94,234,212,0.2)'}`,
                    background: gamePlayState.selectedJokerId === joker.id ? 'rgba(94,234,212,0.1)' : 'transparent',
                    color: RARITY_ACCENT[def.rarity] ?? 'var(--cc-mint)',
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    cursor: 'pointer',
                    boxShadow: activatedJokerNames.has(def.name) ? `0 0 10px ${RARITY_ACCENT[def.rarity] ?? 'var(--cc-mint)'}` : undefined,
                  }}
                >
                  ✺ {def.name}
                </button>
              )
            })}
            {game.consumables.map(consumable => {
              const def = getConsumableDefinition(consumable)
              const isTarot = consumable.consumableType === 'tarotCard'
              const accent = isTarot ? 'var(--cc-pink)' : 'var(--cc-gold)'
              const glyph = isTarot ? '◈' : '✷'
              const isSelected = selectedConsumable?.id === consumable.id
              return (
                <button
                  key={consumable.id}
                  type="button"
                  onClick={() => {
                    if (isSelected) {
                      eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id: consumable.id })
                    } else {
                      eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id: consumable.id })
                    }
                  }}
                  style={{
                    flexShrink: 0,
                    padding: '3px 8px',
                    borderRadius: 4,
                    border: `1px solid ${isSelected ? accent : 'rgba(94,234,212,0.2)'}`,
                    background: isSelected ? 'rgba(94,234,212,0.1)' : 'transparent',
                    color: accent,
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    cursor: 'pointer',
                  }}
                >
                  {glyph} {def.name}
                </button>
              )
            })}
            <div style={{ width: 1, height: 16, background: 'rgba(94,234,212,0.15)', flexShrink: 0 }} />
            <button
              type="button"
              onClick={() => setShowDeck(true)}
              style={{
                flexShrink: 0,
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid rgba(94,234,212,0.15)',
                background: 'transparent',
                color: 'var(--cc-text-default)',
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                cursor: 'pointer',
                opacity: 0.6,
              }}
            >
              Deck
            </button>
            <button
              type="button"
              onClick={() => setShowHands(true)}
              style={{
                flexShrink: 0,
                padding: '3px 8px',
                borderRadius: 4,
                border: '1px solid rgba(94,234,212,0.15)',
                background: 'transparent',
                color: 'var(--cc-text-default)',
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                cursor: 'pointer',
                opacity: 0.6,
              }}
            >
              Hands
            </button>
            {game.vouchers.length > 0 && (
              <button
                type="button"
                onClick={() => setShowVouchers(true)}
                style={{
                  flexShrink: 0,
                  padding: '3px 8px',
                  borderRadius: 4,
                  border: '1px solid rgba(94,234,212,0.15)',
                  background: 'transparent',
                  color: 'var(--cc-text-default)',
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  cursor: 'pointer',
                  opacity: 0.6,
                }}
              >
                Vouchers
              </button>
            )}
          </div>
          {/* Selected item actions */}
          {(selectedJoker || selectedConsumable) && (
            <div
              className="flex items-center justify-center gap-3"
              style={{
                padding: '4px 12px',
                borderTop: '1px solid var(--cc-panel-divider)',
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
              }}
            >
              {selectedJoker && selectedJokerDefinition && (
                <>
                  <span style={{ color: RARITY_ACCENT[selectedJokerDefinition.rarity] ?? 'var(--cc-mint)', fontWeight: 600 }}>
                    {selectedJokerDefinition.name}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 9 }}>{selectedJokerDefinition.description}</span>
                  <DangerButton onClick={() => eventEmitter.emit({ type: 'JOKER_SOLD' })}>
                    Sell ${selectedJokerDefinition.price}
                  </DangerButton>
                </>
              )}
              {selectedConsumable && selectedConsumableDefinition && (
                <>
                  <span style={{ color: selectedConsumable.consumableType === 'tarotCard' ? 'var(--cc-pink)' : 'var(--cc-gold)', fontWeight: 600 }}>
                    {selectedConsumableDefinition.name}
                  </span>
                  <span style={{ opacity: 0.5, fontSize: 9 }}>{selectedConsumableDefinition.description}</span>
                  <PrimaryButton
                    disabled={!selectedConsumableDefinition.isPlayable(game)}
                    onClick={() => {
                      if (selectedConsumable.consumableType === 'tarotCard') {
                        eventEmitter.emit({ type: 'TAROT_CARD_USED' })
                      } else {
                        eventEmitter.emit({ type: 'CELESTIAL_CARD_USED' })
                      }
                    }}
                  >
                    Use
                  </PrimaryButton>
                  <DangerButton onClick={() => eventEmitter.emit({ type: 'CONSUMABLE_SOLD' })}>
                    Sell
                  </DangerButton>
                </>
              )}
            </div>
          )}
        </div>
      ) : (
        /* ── DESKTOP: 3-column grid (unchanged) ── */
        <div
          className="relative z-10 grid"
          style={{
            gridTemplateColumns: 'minmax(240px, 270px) minmax(0, 1fr) minmax(240px, 270px)',
            gap: 18,
            padding: '14px 22px 22px',
            alignItems: 'start',
          }}
        >
          {/* LEFT rail */}
          <div className="flex flex-col gap-4">
            {currentBlind && blindDefinition && (
              <Panel title="Current Blind">
                <div style={{ padding: '14px 16px' }}>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 700,
                      letterSpacing: -0.3,
                      color: 'var(--cc-mint)',
                    }}
                  >
                    {blindDefinition.name}
                  </div>
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      opacity: 0.5,
                      letterSpacing: 2,
                      marginTop: 14,
                      marginBottom: 6,
                    }}
                  >
                    Score at Least
                  </div>
                  <div
                    style={{
                      fontSize: 36,
                      fontWeight: 700,
                      letterSpacing: -1,
                      color: 'var(--cc-pink)',
                      textShadow: '0 0 24px rgba(255,107,157,0.35)',
                    }}
                  >
                    {targetScore.toString()}
                  </div>
                  <div
                    style={{
                      marginTop: 16,
                      height: 6,
                      background: 'rgba(94,234,212,0.1)',
                      borderRadius: 3,
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                    className={blindMet ? 'blind-met-celebration' : undefined}
                  >
                    <div
                      className="blind-progress-fill"
                      style={{
                        height: '100%',
                        width: `${blindProgressPct}%`,
                        background: blindProgressPct >= 90
                          ? 'linear-gradient(90deg, var(--cc-mint), var(--cc-gold, #ffd166))'
                          : 'linear-gradient(90deg, var(--cc-mint), var(--cc-mint-hi))',
                        boxShadow: blindProgressPct >= 90
                          ? '0 0 16px rgba(255,209,102,0.7)'
                          : `0 0 ${8 + blindProgressPct * 0.08}px rgba(94,234,212,${0.3 + blindProgressPct * 0.004})`,
                        transition: 'width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s, box-shadow 0.4s',
                      }}
                    />
                  </div>
                  <div
                    className="flex flex-col"
                    style={{
                      gap: 6,
                      marginTop: 14,
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 11,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span style={{ opacity: 0.6 }}>Remaining Hands</span>
                      <span style={{ color: 'var(--cc-mint)' }}>{remainingHands}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 whitespace-nowrap">
                      <span style={{ opacity: 0.6 }}>Remaining Discards</span>
                      <span style={{ color: 'var(--cc-pink)' }}>{remainingDiscards}</span>
                    </div>
                  </div>
                </div>
              </Panel>
            )}

            <Panel title="Selected Hand">
              <div style={{ padding: '14px 16px' }}>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 600,
                    letterSpacing: -0.3,
                    opacity: hasSelectedHand ? 1 : 0.45,
                  }}
                >
                  {hasSelectedHand ? displayHandDefinition.name : 'No hand'}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 11,
                    opacity: 0.55,
                    marginTop: 4,
                  }}
                >
                  Lvl {displayHandState.level}
                </div>
                <div
                  className="flex items-center"
                  style={{
                    marginTop: 14,
                    gap: 10,
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      background: 'rgba(94,234,212,0.12)',
                      color: 'var(--cc-mint)',
                      minWidth: 48,
                      textAlign: 'center',
                      opacity: hasSelectedHand || score.chips > 0 ? 1 : 0.45,
                    }}
                  >
                    {score.chips > 0 ? <TickingNumber value={score.chips} /> : displayHandChips}
                  </span>
                  <span style={{ opacity: 0.4 }}>×</span>
                  <span
                    style={{
                      padding: '6px 10px',
                      borderRadius: 4,
                      background: 'rgba(255,107,157,0.12)',
                      color: 'var(--cc-pink)',
                      minWidth: 48,
                      textAlign: 'center',
                      opacity: hasSelectedHand || score.mult > 0 ? 1 : 0.45,
                    }}
                  >
                    {score.mult > 0 ? <TickingNumber value={score.mult} /> : displayHandMult}
                  </span>
                  <span
                    style={{
                      marginLeft: 'auto',
                      color: 'var(--cc-gold)',
                      fontWeight: 700,
                      fontSize: 16,
                      minWidth: 0,
                      visibility: score.chips > 0 || score.mult > 0 ? 'visible' : 'hidden',
                    }}
                  >
                    = <TickingNumber value={score.chips * score.mult} />
                  </span>
                </div>
                <div
                  className="uppercase"
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 10,
                    opacity: 0.5,
                    letterSpacing: 1,
                    marginTop: 10,
                  }}
                >
                  Chips × Mult
                </div>
              </div>
            </Panel>

            <Panel title="Run Log">
              <div
                style={{
                  padding: '12px 16px',
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 11,
                  opacity: 0.7,
                  lineHeight: 1.7,
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span style={{ opacity: 0.6 }}>Hands Played</span>
                  <span>{game.handsPlayed}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span style={{ opacity: 0.6 }}>Discards Played</span>
                  <span>{game.discardsPlayed}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span style={{ opacity: 0.6 }}>Total Bank</span>
                  <span style={{ color: 'var(--cc-gold)' }}>${game.money}</span>
                </div>
                {game.tags.length > 0 && (
                  <div
                    className="mt-2 flex flex-wrap items-center gap-1"
                    style={{ opacity: 0.85 }}
                  >
                    {game.tags.map(tag => (
                      <span
                        key={tag.id}
                        className="uppercase"
                        style={{
                          fontFamily: 'var(--cc-font-mono)',
                          fontSize: 9,
                          letterSpacing: 1.5,
                          padding: '2px 6px',
                          borderRadius: 999,
                          border: '1px solid rgba(94,234,212,0.25)',
                          color: 'var(--cc-mint)',
                        }}
                      >
                        {tag.tagType}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Panel>

            {gamePlayState.scoringEvents.length > 0 && (
              <GhostButton onClick={() => setShowScoringFeed(true)}>
                Scoring Feed ({gamePlayState.scoringEvents.length})
              </GhostButton>
            )}
          </div>

          {/* CENTER */}
          <div
            className="flex flex-col items-stretch"
            style={{ gap: 18, minHeight: 540 }}
          >
            <div className="flex flex-col items-center" style={{ paddingTop: 8 }}>
              {currentBlind && blindDefinition && (
                <>
                  <div
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--cc-font-mono)',
                      fontSize: 10,
                      opacity: 0.5,
                      letterSpacing: 3,
                    }}
                  >
                    {blindDefinition.name}
                  </div>
                  <div
                    style={{
                      fontSize: 44,
                      fontWeight: 200,
                      letterSpacing: -1.5,
                      lineHeight: 1,
                      marginTop: 4,
                      color: 'var(--cc-mint)',
                      textShadow: '0 0 60px rgba(94,234,212,0.3)',
                      transition: 'transform 0.2s',
                      transform: isScoring ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    <TickingNumber value={Number(currentBlind.score)} duration={400} />
                    <span
                      style={{
                        fontSize: 20,
                        opacity: 0.5,
                        marginLeft: 4,
                        color: 'var(--cc-pink)',
                      }}
                    >
                      / {targetScore.toString()}
                    </span>
                  </div>
                </>
              )}
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 2,
                  opacity: 0.45,
                  marginTop: 8,
                }}
              >
                <span>Total</span>
                <span style={{ marginLeft: 6 }}><TickingNumber value={Number(totalScore)} duration={400} /></span>
              </div>
            </div>

            <LayoutGroup>
              <PlayArea cards={playedCards} visible={isScoring} />
              <div
                className="flex flex-1 items-end justify-center"
                style={{ paddingBottom: 8, paddingTop: 12 }}
              >
                <Hand sortKey={sortKey} />
              </div>
            </LayoutGroup>

            {/* Action bar */}
            <div
              className="flex flex-wrap items-center justify-center"
              style={{
                gap: 16,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              <span
                style={{
                  opacity: 0.5,
                  fontFamily: 'var(--cc-font-mono)',
                }}
              >
                Sort By:
              </span>
              <SortPill active={sortKey === 'value'} onClick={() => setSortKey('value')}>
                Value
              </SortPill>
              <SortPill active={sortKey === 'suit'} onClick={() => setSortKey('suit')}>
                Suit
              </SortPill>
              <div
                style={{ width: 1, height: 22, background: 'rgba(94,234,212,0.15)' }}
              />
              <DangerButton
                disabled={selectedCardIds.length === 0 || remainingDiscards === 0 || isScoring}
                onClick={() => eventEmitter.emit({ type: 'DISCARD_SELECTED_CARDS' })}
              >
                Discard <span style={{ opacity: 0.55, marginLeft: 6 }}>{remainingDiscards}</span>
              </DangerButton>
              <PrimaryButton
                disabled={selectedCardIds.length === 0 || remainingHands === 0 || isScoring}
                onClick={scoreHand}
              >
                Play Hand <span style={{ marginLeft: 6 }}>↑</span>
              </PrimaryButton>
              <GhostButton onClick={() => setShowDeck(true)}>Show Deck</GhostButton>
              <GhostButton onClick={() => setShowHands(true)}>Show Hands</GhostButton>
              {game.vouchers.length > 0 && (
                <GhostButton onClick={() => setShowVouchers(true)}>Show Vouchers</GhostButton>
              )}
              {gamePlayState.scoringEvents.length > 0 && (
                <GhostButton onClick={() => setShowScoringFeed(true)}>Scoring Feed</GhostButton>
              )}
            </div>
          </div>

          {/* RIGHT rail */}
          <div className="flex flex-col gap-4">
            <Panel title="Jokers" subtitle={`${game.jokers.length} / ${game.maxJokers} slots`}>
              <div style={{ padding: 14, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {game.jokers.map(joker => (
                  <Joker
                    key={joker.id}
                    joker={joker}
                    isSelected={gamePlayState.selectedJokerId === joker.id}
                    ownedCardCount={game.ownedCardIds.length}
                    gameSeed={game.gameSeed}
                    roundIndex={game.roundIndex}
                    activated={activatedJokerNames.has(jokerDefinitions[joker.jokerId]?.name ?? '')}
                    onClick={(isSelected, id) => {
                      if (isSelected) {
                        eventEmitter.emit({ type: 'JOKER_DESELECTED', id })
                      } else {
                        eventEmitter.emit({ type: 'JOKER_SELECTED', id })
                      }
                    }}
                  />
                ))}
                {Array.from({ length: Math.max(0, game.maxJokers - game.jokers.length) }).map(
                  (_, i) => (
                    <EmptySlot key={`joker-empty-${i}`} />
                  )
                )}
                {selectedJokerDefinition && (
                  <DangerButton
                    className="self-start"
                    onClick={() => eventEmitter.emit({ type: 'JOKER_SOLD' })}
                  >
                    Sell (${selectedJokerDefinition.price})
                  </DangerButton>
                )}
              </div>
            </Panel>

            <Panel
              title="Consumables"
              subtitle={`${game.consumables.length} / ${game.maxConsumables} slots`}
            >
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {game.consumables.map(consumable => {
                  const def = getConsumableDefinition(consumable)
                  const isTarot = consumable.consumableType === 'tarotCard'
                  const accent = isTarot ? 'var(--cc-pink)' : 'var(--cc-gold)'
                  const glyph = isTarot ? '◈' : '✷'
                  const isSelected = selectedConsumable?.id === consumable.id
                  return (
                    <ItemRow
                      key={consumable.id}
                      name={def.name}
                      description={def.description}
                      accent={accent}
                      glyph={glyph}
                      selected={isSelected}
                      onClick={() => {
                        if (isSelected) {
                          eventEmitter.emit({ type: 'CONSUMABLE_DESELECTED', id: consumable.id })
                        } else {
                          eventEmitter.emit({ type: 'CONSUMABLE_SELECTED', id: consumable.id })
                        }
                      }}
                    />
                  )
                })}
                {Array.from({
                  length: Math.max(0, game.maxConsumables - game.consumables.length),
                }).map((_, i) => (
                  <EmptySlot key={`consumable-empty-${i}`} />
                ))}
                {selectedConsumable && selectedConsumableDefinition && (
                  <div className="flex flex-wrap gap-2">
                    <PrimaryButton
                      disabled={!selectedConsumableDefinition.isPlayable(game)}
                      onClick={() => {
                        if (selectedConsumable.consumableType === 'tarotCard') {
                          eventEmitter.emit({ type: 'TAROT_CARD_USED' })
                        } else {
                          eventEmitter.emit({ type: 'CELESTIAL_CARD_USED' })
                        }
                      }}
                    >
                      Use
                    </PrimaryButton>
                    <DangerButton
                      onClick={() => eventEmitter.emit({ type: 'CONSUMABLE_SOLD' })}
                    >
                      Sell (${selectedConsumableDefinition.price})
                    </DangerButton>
                  </div>
                )}
              </div>
            </Panel>

          </div>
        </div>
      )}

      {showDeck && (
        <Modal eyebrow="Show Deck" title="Standard 52" onClose={() => setShowDeck(false)}>
          <Deck />
        </Modal>
      )}
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
      {showScoringFeed && (
        <Modal eyebrow="Scoring" title="Scoring Feed" onClose={() => setShowScoringFeed(false)}>
          <div
            className="flex flex-col gap-1"
            style={{
              padding: '12px 16px',
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 12,
            }}
          >
            {gamePlayState.scoringEvents.length === 0 ? (
              <div style={{ opacity: 0.5, textAlign: 'center', padding: 16 }}>
                No scoring events yet
              </div>
            ) : (
              <>
                {/* Summary row */}
                <div
                  className="flex items-center justify-between gap-4"
                  style={{
                    padding: '8px 0 12px',
                    borderBottom: '1px solid var(--cc-panel-divider)',
                    marginBottom: 8,
                  }}
                >
                  <span style={{ fontSize: 11, opacity: 0.6 }}>Hand Score</span>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>
                    <span style={{ color: 'var(--cc-mint)' }}>{gamePlayState.score.chips}</span>
                    <span style={{ opacity: 0.4, margin: '0 6px' }}>×</span>
                    <span style={{ color: 'var(--cc-pink)' }}>{gamePlayState.score.mult}</span>
                  </span>
                </div>
                {/* Event list */}
                {gamePlayState.scoringEvents.map(event => {
                  if (isCustomScoringEvent(event)) {
                    return (
                      <div key={event.id} style={{ opacity: 0.75, padding: '2px 0' }}>
                        {event.message}
                      </div>
                    )
                  }
                  const sign = event.operator ?? '+'
                  const isMult = event.type === 'mult'
                  return (
                    <div key={event.id} className="flex items-center justify-between gap-2" style={{ padding: '2px 0' }}>
                      <span style={{ opacity: 0.6 }}>{event.source}</span>
                      <span style={{ color: isMult ? 'var(--cc-pink)' : 'var(--cc-mint)', fontWeight: 600 }}>
                        {sign}{event.value} {isMult ? 'mult' : 'chips'}
                      </span>
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  )
}

