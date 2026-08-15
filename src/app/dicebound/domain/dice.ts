/**
 * The die.
 *
 * This file is the reason the game is trustworthy. The dungeon master model
 * decides *whether* a check happens, *which* attribute it leans on, and *how
 * hard* it is — and then it stops. The roll itself happens here, in code the
 * model cannot see the result of before it commits to the difficulty, and the
 * outcome is handed back to it as a fact it has to narrate around.
 *
 * A model asked to roll its own dice will let the player win. Not maliciously —
 * it is agreeable, the story is going well, and a 4 is inconvenient. But the
 * whole tension of "describe what you attempt" collapses the moment attempts
 * stop being able to fail, so the split is structural rather than a matter of
 * prompting.
 *
 * Everything here is pure and synchronous so it can be tested exhaustively and
 * so the same resolution runs on the server today and could run on the client
 * tomorrow without changing a number.
 */

/** The player's own table, verbatim. The DM is shown this and picks a row. */
export interface DifficultyRow {
  dc: number
  label: string
  example: string
}

export const DC_TABLE: readonly DifficultyRow[] = [
  { dc: 0, label: 'trivial', example: 'operate an elevator' },
  { dc: 5, label: 'easy', example: 'tie your shoes, catch a ball' },
  {
    dc: 10,
    label: 'medium',
    example: 'balance on a wide log across a river, convince an ally to do a favor',
  },
  {
    dc: 12,
    label: 'kinda hard',
    example: 'balance on a skinny log across a river, convince an ally to do something dangerous',
  },
  {
    dc: 15,
    label: 'hard',
    example: 'carry a person over your shoulders, convince a neutral stranger to help you',
  },
  {
    dc: 18,
    label: 'really hard',
    example: 'bend an iron bar, convince a neutral stranger to do something dangerous',
  },
  { dc: 20, label: 'extremely difficult', example: 'hold up a huge iron door for a moment' },
  { dc: 25, label: 'impossible for a regular person', example: 'lift a giant boulder' },
  { dc: 30, label: 'impossible', example: 'jump to the moon' },
]

export const MIN_DC = 0
export const MAX_DC = 30

/**
 * How far a single situational nudge may move the odds.
 *
 * Wide enough for "the floor is wet" and "you just mentioned his daughter" to
 * matter, tight enough that a stack of them cannot quietly turn a hard check
 * into a formality — which is the failure mode when a model is allowed to
 * invent its own arithmetic in the player's favour.
 */
export const MAX_SITUATIONAL = 4
export const MAX_SITUATIONAL_TOTAL = 6

export type OutcomeBand =
  | 'critical-success'
  | 'strong-success'
  | 'success'
  | 'failure'
  | 'strong-failure'
  | 'critical-failure'

export interface Modifier {
  label: string
  value: number
}

export type AdvantageDirection = 'advantage' | 'disadvantage'

/**
 * One reason the die gets thrown twice.
 *
 * Advantage is a **flag, not a number**, and that is the whole point of it. The
 * alternative — the DM saying "give them +4 for the fire" — is the exact fudge
 * this architecture exists to prevent, because a number can be argued up,
 * scaled and stacked. This cannot: it is on or it is off, and only code turns
 * it on. It also sits deliberately outside the ±6 situational budget and the +3
 * kit ceiling, because it moves the odds without moving any number anyone can
 * point at.
 *
 * A list rather than a tri-state field, because sources arrive independently —
 * a power grants advantage while the scene imposes disadvantage, and neither
 * knows about the other. Making the caller collapse that into one value would
 * put the cancelling rule wherever the request happens to be assembled; here it
 * is in `netAdvantage`, once.
 */
export interface AdvantageSource {
  direction: AdvantageDirection
  /** Why, in the fiction. Shown on the die card beside the discarded die. */
  reason: string
}

/** What actually happened when a check was rolled twice. */
export interface RolledTwice {
  direction: AdvantageDirection
  reason: string
  /** The die that was thrown away — the most interesting number on the card. */
  discarded: number
}

/**
 * Collapse every source into the one thing that happens to the die.
 *
 * Pulled in both directions is *neither*, regardless of how many sources are on
 * each side. Counting them and taking the difference would let a stack of small
 * advantages out-vote a disadvantage, which is a magnitude — and the reason
 * this is a flag is that it has no magnitude to argue about.
 */
