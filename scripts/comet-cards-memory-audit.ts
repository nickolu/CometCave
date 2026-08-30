/**
 * Which jokers can The Last Ante's memory phase actually charge?
 *
 * Reading 5,600 lines of joker definitions would answer this badly. Instead
 * this probes every joker empirically: give it a game, fire one candidate
 * event at it repeatedly, and see whether anything it accumulates moved.
 *
 * "Accumulates" is deliberately broad — a joker's progress can live in
 * `counter`, in `metadata`, in permanent chip bonuses written onto cards, in
 * hand levels, or in the size of the deck.
 *
 * Run with `npm run audit:last-ante`.
 */
import { dispatchEffects } from '@/app/comet-cards/domain/events/dispatch-effects'
import type { EffectContext, GameEvent } from '@/app/comet-cards/domain/events/types'
import { defaultGameState } from '@/app/comet-cards/domain/game/default-game-state'
import type { GameState } from '@/app/comet-cards/domain/game/types'
import { collectEffects } from '@/app/comet-cards/domain/game/utils'
import { findHighestPriorityHand } from '@/app/comet-cards/domain/hand/hands'
import { jokers } from '@/app/comet-cards/domain/joker/jokers'
import { initializeJoker } from '@/app/comet-cards/domain/joker/utils'

/** Every way a joker is known to record progress. */
function chargeFingerprint(game: GameState): string {
  const joker = game.jokers[0]
  const cardBonus = game.ownedCardIds.reduce((sum, id) => sum + (game.cards[id]?.bonusChips ?? 0), 0)
  const enhancements = game.ownedCardIds
    .map(id => game.cards[id]?.flags.enchantment ?? '')
    .sort()
    .join('')
  const handLevels = Object.values(game.pokerHands).reduce((sum, h) => sum + h.level, 0)
  return JSON.stringify({
    counter: joker?.counter,
    metadata: joker?.metadata,
    sellValue: joker?.bonusSellValue,
    cardBonus,
    enhancements,
    handLevels,
    deckSize: game.ownedCardIds.length,
    handSize: game.handSizeModifier,
    maxHands: game.maxHands,
    maxDiscards: game.maxDiscards,
  })
}

function gameWith(jokerId: string): GameState {
  const game: GameState = structuredClone(defaultGameState)
  game.jokers = [initializeJoker(jokers[jokerId], game)]
  game.rounds[game.roundIndex].smallBlind.status = 'inProgress'
  game.gamePhase = 'gameplay'

  // A real five-card hand from the real deck, so card-shaped conditions
  // (face cards, suits, ranks) resolve the way they would in play.
  const cards = game.ownedCardIds.slice(0, 5).map(id => game.cards[id])
  const { hand } = findHighestPriorityHand(cards, game.staticRules)
  game.gamePlayState.selectedHand = [hand, cards]
  game.gamePlayState.cardsToScore = cards
  game.gamePlayState.playedCardIds = cards.map(c => c.id)
  game.gamePlayState.handIds = game.ownedCardIds.slice(0, 8)
  game.gamePlayState.selectedCardIds = cards.map(c => c.id)
  return game
}

function fire(game: GameState, event: GameEvent, times: number) {
  for (let i = 0; i < times; i++) {
    // Chance-based jokers seed off the game's play counts. Firing the same
    // event with the same counts rolls the same number every time, so a joker
    // like Space Joker (1 in 4 to level a hand) reads as inert on a miss.
    game.handsPlayed += 1

    const ctx: EffectContext = {
      event,
      game,
      score: game.gamePlayState.score,
      playedCards: game.gamePlayState.selectedHand?.[1] ?? [],
      scoredCards: game.gamePlayState.cardsToScore,
      round: game.rounds[game.roundIndex],
      bossBlind: game.rounds[game.roundIndex].bossBlind,
      jokers: game.jokers,
      vouchers: game.vouchers,
      tags: game.tags,
    }
    dispatchEffects(event, ctx, collectEffects(game))
  }
}

/** Events a "history" could plausibly contain. */
const PROBES: { label: string; event: GameEvent }[] = [
  { label: 'hand played', event: { type: 'HAND_SCORING_FINALIZE' } },
  { label: 'card scored', event: { type: 'CARD_SCORED' } },
  { label: 'discard', event: { type: 'DISCARD_SELECTED_CARDS' } },
  { label: 'round ended', event: { type: 'ROUND_END' } },
  { label: 'celestial used', event: { type: 'CELESTIAL_CARD_USED' } },
  { label: 'tarot used', event: { type: 'TAROT_CARD_USED' } },
  { label: 'shop reroll', event: { type: 'SHOP_REROLL' } },
  { label: 'pack skipped', event: { type: 'PACK_OPEN_SKIP' } },
  { label: 'card destroyed', event: { type: 'CARD_DESTROYED', cardId: '', source: 'glass_break' } },
  { label: 'card bought', event: { type: 'SHOP_BUY_CARD' } },
  { label: 'pack opened', event: { type: 'SHOP_OPEN_PACK', id: 'probe' } },
  { label: 'blind skipped', event: { type: 'BLIND_SKIPPED' } },
  { label: 'scoring start', event: { type: 'HAND_SCORING_START' } },
  { label: 'cards done', event: { type: 'HAND_SCORING_DONE_CARD_SCORING' } },
]

/** Blind selection is where per-round resets live. */
const RESET_EVENTS: GameEvent[] = [
  { type: 'SMALL_BLIND_SELECTED' },
  { type: 'BIG_BLIND_SELECTED' },
  { type: 'BOSS_BLIND_SELECTED' },
]

