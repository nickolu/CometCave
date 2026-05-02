import type { ReactNode } from 'react'

export function Panel({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string
  subtitle?: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-lg border backdrop-blur-md ${className}`}
      style={{
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), var(--cc-panel-grad-to))',
        borderColor: 'var(--cc-panel-border)',
      }}
    >
      {title && (
        <div
          className="flex items-center justify-between px-4 py-2.5"
          style={{ borderBottom: '1px solid var(--cc-panel-divider)' }}
        >
          <div
            className="uppercase"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                opacity: 0.4,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
