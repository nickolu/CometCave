import { getPersonality } from '../personalities'

import { GENTLE_SUFFIX } from './personas'
import { type TextVerdict } from './text-safety'

const MAX_WORDS = 16
const MIN_WORDS = 3
const MAX_CHARS = 140

/** Pure. First line, quotes and a leading label stripped, capped; null when too short to use. */
export function cleanDescription(raw: string): string | null {
  const firstLine = raw.split(/\r?\n/).find(l => l.trim().length > 0) ?? ''
  let text = firstLine
    .replace(/^\s*(description|caption|answer)\s*:\s*/i, '')
    .replace(/^["'“”‘’`\s]+|["'“”‘’`\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const words = text.split(' ').filter(Boolean)
  if (words.length < MIN_WORDS) return null
  if (words.length > MAX_WORDS) text = words.slice(0, MAX_WORDS).join(' ')
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS).replace(/\s+\S*$/, '').trim()
  return text.split(' ').filter(Boolean).length >= MIN_WORDS ? text : null
}

export function fallbackLineFor(personalityId: string, seed: number): string {
  const lines = getPersonality(personalityId).fallbackLines
  return lines[Math.abs(seed) % lines.length]
}

export type DescribeOutcome =
  | { ok: true; text: string; fallback: boolean }
  | { ok: false; reason: 'unavailable' }

export interface DescribeDeps {
  /** Ask the model; `extra` is appended to the system prompt on the retry. Throws on upstream failure. */
  model: (extra: string) => Promise<string>
  check: (text: string) => Promise<TextVerdict>
  seed: number
}

/**
 * Model line -> clean -> text layers. One gentler retry, then a hand-written
 * fallback line (not model output, so safe). If moderation itself is down the
 * outcome is unavailable and nothing is shown.
 */
export async function describeWithPersona(personalityId: string, deps: DescribeDeps): Promise<DescribeOutcome> {
  for (const extra of ['', GENTLE_SUFFIX]) {
    const cleaned = cleanDescription(await deps.model(extra))
    if (!cleaned) continue
    const verdict = await deps.check(cleaned)
    if (verdict.ok) return { ok: true, text: cleaned, fallback: false }
    if (verdict.reason === 'unavailable') return { ok: false, reason: 'unavailable' }
  }
  return { ok: true, text: fallbackLineFor(personalityId, deps.seed), fallback: true }
}
