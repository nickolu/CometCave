'use client'

import type { ReactNode } from 'react'

export type TokenCardSize = 'sm' | 'md'

const SIZES: Record<TokenCardSize, { w: number; h: number; pip: number; titleFs: number; descFs: number }> = {
  sm: { w: 132, h: 168, pip: 32, titleFs: 12, descFs: 10 },
  md: { w: 168, h: 208, pip: 40, titleFs: 13, descFs: 11 },
}

export function TokenCard({
  title,
  description,
  glyph,
  accent = 'var(--cc-mint)',
  selected = false,
  disabled = false,
  size = 'md',
  badge,
  onClick,
  footer,
  typeLabel,
}: {
  title: string
  description?: string
  glyph?: ReactNode
  accent?: string
  selected?: boolean
  disabled?: boolean
  size?: TokenCardSize
  badge?: ReactNode
  onClick?: () => void
  footer?: ReactNode
  typeLabel?: string
}) {
  const dims = SIZES[size]
  const isInteractive = !!onClick && !disabled
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="bc-card flex flex-col"
      data-selected={selected ? 'true' : 'false'}
      style={{
        width: dims.w,
        minHeight: dims.h,
        position: 'relative',
        textAlign: 'left',
        background: 'var(--cc-card-bg)',
        borderRadius: 12,
        border: `1px solid ${selected ? accent : 'var(--cc-card-border)'}`,
        boxShadow: selected
          ? `0 0 0 2px color-mix(in srgb, ${accent} 33%, transparent), 0 0 28px ${accent}, var(--cc-card-shadow-selected-tail)`
          : `0 0 12px color-mix(in srgb, ${accent} 10%, transparent), var(--cc-card-shadow-base)`,
        cursor: isInteractive ? 'pointer' : disabled ? 'not-allowed' : 'default',
        opacity: disabled ? 0.55 : 1,
        overflow: 'hidden',
        flex: 'none',
        padding: 0,
        color: 'var(--cc-text-default)',
      }}
    >
      {/* Sheen */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(125deg, transparent 35%, color-mix(in srgb, ${accent} 12%, transparent) 50%, transparent 65%)`,
          mixBlendMode: 'screen',
          pointerEvents: 'none',
        }}
      />
      {/* Inner border */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 6,
          border: `1px solid color-mix(in srgb, ${accent} 22%, transparent)`,
          borderRadius: 8,
          pointerEvents: 'none',
        }}
      />

      {badge && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 2,
          }}
        >
          {badge}
        </div>
      )}

      {typeLabel && (
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 10,
            zIndex: 2,
            fontSize: 8,
            fontWeight: 600,
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color: accent,
            opacity: 0.4,
          }}
        >
          {typeLabel}
        </div>
      )}

      <div
        className="flex items-center justify-center"
        style={{
          height: '50%',
          minHeight: 80,
          fontSize: dims.pip,
          color: accent,
          textShadow: `0 0 22px ${accent}, 0 0 40px color-mix(in srgb, ${accent} 53%, transparent)`,
        }}
      >
        {glyph ?? '✺'}
      </div>

      <div
        className="flex flex-col"
        style={{
          padding: '10px 12px 12px',
          gap: 4,
          borderTop: `1px solid color-mix(in srgb, ${accent} 14%, transparent)`,
          flex: 1,
        }}
      >
        <div
          style={{
            fontWeight: 700,
            fontSize: dims.titleFs,
            color: accent,
            letterSpacing: -0.2,
            lineHeight: 1.2,
          }}
        >
          {title}
        </div>
        {description && (
          <div
            style={{
              fontSize: dims.descFs,
              opacity: 0.78,
              lineHeight: 1.4,
            }}
          >
            {description}
          </div>
        )}
        {footer && (
          <div style={{ marginTop: 'auto', paddingTop: 6 }}>{footer}</div>
        )}
      </div>
    </button>
  )
}
