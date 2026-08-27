/**
 * Gold curve simulator for Badge Run.
 * Usage: npx tsx scripts/badge-run-gold-sim.ts [--rounds N]
 *
 * Simulates N "perfect" runs (always win) and N "losing" runs to show
 * the gold curve extremes and a mixed-skill average.
 */
import { computeRoundIncome } from '../src/app/badge-run/domain/economy/gold'

const args = process.argv.slice(2)
const roundsIdx = args.indexOf('--rounds')
const ROUNDS = roundsIdx >= 0 ? parseInt(args[roundsIdx + 1], 10) : 29

type RunType = 'perfect' | 'losing' | 'mixed'

function simulateGoldCurve(rounds: number, runType: RunType): number[] {
  let gold = 0
  let winStreak = 0
  let lossStreak = 0
  const curve: number[] = []

  for (let r = 1; r <= rounds; r++) {
    const streak = runType === 'perfect' ? winStreak
                 : runType === 'losing'  ? lossStreak
                 : r % 3 === 0 ? lossStreak : winStreak

    const income = computeRoundIncome(gold, streak)
    gold += income

    if (runType === 'perfect' || (runType === 'mixed' && r % 3 !== 0)) {
      winStreak++
      lossStreak = 0
    } else {
      lossStreak++
      winStreak = 0
    }

    curve.push(gold)
  }

  return curve
}

const perfect = simulateGoldCurve(ROUNDS, 'perfect')
const losing = simulateGoldCurve(ROUNDS, 'losing')
const mixed = simulateGoldCurve(ROUNDS, 'mixed')

console.log(`\nBadge Run — Gold Curves (${ROUNDS} rounds)\n`)
console.log('Round | Perfect | Mixed  | Losing')
console.log('------|---------|--------|-------')
for (let r = 0; r < ROUNDS; r++) {
  const round = String(r + 1).padStart(5)
  const p = String(perfect[r]).padStart(7)
  const m = String(mixed[r]).padStart(6)
  const l = String(losing[r]).padStart(7)
  console.log(`${round} | ${p} | ${m} | ${l}`)
}
