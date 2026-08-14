'use client'

/**
 * Dicebound lives inside the cave's shell rather than taking over the viewport.
 *
 * It is a conversation, not a canvas: the transcript and the composer are happy
 * in a column, and keeping the shell means the nav is the exit and this game
 * adds no duplicate one (interaction model 2).
 */
import { DiceboundGame } from './DiceboundGame'

export default function DiceboundPage() {
  return <DiceboundGame />
}
