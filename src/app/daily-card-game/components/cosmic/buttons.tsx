import type { ButtonHTMLAttributes, ReactNode } from 'react'

const monoLabel = {
  fontFamily: 'var(--cc-font-mono)',
  fontWeight: 700,
  textTransform: 'uppercase' as const,
}

export function PrimaryButton({
  children,
  className = '',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={`disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
      style={{
        ...monoLabel,
        background: 'linear-gradient(180deg, var(--cc-mint), var(--cc-mint-hi))',
        border: '1px solid var(--cc-mint)',
        color: 'var(--cc-on-mint)',
        fontSize: 11,
        letterSpacing: 2,
        padding: '10px 22px',
        borderRadius: 4,
        boxShadow: 'var(--cc-mint-glow)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function DangerButton({
  children,
  className = '',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={`disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
      style={{
        ...monoLabel,
        background: 'var(--cc-pink-bg)',
        border: '1px solid var(--cc-pink-border)',
        color: 'var(--cc-pink)',
        fontSize: 11,
        letterSpacing: 2,
        padding: '10px 18px',
        borderRadius: 4,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  className = '',
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      type="button"
      className={`disabled:cursor-not-allowed disabled:opacity-35 ${className}`}
      style={{
        ...monoLabel,
        fontWeight: 600,
        background: 'transparent',
        border: '1px solid var(--cc-mint-line)',
        color: 'var(--cc-text-muted)',
        fontSize: 10,
        letterSpacing: 2,
        padding: '8px 14px',
        borderRadius: 4,
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

export function SortPill({
  active,
  onClick,
  children,
}: {
  active?: boolean
  onClick?: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: 'transparent',
        border: 'none',
        color: active ? 'var(--cc-mint)' : 'var(--cc-text-muted)',
        fontFamily: 'var(--cc-font-mono)',
        fontSize: 11,
        letterSpacing: 1.5,
        textTransform: 'uppercase',
        fontWeight: 600,
        padding: '4px 0',
        cursor: 'pointer',
        borderBottom: active ? '1px solid var(--cc-mint)' : '1px solid transparent',
      }}
    >
      {children}
    </button>
  )
}
