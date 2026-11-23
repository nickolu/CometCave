import { mulberry32, xmur3 } from '@/app/comet-cards/domain/randomness'

import { CARDS } from '@/app/postmortem/data/cards'

import type { Incident } from '@/app/postmortem/data/incidents'

export const HAND_SIZE = 8
export const RUN_LENGTH = 10
export const CLUE_COUNT = 3
export const CORRECT_POINTS = 10
export const WRONG_PENALTY = 5

/** Returns a float in [0, 1). Injectable so tests are deterministic. */
export type Rng = () => number

export function createRng(seed: string): Rng {
  return mulberry32(xmur3(seed)())
}

/** Fisher-Yates. Returns a new array; the input is untouched. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/** Pick the incidents for one run. */
export function pickIncidents(all: readonly Incident[], rng: Rng, count = RUN_LENGTH): Incident[] {
  return shuffle(all, rng).slice(0, Math.min(count, all.length))
}

/**
 * Hand = every factor + every decoy + random filler up to HAND_SIZE, shuffled.
 * Never contains duplicates.
 */
export function buildHand(incident: Incident, rng: Rng, allCardIds: readonly string[] = CARDS.map(c => c.id)): string[] {
  const required = [...incident.factors, ...incident.decoys.map(d => d.id)]
  const unique = [...new Set(required)]
  const pool = shuffle(
    allCardIds.filter(id => !unique.includes(id)),
    rng
  )
  const fill = pool.slice(0, Math.max(0, HAND_SIZE - unique.length))
  return shuffle([...unique, ...fill], rng)
}

/** Clues revealed at commit time (1 to 3) -> multiplier. */
export function multiplierFor(cluesRevealed: number): 3 | 2 | 1 {
  if (cluesRevealed <= 1) return 3
  if (cluesRevealed === 2) return 2
  return 1
}

export type CardResult = 'correct' | 'wrong' | 'missed' | 'neutral'

/** Marks for every card in the hand. 'neutral' = not a factor and not picked. */
export function classifyHand(incident: Incident, hand: readonly string[], selected: readonly string[]): Record<string, CardResult> {
  const out: Record<string, CardResult> = {}
  for (const id of hand) {
    const isFactor = incident.factors.includes(id)
    const isPicked = selected.includes(id)
    out[id] = isFactor ? (isPicked ? 'correct' : 'missed') : isPicked ? 'wrong' : 'neutral'
  }
  return out
}

export type IncidentScore = {
  correct: string[]
  wrong: string[]
  missed: string[]
  multiplier: 3 | 2 | 1
  points: number
  solved: boolean
}

export type ScoreOutcome = { ok: true; score: IncidentScore } | { ok: false; reason: 'empty' }

/** +10 per correct x multiplier, -5 per wrong (unmultiplied), 0 per missed. */
export function scoreIncident(
  incident: Incident,
  hand: readonly string[],
  selected: readonly string[],
  cluesRevealed: number
): ScoreOutcome {
  const picked = [...new Set(selected)].filter(id => hand.includes(id))
  if (picked.length === 0) return { ok: false, reason: 'empty' }
  const correct = picked.filter(id => incident.factors.includes(id))
  const wrong = picked.filter(id => !incident.factors.includes(id))
  const missed = incident.factors.filter(id => !picked.includes(id))
  const multiplier = multiplierFor(cluesRevealed)
  const points = correct.length * CORRECT_POINTS * multiplier - wrong.length * WRONG_PENALTY
  return { ok: true, score: { correct, wrong, missed, multiplier, points, solved: wrong.length === 0 && missed.length === 0 } }
}

/** All factors found, no wrong cards. */
export function isFullySolved(score: Pick<IncidentScore, 'wrong' | 'missed'>): boolean {
  return score.wrong.length === 0 && score.missed.length === 0
}

export type IncidentResult = {
  incidentId: string
  factors: string[]
  correct: string[]
  wrong: string[]
  missed: string[]
  points: number
  multiplier: number
  solved: boolean
}

export function toResult(incident: Incident, score: IncidentScore): IncidentResult {
  return {
    incidentId: incident.id,
    factors: [...incident.factors],
    correct: score.correct,
    wrong: score.wrong,
    missed: score.missed,
    points: score.points,
    multiplier: score.multiplier,
    solved: score.solved,
  }
}

export type RunSummaryStats = {
  totalScore: number
  incidentsPlayed: number
  fullySolved: number
  /** Cards the player got wrong or missed most often this run, most first. */
  mostMissed: { id: string; count: number }[]
}

export function summarizeRun(results: readonly IncidentResult[], topN = 5): RunSummaryStats {
  const counts = new Map<string, number>()
  for (const r of results) {
    for (const id of [...r.wrong, ...r.missed]) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  const mostMissed = [...counts.entries()]
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id))
    .slice(0, topN)
  return {
    totalScore: results.reduce((sum, r) => sum + r.points, 0),
    incidentsPlayed: results.length,
    fullySolved: results.filter(r => r.solved).length,
    mostMissed,
  }
}

/** A run is a new high score when it is above zero and beats the saved best (or there is no saved best). */
export function isNewHighScore(score: number, previousBest: number | null): boolean {
  if (score <= 0) return false
  return previousBest === null || score > previousBest
}
