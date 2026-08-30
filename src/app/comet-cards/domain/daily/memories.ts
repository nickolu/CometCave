
import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/comet-cards/domain/events/types'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { collectEffects } from '@/app/comet-cards/domain/game/utils'
import { findHighestPriorityHand } from '@/app/comet-cards/domain/hand/hands'
import type { JokerState } from '@/app/comet-cards/domain/joker/types'
import type { PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'

import {
  LAST_ANTE_PACKS_SKIPPED_BEHIND,
  LAST_ANTE_REROLLS_BEHIND,
  LAST_ANTE_ROUNDS_BEHIND,
} from './constants'
import { buildRememberedHand, buildRememberedHands } from './remembered-hands'

import type { MemoryAllocation, MemoryDeclaration, RememberedHandId } from './types'
import type { Draft } from 'immer'

export type { MemoryAllocation, MemoryDeclaration }

/**
 * Canonical replay order. Some jokers are order-sensitive — Ride the Bus resets
 * its counter whenever a scoring face card turns up — so the order is fixed and
 * the live preview shows the player exactly what their allocation produces.
 */
const REPLAY_ORDER: RememberedHandId[] = [
  'highCard',
  'pair',
  'twoPair',
  'threeOfAKind',
  'straight',
  'flush',
  'fullHouse',
  'fourOfAKind',
  'straightFlush',
  'flushHouse',
  'fiveOfAKind',
  'flushFive',
]

const JOKER_ADDED: GameEvent = { type: 'JOKER_ADDED' }
const CARD_SCORED: GameEvent = { type: 'CARD_SCORED' }
const FINALIZE: GameEvent = { type: 'HAND_SCORING_FINALIZE' }
const DISCARD: GameEvent = { type: 'DISCARD_SELECTED_CARDS' }
const ROUND_END: GameEvent = { type: 'ROUND_END' }
const SHOP_REROLL: GameEvent = { type: 'SHOP_REROLL' }
const PACK_SKIPPED: GameEvent = { type: 'PACK_OPEN_SKIP' }

const CARDS_PER_DISCARD = 5

function effectContext(
  draft: Draft<GameState>,
  event: GameEvent,
  override: Partial<EffectContext> = {}
): EffectContext {
  return {
    event,
    game: draft as unknown as GameState,
    score: draft.gamePlayState.score,
    playedCards: [],
    round: draft.rounds[draft.roundIndex],
    bossBlind: draft.rounds[draft.roundIndex].bossBlind,
    jokers: draft.jokers,
    vouchers: draft.vouchers,
    tags: draft.tags,
    ...override,
  }
}

function emit(draft: Draft<GameState>, event: GameEvent, override?: Partial<EffectContext>) {
  const ctx = effectContext(draft, event, override)
  dispatchEffects(event, ctx, collectEffects(ctx.game))
}

/**
 * Replay one remembered hand through the effect system.
 *
 * This deliberately does NOT go through `reduceGame`. The real handlers settle
 * the blind — they bank score against the ante, spend a hand, decide game-over
 * and move the phase. A memory is not a hand being played now; it is a hand
 * that was played before the run started.
 *
 * So we emit the events straight at the effects and let each joker do its own
 * bookkeeping. Nothing here knows what Spare Trousers or Hiker are.
 */
function replayHand(draft: Draft<GameState>, handId: RememberedHandId, cards: PlayingCardState[]) {
  const gamePlayState = draft.gamePlayState

  draft.pokerHands[handId].timesPlayed += 1
  draft.pokerHands[handId].isSecret = false
  draft.handsPlayed += 1

  gamePlayState.selectedHand = [handId, cards]
  gamePlayState.cardsToScore = cards
  gamePlayState.playedCardIds = cards.map(card => card.id)
  gamePlayState.selectedCardIds = gamePlayState.playedCardIds

  // A remembered hand scored its cards, same as a real one. Skipping this left
  // Hiker and Hanging Chad — which work per scored card — unable to remember
  // anything, and made a remembered hand a half-hand.
  for (const card of cards) {
    emit(draft, CARD_SCORED, { playedCards: cards, scoredCards: [card] })
  }

  emit(draft, FINALIZE, { playedCards: cards })
}

/** Replay one remembered discard. Castle reads the suits of what you threw. */
function replayDiscard(draft: Draft<GameState>, cards: PlayingCardState[]) {
  const gamePlayState = draft.gamePlayState

  draft.discardsPlayed += 1
  gamePlayState.selectedCardIds = cards.map(card => card.id)
  gamePlayState.selectedHand = undefined

  emit(draft, DISCARD, { playedCards: cards })
}

/**
 * The part of the history the player does not choose: the antes below this one,
 * the shops between them, and the packs walked past.
 *
 * A joker that decays per round can decay to death — Turtle Bean destroys
 * itself when its hand-size bonus hits zero, and five antes is more than enough.
 * The player picks their jokers in The Opening, before they ever see this
 * screen, so letting the backstory delete one is a trap they cannot see coming
 * and reads as a bug rather than a rule.
 *
 * So a joker that would not have survived the run is treated as having joined
 * late: it keeps its full value and remembers none of the rounds. The fields
 * those jokers pay out through are restored alongside them, or the player would
 * keep the joker and lose the hand size it grants.
 */
function applyBackstory(draft: Draft<GameState>) {
  // Plain copies, not structuredClone — these are immer draft proxies.
  const before = draft.jokers.map(joker => ({
    ...joker,
    flags: { ...joker.flags },
    metadata: joker.metadata ? { ...joker.metadata } : undefined,
  }))
  const slots = {
    handSizeModifier: draft.handSizeModifier,
    maxHands: draft.maxHands,
    maxDiscards: draft.maxDiscards,
  }

  for (let i = 0; i < LAST_ANTE_ROUNDS_BEHIND; i++) emit(draft, ROUND_END)
  for (let i = 0; i < LAST_ANTE_REROLLS_BEHIND; i++) emit(draft, SHOP_REROLL)
  for (let i = 0; i < LAST_ANTE_PACKS_SKIPPED_BEHIND; i++) emit(draft, PACK_SKIPPED)

  const surviving = new Set(draft.jokers.map(joker => joker.id))
  const lost = before.filter(joker => !surviving.has(joker.id))
  if (lost.length === 0) return

  draft.jokers = before as Draft<GameState>['jokers']
  draft.handSizeModifier = slots.handSizeModifier
  draft.maxHands = slots.maxHands
  draft.maxDiscards = slots.maxDiscards
}

/**
 * Cards thrown away on the nth remembered discard.
 *
 * Walks a stride through the deck so successive discards throw different cards.
 * Castle picks one suit per run and counts only that suit, so handing every
 * discard the same five cards would make it either useless or absurd depending
 * on a coin flip taken at run start.
 */
function discardedCards(draft: Draft<GameState>, index: number): PlayingCardState[] {
  const owned = draft.ownedCardIds
  if (owned.length === 0) return []

  const cards: PlayingCardState[] = []
  for (let i = 0; i < CARDS_PER_DISCARD; i++) {
    const card = draft.cards[owned[(index * CARDS_PER_DISCARD + i) % owned.length]]
    if (card) cards.push(card as PlayingCardState)
  }
  return cards
}

/**
 * Apply a declared history to the run.
 *
 * Jokers keep everything they accumulate — counters, metadata, permanent card
 * bonuses, sell value. Everything that belongs to *scoring a hand now* is rolled
 * back: chips and mult never touched the board, no scoring log is shown, and
 * money jokers do not pay out for hands that were only remembered.
 */
export function applyMemories(draft: Draft<GameState>, declaration: MemoryDeclaration) {
  const gamePlayState = draft.gamePlayState

  // Scaling jokers keep their progress in `metadata`, which they only create
  // when they hear JOKER_ADDED. A joker that has never heard it silently
  // ignores its own history, so prime every accumulator first. The listeners
  // are all idempotent (`?? 0`) initialisers, so this is safe to repeat.
  emit(draft, JOKER_ADDED)

  const moneyBefore = draft.money
  const scoreBefore = { ...gamePlayState.score }
  const scoringEventsBefore = gamePlayState.scoringEvents.length
  const handResultsBefore = gamePlayState.handResults.length
  const selectedBefore = [...gamePlayState.selectedCardIds]

  applyBackstory(draft)

  for (const handId of REPLAY_ORDER) {
    const count = declaration.hands[handId] ?? 0
    if (count <= 0) continue

    // Cycle through different versions of the hand rather than replaying one
    // five times over, so effects that write onto the cards they score spread
    // across the deck the way they would have in a real run.
    const variants = buildRememberedHands(draft as unknown as GameState, handId)
    if (variants.length === 0) continue

    for (let i = 0; i < count; i++) {
      replayHand(draft, handId, variants[i % variants.length])
    }
  }

  for (let i = 0; i < declaration.discards; i++) {
    const cards = discardedCards(draft, i)
    if (cards.length > 0) replayDiscard(draft, cards)
  }

  draft.money = moneyBefore
  gamePlayState.score = scoreBefore
  gamePlayState.scoringEvents = gamePlayState.scoringEvents.slice(0, scoringEventsBefore)
  gamePlayState.handResults = gamePlayState.handResults.slice(0, handResultsBefore)
  gamePlayState.selectedCardIds = selectedBefore
  gamePlayState.selectedHand = undefined
  gamePlayState.cardsToScore = []
  gamePlayState.playedCardIds = []
}

/**
 * Run a declaration against a copy of the game so the memory screen can show
 * jokers charging up live as the player allocates.
 */
export function previewMemories(game: GameState, declaration: MemoryDeclaration): GameState {
  const copy = structuredClone(game)
  applyMemories(copy as unknown as Draft<GameState>, declaration)
  return copy
}

/** Hands spent by an allocation, before discards are counted against it. */
export function countAllocated(allocation: MemoryAllocation): number {
  return Object.values(allocation).reduce<number>((sum, n) => sum + (n ?? 0), 0)
}

/** Everything a declaration spends. Hands and discards share one budget. */
export function countDeclared(declaration: MemoryDeclaration): number {
  return countAllocated(declaration.hands) + declaration.discards
}

/**
 * A joker's accumulated state, as a number the UI can watch move.
 *
 * Scaling jokers keep progress in `counter`, in `metadata`, or in sell value,
 * so this reads all of them and returns the total. It can go down: Turtle Bean
 * decays with every round behind you.
 */
export function getJokerChargeValue(joker: JokerState): number {
  const metadataTotal = Object.values(joker.metadata ?? {}).reduce<number>(
    (sum, n) => sum + (typeof n === 'number' ? n : 0),
    0
  )
  return joker.counter + metadataTotal + (joker.bonusSellValue ?? 0)
}

/** Permanent chip bonuses a joker has written onto the deck. Hiker's home. */
export function getDeckChargeValue(game: GameState): number {
  return game.ownedCardIds.reduce((sum, id) => sum + (game.cards[id]?.bonusChips ?? 0), 0)
}

/** Total poker hand levels, which Space Joker raises at random. */
export function getHandLevelTotal(game: GameState): number {
  return Object.values(game.pokerHands).reduce((sum, hand) => sum + hand.level, 0)
}

export interface JokerMemorySummary {
  /** Extra Mult added on a hand, thanks to the history. */
  addMult: number
  /** Extra Mult multiplied in, as a factor. 1 means no change. */
  xMult: number
  /** Extra chips on a hand. */
  chips: number
  /** Poker hand levels gained - Space Joker raises these and keeps nothing. */
  levels: number
  /** Sell value gained. Egg's entire effect, and it never scores. */
  sellValue: number
  /** True if the history changed nothing this joker can use. */
  inert: boolean
}

const EMPTY_SUMMARY: JokerMemorySummary = {
  addMult: 0,
  xMult: 1,
  chips: 0,
  levels: 0,
  sellValue: 0,
  inert: true,
}

/**
 * The hand this player is actually going to play, so the readout answers "what
 * does this joker do for me on my hand" rather than on an arbitrary one.
 *
 * It matters for jokers whose value depends on which hand is played: Obelisk
 * climbs only while you avoid your most-played hand, so measuring it against a
 * hand nobody intends to play would flatter it.
 */
function representativeHand(declaration: MemoryDeclaration): RememberedHandId {
  let best: RememberedHandId | undefined
  let bestCount = 0
  for (const handId of REPLAY_ORDER) {
    const count = declaration.hands[handId] ?? 0
    if (count > bestCount) {
      best = handId
      bestCount = count
    }
  }
  return best ?? 'pair'
}

interface Contribution {
  addMult: number
  xMult: number
  chips: number
}

/**
 * Score one representative hand and total up what a single joker put on the
 * board. Only that joker is present, so every scoring event belongs to it.
 */
function jokerContribution(game: GameState, cards: PlayingCardState[]): Contribution {
  const draft = game as unknown as Draft<GameState>
  const gamePlayState = draft.gamePlayState

  gamePlayState.score = { chips: 0, mult: 0 }
  gamePlayState.scoringEvents = []
  gamePlayState.selectedHand = [findHighestPriorityHand(cards, game.staticRules).hand, cards]
  gamePlayState.cardsToScore = cards
  gamePlayState.playedCardIds = cards.map(card => card.id)
  gamePlayState.selectedCardIds = gamePlayState.playedCardIds

  for (const card of cards) {
    emit(draft, CARD_SCORED, { playedCards: cards, scoredCards: [card] })
  }
  emit(draft, { type: 'HAND_SCORING_DONE_CARD_SCORING' }, { playedCards: cards })
  emit(draft, FINALIZE, { playedCards: cards })

  const contribution: Contribution = { addMult: 0, xMult: 1, chips: 0 }
  for (const event of gamePlayState.scoringEvents) {
    if (!('source' in event)) continue
    if (event.type === 'chips') contribution.chips += event.value
    else if (event.operator === 'x') contribution.xMult *= event.value
    else contribution.addMult += event.value
  }
  return contribution
}

/**
 * What one joker got out of a declared history, in the units a player reads.
 *
 * Reading the joker's own counter looked obvious and was wrong. Jokers store
 * progress in private, scaled units with non-zero baselines - Lucky Cat's
 * counter of 4 *is* X1.0, and Canio's xMult of 100 *is* X1.0 - so the first
 * touch of a fresh joker moved its number without changing anything a player
 * would ever see. The screen reported "+4" and "+100" for jokers that had
 * gained exactly nothing.
 *
 * So measure the effect rather than the bookkeeping: score the same hand with
 * the joker before and after its history and diff what it actually put on the
 * board. Baselines and lazy initialisation happen on both sides and cancel, and
 * jokers that keep no state at all - Space Joker raises a hand level, Hiker
 * writes chips onto the deck - fall out of the same measurement.
 */
export function summariseJokerMemory(
  game: GameState,
  declaration: MemoryDeclaration,
  jokerId: string
): JokerMemorySummary {
  if (!game.jokers.some(joker => joker.id === jokerId)) return EMPTY_SUMMARY

  const isolate = (): GameState => {
    const copy = structuredClone(game)
    copy.jokers = copy.jokers.filter(joker => joker.id === jokerId)
    return copy
  }

  const charged = isolate()
  applyMemories(charged as unknown as Draft<GameState>, declaration)

  // The same five cards get scored on both sides.
  const handId = representativeHand(declaration)
  const cards =
    buildRememberedHand(charged, handId) ??
    buildRememberedHand(charged, 'pair') ??
    buildRememberedHand(charged, 'highCard')
  if (!cards) return EMPTY_SUMMARY

  const base = isolate()
  const baseCards = cards
    .map(card => base.cards[card.id])
    .filter((card): card is PlayingCardState => card !== undefined)
  if (baseCards.length !== cards.length) return EMPTY_SUMMARY

  const before = jokerContribution(base, baseCards)
  const after = jokerContribution(charged, cards)

  const baseJoker = base.jokers.find(joker => joker.id === jokerId)
  const chargedJoker = charged.jokers.find(joker => joker.id === jokerId)

  // Chips a joker wrote permanently onto the deck count too. Hiker's whole
  // effect is +5 chips on every card it has ever scored, and those chips are
  // added by the card, not by a scoring event carrying Hiker's name.
  const deckChips = getDeckChargeValue(charged) - getDeckChargeValue(base)

  const sellValue = (chargedJoker?.bonusSellValue ?? 0) - (baseJoker?.bonusSellValue ?? 0)

  const summary: JokerMemorySummary = {
    addMult: after.addMult - before.addMult,
    xMult: before.xMult === 0 ? 1 : after.xMult / before.xMult,
    chips: after.chips - before.chips + deckChips,
    levels: getHandLevelTotal(charged) - getHandLevelTotal(base),
    sellValue,
    inert: false,
  }

  summary.inert =
    summary.addMult === 0 &&
    summary.chips === 0 &&
    summary.levels === 0 &&
    summary.sellValue === 0 &&
    Math.abs(summary.xMult - 1) < 1e-9

  return summary
}
