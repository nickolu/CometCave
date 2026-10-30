import Link from 'next/link'

import { type Placement, placeText } from '@/app/meteor-coins/lib/scoreboard'
import type { StageDef } from '@/app/meteor-coins/lib/stages'

/**
 * The player's standing on a stage, with the one step that would list them:
 * signing in, or picking a nickname. Listed players just see their place.
 * Sign-in sends them to the stage's scores, so the first thing they see
 * after is their name on the board.
 */
export function PlaceLine({
  stage,
  placement,
  signedUp,
  onPickNickname,
  className,
}: {
  stage: StageDef
  placement: Placement
  signedUp: boolean
  onPickNickname: () => void
  className?: string
}) {
  const linkClass = 'font-semibold text-white underline-offset-4 hover:underline'
  let action = null
  if (!placement.listed) {
    if (signedUp) {
      action = (
        <button type="button" onClick={onPickNickname} className={linkClass}>
          Pick a nickname to be listed
        </button>
      )
    } else {
      const back = encodeURIComponent(`/meteor-coins/${stage.slug}/scores`)
      action = (
        <Link href={`/auth?redirect=${back}`} className={linkClass}>
          {placement.rank === null ? 'Sign in to be listed' : 'Sign in to claim it'}
        </Link>
      )
    }
  }
  return (
    <p className={className}>
      {placeText(placement)}
      {action && <> {action}</>}
    </p>
  )
}
