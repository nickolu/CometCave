import { afterEach, describe, expect, it, vi } from 'vitest'

import { RefusedError, callModel } from '@/lib/dicebound/anthropic'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

function reply(status: number, body: unknown = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function call(signal?: AbortSignal) {
  return callModel({
    apiKey: 'k',
    system: 's',
    messages: [{ role: 'user', content: 'hello' }],
    maxTokens: 10,
    signal,
  })
}

describe('callModel', () => {
  it('tries again when the model is briefly overloaded', async () => {
    // The failure that was actually costing turns: a 20-turn run lost 8 of them
    // to overloaded_error, and every one reached the player as "The telling
    // faltered."
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(529, { error: 'overloaded' }))
      .mockResolvedValueOnce(reply(200, { content: [{ type: 'text', text: 'ok' }] }))

    const data = await call()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(data.content?.[0]).toMatchObject({ text: 'ok' })
  })

  it('gives up after a bounded number of attempts rather than hammering', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => reply(529, {}))
    await expect(call()).rejects.toThrow(/529/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('does not retry a request that was wrong the first time', async () => {
    // 400 is a fact about the request. Sending it again is a slower failure.
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => reply(400, {}))
    await expect(call()).rejects.toThrow(/400/)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not retry a refusal — asking again gets the same answer, slower', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => reply(200, { stop_reason: 'refusal' }))

    await expect(call()).rejects.toBeInstanceOf(RefusedError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('stops retrying the moment the turn is abandoned', async () => {
    // A turn has a hard deadline. A retry that lands after it is worse than no
    // retry: the player has stopped waiting and the answer arrives to nobody.
    const controller = new AbortController()
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      controller.abort()
      return reply(529, {})
    })

    await expect(call(controller.signal)).rejects.toThrow(/abort/i)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('waits as long as the server asked, but not longer than a turn can bear', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(reply(429, {}, { 'retry-after': '600' }))
      .mockResolvedValueOnce(reply(200, { content: [] }))

    const started = Date.now()
    await call()
    // A 600-second hint is honest and unusable inside a turn that aborts at
    // 105, so it is capped rather than obeyed.
    expect(Date.now() - started).toBeLessThan(3_000)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
