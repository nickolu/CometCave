import type { GameState } from '@/app/comet-cards/domain/game/types'
import { findHighestPriorityHand } from '@/app/comet-cards/domain/hand/hands'
import { cardValuePriority, playingCards } from '@/app/comet-cards/domain/playing-card/playing-cards'
import type { CardValue, PlayingCardState } from '@/app/comet-cards/domain/playing-card/types'


import type { RememberedHandId } from './types'

export type { RememberedHandId }

/**
 * A remembered hand is played with the player's *real* cards, not invented ones.
 *
 * This matters for more than flavour: Ride the Bus asks whether a scoring face
 * card was present, Baron and Steel read enchantments, and editions change what
 * charges. Handing effects synthetic cards would charge jokers against a deck
 * the player does not own.
 *
 * It also enforces coherence for free — if your deck cannot make a Full House,
 * you cannot remember having played one.
 */

interface CardRef {
  state: PlayingCardState
  value: CardValue
  suit: 'hearts' | 'diamonds' | 'clubs' | 'spades'
}

function toRefs(game: GameState): CardRef[] {
  const refs: CardRef[] = []
  for (const id of game.ownedCardIds) {
    const state = game.cards[id]
    if (!state) continue
    // Stone cards have no rank or suit for hand-matching purposes.
    if (state.flags.enchantment === 'stone') continue
    const def = playingCards[state.playingCardId]
    if (!def) continue
    refs.push({ state, value: def.value, suit: def.suit })
  }
  return refs
}

function groupBy<K extends string>(refs: CardRef[], key: (r: CardRef) => K): Map<K, CardRef[]> {
  const map = new Map<K, CardRef[]>()
  for (const ref of refs) {
    const k = key(ref)
    const existing = map.get(k)
    if (existing) existing.push(ref)
    else map.set(k, [ref])
  }
  return map
}

/** Groups of the same value with at least `size` members, largest value first. */
function valueGroups(refs: CardRef[], size: number): CardRef[][] {
  return [...groupBy(refs, r => r.value).values()]
    .filter(group => group.length >= size)
    .sort((a, b) => cardValuePriority[b[0].value] - cardValuePriority[a[0].value])
}

function suitGroups(refs: CardRef[], size: number): CardRef[][] {
  return [...groupBy(refs, r => r.suit).values()].filter(group => group.length >= size)
}

