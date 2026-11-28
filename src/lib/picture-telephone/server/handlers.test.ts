import { describe, expect, it, vi } from 'vitest'

import { fallbackLineFor } from '../safety/describe'
import { type ModerationLike } from '../safety/moderate'
import { signImage } from '../safety/signing'
import { STARTER_SENTENCES } from '../starters'

import { ContentPolicyError, type Deps, handleDescribe, handleImage, handleModerate, handleStarter } from './handlers'

import type { AuthClaims } from '@/lib/users/profile'

const KEY = 'test-key'
const CLEAN: ModerationLike = { flagged: false, category_scores: { sexual: 0.001, violence: 0.001 } }
const FLAGGED: ModerationLike = { flagged: false, category_scores: { sexual: 0.9 } }
const claims = { uid: 'u1', isAnonymous: false } as unknown as AuthClaims

const JPEG_B64 = Buffer.from('fake jpeg bytes for tests').toString('base64')
const JPEG_URL = `data:image/jpeg;base64,${JPEG_B64}`

type Mod = ModerationLike | 'throw' | undefined

function req(body: unknown): Request {
  return new Request('http://test.local/x', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) })
}

interface Setup {
  deps: Deps
  spend: ReturnType<typeof vi.fn>
  generate: ReturnType<typeof vi.fn>
  complete: ReturnType<typeof vi.fn>
}

/** `textMods` / `imageMods` are queues of moderation results; the last one repeats. */
function setup(over: Partial<Deps> = {}, opts: { textMods?: Mod[]; imageMods?: Mod[]; completions?: string[] } = {}): Setup {
  const textMods = [...(opts.textMods ?? [CLEAN])]
  const imageMods = [...(opts.imageMods ?? [CLEAN])]
  const completions = [...(opts.completions ?? ['A calm little boat floats on a quiet pond.'])]
  const next = (q: Mod[]): Mod => (q.length > 1 ? q.shift() : q[0])
  const spend = vi.fn(async () => null)
  const generate = vi.fn(async () => JPEG_B64)
  const complete = vi.fn(async () => {
    const c = completions.length > 1 ? completions.shift()! : completions[0]
    if (c === 'THROW') throw new Error('upstream')
    return c
  })
  const deps: Deps = {
    env: { NODE_ENV: 'test', PICTURE_TELEPHONE_SIGNING_KEY: KEY },
    requireSignedIn: async () => ({ claims }),
    spend,
    moderation: async input => {
      const r = next(Array.isArray(input) ? imageMods : textMods)
      if (r === 'throw') throw new Error('moderation down')
      return r
    },
    imageGenerationAllowed: () => true,
    imageDisableReason: () => 'Images are off.',
    generateImage: generate,
    completeText: complete,
    checkModerateLimit: async () => ({ limited: false }),
    random: () => 0,
    ...over,
  }
  return { deps, spend, generate, complete }
}

const signedOut = (): Partial<Deps> => ({
  requireSignedIn: async () => ({ error: Response.json({ code: 'SIGN_IN_REQUIRED' }, { status: 401 }) }),
})

