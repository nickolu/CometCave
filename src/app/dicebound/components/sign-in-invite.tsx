'use client'

/**
 * Sign-up prompt (interaction model 4, triggers 1 and 2).
 *
 * Two moments, one component. The streak threshold came first because a
 * run-loop game had no end-of-session beat to hang trigger 1 on: the honest
 * moment was the one where the player had something worth losing — a character
 * several days deep, kept on one device against an anonymous uid. Three days is
 * the threshold the model names.
 *
 * Now a run can end, and `ending` is trigger 1 arriving late. It is the
 * stronger of the two by some distance: a player who has just lost a character
 * they spent a week on is being offered a reason to keep the record, which is
 * the honest version of that pitch rather than a growth prompt wearing one. It
 * ignores the streak, because a story that finished on day two still finished.
 *
 * What it does **not** ignore is a dismissal. A player who said "not now" a
 * week ago has answered this question, and the ending being a bigger moment is
 * a reason to ask well rather than a licence to ask again — the file's own rule
 * is that erring toward asking less often is the right direction to be wrong
 * in, and an ending is exactly where that rule earns its keep.
 *
 * It sells depth, not access — the campaign already saves without an account,
 * and the copy says so rather than implying otherwise. It is inline in the
 * sheet, never a modal, never a banner, and it does not steal focus.
 *
 * Cadence is simplified from the model's "dismissed twice, then 14 days": one
 * dismissal suppresses it for 14 days. The full two-strike rule needs a
 * dismissal counter that would outlive the campaign, and the simpler rule errs
 * toward asking less often, which is the right direction to be wrong in.
 */
import { useState } from 'react'

const KEY = 'dicebound:signin-dismissed-until'
const SUPPRESS_DAYS = 14

/** Streak days before the cave asks. */
export const INVITE_AT_STREAK = 3

function suppressedUntil(): number {
  if (typeof window === 'undefined') return Number.POSITIVE_INFINITY
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? Number(raw) || 0 : 0
  } catch {
    // Storage blocked. Treat it as "never dismissed" — asking once per session
    // is a better failure than never being able to sign in from here.
    return 0
  }
}

export function SignInInvite({ streak, ending = false }: { streak: number; ending?: boolean }) {
  /**
   * Read once, in a lazy initializer rather than an effect.
   *
   * There is no hydration hazard despite the `localStorage` read: the sheet
   * this lives in only renders after the campaign has loaded on the client, so
   * the server never renders this component at all.
   */
  const [dismissed, setDismissed] = useState(() => Date.now() <= suppressedUntil())

  if (dismissed) return null
  if (!ending && streak < INVITE_AT_STREAK) return null

  const dismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(KEY, String(Date.now() + SUPPRESS_DAYS * 24 * 60 * 60 * 1000))
    } catch {
      // Dismissed for this session only. Acceptable.
    }
  }

  return (
    <aside className="rounded-ds-sm border-2 border-ds-tertiary/40 bg-surface-container p-4">
      <p className="text-body-md text-on-surface">
        {ending
          ? 'That was a whole story, start to finish. Sign in and it stays yours — on this device and any other.'
          : `${streak} days deep. Sign in and the cave will carry this story to your other devices.`}
      </p>
      <div className="mt-3 flex items-center gap-4">
        <a
          href="/auth?redirect=/dicebound"
          className="font-label text-label-caps uppercase tracking-widest text-ds-primary underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          Sign in
        </a>
        <button
          type="button"
          onClick={dismiss}
          className="text-sm text-on-surface-variant/70 hover:text-on-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
        >
          Not now
        </button>
      </div>
    </aside>
  )
}
