'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { VoiceJourneyProgress } from '@/lib/voice-journey/progress-store'

const ENDPOINT = '/api/v1/voice-journey'
const CACHE_KEY = 'voice-journey-progress-v1'
/** Long enough to swallow a burst of taps, short enough to feel instant. */
const FLUSH_DELAY_MS = 600

export type SyncState = 'saving' | 'saved' | 'offline'

/**
 * A calendar day in the device's own timezone.
 *
 * `toISOString().slice(0, 10)` would be tempting and wrong: it is UTC, so an
 * evening practice session in the Americas gets filed under tomorrow, and the
 * streak counter then finds a hole where a practice day should be.
 */
export function localDayKey(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** Today as the device sees it. */
export function todayLocal(): string {
  return localDayKey(new Date())
}

interface CachedProgress extends VoiceJourneyProgress {
  /** True when this device holds changes the server has not accepted yet. */
  dirty: boolean
}

function readCache(): CachedProgress | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<CachedProgress>
    if (typeof parsed !== 'object' || parsed === null) return null
    return {
      completed: parsed.completed ?? {},
      log: Array.isArray(parsed.log) ? parsed.log : [],
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : 0,
      dirty: parsed.dirty === true,
    }
  } catch {
    return null
  }
}

function writeCache(next: CachedProgress): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next))
  } catch {
    // Private browsing, or a full quota. The server is still the real store.
  }
}

/**
 * Her progress, shared across every device she opens the page on.
 *
 * The local cache is a paint accelerator and an offline buffer, never the
 * truth: a returning visit shows the last known state immediately, then the
 * server's copy replaces it a moment later. Writes go the other way — state
 * changes at once, the network catches up, and a failed write leaves the page
 * usable with `sync` reading 'offline' until it lands.
 *
 * Conflicts resolve last-write-wins, which is right for a single singer and
 * would not be for two. Coming back to a tab re-reads the server first, so the
 * common two-device case — tablet in the morning, phone at night — does not
 * clobber itself.
 */
export function useProgress() {
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [log, setLog] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [sync, setSync] = useState<SyncState>('saved')

  /** The state a flush should send — refs so timers never send a stale closure. */
  const pending = useRef<{ completed: Record<string, boolean>; log: string[] }>({
    completed: {},
    log: [],
  })
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const started = useRef(false)

  const adopt = useCallback((next: VoiceJourneyProgress, isDirty: boolean) => {
    setCompleted(next.completed)
    setLog(next.log)
    pending.current = { completed: next.completed, log: next.log }
    dirty.current = isDirty
    writeCache({ ...next, dirty: isDirty })
  }, [])

  const flush = useCallback(async () => {
    if (!dirty.current) return
    setSync('saving')
    try {
      const res = await fetch(ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pending.current),
      })
      if (!res.ok) throw new Error(`save failed: ${res.status}`)
      const saved = (await res.json()) as VoiceJourneyProgress
      // Only the timestamp is adopted. Re-adopting the body would undo any tap
      // that happened while this request was in flight.
      dirty.current = false
      writeCache({ ...pending.current, updatedAt: saved.updatedAt, dirty: false })
      setSync('saved')
    } catch {
      setSync('offline')
    }
  }, [])

  const schedule = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      timer.current = null
      void flush()
    }, FLUSH_DELAY_MS)
  }, [flush])

  const commit = useCallback(
    (nextCompleted: Record<string, boolean>, nextLog: string[]) => {
      setCompleted(nextCompleted)
      setLog(nextLog)
      pending.current = { completed: nextCompleted, log: nextLog }
      dirty.current = true
      writeCache({ ...pending.current, updatedAt: Date.now(), dirty: true })
      schedule()
    },
    [schedule]
  )

  const pull = useCallback(async () => {
    // A device holding unsent taps pushes them rather than being overwritten.
    if (dirty.current) {
      await flush()
      return
    }
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' })
      if (!res.ok) throw new Error(`load failed: ${res.status}`)
      adopt((await res.json()) as VoiceJourneyProgress, false)
      setSync('saved')
    } catch {
      setSync('offline')
    }
  }, [adopt, flush])

  useEffect(() => {
    if (started.current) return
    started.current = true

    const cached = readCache()
    if (cached) {
      adopt(
        { completed: cached.completed, log: cached.log, updatedAt: cached.updatedAt },
        cached.dirty
      )
      setReady(true)
    }

    void pull().finally(() => setReady(true))
  }, [adopt, pull])

  // Coming back to the tab is the moment the other device's work should appear.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onVisible)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onVisible)
    }
  }, [pull])

  // A pending tap must not die with the tab.
  useEffect(() => {
    const onHide = () => {
      if (!dirty.current) return
      navigator.sendBeacon?.(
        ENDPOINT,
        new Blob([JSON.stringify(pending.current)], { type: 'application/json' })
      )
    }
    window.addEventListener('pagehide', onHide)
    return () => window.removeEventListener('pagehide', onHide)
  }, [])

  const toggleItem = useCallback(
    (id: string) => {
      const nextCompleted = { ...pending.current.completed }
      let nextLog = pending.current.log

      if (nextCompleted[id]) {
        delete nextCompleted[id]
      } else {
        nextCompleted[id] = true
        const today = todayLocal()
        if (!nextLog.includes(today)) nextLog = [...nextLog, today].sort()
      }

      commit(nextCompleted, nextLog)
    },
    [commit]
  )

  /** Returns false when today was already logged, so the caller can skip the fanfare. */
  const logToday = useCallback((): boolean => {
    const today = todayLocal()
    if (pending.current.log.includes(today)) return false
    commit(pending.current.completed, [...pending.current.log, today].sort())
    return true
  }, [commit])

  return { completed, log, ready, sync, toggleItem, logToday }
}
