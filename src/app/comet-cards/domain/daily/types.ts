import type { PokerHandsState } from '@/app/comet-cards/domain/hand/types'

export type GameMode = 'endless' | 'lastAnte'

export type RememberedHandId = keyof PokerHandsState

export type MemoryAllocation = Partial<Record<RememberedHandId, number>>

/** Everything the player claims about the run they never played. */
export interface MemoryDeclaration {
  hands: MemoryAllocation
  discards: number
}

/**
 * State that only The Last Ante uses. `null` on an endless run.
 */
export interface LastAnteState {
  /** True once the free opening packs have been dealt with. */
  openingResolved: boolean
  /** Hands of history the player may declare in the memory phase. */
  memoryBudget: number
  allocation: MemoryAllocation
  /** Hands thrown away rather than played. Its own dial, its own budget. */
  discardsRemembered: number
  /** True once Shop 0 has been closed — the build is locked. */
  draftResolved: boolean
  /** True once memories are locked in and the first blind can start. */
  memoriesResolved: boolean
  outcome: 'won' | 'lost' | null
}
