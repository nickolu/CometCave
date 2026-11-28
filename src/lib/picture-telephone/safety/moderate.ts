import OpenAI from 'openai'

import { MODERATION_MODEL, MODERATION_THRESHOLDS, MODERATION_TIMEOUT_MS } from './config'

/* Moderation, fail closed. Only a successful response whose scores are all
   under threshold counts as allowed. A missing result, a thrown error, a
   timeout or an unreadable response is `unavailable`, which is never "safe". */

export interface ModerationLike {
  flagged: boolean
  category_scores: Record<string, number | null | undefined>
}

export interface ModerationDecision {
  allowed: boolean
  reasons: string[]
}

export const UNAVAILABLE = 'unavailable'

export function isUnavailable(decision: ModerationDecision): boolean {
  return !decision.allowed && decision.reasons.includes(UNAVAILABLE)
}

const UNAVAILABLE_DECISION = (): ModerationDecision => ({ allowed: false, reasons: [UNAVAILABLE] })

/** Pure. Decides on one moderation result. */
export function decideModeration(
  result: ModerationLike | null | undefined,
  thresholds: Readonly<Record<string, number>> = MODERATION_THRESHOLDS
): ModerationDecision {
  const scores = result?.category_scores
  if (!result || typeof result.flagged !== 'boolean' || !scores || typeof scores !== 'object') {
    return UNAVAILABLE_DECISION()
  }

  const reasons: string[] = []
  let sawScore = false
  for (const [category, score] of Object.entries(scores)) {
    if (score === null || score === undefined) continue
    if (typeof score !== 'number' || Number.isNaN(score)) return UNAVAILABLE_DECISION()
    sawScore = true
    const limit = thresholds[category]
    if (limit !== undefined && score >= limit) reasons.push(category)
  }
  // A result with no scores at all tells us nothing.
  if (!sawScore) return UNAVAILABLE_DECISION()
  if (result.flagged && reasons.length === 0) reasons.push('flagged')
  return { allowed: reasons.length === 0, reasons }
}

export type ModerationInput = string | Array<{ type: 'image_url'; image_url: { url: string } }>

/** Calls the moderation model and returns its first result, or undefined. May throw. */
export type ModerationFn = (input: ModerationInput, signal: AbortSignal) => Promise<ModerationLike | undefined>

export function openAiModeration(): ModerationFn {
  return async (input, signal) => {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OPENAI_API_KEY is not set')
    const client = new OpenAI({ apiKey })
    const res = await client.moderations.create({ model: MODERATION_MODEL, input }, { signal })
    return res.results?.[0] as unknown as ModerationLike | undefined
  }
}

async function run(input: ModerationInput, fn: ModerationFn, timeoutMs: number): Promise<ModerationDecision> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort()
        reject(new Error('moderation timed out'))
      }, timeoutMs)
    })
    const result = await Promise.race([fn(input, controller.signal), timeout])
    return decideModeration(result)
  } catch {
    return UNAVAILABLE_DECISION()
  } finally {
    if (timer) clearTimeout(timer)
  }
}

export function moderateText(text: string, fn: ModerationFn, timeoutMs = MODERATION_TIMEOUT_MS) {
  return run(text, fn, timeoutMs)
}

export function moderateImage(dataUrl: string, fn: ModerationFn, timeoutMs = MODERATION_TIMEOUT_MS) {
  return run([{ type: 'image_url', image_url: { url: dataUrl } }], fn, timeoutMs)
}
