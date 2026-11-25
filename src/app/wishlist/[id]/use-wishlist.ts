'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { Marks, WishlistView } from '@/lib/wishlist/store'

/** Other relatives' marks should show up without a reload, but this is not a chat. */
const POLL_MS = 45_000

export type LoadState = 'loading' | 'ready' | 'missing' | 'error'
export type SyncState = 'idle' | 'saving' | 'failed'

/**
 * The list plus its marks, shared by everyone holding the link.
 *
 * Marks change at once on the device that tapped and the server catches up;
 * the server's answer (the full marks map) then replaces the optimistic copy,
 * so two relatives marking at the same time both end up seeing both marks. A
 * failed save puts the mark back and says so. Coming back to the tab, or just
 * leaving it open, re-reads the server so one person's purchase hides the
 * item for the next.
 */
export function useWishlist(id: string | undefined) {
  const [view, setView] = useState<WishlistView | null>(null)
  const [state, setState] = useState<LoadState>('loading')
  const [sync, setSync] = useState<SyncState>('idle')
  const inflight = useRef(0)

  const pull = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/v1/wishlist/${encodeURIComponent(id)}`, { cache: 'no-store' })
      if (res.status === 404) {
        setState('missing')
        return
      }
      if (!res.ok) throw new Error(`load failed: ${res.status}`)
      const next = (await res.json()) as WishlistView
      // A poll landing while a mark is in flight must not undo the optimistic
      // mark; the mark's own response carries the truth a moment later.
      setView(prev => (inflight.current && prev ? { ...next, marks: prev.marks } : next))
      setState('ready')
    } catch {
      setState(prev => (prev === 'ready' ? prev : 'error'))
    }
  }, [id])

  useEffect(() => {
    void pull()
  }, [pull])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void pull()
    }, POLL_MS)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
      clearInterval(timer)
    }
  }, [pull])

  const mark = useCallback(
    async (key: string, bought: boolean, by: string): Promise<boolean> => {
      if (!id) return false
      let before: Marks = {}
      setView(prev => {
        if (!prev) return prev
        before = prev.marks
        const marks = { ...prev.marks }
        if (bought) marks[key] = { at: Date.now(), ...(by ? { by } : {}) }
        else delete marks[key]
        return { ...prev, marks }
      })
      inflight.current++
      setSync('saving')
      try {
        const res = await fetch(`/api/v1/wishlist/${encodeURIComponent(id)}/mark`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(by ? { key, bought, by } : { key, bought }),
        })
        if (!res.ok) throw new Error(`mark failed: ${res.status}`)
        const { marks } = (await res.json()) as { marks: Marks }
        setView(prev => (prev ? { ...prev, marks } : prev))
        setSync('idle')
        return true
      } catch {
        setView(prev => (prev ? { ...prev, marks: before } : prev))
        setSync('failed')
        return false
      } finally {
        inflight.current--
      }
    },
    [id]
  )

  return { view, state, sync, mark, reload: pull }
}
