/**
 * Micro Land ecosystem evals — pass/fail, so a change can be judged.
 *
 * `micro-land-sim.ts` prints the world for a person to read. This asks whether
 * the world is *working*, against the claims in `harness/evals.ts`, and exits
 * non-zero when it is not. That is the difference between a dashboard and a
 * test, and it is what makes "did my tuning help" answerable.
 *
 * Usage:
 *   npm run eval:micro-land                            # every theme, 300s, 3 seeds
 *   npm run eval:micro-land -- --theme grassland       # one theme
 *   npm run eval:micro-land -- --seconds 600 --runs 5  # slower, more confident
 *   npm run eval:micro-land -- --set breedAtScale=0.7  # same knobs as the panel
 *   npm run eval:micro-land:smoke                      # 120s, 1 seed, fast
 *   npm run eval:micro-land -- --json                  # machine-readable
 *
 * `--diagnose` prints the breeding probe per species even when everything
 * passes, which is what you want open while tuning.
 */
import { THEMES, THEME_BY_ID } from '@/app/micro-land/domain/config/themes'
import {
  TUNING,
  TUNING_DEFAULTS,
  type TuningKey,
  changedKnobs,
  setTuning,
} from '@/app/micro-land/domain/tuning'
import { meanProbe } from '@/app/micro-land/harness/breeding-probe'
import { runChecks, textMetric } from '@/app/micro-land/harness/evals'
import { type RunMetrics, runSeeds } from '@/app/micro-land/harness/run'

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

const asJson = process.argv.includes('--json')
const diagnose = process.argv.includes('--diagnose')
const seconds = Number(arg('seconds', '300'))
const runs = Number(arg('runs', '3'))
// Which seeds, not how many. `--runs 3 --seed-start 3` is a second, disjoint set
// of three worlds under the identical configuration — run it against the first
// and the gap between the two answers is the noise floor, below which no result
// means anything.
const seedStart = Number(arg('seed-start', '0'))

// Empty is not an ecosystem — it has nothing in it by design, so it can only
// ever fail checks that assume a population.
const playable = THEMES.filter(t => t.id !== 'empty').map(t => t.id)
const themeArg = arg('theme', '')
const themeIds = themeArg ? [themeArg] : playable

for (const id of themeIds) {
  if (!THEME_BY_ID[id]) {
    console.error(`Unknown theme "${id}". Try: ${THEMES.map(t => t.id).join(', ')}`)
    process.exit(2)
  }
}

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] !== '--set') continue
  const [key, raw] = (process.argv[i + 1] ?? '').split('=')
  if (!(key in TUNING_DEFAULTS) || !Number.isFinite(Number(raw))) {
    console.error(`Bad --set "${process.argv[i + 1] ?? ''}".`)
    process.exit(2)
  }
  setTuning({ [key as TuningKey]: Number(raw) })
}

const tuned = changedKnobs()

interface ThemeReport {
  themeId: string
  results: ReturnType<typeof runChecks>
  runs: RunMetrics[]
}

const reports: ThemeReport[] = []
for (const themeId of themeIds) {
  const metrics = runSeeds({ themeId, seconds, runs, seedStart })
  reports.push({ themeId, results: runChecks(metrics), runs: metrics })
}

const failed = reports.flatMap(r => r.results.filter(c => !c.pass))

if (asJson) {
  console.log(
    JSON.stringify(
      {
        seconds,
        runs,
        tuning: Object.fromEntries(tuned.map(k => [k, TUNING[k]])),
        themes: reports.map(r => ({
          themeId: r.themeId,
          // The primary metric first: the checks say whether the world is broken,
          // this says how long it took to break, and only the second one moves
          // while the first is failing.
          tExt: textMetric(r.runs),
          checks: r.results,
        })),
        passed: failed.length === 0,
      },
      null,
      2
    )
  )
  process.exit(failed.length === 0 ? 0 : 1)
}

if (tuned.length > 0) {
  console.log(
    `tuning: ${tuned.map(k => `${k}=${TUNING[k]} (was ${TUNING_DEFAULTS[k]})`).join(', ')}`
  )
}
console.log(
  `${themeIds.length} theme(s) · ${seconds}s · ${runs} seed(s) each` +
    (seedStart ? ` · starting at seed ${seedStart}` : '') +
    '\n'
)

