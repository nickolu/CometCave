import { UNIT_CATALOG, type CatalogUnit } from '@/app/badge-run/domain/unit-catalog'
import { ARENA_SCHEDULE } from '@/app/badge-run/domain/data/arenas'
import { runBattle } from '@/app/badge-run/domain/battle/runner'
import type { BattleUnit, Team } from '@/app/badge-run/domain/battle/types'
import { makePRNG } from '@/app/badge-run/domain/rng'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const N_BATTLES = Number(arg('battles', '50'))

function catalogToUnit(cat: CatalogUnit, idx: number): BattleUnit {
  return {
    instanceId: `${cat.dexId}-${idx}`,
    dexId: cat.dexId,
    name: cat.name,
    types: cat.types,
    tier: cat.tier,
    kin: cat.kin,
    maxHp: cat.baseStats.hp,
    currentHp: cat.baseStats.hp,
    attack: cat.baseStats.attack,
    defense: cat.baseStats.defense,
    specialAttack: cat.baseStats.specialAttack,
    specialDefense: cat.baseStats.specialDefense,
    speed: cat.baseStats.speed,
    signatureMove: cat.signatureMove,
    fainted: false,
  }
}

function buildTeam(id: string, picks: CatalogUnit[]): Team {
  return { id, units: picks.map((c, i) => catalogToUnit(c, i)) }
}

function pickN<T>(arr: T[], n: number, rng: ReturnType<typeof makePRNG>): T[] {
  const pool = [...arr]
  const out: T[] = []
  while (out.length < n && pool.length > 0) {
    const idx = rng.nextInt(pool.length)
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return out
}

interface UnitStats {
  kills: number
  appeared: number
  survived: number
}

const unitStats = new Map<string, UnitStats>()
function getStats(name: string): UnitStats {
  if (!unitStats.has(name)) unitStats.set(name, { kills: 0, appeared: 0, survived: 0 })
  return unitStats.get(name)!
}

let attackerWins = 0
const turnBuckets: Record<string, number> = {
  '1-10': 0, '11-20': 0, '21-30': 0, '31-40': 0, '41-50': 0, '51+': 0,
}
const tierSurvival: Record<string, { survived: number; appeared: number }> = {}

for (let i = 0; i < N_BATTLES; i++) {
  const rng = makePRNG(i * 1000)
  const arenaId = ARENA_SCHEDULE[rng.nextInt(ARENA_SCHEDULE.length)]
  const aTeamPicks = pickN(UNIT_CATALOG, 6, rng)
  const dTeamPicks = pickN(UNIT_CATALOG, 6, rng)
  const attackerTeam = buildTeam('attacker', aTeamPicks)
  const defenderTeam = buildTeam('defender', dTeamPicks)

  const { result } = runBattle(attackerTeam, defenderTeam, arenaId, i)

  if (result.winnerId === 'attacker') attackerWins++

  // Turn bucket
  const t = result.totalTurns
  const bucket = t <= 10 ? '1-10' : t <= 20 ? '11-20' : t <= 30 ? '21-30' : t <= 40 ? '31-40' : t <= 50 ? '41-50' : '51+'
  turnBuckets[bucket]++

  // Collect fainted unit IDs
  const faintedIds = new Set<string>()
  for (const ev of result.events) {
    if (ev.type === 'faint') faintedIds.add(ev.unitId)
  }

  // Per-unit stats: appearances and survival
  for (const [teamPicks] of [[aTeamPicks], [dTeamPicks]] as const) {
    for (let ui = 0; ui < teamPicks.length; ui++) {
      const cat = teamPicks[ui]
      const instanceId = `${cat.dexId}-${ui}`
      const stats = getStats(cat.name)
      stats.appeared++
      const survived = !faintedIds.has(instanceId)
      if (survived) stats.survived++

      // Tier survival
      if (!tierSurvival[cat.tier]) tierSurvival[cat.tier] = { survived: 0, appeared: 0 }
      tierSurvival[cat.tier].appeared++
      if (survived) tierSurvival[cat.tier].survived++
    }
  }

  // Kill tracking: credit the last actor before a faint event
  const lastActorForTarget = new Map<string, string>()
  for (const ev of result.events) {
    if (ev.type === 'unit_acts') {
      lastActorForTarget.set(ev.targetId, ev.actorId)
    } else if (ev.type === 'faint') {
      const killer = lastActorForTarget.get(ev.unitId)
      if (killer) {
        const allWithIds = [
          ...aTeamPicks.map((c, idx) => ({ name: c.name, id: `${c.dexId}-${idx}` })),
          ...dTeamPicks.map((c, idx) => ({ name: c.name, id: `${c.dexId}-${idx}` })),
        ]
        const killerEntry = allWithIds.find(u => u.id === killer)
        if (killerEntry) getStats(killerEntry.name).kills++
      }
    }
  }
}

// Report
const attackerWinRate = ((attackerWins / N_BATTLES) * 100).toFixed(1)
console.log(`\n=== Badge Run Simulation (${N_BATTLES} battles) ===\n`)
console.log(`Attacker win rate: ${attackerWinRate}% (${attackerWins}/${N_BATTLES})`)
console.log(`Defender win rate: ${(100 - Number(attackerWinRate)).toFixed(1)}%\n`)

console.log('Cycle-length distribution:')
for (const [bucket, count] of Object.entries(turnBuckets)) {
  const pct = ((count / N_BATTLES) * 100).toFixed(1)
  const bar = '\u2588'.repeat(Math.round((count / N_BATTLES) * 20))
  console.log(`  ${bucket.padEnd(6)} ${String(count).padStart(3)} (${pct.padStart(5)}%)  ${bar}`)
}

console.log('\nSurvival rate by tier:')
for (const tier of ['T1', 'T2', 'T3', 'T4', 'T5']) {
  const s = tierSurvival[tier]
  if (!s) continue
  const rate = ((s.survived / s.appeared) * 100).toFixed(1)
  console.log(`  ${tier}: ${rate}% (${s.survived}/${s.appeared})`)
}

console.log('\nTop 10 units by kills:')
const ranked = [...unitStats.entries()].sort((a, b) => b[1].kills - a[1].kills).slice(0, 10)
for (const [name, s] of ranked) {
  const survRate = ((s.survived / s.appeared) * 100).toFixed(0)
  console.log(`  ${name.padEnd(14)} ${String(s.kills).padStart(3)} kills  ${survRate}% survival`)
}
console.log()
