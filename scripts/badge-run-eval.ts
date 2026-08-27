/**
 * Badge Run lobby evaluation harness.
 *
 * Runs N full 8-drafter lobbies and reports key health metrics:
 *   - Pool exhaustion rate: % of lobbies where the pool ran out
 *   - Contention rate: denials / total pick attempts
 *   - Denial rate: denials / (N × 8 × 6 rounds)
 *   - Ghost board diversity: average unique dexIds across 8 boards per lobby
 *
 * Usage:
 *   npm run eval:badge-run                  # 100 lobbies
 *   npm run eval:badge-run -- --lobbies 50  # custom count
 *   npm run eval:badge-run:smoke            # 10 lobbies, fast
 */
import { runLobby } from '@/app/badge-run/domain/draft/lobby'
import { HeuristicBot } from '@/app/badge-run/domain/draft/drafter'
import { UNIT_CATALOG } from '@/app/badge-run/domain/unit-catalog'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const N_LOBBIES = Number(arg('lobbies', '100'))

let totalPoolExhausted = 0
let totalDenials = 0
let totalPicked = 0
let totalDiversity = 0

for (let i = 0; i < N_LOBBIES; i++) {
  const bots = Array.from({ length: 8 }, () => new HeuristicBot())
  const result = runLobby(bots, i)

  if (result.poolExhausted) totalPoolExhausted++
  totalDenials += result.denials
  totalPicked += result.totalPicked

  // Board diversity: count unique dexIds across all 8 boards
  const allDexIds = new Set(result.drafts.flatMap(d => d.board.map(u => u.dexId)))
  totalDiversity += allDexIds.size
}

const exhaustionRate = ((totalPoolExhausted / N_LOBBIES) * 100).toFixed(1)
const contentionRate = totalPicked > 0 ? ((totalDenials / (totalPicked + totalDenials)) * 100).toFixed(1) : '0.0'
const denialRate = ((totalDenials / (N_LOBBIES * 8 * 6)) * 100).toFixed(1)
const avgDiversity = (totalDiversity / N_LOBBIES).toFixed(1)
const maxPossibleDiversity = UNIT_CATALOG.length

console.log(`\n=== Badge Run Lobby Evaluation (${N_LOBBIES} lobbies, 8 drafters × 6 rounds) ===\n`)
console.log(`Pool exhaustion rate:  ${exhaustionRate}% (${totalPoolExhausted}/${N_LOBBIES} lobbies ran dry)`)
console.log(`Contention rate:       ${contentionRate}% (denials / total pick attempts)`)
console.log(`Denial rate:           ${denialRate}% (${totalDenials} total denials across all rounds)`)
console.log(`Ghost board diversity: ${avgDiversity} unique units/lobby (out of ${maxPossibleDiversity} possible)\n`)