describe('image route', () => {
  it('refuses signed-out callers before anything else', async () => {
    const s = setup(signedOut())
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(401)
    expect(s.spend).not.toHaveBeenCalled()
    expect(s.generate).not.toHaveBeenCalled()
  })

  it('returns a clear error with no spend when image generation is disabled', async () => {
    const s = setup({ imageGenerationAllowed: () => false })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: 'IMAGES_DISABLED', error: 'Images are off.' })
    expect(s.spend).not.toHaveBeenCalled()
    expect(s.generate).not.toHaveBeenCalled()
  })

  it('rejects a blocklisted sentence before spending or calling a model', async () => {
    const s = setup()
    const res = await handleImage(req({ sentence: 'a naked person' }), s.deps)
    expect(res.status).toBe(422)
    expect((await res.json()).code).toBe('TEXT_REJECTED')
    expect(s.spend).not.toHaveBeenCalled()
    expect(s.generate).not.toHaveBeenCalled()
  })

  it('rejects a moderated sentence before spending', async () => {
    const s = setup({}, { textMods: [FLAGGED] })
    const res = await handleImage(req({ sentence: 'a perfectly fine sentence' }), s.deps)
    expect(res.status).toBe(422)
    expect(s.spend).not.toHaveBeenCalled()
    expect(s.generate).not.toHaveBeenCalled()
  })

  it('fails closed (503, no spend) when text moderation is unavailable', async () => {
    const s = setup({}, { textMods: ['throw'] })
    const res = await handleImage(req({ sentence: 'a perfectly fine sentence' }), s.deps)
    expect(res.status).toBe(503)
    expect((await res.json()).code).toBe('MODERATION_UNAVAILABLE')
    expect(s.spend).not.toHaveBeenCalled()
  })

  it('rejects malformed bodies and too-short sentences', async () => {
    const s = setup()
    expect((await handleImage(req('not json'), s.deps)).status).toBe(400)
    expect((await handleImage(req({ sentence: 42 }), s.deps)).status).toBe(400)
    expect((await handleImage(req({ sentence: 'x'.repeat(500) }), s.deps)).status).toBe(400)
    expect((await handleImage(req({ sentence: 'hi' }), s.deps)).status).toBe(422)
    expect(s.spend).not.toHaveBeenCalled()
  })

  it('fails closed in production without a signing key, before spending', async () => {
    const s = setup({ env: { NODE_ENV: 'production' } })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(503)
    expect(s.spend).not.toHaveBeenCalled()
    expect(s.generate).not.toHaveBeenCalled()
  })

  it('returns a moderated, signed image and spends once', async () => {
    const s = setup()
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.image).toBe(JPEG_URL)
    expect(body.signature).toBe(signImage(Buffer.from(JPEG_B64, 'base64'), KEY))
    expect(body.mock).toBe(false)
    expect(s.spend).toHaveBeenCalledTimes(1)
    expect(s.spend).toHaveBeenCalledWith(claims, 'picture-telephone-image')
    expect(s.generate).toHaveBeenCalledTimes(1)
    expect(s.generate.mock.calls[0][0]).toContain('a cat on a mat')
  })

  it('uses the configured model', async () => {
    const s = setup({ env: { NODE_ENV: 'test', PICTURE_TELEPHONE_IMAGE_MODEL: 'gpt-image-1-mini' } })
    await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(s.generate.mock.calls[0][1]).toBe('gpt-image-1-mini')
  })

  it('regenerates once when the image fails moderation, spending once', async () => {
    const s = setup({}, { imageMods: [FLAGGED, CLEAN], completions: ['A gentle cat naps on a soft mat.'] })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(200)
    expect(s.generate).toHaveBeenCalledTimes(2)
    expect(s.generate.mock.calls[1][0]).toContain('calm, gentle, wholesome')
    expect(s.generate.mock.calls[1][0]).toContain('A gentle cat naps on a soft mat.')
    expect(s.spend).toHaveBeenCalledTimes(1)
  })

  it('regenerates once on a provider content-policy refusal', async () => {
    const s = setup()
    s.generate.mockRejectedValueOnce(new ContentPolicyError())
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(200)
    expect(s.generate).toHaveBeenCalledTimes(2)
  })

  it('uses the constant scene when the rewrite is itself rejected', async () => {
    const s = setup({}, { imageMods: [FLAGGED, CLEAN], textMods: [CLEAN, FLAGGED], completions: ['something odd and flagged'] })
    await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(s.generate.mock.calls[1][0]).toContain('a friendly cartoon scene with a cheerful animal')
  })

  it('returns IMAGE_REJECTED after the one regenerate also fails, and never an image', async () => {
    const s = setup({}, { imageMods: [FLAGGED] })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.code).toBe('IMAGE_REJECTED')
    expect(body.image).toBeUndefined()
    expect(s.generate).toHaveBeenCalledTimes(2)
    expect(s.spend).toHaveBeenCalledTimes(1)
  })

  it('fails closed when image moderation is unavailable, without regenerating', async () => {
    const s = setup({}, { imageMods: ['throw'] })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.image).toBeUndefined()
    expect(s.generate).toHaveBeenCalledTimes(1)
  })

  it('does not regenerate on an upstream failure', async () => {
    const s = setup()
    s.generate.mockRejectedValueOnce(new Error('boom'))
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(502)
    expect(await res.json()).toMatchObject({ code: 'UPSTREAM', retryable: true })
    expect(s.generate).toHaveBeenCalledTimes(1)
  })

  it('passes a limit refusal from the gate straight through', async () => {
    const s = setup({ spend: async () => ({ error: Response.json({ code: 'AI_LIMIT_REACHED' }, { status: 429 }) }) })
    const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(429)
    expect(s.generate).not.toHaveBeenCalled()
  })

  describe('mock mode', () => {
    const env = { NODE_ENV: 'test', PICTURE_TELEPHONE_MOCK_IMAGES: 'true' }
    it('serves a placeholder with no spend and no model, even with the flag off', async () => {
      const s = setup({ env, imageGenerationAllowed: () => false })
      const res = await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)
      const body = await res.json()
      expect(body.mock).toBe(true)
      expect(body.image).toMatch(/^data:image\/svg\+xml/)
      expect(s.spend).not.toHaveBeenCalled()
      expect(s.generate).not.toHaveBeenCalled()
    })
    it('still runs the blocklist', async () => {
      const s = setup({ env })
      expect((await handleImage(req({ sentence: 'a naked person' }), s.deps)).status).toBe(422)
    })
    it('is ignored in production', async () => {
      const s = setup({ env: { ...env, VERCEL_ENV: 'production', PICTURE_TELEPHONE_SIGNING_KEY: KEY }, imageGenerationAllowed: () => false })
      expect((await handleImage(req({ sentence: 'a cat on a mat' }), s.deps)).status).toBe(403)
    })
  })
})