export function netAdvantage(sources: readonly AdvantageSource[]): AdvantageSource | null {
  const up = sources.filter(s => s.direction === 'advantage')
  const down = sources.filter(s => s.direction === 'disadvantage')
  if (up.length === 0 && down.length === 0) return null
  if (up.length > 0 && down.length > 0) return null

  const winning = up.length > 0 ? up : down
  return {
    direction: winning[0].direction,
    // Every reason is kept. Two powers both granting advantage is one extra
    // die, but the player is owed both of the reasons it happened.
    reason: [...new Set(winning.map(s => s.reason).filter(Boolean))].join(' + '),
  }
}

export interface CheckOutcome {
  roll: number
  /** Everything added to the roll, itemised, so the die card can show its work. */
  modifiers: Modifier[]
  modifier: number
  total: number
  dc: number
  dcLabel: string
  /** total − dc. Negative is a miss. The DM narrates by how much. */
  margin: number
  band: OutcomeBand
  succeeded: boolean
  /** Null on an ordinary check, which is very nearly all of them. */
  twice: RolledTwice | null
}

export interface CheckRequest {
  dc: number
  modifiers: Modifier[]
  /** Everything pulling the die in either direction. See `netAdvantage`. */
  advantage?: readonly AdvantageSource[]
}

export type Rng = () => number

export function rollD20(rng: Rng = Math.random): number {
  return 1 + Math.floor(rng() * 20)
}

export function clampDc(dc: unknown): number {
  const n = typeof dc === 'number' && Number.isFinite(dc) ? Math.round(dc) : 10
  return Math.min(MAX_DC, Math.max(MIN_DC, n))
}

/** The nearest table row at or below `dc`, for labelling an off-table number. */
export function difficultyLabel(dc: number): string {
  let row = DC_TABLE[0]
  for (const candidate of DC_TABLE) {
    if (candidate.dc <= dc) row = candidate
  }
  return row.label
}

/**
 * Trim a set of situational modifiers to what the table can bear.
 *
 * Each one is clamped on its own and then the *sum* of the situational nudges
 * is clamped again, because three plausible +3s are how a DC 18 becomes a
 * coin flip without anyone deciding that it should.
 */
export function clampSituational(modifiers: Modifier[]): Modifier[] {
  const clamped = modifiers
    .filter(m => Number.isFinite(m.value) && m.value !== 0)
    .map(m => ({
      label: m.label,
      value: Math.max(-MAX_SITUATIONAL, Math.min(MAX_SITUATIONAL, Math.round(m.value))),
    }))

  const total = clamped.reduce((sum, m) => sum + m.value, 0)
  if (Math.abs(total) <= MAX_SITUATIONAL_TOTAL) return clamped

  // Scale the whole set toward the ceiling rather than dropping entries, so
  // every reason the DM gave the player still appears on the die card.
  const scale = MAX_SITUATIONAL_TOTAL / Math.abs(total)
  return clamped.map(m => ({
    label: m.label,
    value: Math.round(m.value * scale) || (m.value > 0 ? 1 : -1),
  }))
}

/**
 * Resolve one check.
 *
 * A natural 20 and a natural 1 are decided by the die alone, before the
 * arithmetic — a character good enough that a 1 still clears the DC should
 * still have the moment where it all goes wrong, and a character who cannot
 * mathematically reach the DC should still have the moment where it doesn't
 * matter. That is the part of the table people actually tell stories about.
 *
 * With advantage the naturals are decided on the **kept** die, not on either
 * die that was thrown. Otherwise advantage would double a character's chance of
 * a critical failure, which is the opposite of what it is for.
 */
export function resolveCheck(request: CheckRequest, rng: Rng = Math.random): CheckOutcome {
  const net = netAdvantage(request.advantage ?? [])
  const first = rollD20(rng)
  // The second die is only thrown when something is actually pulling, so an
  // ordinary check consumes exactly one value from the rng and every existing
  // seeded test keeps rolling what it always rolled.
  const second = net ? rollD20(rng) : null

  const [roll, twice] =
    net && second !== null
      ? net.direction === 'advantage'
        ? ([Math.max(first, second), { ...net, discarded: Math.min(first, second) }] as const)
        : ([Math.min(first, second), { ...net, discarded: Math.max(first, second) }] as const)
      : ([first, null] as const)

  const dc = clampDc(request.dc)
  // Modifiers are kept exactly as given, zeroes included: the die card shows
  // its work, and "Dexterity +0" is information the player wants — it tells
  // them which attribute the DM thought this was about.
  const modifiers = request.modifiers
  const modifier = modifiers.reduce((sum, m) => sum + m.value, 0)
  const total = roll + modifier
  const margin = total - dc

  let band: OutcomeBand
  if (roll === 20) band = 'critical-success'
  else if (roll === 1) band = 'critical-failure'
  else if (margin >= 5) band = 'strong-success'
  else if (margin >= 0) band = 'success'
  else if (margin > -5) band = 'failure'
  else band = 'strong-failure'

  return {
    roll,
    modifiers,
    modifier,
    total,
    dc,
    dcLabel: difficultyLabel(dc),
    margin,
    band,
    succeeded: band.endsWith('success'),
    twice,
  }
}

