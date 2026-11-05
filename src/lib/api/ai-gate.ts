/**
 * The gate every model-backed route stands behind.
 *
 * Two levels:
 *   requireSignedIn  — a real account (not the anonymous uid the client mints
 *                      for everyone). No metering.
 *   requireAiAccess  — requireSignedIn, then spend the feature's credits for
 *                      today. Refuses with 429 when the day's budget is gone.
 *
 * Both return `{ error }` with a response ready to send, so a route reads:
 *
 *   const gate = await requireAiAccess(request, 'secret-word')
 *   if ('error' in gate) return gate.error
 *
 * The owner of the cave is signed in like anyone else but is never metered.
 */
import { NextResponse } from 'next/server'

import { type AiFeature, type AiGateErrorBody } from '@/lib/ai/limits'
import { nextResetIso, spendAiCredits } from '@/lib/ai/usage'
import { verifyRequestAuth } from '@/lib/api/auth'
import { isOwnerEmail } from '@/lib/auth/owner'
import type { AuthClaims } from '@/lib/users/profile'

export const SIGN_IN_REQUIRED_MESSAGE = 'Sign in to use this.'
export const LIMIT_REACHED_MESSAGE = "You've used today's allowance for this. It resets at midnight Pacific."
export const UNAVAILABLE_MESSAGE = 'This is not available right now. Try again in a minute.'

function gateError(status: number, body: AiGateErrorBody, headers?: HeadersInit): NextResponse {
  return NextResponse.json(body, { status, headers })
}

export type SignedIn = { claims: AuthClaims }
export type GateResult = SignedIn | { error: NextResponse }

export async function requireSignedIn(request: Request): Promise<GateResult> {
  const auth = await verifyRequestAuth(request)
  if ('error' in auth) {
    return { error: gateError(401, { error: SIGN_IN_REQUIRED_MESSAGE, code: 'SIGN_IN_REQUIRED' }) }
  }
  if (auth.claims.isAnonymous) {
    return { error: gateError(401, { error: SIGN_IN_REQUIRED_MESSAGE, code: 'SIGN_IN_REQUIRED' }) }
  }
  return { claims: auth.claims }
}

export type AiAccess = SignedIn & { remaining: number | null }

/**
 * Spend credits for an already-verified account. Split out for routes that
 * verify once and then only sometimes reach the model (Infinite Trivia serves
 * most questions from a pool and generates only when it runs dry).
 */
export async function spendForClaims(
  claims: AuthClaims,
  feature: AiFeature
): Promise<AiAccess | { error: NextResponse }> {
  if (isOwnerEmail(claims.email)) return { claims, remaining: null }

  let decision
  try {
    decision = await spendAiCredits(claims.uid, feature)
  } catch (error) {
    console.error('[ai-gate] could not meter usage; refusing', { uid: claims.uid, feature, error })
    return { error: gateError(503, { error: UNAVAILABLE_MESSAGE, code: 'AI_UNAVAILABLE' }) }
  }

  if (!decision.allowed) {
    const resetsAt = nextResetIso()
    const retryAfter = Math.max(1, Math.ceil((Date.parse(resetsAt) - Date.now()) / 1000))
    return {
      error: gateError(
        429,
        { error: LIMIT_REACHED_MESSAGE, code: 'AI_LIMIT_REACHED', resetsAt },
        { 'Retry-After': String(retryAfter), 'X-AI-Credits-Remaining': '0' }
      ),
    }
  }
  return { claims, remaining: decision.remaining }
}

export async function requireAiAccess(
  request: Request,
  feature: AiFeature
): Promise<AiAccess | { error: NextResponse }> {
  const signedIn = await requireSignedIn(request)
  if ('error' in signedIn) return signedIn
  return spendForClaims(signedIn.claims, feature)
}
