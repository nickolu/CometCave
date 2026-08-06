/**
 * Milestones — the game noticing you, once.
 *
 * These deliberately have no screen of their own. A milestone arrives as one
 * line in the same notice strip that already reports hunts and extinctions, and
 * afterwards it lives in the back of the field guide. There is no badge, no
 * progress bar, and nothing to collect on purpose: the whole mechanism is the
 * world remarking on something you did and then getting on with it.
 *
 * They fire once ever, not once per land. Seeing "a family line five deep" in
 * every world you open would turn a discovery into a chore.
 */

/** Everything a milestone is allowed to look at. All counts are current. */
export interface MilestoneContext {
  /** World-seconds this land has been running. */
  elapsed: number
  /** World-seconds since the last extinction here. */
  steadySeconds: number
  /** Age of the oldest thing currently alive. */
  oldestSeconds: number
  /** Deepest generation currently alive. */
  generations: number
  /** Distinct species currently alive. */
  speciesAlive: number
  /** Living things right now. */
  total: number
  /** Species in the field guide archive. */
  archived: number
  /** How many of those the player summoned. */
  summonedArchived: number
  /** Highest toxicity trait value among all living creatures. */
  maxToxicity: number
  /** Highest immunity trait value among living meat-eaters. */
  maxPredatorImmunity: number
  /**
   * True once a prey species has doubled in population after its last predator
   * went extinct — a trophic cascade in the classic sense.
   */
  trophicCascadeDetected: boolean
}

export interface Milestone {
  id: string
  /** Shown as a notice when it fires, and in the field guide from then on. */
  text: string
  reached: (c: MilestoneContext) => boolean
}

/**
 * Ordered loosely by when a player is likely to meet them. Order only affects
 * the field guide listing — the checks are independent.
 */
export const MILESTONES: Milestone[] = [
  {
    id: 'first-elder',
    text: 'Something here has grown old.',
    reached: c => c.oldestSeconds >= 60,
  },
  {
    id: 'many-kinds',
    text: 'Eight kinds sharing one land.',
    reached: c => c.speciesAlive >= 8,
  },
  {
    id: 'steady-3m',
    text: 'Three minutes, and nothing has died out.',
    reached: c => c.steadySeconds >= 180,
  },
  {
    id: 'gen-5',
    text: 'A family line five deep.',
    reached: c => c.generations >= 5,
  },
  {
    id: 'guide-12',
    text: 'Twelve kinds recorded in the field guide.',
    reached: c => c.archived >= 12,
  },
  {
    id: 'elder-5m',
    text: 'One creature has lived five whole minutes.',
    reached: c => c.oldestSeconds >= 300,
  },
  {
    id: 'summoned-5',
    text: 'Five creatures of your own invention, remembered.',
    reached: c => c.summonedArchived >= 5,
  },
  {
    id: 'crowded',
    text: 'Two hundred and fifty living things at once.',
    reached: c => c.total >= 250,
  },
  {
    id: 'steady-10m',
    text: 'Ten minutes steady. This web holds.',
    reached: c => c.steadySeconds >= 600,
  },
  {
    id: 'age-established',
    text: 'This land has stood for ten minutes.',
    reached: c => c.elapsed >= 600,
  },
  {
    id: 'age-ancient',
    text: 'Thirty minutes in one world. Something endures here.',
    reached: c => c.elapsed >= 1800,
  },
  {
    id: 'gen-12',
    text: 'Twelve generations. None of the first are left.',
    reached: c => c.generations >= 12,
  },
  {
    id: 'guide-30',
    text: 'Thirty kinds. The field guide is getting heavy.',
    reached: c => c.archived >= 30,
  },
  {
    id: 'toxicity-arms-race',
    text: 'A venomous lineage and an immune one, locked in step.',
    reached: c => c.maxToxicity >= 0.7 && c.maxPredatorImmunity >= 0.5,
  },
  {
    id: 'trophic-cascade',
    text: 'The hunters are gone. Their prey bloom in the silence.',
    reached: c => c.trophicCascadeDetected,
  },
  {
    id: 'grade-c',
    text: 'Grade C — four kinds of life, finding their niches.',
    reached: c => c.speciesAlive >= 4,
  },
  {
    id: 'grade-b',
    text: 'Grade B — six kinds. Each one needed.',
    reached: c => c.speciesAlive >= 6,
  },
  {
    id: 'grade-a',
    text: 'Grade A — nine kinds, all holding. The cave is old and it approves.',
    reached: c => c.speciesAlive >= 9,
  },
]

export const MILESTONE_BY_ID: Record<string, Milestone> = Object.fromEntries(
  MILESTONES.map(m => [m.id, m])
)
