'use client'

import { useCallback, useEffect, useState } from 'react'

import { useAuth } from '@/hooks/useAuth'
import { useIsOwner } from '@/hooks/useIsOwner'

export type ValidationKind = 'joker' | 'voucher' | 'tag' | 'bossBlind'
export type ValidationStatus = 'validated' | 'failed'

interface ValidationState {
  joker: Record<string, ValidationStatus>
  voucher: Record<string, ValidationStatus>
  tag: Record<string, ValidationStatus>
  bossBlind: Record<string, ValidationStatus>
}

const LEGACY_KEY = 'dcg.sandbox.validations.v2'
const ENDPOINT = '/api/v1/comet-cards/sandbox/validations'
const EMPTY: ValidationState = { joker: {}, voucher: {}, tag: {}, bossBlind: {} }

function isEmpty(state: ValidationState) {
  return (
    Object.keys(state.joker).length === 0 &&
    Object.keys(state.voucher).length === 0 &&
    Object.keys(state.tag).length === 0 &&
    Object.keys(state.bossBlind).length === 0
  )
}

function readLegacyLocalStorage(): ValidationState | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ValidationState>
    return {
      joker: parsed.joker ?? {},
      voucher: parsed.voucher ?? {},
      tag: parsed.tag ?? {},
      bossBlind: parsed.bossBlind ?? {},
    }
  } catch {
    return null
  }
}

function clearLegacyLocalStorage() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}

function countByStatus(map: Record<string, ValidationStatus>) {
  let validated = 0
  let failed = 0
  for (const status of Object.values(map)) {
    if (status === 'validated') validated++
    else if (status === 'failed') failed++
  }
  return { validated, failed }
}

export function useValidations() {
  const { user } = useAuth()
  const { isOwner } = useIsOwner()
  const [state, setState] = useState<ValidationState>(EMPTY)
  // Tracks whether the local `state` reflects a known-good source (server
  // doc or migrated legacy data). Until hydrated, the push-on-change effect
  // stays quiet so we don't clobber the server with the initial EMPTY.
  const [hydrated, setHydrated] = useState(false)

  // Hydrate from Firestore on owner login. If the remote doc is empty but
  // legacy localStorage has data, seed the state from localStorage — the
  // push effect below will write it up and we clear the local key.
  //
  // The hook unmounts when the owner gate flips (see sandbox/page.tsx), so
  // we don't need to reset local state mid-effect for sign-out.
  useEffect(() => {
    if (!user || !isOwner) return
    let cancelled = false
    void (async () => {
      try {
        const token = await user.getIdToken()
        const res = await fetch(ENDPOINT, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok || cancelled) return
        const data = (await res.json()) as { state: ValidationState }
        const remote = data.state ?? EMPTY
        if (isEmpty(remote)) {
          const legacy = readLegacyLocalStorage()
          if (legacy && !isEmpty(legacy)) {
            setState(legacy)
            clearLegacyLocalStorage()
            setHydrated(true)
            return
          }
        }
        setState(remote)
        setHydrated(true)
      } catch (err) {
        console.error('[sandbox] failed to load validations:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, isOwner])

  // Push changes to the server whenever the hydrated state changes.
  useEffect(() => {
    if (!hydrated || !user || !isOwner) return
    let cancelled = false
    void (async () => {
      try {
        const token = await user.getIdToken()
        if (cancelled) return
        const res = await fetch(ENDPOINT, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ state }),
        })
        if (!res.ok) {
          console.error('[sandbox] failed to persist validations: HTTP', res.status)
        }
      } catch (err) {
        console.error('[sandbox] failed to persist validations:', err)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [state, hydrated, user, isOwner])

  const getStatus = useCallback(
    (kind: ValidationKind, id: string): ValidationStatus | undefined => state[kind][id],
    [state]
  )

  // Setting status to the current value clears it (so clicking "Mark validated"
  // on an already-validated item unmarks it). Otherwise sets to the new status.
  const setStatus = useCallback(
    (kind: ValidationKind, id: string, status: ValidationStatus) => {
      setState(prev => {
        const next: ValidationState = { ...prev, [kind]: { ...prev[kind] } }
        if (next[kind][id] === status) {
          delete next[kind][id]
        } else {
          next[kind][id] = status
        }
        return next
      })
    },
    []
  )

  const clearKind = useCallback((kind: ValidationKind) => {
    setState(prev => ({ ...prev, [kind]: {} }))
  }, [])

  const counts = {
    joker: countByStatus(state.joker),
    voucher: countByStatus(state.voucher),
    tag: countByStatus(state.tag),
    bossBlind: countByStatus(state.bossBlind),
  }

  return { getStatus, setStatus, counts, clearKind }
}
