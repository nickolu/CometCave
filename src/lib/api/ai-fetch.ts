/**
 * Client-side fetch for routes behind the AI gate.
 *
 * Attaches the player's Firebase ID token and turns the gate's refusals into a
 * typed error with a message that is already fit to show. Anything that is not
 * a gate refusal comes back as the plain Response, so each game keeps its own
 * handling of its own failures.
 *
 *   const res = await aiFetch('/api/v1/secret-word/generate-word', { method: 'POST', body })
 *   if (!res.ok) throw new Error('Could not pick a word.')
 *
 *   catch (err) { setError(aiErrorMessage(err, 'Could not pick a word.')) }
 */
import type { AiGateCode, AiGateErrorBody } from '@/lib/ai/limits'
import { getFirebaseAuth, isFirebaseAuthConfigured } from '@/lib/firebase/client'

export class AiAccessError extends Error {
  readonly code: AiGateCode
  readonly status: number
  readonly resetsAt?: string

  constructor(body: AiGateErrorBody, status: number) {
    super(body.error)
    this.name = 'AiAccessError'
    this.code = body.code
    this.status = status
    this.resetsAt = body.resetsAt
  }
}

export function isAiAccessError(error: unknown): error is AiAccessError {
  return error instanceof AiAccessError
}

/** The gate's message if this is a gate refusal, otherwise the game's own fallback. */
export function aiErrorMessage(error: unknown, fallback: string): string {
  return isAiAccessError(error) ? error.message : fallback
}

export async function getIdToken(): Promise<string | null> {
  if (!isFirebaseAuthConfigured()) return null
  try {
    const user = getFirebaseAuth().currentUser
    return user ? await user.getIdToken() : null
  } catch {
    return null
  }
}

export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

const GATE_CODES: ReadonlySet<string> = new Set<AiGateCode>([
  'SIGN_IN_REQUIRED',
  'AI_LIMIT_REACHED',
  'AI_UNAVAILABLE',
])

export async function aiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  const auth = await authHeaders()
  for (const [k, v] of Object.entries(auth)) headers.set(k, v)

  const response = await fetch(input, { ...init, headers })
  if (response.status === 401 || response.status === 429 || response.status === 503) {
    const body = (await response.clone().json().catch(() => null)) as AiGateErrorBody | null
    if (body && typeof body.code === 'string' && GATE_CODES.has(body.code)) {
      throw new AiAccessError(body, response.status)
    }
  }
  return response
}
