'use client'

import { playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import type {
  PlayingCardFlags,
  PlayingCardState,
} from '@/app/comet-cards/domain/playing-card/types'

const SUIT_GLYPH: Record<string, string> = {
  hearts: '♥',
  diamonds: '♦',
  spades: '♠',
  clubs: '♣',
}

const SIZES = {
  xs: { w: 58, h: 82, fs: 14, pip: 26 },
  sm: { w: 72, h: 102, fs: 18, pip: 32 },
  md: { w: 92, h: 132, fs: 22, pip: 42 },
  lg: { w: 116, h: 168, fs: 28, pip: 56 },
} as const

type Size = keyof typeof SIZES

const enchantmentOverlay: Partial<Record<PlayingCardFlags['enchantment'], string>> = {
  bonus: 'radial-gradient(circle at 50% 50%, rgba(99,179,255,0.20), transparent 60%)',
  mult: 'radial-gradient(circle at 50% 50%, rgba(255,107,107,0.20), transparent 60%)',
  gold: 'radial-gradient(circle at 50% 50%, rgba(255,209,102,0.22), transparent 60%)',
  glass: 'linear-gradient(160deg, rgba(255,255,255,0.18), transparent 70%)',
  lucky: 'radial-gradient(circle at 50% 50%, rgba(110,231,183,0.20), transparent 60%)',
  steel: 'linear-gradient(160deg, rgba(180,200,220,0.18), transparent 70%)',
  stone: 'linear-gradient(160deg, rgba(120,120,135,0.30), transparent 70%)',
  wild: 'conic-gradient(from 0deg, rgba(255,107,157,0.25), rgba(255,209,102,0.25), rgba(94,234,212,0.25), rgba(255,107,157,0.25))',
}

const sealVar: Partial<Record<PlayingCardFlags['seal'], string>> = {
  blue: 'var(--cc-seal-blue)',
  purple: 'var(--cc-seal-purple)',
  gold: 'var(--cc-seal-gold)',
  red: 'var(--cc-seal-red)',
}

export function BrandCard({
  card,
  selected = false,
  size = 'md',
  onClick,
  faceDown,
  debuffed,
}: {
  card: PlayingCardState
  selected?: boolean
  size?: Size
  onClick?: (isSelected: boolean, id: string) => void
  faceDown?: boolean
  debuffed?: boolean
}) {
  const dims = SIZES[size]
  const definition = playingCards[card.playingCardId]
  const suit = definition?.suit ?? 'hearts'
  const isWild = card.flags.enchantment === 'wild'
  const suitGlyph = isWild ? '✶' : SUIT_GLYPH[suit]
  const isFaceDown = faceDown ?? !card.isFaceUp

  const baseShadow = selected
    ? `0 0 0 2px var(--cc-suit-55), 0 0 28px var(--cc-suit-color), var(--cc-card-shadow-selected-tail)`
    : `0 0 12px var(--cc-suit-1a), var(--cc-card-shadow-base)`

  const borderColor = selected ? 'var(--cc-suit-color)' : 'var(--cc-card-border)'

  if (isFaceDown) {
    return (
      <button
        type="button"
        onClick={() => onClick?.(selected, card.id)}
        className="bc-card"
        data-selected={selected ? 'true' : 'false'}
        data-suit={suit}
        style={{
          width: dims.w,
          height: dims.h,
          padding: 0,
          position: 'relative',
          background: 'var(--cc-card-bg)',
          borderRadius: 14,
          border: '1px solid var(--cc-card-border)',
          boxShadow: 'var(--cc-card-shadow-base)',
          cursor: onClick ? 'pointer' : 'default',
          overflow: 'hidden',
          flex: 'none',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 6,
            border: '1px solid var(--cc-mint-line)',
            borderRadius: 9,
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'radial-gradient(circle at 50% 50%, rgba(94,234,212,0.18), transparent 60%)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--cc-mint)',
            fontFamily: 'var(--cc-font-mono)',
            fontSize: dims.fs,
            opacity: 0.6,
            textShadow: '0 0 12px rgba(94,234,212,0.7)',
          }}
        >
          ✦
        </div>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onClick?.(selected, card.id)}
      className="bc-card"
      data-selected={selected ? 'true' : 'false'}
      data-suit={suit}
      style={{
        width: dims.w,
        height: dims.h,
        padding: 0,
        position: 'relative',
        background: 'var(--cc-card-bg)',
        borderRadius: 14,
        border: `1px solid ${borderColor}`,
        boxShadow: baseShadow,
        cursor: onClick ? 'pointer' : 'default',
        overflow: 'hidden',
        flex: 'none',
        color: 'var(--cc-suit-color)',
      }}
    >
      {/* Sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(125deg, transparent 35%, var(--cc-suit-1f) 50%, transparent 65%)',
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />

      {/* Inner border */}
      <div
        style={{
          position: 'absolute',
          inset: 6,
          border: '1px solid var(--cc-suit-22)',
          borderRadius: 9,
          pointerEvents: 'none',
        }}
      />

      {/* Enchantment overlay */}
      {card.flags.enchantment !== 'none' && enchantmentOverlay[card.flags.enchantment] && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: enchantmentOverlay[card.flags.enchantment],
            mixBlendMode: 'screen',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* Seal indicator */}
      {card.flags.seal !== 'none' && sealVar[card.flags.seal] && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 6,
            right: 6,
            width: 10,
            height: 10,
            borderRadius: 9999,
            background: sealVar[card.flags.seal],
            boxShadow: `0 0 8px ${sealVar[card.flags.seal]}`,
          }}
        />
      )}

      {/* Top-left rank/suit */}
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 10,
          color: 'var(--cc-suit-color)',
          fontFamily: 'var(--cc-font-mono)',
          lineHeight: 1,
          textAlign: 'center',
          textShadow: '0 0 10px var(--cc-suit-88)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: dims.fs * 0.7 }}>{definition?.value ?? '?'}</div>
        <div style={{ fontSize: dims.fs * 0.62, marginTop: 2 }}>{suitGlyph}</div>
      </div>

      {/* Bottom-right rank/suit (rotated) */}
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          right: 10,
          color: 'var(--cc-suit-color)',
          fontFamily: 'var(--cc-font-mono)',
          lineHeight: 1,
          textAlign: 'center',
          transform: 'rotate(180deg)',
          textShadow: '0 0 10px var(--cc-suit-88)',
        }}
      >
        <div style={{ fontWeight: 700, fontSize: dims.fs * 0.7 }}>{definition?.value ?? '?'}</div>
        <div style={{ fontSize: dims.fs * 0.62, marginTop: 2 }}>{suitGlyph}</div>
      </div>

      {/* Center suit pip */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: dims.pip,
            color: 'var(--cc-suit-color)',
            textShadow: '0 0 22px var(--cc-suit-color), 0 0 40px var(--cc-suit-88)',
          }}
        >
          {suitGlyph}
        </div>
      </div>

      {/* Inner glow */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'radial-gradient(circle at 50% 55%, var(--cc-suit-22) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      {/* Debuff overlay */}
      {debuffed && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            borderRadius: 14,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: dims.pip * 0.6, opacity: 0.7 }}>🚫</span>
        </div>
      )}

      {/* Edition shimmer overlay */}
      {card.flags.edition !== 'normal' && (
        <div className={`edition-${card.flags.edition}`} />
      )}

      {/* Edition label */}
      {card.flags.edition !== 'normal' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            textAlign: 'center',
            fontFamily: 'var(--cc-font-mono)',
            fontSize: 9,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            background: 'rgba(0,0,0,0.4)',
            color: 'var(--cc-suit-color)',
            padding: '2px 0',
          }}
        >
          {card.flags.edition}
        </div>
      )}
    </button>
  )
}
