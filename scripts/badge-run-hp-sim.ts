/**
 * Snowball check harness for Badge Run player HP.
 * Simulates early-winner vs losing-streak scenarios and reports HP distribution.
 */
import { computeLossDamage, MAX_PLAYER_HP } from '../src/app/badge-run/domain/matchmaking/hp'

const ROUNDS = 29

function simulateHpCurve(winRounds: Set<number>): number[] {
  let hp = MAX_PLAYER_HP
  const curve: number[] = []
  for (let r = 1; r <= ROUNDS; r++) {
    const won = winRounds.has(r)
    if (!won) {
      const dmg = computeLossDamage(r, 3, false)  // assume 3 survivors on average
      hp = Math.max(0, hp - dmg)
    }
    curve.push(hp)
  }
  return curve
}

// Perfect winner (never loses)
const perfectWinner = simulateHpCurve(new Set(Array.from({ length: ROUNDS }, (_, i) => i + 1)))
// Loses every other round
const alternating = simulateHpCurve(new Set(Array.from({ length: ROUNDS }, (_, i) => i + 1).filter(r => r % 2 !== 0)))
// Loses every round
const alwaysLoses = simulateHpCurve(new Set())

console.log('\nBadge Run — Player HP Curves\n')
console.log('Round | Perfect | Alternating | Always Loses')
console.log('------|---------|-------------|-------------')
for (let r = 0; r < ROUNDS; r++) {
  const round = String(r + 1).padStart(5)
  const p = String(perfectWinner[r]).padStart(7)
  const a = String(alternating[r]).padStart(11)
  const l = String(alwaysLoses[r]).padStart(12)
  console.log(`${round} | ${p} | ${a} | ${l}`)
}

const eliminated = alwaysLoses.findIndex(hp => hp <= 0)
console.log(`\nAlways-losing player eliminated after round: ${eliminated + 1}`)
console.log('Snowball assessment: HP is a one-way resource — perfect winner keeps 100HP advantage.')
console.log('Anti-snowball mechanism: matchmaking (harder rivals for winners) is the balancing lever.')