/**
 * Some jokers store no progress at all — they read a counter off the game and
 * convert it to score on the spot. Supernova reads `pokerHands[..].timesPlayed`;
 * Fortune Teller counts consumables used. Nothing about the joker changes, so
 * the fingerprint above cannot see them. Instead, score a hand against a game
 * that has a long history behind it and see whether the joker pays out more.
 */
function readsHistory(id: string): string[] {
  const reads: string[] = []

  // Compare chips and mult separately. A joker that only moves Mult is
  // invisible in the product whenever base chips are zero.
  const scoreWith = (mutate: (game: GameState) => void): string => {
    const game = gameWith(id)
    fire(game, { type: 'JOKER_ADDED' }, 1)
    mutate(game)
    game.gamePlayState.score = { chips: 0, mult: 0 }
    game.gamePlayState.scoringEvents = []
    fire(game, { type: 'HAND_SCORING_START' }, 1)
    fire(game, { type: 'CARD_SCORED' }, 5)
    fire(game, { type: 'HAND_SCORING_DONE_CARD_SCORING' }, 1)
    fire(game, { type: 'HAND_SCORING_FINALIZE' }, 1)
    const events = game.gamePlayState.scoringEvents
      .map(e => ('source' in e ? `${e.source}:${e.operator ?? '+'}${e.value}` : e.message))
      .join('|')
    return `${game.gamePlayState.score.chips}/${game.gamePlayState.score.mult}/${events}`
  }

  const baseline = scoreWith(() => {})

  const histories: { label: string; mutate: (game: GameState) => void }[] = [
    {
      label: 'hands played',
      mutate: game => {
        game.handsPlayed = 40
        for (const hand of Object.values(game.pokerHands)) hand.timesPlayed = 20
      },
    },
    { label: 'discards', mutate: game => void (game.discardsPlayed = 20) },
    {
      label: 'consumables used',
      mutate: game => {
        game.consumablesUsed = Array.from({ length: 12 }, (_, i) => ({
          id: `probe-${i}`,
          celestialCardId: 'pair',
        })) as unknown as GameState['consumablesUsed']
      },
    },
  ]

  for (const history of histories) {
    if (scoreWith(history.mutate) !== baseline) reads.push(history.label)
  }

  return reads
}

interface Row {
  id: string
  name: string
  chargedBy: string[]
  readsHistory: string[]
  resetsPerRound: boolean
}

const rows: Row[] = []

for (const id of Object.keys(jokers)) {
  const chargedBy: string[] = []

  for (const probe of PROBES) {
    const game = gameWith(id)
    fire(game, { type: 'JOKER_ADDED' }, 1)
    const before = chargeFingerprint(game)
    fire(game, probe.event, 6)
    if (chargeFingerprint(game) !== before) chargedBy.push(probe.label)
  }

  // Does starting a blind wipe whatever it accumulated?
  let resetsPerRound = false
  if (chargedBy.length > 0) {
    const game = gameWith(id)
    fire(game, { type: 'JOKER_ADDED' }, 1)
    fire(game, { type: 'HAND_SCORING_FINALIZE' }, 6)
    fire(game, { type: 'DISCARD_SELECTED_CARDS' }, 6)
    const charged = chargeFingerprint(game)
    for (const reset of RESET_EVENTS) fire(game, reset, 1)
    resetsPerRound = chargeFingerprint(game) !== charged
  }

  rows.push({ id, name: jokers[id].name, chargedBy, readsHistory: readsHistory(id), resetsPerRound })
}

const historyAware = rows.filter(r => r.chargedBy.length > 0 || r.readsHistory.length > 0)
/** What the memory phase actually replays today. */
const REPLAYED = new Set([
  'hand played',
  'card scored',
  'discard',
  'round ended',
  'shop reroll',
  'pack skipped',
])
const covered = historyAware.filter(
  r =>
    !r.resetsPerRound &&
    (r.chargedBy.some(c => REPLAYED.has(c)) || r.readsHistory.includes('hands played') || r.readsHistory.includes('discards'))
)
const resetting = historyAware.filter(r => r.resetsPerRound)
const gaps = historyAware.filter(r => !covered.includes(r) && !r.resetsPerRound)

console.log(`\n${rows.length} jokers probed`)
console.log(`  ${historyAware.length} care about history at all`)
console.log(`  ${covered.length} already reached by memories (hands played)`)
console.log(`  ${resetting.length} reset when a blind starts — memories cannot help them`)
console.log(`  ${gaps.length} care about history that memories cannot supply\n`)

console.log('=== GAPS: accumulate, survive a blind start, not charged by hands ===')
const byEvent = new Map<string, Row[]>()
for (const row of gaps) {
  const key = [...row.chargedBy, ...row.readsHistory.map(r => `reads ${r}`)].join(' + ')
  byEvent.set(key, [...(byEvent.get(key) ?? []), row])
}
for (const [key, group] of [...byEvent.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`\n  charged by: ${key}   (${group.length})`)
  for (const row of group) console.log(`    ${row.name}`)
}

console.log('\n\n=== RESETS PER ROUND (correctly out of reach) ===')
console.log('  ' + resetting.map(r => r.name).join(', ') + '\n')

if (process.argv.includes('--all')) {
  console.log('\n=== ALREADY COVERED ===')
  for (const row of covered) {
    console.log(`  ${row.name}: ${[...row.chargedBy, ...row.readsHistory.map(r => `reads ${r}`)].join(', ')}`)
  }
}
