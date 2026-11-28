/**
 * The one table that decides how much generated content a player gets per day.
 *
 * Every route that calls a model goes through `requireAiAccess` with one of
 * these feature keys. Each call costs the feature's weight in credits, and a
 * player has `DAILY_CREDITS` to spend between midnights (Pacific, the same
 * clock Daily Trivia keeps). The cave's owner is never metered.
 *
 * Weights are rough relative cost, not pricing: a cheap one-shot text call is
 * 1, a bigger model with a long context is a few, an image is around ten, and a
 * Micro Land summon — a frontier model writing up to 32k tokens of pixel art —
 * is the most expensive thing a player can ask for. Tune the numbers here;
 * nothing else needs to change.
 */

export const DAILY_CREDITS = 120

export const AI_FEATURES = {
  // Trivia
  'trivia-judge': 1, // daily game, free-text answer judged by a small model
  'trivia-infinite-judge': 1,
  'trivia-infinite-generate': 2,

  // Dicebound
  'dicebound-character': 3,
  'dicebound-turn': 4,
  'dicebound-suggest': 1,

  // Micro Land
  'micro-land-summon': 15,

  // Tool-style games
  'secret-word': 1,
  'blanks-story': 2, // one story template per topic; a few hundred tokens of prose
  'voters': 1,
  'oracle': 2,
  'chat-room': 2,
  'tap-tap-text': 2,
  'whowouldwininator-text': 1,
  'whowouldwininator-image': 10,
  'avatar-maker-image': 10,

  // Picture Telephone. Tunable. An image is a low-quality 1024px render, much
  // cheaper than the 10-credit portraits above, so it weighs 3. Moderation
  // calls are free and have no key here.
  'picture-telephone-image': 3, // one low-quality picture (plus a rare one-time regenerate)
  'picture-telephone-describe': 1, // an AI seat captions a picture with a small vision model
  'picture-telephone-starter': 1, // "AI starts": one opening sentence from a small model
} as const

export type AiFeature = keyof typeof AI_FEATURES

export function costOf(feature: AiFeature): number {
  return AI_FEATURES[feature]
}

/** Shape of the error body every gated route returns, so clients can branch on `code`. */
export type AiGateCode = 'SIGN_IN_REQUIRED' | 'AI_LIMIT_REACHED' | 'AI_UNAVAILABLE'

export interface AiGateErrorBody {
  error: string
  code: AiGateCode
  /** ISO timestamp of the next reset, only on AI_LIMIT_REACHED. */
  resetsAt?: string
}
