'use client'

import { PrimaryButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { CurrentJokers } from '@/app/comet-cards/components/joker/current-jokers'
import { BoosterPacksForSale } from '@/app/comet-cards/components/shop/booster-packs'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { bossBlinds } from '@/app/comet-cards/domain/round/boss-blinds'
import { useAutoFocus } from '@/app/comet-cards/hooks/useAutoFocus'
import { useLandscapeMobile } from '@/app/comet-cards/hooks/useLandscapeMobile'
import { useGameState } from '@/app/comet-cards/useGameState'

import { ViewTemplate } from './view-template'

const mono = { fontFamily: 'var(--cc-font-mono)' as const }

export function OpeningView() {
  const isLandscape = useLandscapeMobile()
  const autoFocusRef = useAutoFocus()
  const { game } = useGameState()

  const round = game.rounds[game.roundIndex]
  const boss = bossBlinds.find(blind => blind.name === round.bossBlindName)
  const remaining = game.shopState.packsForSale.length

  return (
    <ViewTemplate
      sidebarContentTop={
        <div className="flex flex-col gap-3">
          {boss && (
            <div
              style={{
                border: '1px solid var(--cc-pink-border)',
                background: 'var(--cc-pink-bg)',
                borderRadius: 10,
                padding: '12px 16px',
              }}
            >
              <div
                className="uppercase"
                style={{ ...mono, fontSize: 10, letterSpacing: 2, opacity: 0.6 }}
              >
                Tonight you play
              </div>
              <div
                style={{ ...mono, fontSize: 16, fontWeight: 700, color: 'var(--cc-pink)', marginTop: 4 }}
              >
                {boss.name}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4, lineHeight: 1.45 }}>
                {boss.description}
              </div>
            </div>
          )}
          <Panel title={`Your Jokers (${game.jokers.length}/${game.maxJokers})`}>
            <div style={{ padding: 12 }}>
              <CurrentJokers />
            </div>
          </Panel>
        </div>
      }
    >
      <div
        ref={autoFocusRef}
        className="cc-scroll flex flex-col"
        style={{ gap: 18, padding: isLandscape ? 12 : 20, height: '100%', overflowY: 'auto' }}
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
            What you brought with you
          </h1>
          <p style={{ fontSize: 13, opacity: 0.65, marginTop: 8, maxWidth: 540, lineHeight: 1.55 }}>
            Everything on this table is already yours — you won it somewhere back down the run. Take
            what you want from each. Your gold is for the shop that comes after.
          </p>
        </div>

        <Panel title="The Opening" subtitle={`${remaining} unopened`}>
          <div style={{ padding: 16 }}>
            {remaining > 0 ? (
              <BoosterPacksForSale />
            ) : (
              <div style={{ ...mono, fontSize: 12, opacity: 0.5, lineHeight: 1.6 }}>
                Every pack is open. Whatever you left behind stays behind.
              </div>
            )}
          </div>
        </Panel>

        <div className="flex flex-wrap items-center gap-3" style={{ paddingBottom: 8 }}>
          <PrimaryButton onClick={() => eventEmitter.emit({ type: 'OPENING_CONFIRMED' })}>
            Continue → Shop
          </PrimaryButton>
          {remaining > 0 && (
            <span style={{ ...mono, fontSize: 11, opacity: 0.5 }}>
              {remaining} still sealed — they do not carry.
            </span>
          )}
        </div>
      </div>
    </ViewTemplate>
  )
}
