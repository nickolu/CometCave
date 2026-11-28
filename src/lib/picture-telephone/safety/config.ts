/* Picture Telephone safety tunables. Everything a human might want to adjust
   lives here. These are first guesses, deliberately stricter than OpenAI's own
   flags because the audience includes kids. Server-only: never import this
   from a client component. */

export const MODERATION_MODEL = 'omni-moderation-latest'
export const MODERATION_TIMEOUT_MS = 8000

/** A category's score at or above its value rejects the content. */
export const MODERATION_THRESHOLDS: Readonly<Record<string, number>> = {
  'sexual': 0.2,
  'sexual/minors': 0.01,
  'violence': 0.3,
  'violence/graphic': 0.1,
  'harassment': 0.4,
  'harassment/threatening': 0.2,
  'hate': 0.2,
  'hate/threatening': 0.1,
  'illicit': 0.3,
  'illicit/violent': 0.2,
  'self-harm': 0.1,
  'self-harm/intent': 0.05,
  'self-harm/instructions': 0.05,
}

// TODO: gpt-image-1 may retire around Dec 2026. Move to the cheapest current
// GPT Image model (for example gpt-image-1-mini) by setting the env var; no
// code change needed.
export const DEFAULT_IMAGE_MODEL = 'gpt-image-1'
export const IMAGE_SIZE = '1024x1024'
export const IMAGE_QUALITY = 'low'
export const IMAGE_FORMAT = 'jpeg'
export const IMAGE_COMPRESSION = 60
export const IMAGE_MIME = 'image/jpeg'

export function imageModel(env: Record<string, string | undefined> = process.env): string {
  return env.PICTURE_TELEPHONE_IMAGE_MODEL?.trim() || DEFAULT_IMAGE_MODEL
}

export const TEXT_MODEL = 'claude-haiku-4-5-20251001'

/** Longest accepted request fields. */
export const MAX_SENTENCE_RAW = 400
export const MAX_MODERATE_TEXT = 200
/** Longest accepted data URL for `describe` (base64 characters). */
export const MAX_DESCRIBE_IMAGE_CHARS = 2_500_000

/** Per-uid cap on the free `moderate` route. */
export const MODERATE_RATE_WINDOW_MS = 60 * 60 * 1000
export const MODERATE_RATE_MAX = 60

/** Used when the safer rewrite itself is rejected or unavailable. */
export const SAFE_SCENE_SENTENCE = 'a friendly cartoon scene with a cheerful animal'

export const TEXT_REJECTED_MESSAGE = 'Try another one. That sentence cannot be drawn.'
export const IMAGE_REJECTED_MESSAGE = 'That one is too tricky to draw. Try describing something else!'
