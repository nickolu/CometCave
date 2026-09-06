/**
 * Nickname rules, shared by the client dialog, the server profile writer
 * and every game that gates play behind a name.
 *
 * Deliberately free of firebase-admin so client components can import it —
 * `@/lib/users/profile` re-exports these for server code.
 */

export const NICKNAME_MAX_LENGTH = 20

export function sanitizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX_LENGTH)
}

export class NicknameInUseError extends Error {
  constructor() {
    super('Nickname is already taken')
    this.name = 'NicknameInUseError'
  }
}

interface TokenBearer {
  getIdToken: () => Promise<string>
}

/**
 * Claim a nickname for the signed-in user. Anonymous uids are real uids, so
 * this works before anyone has made an account.
 */
export async function saveNickname(user: TokenBearer, raw: string): Promise<void> {
  const clean = sanitizeNickname(raw)
  if (!clean) throw new Error('Nickname cannot be empty.')

  const token = await user.getIdToken()
  const res = await fetch('/api/v1/users/me/nickname', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ nickname: clean }),
  })
  if (res.status === 409) throw new NicknameInUseError()
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(body.error || 'Failed to set nickname.')
  }
}
