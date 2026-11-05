import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyRequestAuth = vi.fn()
const spendAiCredits = vi.fn()

vi.mock('@/lib/api/auth', () => ({ verifyRequestAuth: (...a: unknown[]) => verifyRequestAuth(...a) }))
vi.mock('@/lib/ai/usage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/usage')>('@/lib/ai/usage')
  return { ...actual, spendAiCredits: (...a: unknown[]) => spendAiCredits(...a) }
})
vi.mock('@/lib/firebase/server', () => ({ getFirestoreDb: () => { throw new Error('no firestore in tests') } }))

import { requireAiAccess, requireSignedIn } from '@/lib/api/ai-gate'

const req = new Request('http://cave.test/api/v1/thing', { headers: { Authorization: 'Bearer t' } })
const anon = { claims: { uid: 'anon-1', isAnonymous: true } }
const named = { claims: { uid: 'ada', email: 'ada@example.com', isAnonymous: false } }
const owner = { claims: { uid: 'nick', email: 'nickolusroy@gmail.com', isAnonymous: false } }

beforeEach(() => {
  verifyRequestAuth.mockReset()
  spendAiCredits.mockReset()
})

describe('requireSignedIn', () => {
  it('refuses a missing or bad token with a SIGN_IN_REQUIRED body', async () => {
    verifyRequestAuth.mockResolvedValue({ error: new Response(null, { status: 401 }) })
    const result = await requireSignedIn(req)
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.status).toBe(401)
    expect(await result.error.json()).toMatchObject({ code: 'SIGN_IN_REQUIRED' })
  })

  it('refuses the anonymous uid the client mints for everyone', async () => {
    verifyRequestAuth.mockResolvedValue(anon)
    const result = await requireSignedIn(req)
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.status).toBe(401)
    expect(await result.error.json()).toMatchObject({ code: 'SIGN_IN_REQUIRED' })
  })

  it('lets a real account through', async () => {
    verifyRequestAuth.mockResolvedValue(named)
    expect(await requireSignedIn(req)).toEqual(named)
  })
})

describe('requireAiAccess', () => {
  it('spends the feature cost for a signed-in player and reports what is left', async () => {
    verifyRequestAuth.mockResolvedValue(named)
    spendAiCredits.mockResolvedValue({ allowed: true, remaining: 42, spent: 3 })
    const result = await requireAiAccess(req, 'secret-word')
    expect(result).toEqual({ claims: named.claims, remaining: 42 })
    expect(spendAiCredits).toHaveBeenCalledWith('ada', 'secret-word')
  })

  it('does not meter the owner', async () => {
    verifyRequestAuth.mockResolvedValue(owner)
    const result = await requireAiAccess(req, 'micro-land-summon')
    expect(result).toEqual({ claims: owner.claims, remaining: null })
    expect(spendAiCredits).not.toHaveBeenCalled()
  })

  it('answers 429 with a reset time when the day is spent', async () => {
    verifyRequestAuth.mockResolvedValue(named)
    spendAiCredits.mockResolvedValue({ allowed: false, remaining: 0, spent: 120 })
    const result = await requireAiAccess(req, 'dicebound-turn')
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.status).toBe(429)
    expect(result.error.headers.get('Retry-After')).toMatch(/^\d+$/)
    const body = await result.error.json()
    expect(body.code).toBe('AI_LIMIT_REACHED')
    expect(Date.parse(body.resetsAt)).toBeGreaterThan(Date.now())
  })

  it('fails closed when the meter itself is down', async () => {
    verifyRequestAuth.mockResolvedValue(named)
    spendAiCredits.mockRejectedValue(new Error('firestore unavailable'))
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const result = await requireAiAccess(req, 'voters')
    errorSpy.mockRestore()
    expect('error' in result).toBe(true)
    if (!('error' in result)) return
    expect(result.error.status).toBe(503)
    expect(await result.error.json()).toMatchObject({ code: 'AI_UNAVAILABLE' })
  })

  it('never meters an anonymous player — it refuses first', async () => {
    verifyRequestAuth.mockResolvedValue(anon)
    const result = await requireAiAccess(req, 'voters')
    expect('error' in result).toBe(true)
    expect(spendAiCredits).not.toHaveBeenCalled()
  })
})
