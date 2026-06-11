'use client'

import { GhostButton } from '@/app/comet-cards/components/cosmic/buttons'
import { Panel } from '@/app/comet-cards/components/cosmic/panel'
import { eventEmitter } from '@/app/comet-cards/domain/events/event-emitter'
import { pokerHands } from '@/app/comet-cards/domain/hand/hands'

const RULES_SECTIONS = [
  {
    title: 'The Goal',
    body: 'Each blind has a chip target. Score enough chips to survive it — or the run ends. Three blinds per ante. Survive all eight antes to win.',
  },
  {
    title: 'Playing Hands',
    body: 'Select up to five cards and play a poker hand. Your base chips and multiplier combine: chips × mult = score. Higher hands, bigger numbers.',
  },
  {
    title: 'Hands & Discards',
    body: 'Each blind gives you a limited number of hands and discards. Discarding refreshes your options — but costs a use. Spend them wisely.',
  },
  {
    title: 'Jokers',
    body: 'Jokers are passive modifiers that bend the rules in your favour. They trigger in order from left to right — position matters. Stack combinations to reach impossible scores.',
  },
  {
    title: 'Consumables',
    body: 'Tarots reshape your cards: change suits, add enhancements, alter values. Celestials level up poker hands, raising their base chips and mult permanently for this run.',
  },
  {
    title: 'The Shop',
    body: 'Between blinds, spend your chips on jokers, packs, vouchers, and consumables. Vouchers grant lasting upgrades. Rerolling costs money — more each time.',
  },
  {
    title: 'Blinds',
    body: 'Small → Big → Boss. Boss blinds carry a curse: a debuff that warps the rules. Each ante the stakes climb. Skip a blind to earn a tag — useful, but the money is gone.',
  },
]

const HAND_ORDER: Array<keyof typeof pokerHands> = [
  'highCard',
  'pair',
  'twoPair',
  'threeOfAKind',
  'straight',
  'flush',
  'fullHouse',
  'fourOfAKind',
  'straightFlush',
  'fiveOfAKind',
  'flushHouse',
  'flushFive',
]

export function HowToPlayView() {
  return (
    <div
      className="cc-scroll mx-auto flex flex-col"
      style={{
        maxWidth: 820,
        padding: '32px 22px 40px',
        gap: 24,
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <header className="flex flex-col items-start" style={{ gap: 4 }}>
        <div
          className="uppercase"
          style={{
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 11,
            letterSpacing: 3,
            opacity: 0.55,
            color: 'var(--cc-mint)',
          }}
        >
          Rules
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 300,
            letterSpacing: -0.5,
            margin: 0,
            color: 'var(--cc-text-default)',
          }}
        >
          How to Play
        </h1>
        <p
          style={{
            fontSize: 13,
            opacity: 0.65,
            maxWidth: 560,
            lineHeight: 1.55,
            margin: 0,
            fontStyle: 'italic',
          }}
        >
          The cosmos rewards those who understand its rules — and those bold enough to bend them.
        </p>
      </header>

      {/* Rules */}
      <Panel title="The Way of Cards">
        <div
          className="flex flex-col"
          style={{ padding: '4px 0 8px' }}
        >
          {RULES_SECTIONS.map((section, i) => (
            <div
              key={section.title}
              className="flex flex-col"
              style={{
                padding: '14px 20px',
                borderBottom:
                  i < RULES_SECTIONS.length - 1
                    ? '1px solid var(--cc-panel-divider)'
                    : undefined,
                gap: 6,
              }}
            >
              <div
                className="uppercase"
                style={{
                  fontFamily: 'var(--cc-font-mono)',
                  fontSize: 10,
                  letterSpacing: 2,
                  color: 'var(--cc-mint)',
                  opacity: 0.85,
                }}
              >
                {section.title}
              </div>
              <p
                style={{
                  fontSize: 13,
                  lineHeight: 1.6,
                  opacity: 0.8,
                  margin: 0,
                }}
              >
                {section.body}
              </p>
            </div>
          ))}
        </div>
      </Panel>

      {/* Hand Rankings */}
      <Panel title="Hand Rankings">
        <div
          className="grid"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: 8,
            padding: '14px 16px',
          }}
        >
          {HAND_ORDER.map((handId, i) => {
            const hand = pokerHands[handId]
            if (!hand) return null
            return (
              <div
                key={handId}
                className="flex items-center justify-between gap-3 rounded-md"
                style={{
                  padding: '10px 12px',
                  background:
                    i % 2 === 0
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(255,255,255,0.01)',
                  border: '1px solid rgba(94,234,212,0.08)',
                }}
              >
                <div className="flex flex-col" style={{ gap: 2 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{hand.name}</div>
                  {hand.isSecret && (
                    <div
                      className="uppercase"
                      style={{
                        fontFamily: 'var(--cc-font-mono)',
                        fontSize: 9,
                        letterSpacing: 1.5,
                        opacity: 0.45,
                        color: 'var(--cc-gold)',
                      }}
                    >
                      Secret
                    </div>
                  )}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--cc-font-mono)',
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ color: 'var(--cc-mint)' }}>{hand.baseChips}</span>
                  <span style={{ opacity: 0.35, padding: '0 4px' }}>×</span>
                  <span style={{ color: 'var(--cc-pink)' }}>{hand.baseMult}</span>
                </div>
              </div>
            )
          })}
        </div>
        <div
          style={{
            padding: '10px 20px 14px',
            borderTop: '1px solid var(--cc-panel-divider)',
            fontSize: 11,
            opacity: 0.5,
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          Base values shown. Level up hands with Celestial cards to increase chips and mult permanently.
          Secret hands require special conditions to unlock.
        </div>
      </Panel>

      {/* Back */}
      <div>
        <GhostButton onClick={() => eventEmitter.emit({ type: 'BACK_TO_MAIN_MENU' })}>
          ← Back
        </GhostButton>
      </div>
    </div>
  )
}
