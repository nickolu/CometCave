'use client'

import { useState, type ReactNode } from 'react'

export function CollapsibleSection({
  title,
  subtitle,
  defaultOpen = true,
  children,
}: {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-lg border backdrop-blur-md"
      style={{
        background: 'linear-gradient(180deg, var(--cc-panel-grad-from), var(--cc-panel-grad-to))',
        borderColor: 'var(--cc-panel-border)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5"
        style={{
          borderBottom: open ? '1px solid var(--cc-panel-divider)' : 'none',
          background: 'transparent',
          color: 'inherit',
          cursor: 'pointer',
        }}
        aria-expanded={open}
      >
        <div className="flex items-center" style={{ gap: 8 }}>
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              width: 10,
              opacity: 0.7,
              transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.12s',
              display: 'inline-block',
            }}
          >
            ▶
          </span>
          <span
            className="uppercase"
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              letterSpacing: 2,
              opacity: 0.6,
            }}
          >
            {title}
          </span>
        </div>
        {subtitle && (
          <span
            style={{
              fontFamily: 'var(--cc-font-mono)',
              fontSize: 10,
              opacity: 0.4,
            }}
          >
            {subtitle}
          </span>
        )}
      </button>
      {open && children}
    </div>
  )
}
