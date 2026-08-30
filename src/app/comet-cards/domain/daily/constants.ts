/**
 * The Last Ante — the short daily run.
 *
 * One round, three blinds, no ante ladder. The player arrives at the end of a
 * run they never played: the boss is named up front, Shop 0 sells them a build,
 * and the memory phase lets them declare the history that charges it.
 */

/**
 * Index into the rounds array from `initializeRounds` — base 11,000.
 *
 * Tuned with `npm run sim:last-ante`, not guessed. The memory mechanic is
 * additive (each remembered hand is worth a flat +1 or +2 Mult), so it cannot
 * bridge to a real ante 8, which Balatro-style runs only reach through xMult
 * jokers and deeply levelled hands. Pushed that high, memories stop mattering
 * and the mode becomes a shop simulator.
 *
 * Measured across five days and decks, this height gives the shape we want:
 *   - no memories at all reaches 14-27% of the small blind — hopeless
 *   - the free opening packs alone clear the small and die on the big
 *   - opening plus a decent shop clears all three about three days in five
 *   - a well-drafted, well-spent build clears every day, with overkill
 *     ranging 107-437% — enough spread to be worth arguing about
 *
 * So no single part of the draft is sufficient on its own, which is the point.
 * The sim plays greedily and never discards, so a human sits above these lines.
 */
export const LAST_ANTE_ROUND_INDEX = 5

/**
 * Purse the player brings into Shop 0. Big enough that the first screen is a
 * real decision; small enough that they cannot buy a whole board. Unspent gold
 * carries into the run, so this is also the tuning dial for the whole mode.
 */
export const LAST_ANTE_STARTING_MONEY = 40

/**
 * How many hands of history the player may declare in the memory phase.
 */
export const LAST_ANTE_MEMORY_BUDGET = 25

/**
 * Cap per hand type, so a build cannot dump the entire budget into one counter
 * and skip the allocation decision entirely.
 */
export const LAST_ANTE_MEMORY_MAX_PER_HAND = 15

/**
 * Discards are the second thing a run accumulates, and the only other one the
 * player gets to choose. Castle counts what you threw away; Green Joker loses
 * ground for it.
 *
 * They are spent from the same budget as hands. A run has only so much past in
 * it, so remembering a discard has to cost a hand you did not play — otherwise
 * discards are free and everyone takes the maximum.
 */
export const LAST_ANTE_MEMORY_MAX_DISCARDS = 20

/**
 * The part of the backstory nobody chooses.
 *
 * A player arriving at the last ante necessarily survived the antes below it
 * and shopped between them. Applying that automatically charges the jokers that
 * count rounds and rerolls (Egg, Gift Card, The Idol, Invisible Joker, Flash
 * Card) without adding sliders for numbers that have no interesting trade-off.
 *
 * It cuts both ways: Turtle Bean decays per round, so it arrives already spent.
 * That is honest, and the memory screen shows the loss rather than hiding it.
 */
export const LAST_ANTE_ROUNDS_BEHIND = LAST_ANTE_ROUND_INDEX
export const LAST_ANTE_REROLLS_BEHIND = 8
/** Packs walked past on the way here — Red Card counts them. */
export const LAST_ANTE_PACKS_SKIPPED_BEHIND = 4

/** Shop 0 is wider than the in-run shops — it is the whole draft. */
export const LAST_ANTE_DRAFT_SHOP_CARDS = 4
export const LAST_ANTE_DRAFT_SHOP_PACKS = 3

/**
 * The Opening: free packs the player tears through before the shop.
 *
 * A one-round run cannot get its options from a shop. Packs do not restock and
 * rerolling does not refresh them, so buying packs out of the purse left the
 * player with neither options nor money. Handing the packs over for free moves
 * the whole purse to the shop and puts the build-defining choices — which
 * joker, which suit, which hand to level — where they belong.
 *
 * The spread is fixed rather than seeded so every player gets the same coverage
 * on the same day; the *contents* are still seeded.
 */
export const LAST_ANTE_OPENING_PACKS: {
  cardType: 'jokerCard' | 'playingCard' | 'celestialCard' | 'tarotCard' | 'spectralCard'
  rarity: 'normal' | 'jumbo' | 'mega'
}[] = [
  { cardType: 'jokerCard', rarity: 'mega' }, // 7 jokers, pick 2
  { cardType: 'jokerCard', rarity: 'jumbo' }, // 5 jokers, pick 1
  { cardType: 'celestialCard', rarity: 'mega' }, // 7 hand levels, pick 2
  { cardType: 'playingCard', rarity: 'jumbo' }, // 5 cards, pick 1
  { cardType: 'spectralCard', rarity: 'normal' }, // 3 spectral, pick 1

  // Tarot is how a deck gets designed rather than merely improved — converting
  // suits, adding enhancements, cutting dead cards. One pack lets a player
  // nudge a deck; several let them commit to a strategy, which is the decision
  // the memory phase then pays off. Everything above is a single pack because
  // one pick is enough to matter; tarot is the exception.
  //
  // All three are Mega rather than a longer row of smaller packs. Tarot is the
  // slowest thing to open — each one deals a fresh hand and asks which card to
  // spend it on — so the count of *packs* is what costs the player their five
  // minutes, while the count of *picks* is what buys them a deck. Mega gives
  // six picks across three openings; the six-pack row it replaced gave eight
  // picks across six, and felt like a chore.
  { cardType: 'tarotCard', rarity: 'mega' }, // 7 tarot, pick 2
  { cardType: 'tarotCard', rarity: 'mega' },
  { cardType: 'tarotCard', rarity: 'mega' },
]
