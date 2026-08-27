'use client'

interface NarratorScreenProps {
  headline: string
  body: string
  action?: {
    label: string
    onClick: () => void
  }
  secondaryAction?: {
    label: string
    onClick: () => void
  }
  dim?: boolean
}

/**
 * A full-height cosmic-narrator flavored screen.
 * Used for non-play states: loading, error, already-played.
 * Keeps the shell quiet — no bounce, no heavy motion.
 */
export function NarratorScreen({ headline, body, action, secondaryAction, dim = false }: NarratorScreenProps) {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
        gap: 20,
        maxWidth: 480,
        margin: '0 auto',
        width: '100%',
        opacity: dim ? 0.7 : 1,
      }}
    >
      <h2
        style={{
          color: 'rgba(255,255,255,0.95)',
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 1,
          textAlign: 'center',
          margin: 0,
        }}
      >
        {headline}
      </h2>
      <p
        style={{
          color: 'rgba(255,255,255,0.60)',
          fontSize: 14,
          lineHeight: 1.6,
          textAlign: 'center',
          margin: 0,
        }}
      >
        {body}
      </p>
      {action && (
        <button
          className="br-btn"
          onClick={action.onClick}
          style={{
            marginTop: 8,
            padding: '10px 28px',
            background: 'rgba(124,106,255,0.15)',
            border: '1px solid rgba(124,106,255,0.4)',
            borderRadius: 6,
            color: '#c4baff',
            cursor: 'pointer',
            fontSize: 14,
            fontWeight: 600,
            letterSpacing: 0.5,
          }}
        >
          {action.label}
        </button>
      )}
      {secondaryAction && (
        <button
          className="br-btn"
          onClick={secondaryAction.onClick}
          style={{
            padding: '8px 20px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 6,
            color: 'rgba(255,255,255,0.45)',
            cursor: 'pointer',
            fontSize: 12,
            letterSpacing: 0.5,
          }}
        >
          {secondaryAction.label}
        </button>
      )}
    </div>
  )
}
