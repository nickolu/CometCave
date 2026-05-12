'use client'

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

type Side = 'top' | 'left' | 'right' | 'bottom'

interface Pos {
  top: number
  left: number
  transform: string
}

const ZERO_POS: Pos = { top: 0, left: 0, transform: '' }

function computePos(rect: DOMRect, side: Side, gap: number): Pos {
  switch (side) {
    case 'left':
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        transform: 'translate(-100%, -50%)',
      }
    case 'right':
      return {
        top: rect.top + rect.height / 2,
        left: rect.right + gap,
        transform: 'translateY(-50%)',
      }
    case 'top':
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, -100%)',
      }
    case 'bottom':
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        transform: 'translate(-50%, 0)',
      }
  }
}

export function Tooltip({
  children,
  content,
  side = 'left',
  width = 220,
  className,
  style,
}: {
  children: ReactNode
  content: ReactNode
  side?: Side
  width?: number
  className?: string
  style?: CSSProperties
}) {
  const triggerRef = useRef<HTMLSpanElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<Pos>(ZERO_POS)

  const measure = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    setPos(computePos(el.getBoundingClientRect(), side, 6))
  }, [side])

  useLayoutEffect(() => {
    if (!open) return
    measure()
    const onChange = () => measure()
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    return () => {
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
    }
  }, [open, measure])

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => () => cancelClose(), [])

  // The cosmic theme's CSS custom properties are scoped to .cosmic-cards.
  // Portalling into document.body strands the tooltip outside that scope,
  // so re-apply the class on the portal root to pull the tokens back in.
  const tooltipNode = open && typeof document !== 'undefined' && (
    <span
      className="cosmic-cards"
      role="tooltip"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        transform: pos.transform,
        zIndex: 9999,
        background: '#0f111c',
        border: '1px solid rgba(94,234,212,0.3)',
        color: '#e6fff7',
        padding: '8px 10px',
        borderRadius: 4,
        fontSize: 11,
        lineHeight: 1.45,
        width,
        boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
        whiteSpace: 'normal',
        textAlign: 'left',
        textTransform: 'none',
        letterSpacing: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {content}
    </span>
  )

  return (
    <span
      ref={triggerRef}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', ...style }}
      onMouseEnter={() => {
        cancelClose()
        setOpen(true)
      }}
      onMouseLeave={scheduleClose}
      onFocus={() => {
        cancelClose()
        setOpen(true)
      }}
      onBlur={scheduleClose}
    >
      {children}
      {tooltipNode && createPortal(tooltipNode, document.body)}
    </span>
  )
}