/** What the DM is told the roll means, so its narration matches the die card. */
export const BAND_BRIEF: Record<OutcomeBand, string> = {
  'critical-success':
    'NATURAL 20. It goes better than they had any right to expect — give them something extra they did not ask for.',
  'strong-success': 'Clear success. It works, and it works cleanly.',
  success: 'Success, but only just. It works with a cost, a complication, or a scare.',
  failure: 'A near miss. It fails, but the failure is small and the situation is still workable.',
  'strong-failure': 'A real failure. It fails and the situation gets worse.',
  'critical-failure':
    'NATURAL 1. It fails badly and something new goes wrong — but never something that ends the story outright.',
}

/**
 * Every band, best to worst.
 *
 * The type is a union and unions have no order, but anything that renders all
 * six — the move table in the prompt, and any future legend on the die card —
 * needs them in the order a reader expects. Declaring it once means adding a
 * band is a type error here rather than a row silently missing from a table.
 */
export const BAND_ORDER: readonly OutcomeBand[] = [
  'critical-success',
  'strong-success',
  'success',
  'failure',
  'strong-failure',
  'critical-failure',
]

/**
 * What the dungeon master should actually *do* with each band.
 *
 * `BAND_BRIEF` says what the die meant; this says what to write. They are
 * separate strings because they answer different questions, but they must never
 * disagree — a model told "it fails and the situation gets worse" in one breath
 * and "give them what they wanted" in the next will split the difference, and
 * the split always lands in the player's favour.
 *
 * The way they are kept honest is that this record is the *only* source for
 * both places the moves appear: the table in the system prompt is rendered from
 * it, and the tool result at the point of the roll quotes the same entry. There
 * is no second copy to fall out of date, which is the whole reason this lives
 * in the domain next to the band it belongs to rather than being written out
 * again inside the prompt.
 *
 * Six bands, not the five in the issue that asked for this. The issue's table
 * was written against Dungeon World's three tiers and its row names collide
 * with the band ids here — its "near miss" is this file's `success` (a success
 * that costs something), and its "failure" is `strong-failure`. Mapping its
 * five moves onto six bands rather than collapsing the bands keeps
 * `resolveCheck` untouched and keeps the die card honest.
 */
export const BAND_MOVE: Record<OutcomeBand, string> = {
  'critical-success':
    'Give them what they were reaching for, and one thing more they never asked for — an opening, someone deciding to trust them, a way through that was not there a moment ago.',
  'strong-success':
    'Give them what they wanted, cleanly, and then get out of the way. A sentence is usually enough. Spend the rest of the turn on what is happening next, not on admiring the result.',
  success:
    'They get it, and it costs. Noise, time, something broken, somebody noticing. Put the cost in the fiction where they can see it, and do not soften it afterwards.',
  failure:
    'A soft move. Show the trouble arriving rather than landing — a hand closing on the latch, the rope starting to give, the sound getting nearer — and leave them room to answer it.',
  'strong-failure':
    'A hard move. Pick one from the list and let it happen. Do not replay the attempt back at them; the situation they are in afterwards must be a different situation.',
  'critical-failure':
    'A hard move that changes the scene: the floor gives way, the door shuts behind them, the thing they were avoiding is simply here now. Never one that ends the story.',
}

/**
 * The hard moves, named so the model reaches for one instead of improvising a
 * paragraph of consequence.
 *
 * Paraphrased from Dungeon World's GM moves rather than pasted. It is CC-BY so
 * lifting would be permitted, but its register is not this game's — Dicebound is
 * played at all ages and the list has to read that way.
 */
export const HARD_MOVES: readonly string[] = [
  'Use up something they were relying on.',
  'Put someone they care about in a bad spot.',
  'Show a threat getting closer.',
  'Offer them what they want, at a price.',
  'Turn their own move back on them.',
  'Separate them from someone or something.',
  'Tell them an unwelcome truth about where they are.',
]

/** Player-facing label on the die card. */
export const BAND_LABEL: Record<OutcomeBand, string> = {
  'critical-success': 'Critical success',
  'strong-success': 'Success',
  success: 'Narrow success',
  failure: 'Near miss',
  'strong-failure': 'Failure',
  'critical-failure': 'Critical failure',
}
