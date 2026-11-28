import type { Seat } from './types'

export type Step =
  | { kind: 'write'; /** Sentence number, 0..N. */ index: number; seatIndex: number }
  | { kind: 'image'; /** Image number, 0..N-1. */ index: number }

/** The seat that writes sentence `i` (seats may write more than once). */
export function seatForSentence(i: number, seatCount: number): number {
  return ((i % seatCount) + seatCount) % seatCount
}

/**
 * The whole chain as steps: s0, img0, s1, img1, ... s(N-1), img(N-1), sN.
 * N images, N+1 sentences, 2N+1 steps.
 */
export function buildSteps(chainLength: number, seatCount: number): Step[] {
  const steps: Step[] = []
  for (let i = 0; i <= chainLength; i++) {
    steps.push({ kind: 'write', index: i, seatIndex: seatForSentence(i, seatCount) })
    if (i < chainLength) steps.push({ kind: 'image', index: i })
  }
  return steps
}

export function humanSeats(seats: readonly Seat[]): Seat[] {
  return seats.filter(s => s.kind === 'human')
}

/**
 * Should the "Pass to {name}" screen show before this seat's turn?
 * Only when a human is next, there is more than one human, and that human is
 * not the last one who held the device. `prevHumanId` null means nobody is
 * known to hold it yet.
 */
export function needsHandoff(
  prevHumanId: string | null,
  next: Seat,
  humanCount: number
): boolean {
  if (next.kind !== 'human') return false
  if (humanCount <= 1) return false
  return prevHumanId !== next.id
}
