import { DailyChallenge, DailyChallengeType, DailyChallengesState } from '@/app/tap-tap-adventure/models/dailyChallenge'
export { getTodayDateString } from '@/app/tap-tap-adventure/lib/dailyRewardTracker'

// ---------------------------------------------------------------------------
// Seeded PRNG (Linear Congruential Generator)
// ---------------------------------------------------------------------------

function seededRandom(seed: number): () => number {
  let s = seed >>> 0
  return function () {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function dateToSeed(date: string): number {
  let seed = 0
  for (let i = 0; i < date.length; i++) {
    seed += date.charCodeAt(i)
  }
  return seed
}

// ---------------------------------------------------------------------------
// Challenge template definitions
// ---------------------------------------------------------------------------

interface ChallengeTemplate {
  type: DailyChallengeType
  descriptionFn: (target: number) => string
  targetFn: (bucket: number) => number
  goldRewardFn: (bucket: number) => number
  repReward?: number
}

const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    type: 'travel_distance',
    descriptionFn: (target) => `Travel ${target} steps`,
    targetFn: (bucket) => 50 + bucket * 30,
    goldRewardFn: (bucket) => 15 + bucket * 5,
  },
  {
    type: 'earn_gold',
    descriptionFn: (target) => `Earn ${target} gold`,
    targetFn: (bucket) => 20 + bucket * 20,
    goldRewardFn: (bucket) => 10 + bucket * 3,
    repReward: 3,
  },
  {
    type: 'win_combats',
    descriptionFn: (target) => `Win ${target} combat${target !== 1 ? 's' : ''}`,
    targetFn: (bucket) => 2 + bucket * 1,
    goldRewardFn: (bucket) => 20 + bucket * 5,
  },
  {
    type: 'gain_reputation',
    descriptionFn: (target) => `Gain ${target} reputation`,
    targetFn: (bucket) => 3 + bucket * 3,
    goldRewardFn: (bucket) => 15 + bucket * 5,
  },
  {
    type: 'craft_item',
    descriptionFn: () => 'Craft an item',
    targetFn: () => 1,
    goldRewardFn: () => 30,
    repReward: 5,
  },
]

// ---------------------------------------------------------------------------
// Public functions
// ---------------------------------------------------------------------------

/**
 * Generate 3 deterministic daily challenges for a given date and character level.
 */
export function generateChallengesForDate(date: string, characterLevel: number): DailyChallenge[] {
  const bucket = Math.min(4, Math.floor((characterLevel - 1) / 5))
  const rand = seededRandom(dateToSeed(date))

  // Fisher-Yates shuffle using seeded PRNG
  const indices = [0, 1, 2, 3, 4]
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }

  const selected = indices.slice(0, 3)

  return selected.map((templateIndex, i) => {
    const template = CHALLENGE_TEMPLATES[templateIndex]
    const target = template.targetFn(bucket)
    const gold = template.goldRewardFn(bucket)
    return {
      id: `${date}-${i}`,
      type: template.type,
      description: template.descriptionFn(target),
      target,
      progress: 0,
      completed: false,
      reward: {
        gold,
        ...(template.repReward !== undefined ? { reputation: template.repReward } : {}),
      },
    }
  })
}

/**
 * Return true if the challenges state is missing or stale (different date).
 */
export function shouldRefreshChallenges(
  state: DailyChallengesState | null | undefined,
  today: string
): boolean {
  return !state || state.date !== today
}

/**
 * Build a fresh DailyChallengesState for today. Handles streak carry-over.
 */
export function refreshChallenges(
  currentState: DailyChallengesState | null | undefined,
  today: string,
  characterLevel: number
): DailyChallengesState {
  let newStreak = 0
  if (currentState && currentState.challenges.every(c => c.completed)) {
    newStreak = currentState.streak + 1
  }

  const challenges = generateChallengesForDate(today, characterLevel)
  return {
    date: today,
    challenges,
    allCompletedClaimed: false,
    streak: newStreak,
  }
}

/**
 * Apply progress to a specific challenge type. Returns a new state (pure function).
 */
export function applyProgress(
  state: DailyChallengesState,
  type: DailyChallengeType,
  amount: number
): DailyChallengesState {
  const updatedChallenges = state.challenges.map(challenge => {
    if (challenge.type !== type || challenge.completed) return challenge
    const newProgress = Math.min(challenge.target, challenge.progress + amount)
    return {
      ...challenge,
      progress: newProgress,
      completed: newProgress >= challenge.target,
    }
  })
  return { ...state, challenges: updatedChallenges }
}

/**
 * Compute the bonus reward for completing all 3 daily challenges.
 * Base: 50g + 10 rep. +15g / +5 rep per streak level (capped at 10).
 */
export function computeBonusReward(streak: number): { gold: number; reputation: number } {
  const cappedStreak = Math.min(10, streak)
  return {
    gold: 50 + cappedStreak * 15,
    reputation: 10 + cappedStreak * 5,
  }
}

/**
 * Return true if the bonus reward can currently be claimed.
 */
export function canClaimBonusReward(state: DailyChallengesState): boolean {
  return state.challenges.every(c => c.completed) && !state.allCompletedClaimed
}