/** All five-card value windows present in `refs`, highest first. */
function straightWindows(refs: CardRef[]): CardValue[][] {
  const byValue = groupBy(refs, r => r.value)
  const order: CardValue[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
  const windows: CardValue[][] = []
  for (let start = order.length - 5; start >= 0; start--) {
    const window = order.slice(start, start + 5)
    if (window.every(v => byValue.has(v))) windows.push(window)
  }
  return windows
}

/**
 * Pick one card per value in the window, spreading suits so the result is a
 * plain straight rather than an accidental straight flush.
 */
function straightFromWindow(refs: CardRef[], window: CardValue[], sameSuit: boolean): CardRef[] | null {
  const byValue = groupBy(refs, r => r.value)
  const picked: CardRef[] = []
  for (const value of window) {
    const options = byValue.get(value)
    if (!options) return null
    if (sameSuit) {
      picked.push(options[0])
      continue
    }
    const previous = picked[picked.length - 1]
    const differentSuit = previous ? options.find(o => o.suit !== previous.suit) : undefined
    picked.push(differentSuit ?? options[0])
  }
  return picked
}

/**
 * Builders return *candidates*, not answers. A greedy pick can promote itself
 * without meaning to — the five lowest hearts are a straight flush, not a flush
 * — so each builder offers several shapes and the caller keeps the first one
 * the real hand-matcher agrees with.
 */
type Builder = (refs: CardRef[]) => CardRef[][]

const builders: Record<RememberedHandId, Builder> = {
  highCard: refs => refs.map(ref => [ref]),

  pair: refs => valueGroups(refs, 2).map(group => group.slice(0, 2)),

  twoPair: refs => {
    const groups = valueGroups(refs, 2)
    const candidates: CardRef[][] = []
    for (let i = 0; i < groups.length; i++) {
      for (let j = i + 1; j < groups.length; j++) {
        candidates.push([...groups[i].slice(0, 2), ...groups[j].slice(0, 2)])
      }
    }
    return candidates
  },

  threeOfAKind: refs => valueGroups(refs, 3).map(group => group.slice(0, 3)),

  straight: refs =>
    straightWindows(refs)
      .map(window => straightFromWindow(refs, window, false))
      .filter((hand): hand is CardRef[] => hand !== null),

  flush: refs => {
    const candidates: CardRef[][] = []
    for (const group of suitGroups(refs, 5)) {
      const distinct = [...groupBy(group, r => r.value).values()].map(g => g[0])
      if (distinct.length < 5) continue
      const byPriority = [...distinct].sort(
        (a, b) => cardValuePriority[a.value] - cardValuePriority[b.value]
      )
      // Deliberately non-consecutive shapes first, so a flush stays a flush.
      if (byPriority.length >= 6) {
        candidates.push([...byPriority.slice(0, 4), byPriority[byPriority.length - 1]])
      }
      if (byPriority.length >= 7) {
        candidates.push([...byPriority.slice(0, 3), byPriority[4], byPriority[6]])
      }
      candidates.push(byPriority.slice(0, 5))
    }
    return candidates
  },

  fullHouse: refs => {
    const candidates: CardRef[][] = []
    for (const three of valueGroups(refs, 3)) {
      for (const pair of valueGroups(refs, 2)) {
        if (pair[0].value === three[0].value) continue
        candidates.push([...three.slice(0, 3), ...pair.slice(0, 2)])
      }
    }
    return candidates
  },

  fourOfAKind: refs => valueGroups(refs, 4).map(group => group.slice(0, 4)),

  straightFlush: refs => {
    const candidates: CardRef[][] = []
    for (const group of suitGroups(refs, 5)) {
      for (const window of straightWindows(group)) {
        const hand = straightFromWindow(group, window, true)
        if (hand) candidates.push(hand)
      }
    }
    return candidates
  },

  flushHouse: refs => {
    const candidates: CardRef[][] = []
    for (const group of suitGroups(refs, 5)) {
      for (const three of valueGroups(group, 3)) {
        for (const pair of valueGroups(group, 2)) {
          if (pair[0].value === three[0].value) continue
          candidates.push([...three.slice(0, 3), ...pair.slice(0, 2)])
        }
      }
    }
    return candidates
  },

  fiveOfAKind: refs => valueGroups(refs, 5).map(group => group.slice(0, 5)),

  flushFive: refs => {
    const candidates: CardRef[][] = []
    for (const group of suitGroups(refs, 5)) {
      for (const five of valueGroups(group, 5)) {
        candidates.push(five.slice(0, 5))
      }
    }
    return candidates
  },
}

/**
 * Build a real hand of the requested type from the player's deck, or null if
 * their deck cannot produce one.
 *
 * The candidate is verified through the same `findHighestPriorityHand` the game
 * uses when a hand is actually played — a "flush" that happens to also be a
 * straight flush would score as the latter, so we refuse it rather than charge
 * jokers against a hand the engine would classify differently.
 */
export function buildRememberedHand(
  game: GameState,
  handId: RememberedHandId
): PlayingCardState[] | null {
  return buildRememberedHands(game, handId, 1)[0] ?? null
}

/**
 * How many different versions of a hand a history is built from.
 *
 * A player who remembers fifteen Full Houses did not play the same five cards
 * fifteen times, and it matters: Hiker writes +5 chips onto every card it
 * scores, so replaying one canonical hand piled its whole effect onto five
 * cards and left the rest of the deck untouched. The memory screen would
 * promise hundreds of chips the player then rarely drew.
 *
 * Capped rather than exhaustive because verifying candidates is the expensive
 * part, and this runs on every keystroke of the memory screen. Eight versions
 * spreads a history across most of a deck without the cost.
 */
export const REMEMBERED_HAND_VARIANTS = 8

/**
 * Up to `limit` genuinely different hands of the requested type, each verified
 * against the same matcher the game uses when a hand is really played.
 */
export function buildRememberedHands(
  game: GameState,
  handId: RememberedHandId,
  limit: number = REMEMBERED_HAND_VARIANTS
): PlayingCardState[][] {
  const refs = toRefs(game)
  if (refs.length === 0) return []

  const hands: PlayingCardState[][] = []
  const seen = new Set<string>()

  for (const candidate of builders[handId](refs)) {
    if (hands.length >= limit) break

    const cards = candidate.map(ref => ref.state)
    const key = cards
      .map(card => card.id)
      .sort()
      .join(',')
    if (seen.has(key)) continue

    const { hand } = findHighestPriorityHand(cards, game.staticRules)
    if (hand !== handId) continue

    seen.add(key)
    hands.push(cards)
  }

  return hands
}

/** Which hand types this deck can actually remember having played. */
export function getRememberableHands(game: GameState): RememberedHandId[] {
  return (Object.keys(builders) as RememberedHandId[]).filter(
    handId => buildRememberedHand(game, handId) !== null
  )
}
