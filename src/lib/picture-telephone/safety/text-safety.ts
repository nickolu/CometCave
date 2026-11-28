import { matchesBlocklist } from './blocklist'
import { type ModerationFn, isUnavailable, moderateText } from './moderate'

export type TextVerdict = { ok: true } | { ok: false; reason: 'blocked' | 'flagged' | 'unavailable' }

/**
 * The text layers for any sentence a player or a model wrote: blocklist first
 * (free), then the moderation model. `moderation: null` is mock mode, which
 * runs the blocklist only. Anything but a clean pass is a rejection.
 */
export async function checkTextSafety(text: string, moderation: ModerationFn | null): Promise<TextVerdict> {
  if (matchesBlocklist(text)) return { ok: false, reason: 'blocked' }
  if (!moderation) return { ok: true }
  const decision = await moderateText(text, moderation)
  if (decision.allowed) return { ok: true }
  return { ok: false, reason: isUnavailable(decision) ? 'unavailable' : 'flagged' }
}
