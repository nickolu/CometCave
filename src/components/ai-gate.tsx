'use client'

/**
 * Sign-in gate for games that generate content on the server.
 *
 * CLAUDE.md principle 1 makes every game playable without an account, with one
 * documented exception: features that call a model cost real money per use, so
 * they need a real account behind them and a daily allowance (see
 * `src/lib/ai/limits.ts`). This component is the client half of that rule — the
 * server half is `requireAiAccess`, and the two always travel together.
 *
 * It follows interaction model 4, trigger 3: the gated surface is replaced in
 * place by the prompt plus a way back. Never a modal, never a banner.
 *
 *   <AiGate game="Secret Word" redirectTo="/secret-word">
 *     <SecretWordGame />
 *   </AiGate>
 */
import Link from 'next/link'


import { ChunkyButton } from '@/components/ui/chunky-button'
import { ChunkyCard, ChunkyCardContent } from '@/components/ui/chunky-card'
import { useAuth } from '@/hooks/useAuth'

import type { ReactNode } from 'react'

export function authHref(redirectTo: string): string {
  return `/auth?redirect=${encodeURIComponent(redirectTo)}`
}

/** The in-place prompt. Exported so a game can gate one panel instead of a page. */
export function SignInToPlay({
  game,
  redirectTo,
  what = 'play',
  compact = false,
}: {
  game: string
  redirectTo: string
  /** The verb for the gated thing: "play", "summon", "keep going". */
  what?: string
  compact?: boolean
}) {
  const body = `${game} makes something new every time you ${what}, so it needs an account. It takes a moment and keeps your progress across devices.`

  if (compact) {
    return (
      <div
        role="region"
        aria-label={`Sign in to ${what}`}
        className="flex flex-col gap-3 rounded-ds-sm border-2 border-outline-variant bg-surface-container p-4"
      >
        <p className="text-sm font-bold text-on-surface">Sign in to {what}</p>
        <p className="text-sm text-on-surface-variant">{body}</p>
        <Link href={authHref(redirectTo)}>
          <ChunkyButton variant="primary" size="sm" className="w-full">
            Sign in
          </ChunkyButton>
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-md py-12">
      <ChunkyCard variant="surface-container-high" className="w-full">
        <ChunkyCardContent className="flex flex-col items-center gap-4 pt-6 pb-6 text-center">
          <h2 className="font-headline text-xl font-bold text-on-surface">Sign in to {what} {game}</h2>
          <p className="text-sm text-on-surface-variant">{body}</p>
          <Link href={authHref(redirectTo)} className="w-full">
            <ChunkyButton variant="primary" size="lg" className="w-full">
              Sign in
            </ChunkyButton>
          </Link>
          <Link
            href="/"
            className="text-sm text-on-surface-variant underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-primary"
          >
            Back to all games
          </Link>
        </ChunkyCardContent>
      </ChunkyCard>
    </div>
  )
}

/** True once auth has settled on a real (non-anonymous) account. */
export function useIsSignedIn(): { signedIn: boolean; loading: boolean } {
  const { user, loading, configured } = useAuth()
  if (!configured) return { signedIn: false, loading: false }
  return { signedIn: Boolean(user && !user.isAnonymous), loading }
}

export function AiGate({
  game,
  redirectTo,
  what,
  compact,
  fallback = null,
  children,
}: {
  game: string
  redirectTo: string
  what?: string
  compact?: boolean
  /** Rendered while auth is still settling. Defaults to nothing, so the page does not flash. */
  fallback?: ReactNode
  children: ReactNode
}) {
  const { signedIn, loading } = useIsSignedIn()
  if (loading) return <>{fallback}</>
  if (!signedIn) return <SignInToPlay game={game} redirectTo={redirectTo} what={what} compact={compact} />
  return <>{children}</>
}