describe('describe route', () => {
  const bytes = Buffer.from(JPEG_B64, 'base64')
  const goodSig = signImage(bytes, KEY)
  const body = (over: Record<string, unknown> = {}) => ({ personalityId: 'literal-lou', image: JPEG_URL, signature: goodSig, ...over })

  it('describes a signed picture, spending once after verification', async () => {
    const s = setup({}, { completions: ['Two cats sit on a red mat.'] })
    const res = await handleDescribe(req(body()), s.deps)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ text: 'Two cats sit on a red mat.', fallback: false })
    expect(s.spend).toHaveBeenCalledWith(claims, 'picture-telephone-describe')
    expect(s.complete.mock.calls[0][0].image).toEqual({ base64: JPEG_B64, mime: 'image/jpeg' })
    expect(s.complete.mock.calls[0][0].system).toContain('Literal Lou')
  })

  it('rejects images without a valid signature, with no spend and no model call', async () => {
    for (const sig of [undefined, null, 'nope', signImage(bytes, 'other-key'), signImage(Buffer.from('other'), KEY)]) {
      const s = setup()
      const res = await handleDescribe(req(body({ signature: sig })), s.deps)
      expect(res.status).toBe(403)
      expect((await res.json()).code).toBe('IMAGE_NOT_SIGNED')
      expect(s.spend).not.toHaveBeenCalled()
      expect(s.complete).not.toHaveBeenCalled()
    }
  })

  it('rejects svg, oversize and non-image payloads and unknown personas', async () => {
    const s = setup()
    expect((await handleDescribe(req(body({ image: 'data:image/svg+xml;base64,AAAA' })), s.deps)).status).toBe(400)
    expect((await handleDescribe(req(body({ image: 'x'.repeat(3_000_000) })), s.deps)).status).toBe(400)
    expect((await handleDescribe(req(body({ personalityId: 'evil' })), s.deps)).status).toBe(400)
    expect((await handleDescribe(req('{'), s.deps)).status).toBe(400)
    expect(s.complete).not.toHaveBeenCalled()
  })

  it('fails closed with no signing key in production', async () => {
    const s = setup({ env: { NODE_ENV: 'production' } })
    expect((await handleDescribe(req(body()), s.deps)).status).toBe(503)
    expect(s.complete).not.toHaveBeenCalled()
  })

  it('uses a hand-written fallback when the model output keeps getting rejected', async () => {
    const s = setup({}, { textMods: [FLAGGED], completions: ['Two cats sit on a red mat.'] })
    const res = await handleDescribe(req(body()), s.deps)
    const out = await res.json()
    expect(out.fallback).toBe(true)
    expect(out.text).toBe(fallbackLineFor('literal-lou', parseInt(
      (await import('../safety/signing')).imageDigest(bytes).slice(0, 8), 16)))
  })

  it('returns 503 when moderation is down', async () => {
    const s = setup({}, { textMods: ['throw'] })
    expect((await handleDescribe(req(body()), s.deps)).status).toBe(503)
  })

  it('returns 502 on an upstream model failure', async () => {
    const s = setup({}, { completions: ['THROW'] })
    expect((await handleDescribe(req(body()), s.deps)).status).toBe(502)
  })
})

