
import {
  LAST_ANTE_DRAFT_SHOP_PACKS,
  LAST_ANTE_MEMORY_MAX_DISCARDS,
  LAST_ANTE_MEMORY_MAX_PER_HAND,
} from '@/app/comet-cards/domain/daily/constants'
import { applyMemories, countAllocated } from '@/app/comet-cards/domain/daily/memories'
import { buildOpeningPacks } from '@/app/comet-cards/domain/daily/opening-packs'
import { buildRememberedHand } from '@/app/comet-cards/domain/daily/remembered-hands'
import type {
  DiscardsRememberedEvent,
  GameEvent,
  MemoryAllocatedEvent,
} from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { populateTags } from '@/app/comet-cards/domain/game/utils'
import { getRandomVoucherType } from '@/app/comet-cards/domain/voucher/utils'

import { handleShopOpen } from './shop'

import type { Draft } from 'immer'

/**
 * Open a Last Ante run on The Opening — a shelf of free packs.
 *
 * The boss is already named on the round and every screen before the first
 * blind puts it up front, so the player builds against a known opponent rather
 * than an abstract one.
 */
export function handleLastAnteStart(draft: Draft<GameState>) {
  draft.shopState.packsForSale = buildOpeningPacks(draft as unknown as GameState)
}

/**
 * Leave The Opening and enter the draft proper. Any packs the player did not
 * open are left behind — the shop stocks its own.
 */
export function handleOpeningConfirmed(draft: Draft<GameState>, event: GameEvent) {
  const lastAnte = draft.lastAnte
  if (!lastAnte || lastAnte.openingResolved) return

  lastAnte.openingResolved = true
  draft.shopState.packsForSale = []
  draft.shopState.voucher = getRandomVoucherType(draft as unknown as GameState)
  populateTags(draft as unknown as GameState)
  handleShopOpen(draft as unknown as GameState, event, LAST_ANTE_DRAFT_SHOP_PACKS)
  draft.gamePhase = 'shop'
}

/**
 * Record how many times the player remembers playing a hand type.
 *
 * Allocation is stored, not applied — the memory screen previews it against a
 * copy so the player can move numbers around freely, and only
 * `MEMORIES_CONFIRMED` writes history onto the real run.
 */
export function handleMemoryAllocated(draft: Draft<GameState>, event: MemoryAllocatedEvent) {
  const lastAnte = draft.lastAnte
  if (!lastAnte || lastAnte.memoriesResolved) return

  // A deck that cannot make the hand cannot remember having played it.
  if (buildRememberedHand(draft as unknown as GameState, event.handId) === null) return

  const clamped = Math.max(0, Math.min(LAST_ANTE_MEMORY_MAX_PER_HAND, Math.floor(event.count)))

  // Hands and discards come out of one budget, so what is spent elsewhere —
  // including on discards — is what limits this dial.
  const spentElsewhere =
    countAllocated(lastAnte.allocation) -
    (lastAnte.allocation[event.handId] ?? 0) +
    lastAnte.discardsRemembered
  const affordable = Math.max(0, lastAnte.memoryBudget - spentElsewhere)

  lastAnte.allocation[event.handId] = Math.min(clamped, affordable)
}

/**
 * Record how many hands were thrown away. Discards are spent from the same
 * budget as hands: a run has only so much past in it, so remembering a discard
 * costs a hand you did not play.
 */
export function handleDiscardsRemembered(draft: Draft<GameState>, event: DiscardsRememberedEvent) {
  const lastAnte = draft.lastAnte
  if (!lastAnte || lastAnte.memoriesResolved) return

  const affordable = Math.max(0, lastAnte.memoryBudget - countAllocated(lastAnte.allocation))

  lastAnte.discardsRemembered = Math.max(
    0,
    Math.min(LAST_ANTE_MEMORY_MAX_DISCARDS, affordable, Math.floor(event.count))
  )
}

/**
 * Lock in the declared history and start the run.
 */
export function handleMemoriesConfirmed(draft: Draft<GameState>) {
  const lastAnte = draft.lastAnte
  if (!lastAnte || lastAnte.memoriesResolved) return

  applyMemories(draft, {
    hands: lastAnte.allocation,
    discards: lastAnte.discardsRemembered,
  })
  lastAnte.memoriesResolved = true

  draft.gamePhase = 'blindSelection'
  populateTags(draft as unknown as GameState)
}