for (const report of reports) {
  const name = THEME_BY_ID[report.themeId].name
  const themeFailed = report.results.filter(c => !c.pass).length
  console.log(`── ${name} ${themeFailed === 0 ? '✓' : `✗ ${themeFailed} failing`} ────────────`)

  // The primary metric, above the checks, because it is the one that moves while
  // they are all still red. `≥` means censored: nothing died, so this is a floor.
  const tExt = textMetric(report.runs)
  const perRun = tExt.perRun
    .map(p => `${p.censored ? '≥' : ''}${p.second.toFixed(0)}s${p.species ? ` ${p.species}` : ''}`)
    .join('  ')
  console.log(
    `  T_ext ${`${tExt.censored ? '≥' : ''}${tExt.median.toFixed(0)}s`.padStart(9)}   median time to first animal extinction · ${perRun}`
  )

  for (const c of report.results) {
    // Three states, not two. `~` is a check that declined to answer for want of a
    // sample — see `EvalResult.abstained`. Reading it as a pass is how a run
    // reports that mating works off two observed attempts.
    const mark = c.abstained ? '~' : c.pass ? '✓' : '✗'
    const value = c.value < 1 && c.value > 0 ? `${(c.value * 100).toFixed(0)}%` : c.value.toFixed(2)
    console.log(
      `  ${mark} ${c.id.padEnd(26)} ${(c.abstained ? '—' : value).padStart(7)}   ${c.bar}`
    )
    if (!c.pass) console.log(`      → ${c.points_at}`)
    // Under --diagnose the breakdown prints even on a pass: a check clearing its
    // floor is not the same as the number behind it holding still, and the floors
    // here are set where behaviour is unambiguously wrong rather than where the
    // ideal sits. Watching a passing number drift is how the next floor gets set.
    if (c.detail && (!c.pass || c.abstained || diagnose)) console.log(`      ${c.detail}`)
  }

  if (diagnose) {
    console.log('\n  breeding probe (animals only)')
    console.log(
      `  ${'species'.padEnd(16)} ${'ready'.padStart(6)} ${'mating|ready'.padStart(12)} ${'stints'.padStart(7)} ${'births'.padStart(7)}   ${'died of'.padEnd(22)} top blockers`
    )
    const probe = meanProbe(report.runs.map(r => r.probe))
    const births: Record<string, number> = {}
    // How a species died is the one number that separates "the plants ran out"
    // from "something ate them all", and those have opposite fixes. `RunMetrics`
    // has carried it all along and nothing printed it.
    const deaths: Record<string, Record<string, number>> = {}
    for (const r of report.runs) {
      for (const [id, n] of Object.entries(r.births)) births[id] = (births[id] ?? 0) + n
      for (const [id, causes] of Object.entries(r.deaths)) {
        deaths[id] ??= {}
        for (const [cause, n] of Object.entries(causes)) {
          deaths[id][cause] = (deaths[id][cause] ?? 0) + n
        }
      }
    }
    for (const [id, s] of Object.entries(probe).sort((a, b) => b[1].samples - a[1].samples)) {
      // Per species, not just the aggregate: "the gate is shut" is a different
      // bug depending on which clause is shutting it, and different species are
      // stopped by different clauses. `underfed` dominating one row and
      // `too-young` another is the whole diagnosis.
      const blockers = Object.entries(s.blockedBy)
        .filter(([, n]) => n > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([b, n]) => `${b}:${((n / Math.max(1, s.samples)) * 100).toFixed(0)}%`)
        .join(' ')
      const died = Object.entries(deaths[id] ?? {}).sort((a, b) => b[1] - a[1])
      const diedTotal = died.reduce((n, [, c]) => n + c, 0)
      const diedOf = died
        .slice(0, 2)
        .map(([cause, n]) => `${cause}:${((n / Math.max(1, diedTotal)) * 100).toFixed(0)}%`)
        .join(' ')
      console.log(
        `  ${id.padEnd(16)} ${(s.readyShare * 100).toFixed(0).padStart(5)}% ${(s.matingWhileReady * 100).toFixed(0).padStart(11)}% ${String(s.mateStints).padStart(7)} ${String(births[id] ?? 0).padStart(7)}   ${`${diedOf} (${diedTotal})`.padEnd(22)} ${blockers}`
      )
    }
    console.log(
      `\n  gate blocked by: ${report.results.find(r => r.id === 'breeding-gate-opens')?.detail ?? ''}`
    )
  }
  console.log()
}

if (failed.length === 0) {
  console.log('✓ all checks passed')
  process.exit(0)
}

console.log(
  `✗ ${failed.length} check(s) failing: ${[...new Set(failed.map(f => f.id))].join(', ')}`
)
process.exit(1)
