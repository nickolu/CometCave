import { PERSONALITIES } from './personalities'

import type { Seat, Settings } from './types'

export const MIN_SEATS = 2
export const MAX_SEATS = 8
export const MIN_CHAIN = 4
export const MAX_CHAIN = 10
export const DEFAULT_CHAIN = 6
export const SENTENCE_MIN = 3
export const SENTENCE_MAX = 140
export const NAME_MAX = 16

/** Trim, collapse whitespace, drop control characters, cap the length. Null when too short to use. */
export function cleanSentence(text: string): string | null {
  // eslint-disable-next-line no-control-regex
  const stripped = text.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ')
  const collapsed = stripped.replace(/\s+/g, ' ').trim()
  const capped = collapsed.slice(0, SENTENCE_MAX).trim()
  return capped.length >= SENTENCE_MIN ? capped : null
}

export function cleanName(name: string): string {
  // eslint-disable-next-line no-control-regex
  return name.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX)
}

export function defaultSeatName(index: number, kind: Seat['kind'], personalityId?: string): string {
  if (kind === 'ai') {
    const persona = PERSONALITIES.find(p => p.id === personalityId)
    return persona ? persona.name : `Robot ${index + 1}`
  }
  return `Player ${index + 1}`
}

export type SettingsCheck = { ok: true } | { ok: false; error: string }

export function validateSettings(settings: Settings): SettingsCheck {
  const { seats, chainLength } = settings
  if (seats.length < MIN_SEATS) return { ok: false, error: `You need at least ${MIN_SEATS} players.` }
  if (seats.length > MAX_SEATS) return { ok: false, error: `That is too many players (up to ${MAX_SEATS}).` }
  if (!seats.some(s => s.kind === 'human')) return { ok: false, error: 'At least one player has to be a person.' }
  if (new Set(seats.map(s => s.id)).size !== seats.length) return { ok: false, error: 'Every player needs a unique seat.' }
  if (seats.some(s => cleanName(s.name).length === 0)) return { ok: false, error: 'Every player needs a name.' }
  if (!Number.isInteger(chainLength) || chainLength < MIN_CHAIN || chainLength > MAX_CHAIN) {
    return { ok: false, error: `The chain needs ${MIN_CHAIN} to ${MAX_CHAIN} pictures.` }
  }
  return { ok: true }
}
