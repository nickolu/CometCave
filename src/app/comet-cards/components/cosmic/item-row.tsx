export function ItemRow({
  name,
  description,
  accent = 'var(--cc-mint)',
  glyph = '✺',
  selected = false,
  onClick,
}: {
  name: string
  description: string
  accent?: string
  glyph?: string
  selected?: boolean
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${name}: ${description}`}
      className="cc-btn flex w-full items-start gap-3 rounded-md p-2.5 text-left transition-colors"
      style={{
        background: selected
          ? `color-mix(in srgb, ${accent} 14%, transparent)`
          : 'rgba(255,255,255,0.02)',
        border: `1px solid ${
          selected ? accent : `color-mix(in srgb, ${accent} 22%, transparent)`
        }`,
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        className="flex flex-none items-center justify-center"
        style={{
          width: 40,
          height: 56,
          borderRadius: 4,
          background: 'var(--cc-card-mini-bg)',
          border: `1px solid color-mix(in srgb, ${accent} 55%, transparent)`,
          fontSize: 22,
          color: accent,
          boxShadow: `0 0 12px color-mix(in srgb, ${accent} 33%, transparent)`,
        }}
      >
        {glyph}
      </div>
      <div className="min-w-0 flex-1">
        <div style={{ fontWeight: 600, fontSize: 13, color: accent }}>{name}</div>
        <div style={{ fontSize: 11, opacity: 0.65, marginTop: 2, lineHeight: 1.4 }}>
          {description}
        </div>
      </div>
    </button>
  )
}

export function EmptySlot({ label = 'Empty slot' }: { label?: string }) {
  return (
    <div
      className="flex items-center justify-center uppercase"
      style={{
        height: 76,
        borderRadius: 6,
        border: '1px dashed rgba(94,234,212,0.12)',
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 10,
        opacity: 0.3,
        letterSpacing: 2,
      }}
    >
      {label}
    </div>
  )
}
