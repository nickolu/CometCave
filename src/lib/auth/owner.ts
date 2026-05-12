// Single owner of the cave. Used to gate the Comet Cards sandbox (and any
// other future internal-only surfaces) on both the server and client.
//
// The email is the source of truth — uids differ across anonymous→Google
// upgrades, but the Google account email is stable.
export const OWNER_EMAIL = 'nickolusroy@gmail.com'

export function isOwnerEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.toLowerCase() === OWNER_EMAIL
}
