import { aiFetch, isAiAccessError } from '@/lib/api/ai-fetch'

import { ProviderError } from './provider-error'

import type { PictureProvider } from './provider'

/* The real provider: talks to /api/v1/picture-telephone/* through `aiFetch`.
   The server owns every safety decision; this file only carries requests and
   maps failures onto the reducer's WorkError codes. */

const BASE = '/api/v1/picture-telephone'

interface ErrorBody {
  error?: string
  code?: string
  retryable?: boolean
}

const TRY_AGAIN = 'Something went wrong. Try again.'

/** Pure. Server error body (plus HTTP status) -> the error the reducer understands. */
export function mapApiFailure(status: number, body: ErrorBody | null): ProviderError {
  const message = body?.error || TRY_AGAIN
  switch (body?.code) {
    case 'TEXT_REJECTED':
    case 'IMAGE_REJECTED':
      return new ProviderError(body.code, message, false)
    case 'IMAGES_DISABLED':
    case 'NOT_CONFIGURED':
    case 'IMAGE_NOT_SIGNED':
      return new ProviderError('UPSTREAM', message, false)
    case 'MODERATION_UNAVAILABLE':
    case 'RATE_LIMITED':
    case 'UPSTREAM':
      return new ProviderError('UPSTREAM', message, true)
    case 'BAD_REQUEST':
      return new ProviderError('UNKNOWN', message, false)
  }
  return status >= 500 ? new ProviderError('UPSTREAM', message, true) : new ProviderError('UNKNOWN', message, false)
}

/** Pure. Anything a request can throw -> ProviderError. */
export function mapThrown(err: unknown): ProviderError {
  if (err instanceof ProviderError) return err
  // Gate refusals carry a message that is already fit to show.
  if (isAiAccessError(err)) return new ProviderError('UPSTREAM', err.message, err.code === 'AI_UNAVAILABLE')
  return new ProviderError('UPSTREAM', 'Could not reach the server. Check your connection and try again.', true)
}

export interface ApiProviderOptions {
  fetcher?: (input: string, init: RequestInit) => Promise<Response>
}

export function createApiProvider(options: ApiProviderOptions = {}): PictureProvider {
  const fetcher = options.fetcher ?? aiFetch
  /** Signatures for pictures this session drew, keyed by picture. `describe` needs them. */
  const signatures = new Map<string, string>()

  async function post(path: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    let res: Response
    try {
      res = await fetcher(`${BASE}/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch (err) {
      throw mapThrown(err)
    }
    const body = (await res.json().catch(() => null)) as (Record<string, unknown> & ErrorBody) | null
    if (!res.ok || !body) throw mapApiFailure(res.status, body)
    return body
  }

  return {
    async image(sentence) {
      const body = await post('image', { sentence })
      if (typeof body.image !== 'string') throw new ProviderError('UPSTREAM', TRY_AGAIN, true)
      if (typeof body.signature === 'string') signatures.set(body.image, body.signature)
      return { src: body.image, mock: body.mock === true }
    },
    async describe(personalityId, src) {
      const body = await post('describe', { personalityId, image: src, signature: signatures.get(src) ?? null })
      if (typeof body.text !== 'string') throw new ProviderError('UPSTREAM', TRY_AGAIN, true)
      return { text: body.text }
    },
    async starter() {
      const body = await post('starter', {})
      if (typeof body.text !== 'string') throw new ProviderError('UPSTREAM', TRY_AGAIN, true)
      return { text: body.text }
    },
    async checkText(text) {
      try {
        const body = await post('moderate', { text })
        if (body.ok === false) {
          return { ok: false, message: typeof body.message === 'string' ? body.message : undefined }
        }
        return { ok: true }
      } catch {
        // This check is only the friendly early warning. The image route runs
        // the same layers again and fails closed, so a hiccup here is not a bypass.
        return { ok: true }
      }
    },
  }
}