describe('starter route', () => {
  it('returns a moderated model sentence and spends once', async () => {
    const s = setup({}, { completions: ['A tiny submarine bobs past a sleepy whale.'] })
    const res = await handleStarter(req({}), s.deps)
    expect(await res.json()).toEqual({ text: 'A tiny submarine bobs past a sleepy whale.', fallback: false })
    expect(s.spend).toHaveBeenCalledWith(claims, 'picture-telephone-starter')
  })
  it('falls back to a curated sentence when the output is rejected or the model fails', async () => {
    for (const o of [{ textMods: [FLAGGED] as Mod[] }, { completions: ['THROW'] }, { completions: ['no'] }]) {
      const s = setup({}, o)
      const out = await (await handleStarter(req({}), s.deps)).json()
      expect(out.fallback).toBe(true)
      expect(STARTER_SENTENCES).toContain(out.text)
    }
  })
  it('requires sign-in', async () => {
    const s = setup(signedOut())
    expect((await handleStarter(req({}), s.deps)).status).toBe(401)
    expect(s.spend).not.toHaveBeenCalled()
  })
})

describe('moderate route', () => {
  it('requires sign-in', async () => {
    const s = setup(signedOut())
    expect((await handleModerate(req({ text: 'hello there' }), s.deps)).status).toBe(401)
  })
  it('says ok for clean text, without spending', async () => {
    const s = setup()
    expect(await (await handleModerate(req({ text: 'a cat on a mat' }), s.deps)).json()).toEqual({ ok: true })
    expect(s.spend).not.toHaveBeenCalled()
  })
  it('flags blocklisted and moderated text', async () => {
    const s = setup()
    expect(await (await handleModerate(req({ text: 'a naked person' }), s.deps)).json()).toMatchObject({ ok: false, reason: 'blocked' })
    const f = setup({}, { textMods: [FLAGGED] })
    expect(await (await handleModerate(req({ text: 'a cat on a mat' }), f.deps)).json()).toMatchObject({ ok: false, reason: 'flagged' })
  })
  it('rate limits per user', async () => {
    const s = setup({ checkModerateLimit: async () => ({ limited: true }) })
    const res = await handleModerate(req({ text: 'a cat on a mat' }), s.deps)
    expect(res.status).toBe(429)
  })
  it('fails closed when the limiter or moderation is unavailable', async () => {
    const a = setup({
      checkModerateLimit: async () => {
        throw new Error('firestore down')
      },
    })
    expect((await handleModerate(req({ text: 'a cat on a mat' }), a.deps)).status).toBe(503)
    const b = setup({}, { textMods: ['throw'] })
    expect((await handleModerate(req({ text: 'a cat on a mat' }), b.deps)).status).toBe(503)
  })
  it('rejects oversized or missing text', async () => {
    const s = setup()
    expect((await handleModerate(req({ text: 'x'.repeat(201) }), s.deps)).status).toBe(400)
    expect((await handleModerate(req({}), s.deps)).status).toBe(400)
  })
})
