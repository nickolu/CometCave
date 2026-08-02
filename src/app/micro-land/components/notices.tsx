'use client'

import { useEffect } from 'react'

import { useMicroLand } from '@/app/micro-land/store'

const LIFETIME_MS = 4200

/** Small, quiet messages about what just happened in the world. */
export function Notices() {
  const notices = useMicroLand(s => s.notices)
  const dismiss = useMicroLand(s => s.dismissNotice)

  useEffect(() => {
    if (notices.length === 0) return
    const timers = notices.map(notice => setTimeout(() => dismiss(notice.id), LIFETIME_MS))
    return () => timers.forEach(clearTimeout)
  }, [notices, dismiss])

  if (notices.length === 0) return null

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 flex-col items-center gap-1.5 px-3"
      aria-live="polite"
    >
      {notices.map(notice => (
        <div
          key={notice.id}
          // Notices are a pass-through layer over the canvas, so the strip
          // itself must not take pointer events — only an actual button may.
          className={`flex items-center gap-2 rounded-full py-1.5 pl-3.5 text-center backdrop-blur-sm ${
            notice.action ? 'pointer-events-auto pr-1.5' : 'pr-3.5'
          }`}
          style={{
            fontSize: 12,
            color: 'var(--cc-text-default)',
            background: 'rgba(2, 8, 10, 0.72)',
            border: '1px solid var(--cc-mint-line)',
            maxWidth: '92vw',
          }}
        >
          <span>{notice.text}</span>
          {notice.action && (
            <button
              type="button"
              className="cc-btn shrink-0"
              onClick={() => {
                notice.action?.run()
                dismiss(notice.id)
              }}
              style={{
                fontFamily: 'var(--cc-font-mono)',
                fontSize: 10,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                padding: '4px 10px',
                minHeight: 28,
                borderRadius: 999,
                border: '1px solid var(--cc-mint)',
                background: 'var(--cc-mint-soft)',
                color: 'var(--cc-mint)',
              }}
            >
              {notice.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
