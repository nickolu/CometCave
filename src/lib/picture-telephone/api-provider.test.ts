import { describe, expect, it, vi } from 'vitest'

import { AiAccessError } from '@/lib/api/ai-fetch'

import { createApiProvider, mapApiFailure, mapThrown } from './api-provider'
import { toWorkError } from './provider'
import { INITIAL_STATE, gameReducer } from './reducer'

import type { WorkErrorCode } from './types'

describe('mapApiFailure', () => {
  const cases: [string | undefined, number, WorkErrorCode, boolean][] = [
    ['TEXT_REJECTED', 422, 'TEXT_REJECTED', false],
    ['IMAGE_REJECTED', 422, 'IMAGE_REJECTED', false],
    ['IMAGES_DISABLED', 403, 'UPSTREAM', false],
    ['NOT_CONFIGURED', 503, 'UPSTREAM', false],
    ['IMAGE_NOT_SIGNED', 403, 'UPSTREAM', false],
    ['MODERATION_UNAVAILABLE', 503, 'UPSTREAM', true],
    ['RATE_LIMITED', 429, 'UPSTREAM', true],
    ['UPSTREAM', 502, 'UPSTREAM', true],
    ['BAD_REQUEST', 400, 'UNKNOWN', false],
    [undefined, 500, 'UPSTREAM', true],
    [undefined, 404, 'UNKNOWN', false],
  ]
  it.each(cases)('%s (%i) -> %s retryable=%s', (code, status, expected, retryable) => {
    const e = mapApiFailure(status, code ? { code, error: 'msg' } : null)
    expect(e.code).toBe(expected)
    expect(e.retryable).toBe(retryable)
    expect(e.message).toBeTruthy()
  })
  it('keeps the server message', () => {
    expect(mapApiFailure(403, { code: 'IMAGES_DISABLED', error: 'Images are off.' }).message).toBe('Images are off.')
  })
})

describe('mapThrown', () => {
  it('maps gate refusals and network errors to UPSTREAM', () => {
    const limit = mapThrown(new AiAccessError({ error: 'Used up', code: 'AI_LIMIT_REACHED' }, 429))
    expect(limit).toMatchObject({ code: 'UPSTREAM', message: 'Used up', retryable: false })
    const down = mapThrown(new AiAccessError({ error: 'Later', code: 'AI_UNAVAILABLE' }, 503))
    expect(down.retryable).toBe(true)
    expect(mapThrown(new TypeError('fetch failed'))).toMatchObject({ code: 'UPSTREAM', retryable: true })
  })
})

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status })
}

describe('apiProvider', () => {
  it('sends the signature it got for a picture when describing it', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(200, { image: 'data:image/jpeg;base64,AAAA', signature: 'sig1', mock: false }))
      .mockResolvedValueOnce(jsonRes(200, { text: 'Two cats sit on a mat.' }))
    const p = createApiProvider({ fetcher })
    expect(await p.image('a cat')).toEqual({ src: 'data:image/jpeg;base64,AAAA', mock: false })
    expect(await p.describe('literal-lou', 'data:image/jpeg;base64,AAAA')).toEqual({ text: 'Two cats sit on a mat.' })
    expect(fetcher.mock.calls[0][0]).toBe('/api/v1/picture-telephone/image')
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({
      personalityId: 'literal-lou',
      image: 'data:image/jpeg;base64,AAAA',
      signature: 'sig1',
    })
  })

  it('turns failures into errors the reducer understands', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(jsonRes(422, { code: 'IMAGE_REJECTED', error: 'Too tricky.' }))
      .mockRejectedValueOnce(new AiAccessError({ error: 'Sign in to use this.', code: 'SIGN_IN_REQUIRED' }, 401))
      .mockResolvedValueOnce(jsonRes(502, { code: 'UPSTREAM', error: 'Stuck.' }))
    const p = createApiProvider({ fetcher })
    await expect(p.image('a cat')).rejects.toMatchObject({ code: 'IMAGE_REJECTED', message: 'Too tricky.' })
    await expect(p.starter()).rejects.toMatchObject({ code: 'UPSTREAM', message: 'Sign in to use this.' })
    const err = await p.describe('literal-lou', 'x').catch(e => e)
    expect(toWorkError(err)).toEqual({ code: 'UPSTREAM', message: 'Stuck.', retryable: true })
  })

  it('maps rejection codes onto WORK_FAIL so the reducer returns the human to their turn', async () => {
    const fetcher = vi.fn().mockResolvedValue(jsonRes(422, { code: 'TEXT_REJECTED', error: 'Try another one.' }))
    const err = await createApiProvider({ fetcher }).image('a cat').catch(e => e)
    const work = toWorkError(err)
    expect(work.code).toBe('TEXT_REJECTED')
    let state = gameReducer(INITIAL_STATE, {
      type: 'START',
      settings: { chainLength: 4, seats: [{ id: 's1', kind: 'human', name: 'Ann' }, { id: 's2', kind: 'ai', name: 'Lou', personalityId: 'literal-lou' }] },
    })
    state = gameReducer(state, { type: 'SUBMIT_TEXT', text: 'a cat on a mat' })
    expect(state.phase).toBe('working')
    state = gameReducer(state, { type: 'WORK_FAIL', error: work })
    expect(state.phase).toBe('turn')
    expect(state.entries).toHaveLength(0)
    expect(state.actorId).toBe('s1')
  })

  it('checkText reports a rejection with its message, and does not block on errors', async () => {
    const rejecting = createApiProvider({ fetcher: vi.fn().mockResolvedValue(jsonRes(200, { ok: false, reason: 'blocked', message: 'Nope.' })) })
    expect(await rejecting.checkText('x')).toEqual({ ok: false, message: 'Nope.' })
    const accepting = createApiProvider({ fetcher: vi.fn().mockResolvedValue(jsonRes(200, { ok: true })) })
    expect(await accepting.checkText('x')).toEqual({ ok: true })
    const limited = createApiProvider({ fetcher: vi.fn().mockResolvedValue(jsonRes(429, { code: 'RATE_LIMITED', error: 'Slow.' })) })
    expect(await limited.checkText('x')).toEqual({ ok: true })
  })
})
