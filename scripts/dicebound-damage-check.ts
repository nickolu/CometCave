/**
 * What actually kills people, and how fast.
 *
 * Every number in the phase 3 damage epic is a guess. `DAMAGE_TABLE`'s rows,
 * the severity → steps mapping, the three danger settings, how often a dungeon
 * master reaches for a severity at all — all of them were written by reasoning
 * about what feels right, and none of them had been played. This is the thing
 * that plays them.
 *
 * It is a sibling of `dicebound-voice-check.ts` rather than more rows in that
 * table, for two reasons. The scenario has to be different: voice is measured
 * against a mouse in a bakery cellar, deliberately safe, and lethality measured
 * there would report that nothing ever happens. And the question is different —
 * that script asks whether the DM talks too much, this one asks whether the
 * game can hurt you, and a single table answering both would be read for
 * whichever half the reader came for.
 *
 * Like its sibling it drives the real `POST` handler. A harness with its own
 * copy of the turn loop measures the harness: it would not see a prompt change,
 * a tool schema change, or a pass that quietly stopped terminating.
 *
 *   npm run damage:dicebound                 # 16 turns
 *   npm run damage:dicebound -- --turns 4    # a smoke check
 *   npm run damage:dicebound -- --runs 3     # three campaigns, pooled
 *
 * READ THE FAILURE ROW FIRST. It prints at zero as well as above it, and it
 * exists because a damaged measurement looks exactly like a result: a run once
 * reported a check rate of 17%, in the expected direction, from a change that
 * had just targeted it — and nearly got that change softened. It had lost 8 of
 * its 20 turns to `anthropic 529` overloads, and the survivors were not a
 * representative sample. The rerun read 50%.
 */
import { POST as characterRoute } from '@/app/api/v1/dicebound/character/route'
import { POST as turnRoute } from '@/app/api/v1/dicebound/turn/route'
import {
  CONDITION_ORDER,
  type Condition,
  DANGER_ORDER,
  type Danger,
  SEVERITY_ORDER,
  conditionIndex,
  damageFor,
  damageRow,
  worsen,
} from '@/app/dicebound/domain/body'
import { newCampaign, validateCharacter } from '@/app/dicebound/domain/campaign'
import type { Campaign } from '@/app/dicebound/domain/campaign'
import type { Character } from '@/app/dicebound/domain/character'
import { applyTurn } from '@/app/dicebound/domain/turn'
import type { TurnResult } from '@/app/dicebound/domain/turn'
import { type DamageEvent, recordDamage } from '@/lib/dicebound/telemetry'

import type { NextRequest } from 'next/server'

/**
 * Dangerous, but not a fight from the first line.
 *
 * The scenario has to be able to hurt the player without insisting on it, or
 * the check-rate and severity-rate numbers measure the premise rather than the
 * prompt. A collapsing mine gives the DM every excuse to reach for a severity
 * and no obligation to — which is exactly the judgement being measured.
 */
const CONCEPT = 'a stubborn tunnel-rat who has come back out of worse than this'
const PREMISE = 'the deep gallery of a silver mine, an hour after the roof started coming down'

/**
 * Story-agnostic, like the voice check's list, and for the same reason: the DM
 * invents the world, so an action naming a place or a person falls apart on the
 * second run.
 *
 * The mix is the point. Roughly half of these are things nobody would roll for,
 * because "share of checks that carried a severity" is meaningless if every
 * action was a knife fight. A list of reckless actions would report a meat
 * grinder and prove nothing about the table.
 */
const ACTIONS: readonly string[] = [
  'I look around and take stock of where I am.',
  'I listen for anyone else down here.',
  'I move deeper in, carefully.',
  'I try to shift whatever is blocking the way.',
  'I call out, and wait.',
  'I climb toward the sound of moving air.',
  'I rest for a moment and catch my breath.',
  'I go back the way I came.',
  'I squeeze through the narrowest gap I can find.',
  'I help whoever needs it most.',
  'I look closely at the thing that seems most out of place.',
  'I push on regardless of what it costs me.',
  'I ask about the thing nobody has explained yet.',
  'I take the route that looks worse but shorter.',
  'I try something reckless rather than wait any longer.',
  'I head for the way out.',
]

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function post(body: unknown): NextRequest {
  return new Request('http://localhost/', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as NextRequest
}

async function makeCharacter(): Promise<Character> {
  const response = await characterRoute(post({ concept: CONCEPT, premise: PREMISE }))
  const data = (await response.json()) as { character?: unknown; source?: string }
  const character = validateCharacter(data.character)
  if (!character) throw new Error('character route returned something unusable')
  if (data.source !== 'model') {
    console.warn(`WARNING: character came from the '${data.source}' path, not the model.`)
  }
  return character
}

async function playTurn(campaign: Campaign, action: string): Promise<TurnResult> {
  const response = await turnRoute(post({ campaign, action }))
  const data = (await response.json()) as { result?: TurnResult; error?: string }
  if (!data.result) throw new Error(data.error ?? `turn route returned ${response.status}`)
  return data.result
}

/** One turn's worth of what happened, kept so the tables can be folded at the end. */
interface Beat {
  turn: number
  condition: Condition
  events: DamageEvent[]
}

interface Run {
  beats: Beat[]
  failed: number
  died: number | null
}

async function playCampaign(turns: number, label: string): Promise<Run> {
  const now = Date.now()
  let campaign = newCampaign(PREMISE, await makeCharacter(), now, null)
  campaign = applyTurn(campaign, await playTurn(campaign, ''), now)
  console.log(`  ${label}: "${campaign.title}"`)

  const beats: Beat[] = []
  let failed = 0
  let died: number | null = null

  for (let turn = 1; turn <= turns; turn++) {
    const action = ACTIONS[(turn - 1) % ACTIONS.length]
    const events: DamageEvent[] = []
    const stop = recordDamage(event => events.push(event))

    let result: TurnResult
    try {
      result = await playTurn(campaign, action)
    } catch (error) {
      // Counted, never silently skipped. This is the row that decides whether
      // any of the others mean anything.
      failed += 1
      console.log(`    turn ${turn}: FAILED — ${String(error)}`)
      continue
    } finally {
      stop()
    }

    campaign = applyTurn(campaign, result, now)
    beats.push({ turn, condition: campaign.body.condition, events })

    if (campaign.body.condition === 'dead') {
      died = turn
      console.log(`    turn ${turn}: DIED`)
      break
    }
  }

  return { beats, failed, died }
}

/** The first turn at which the body was at this rung or worse, or null. */
function reached(beats: Beat[], condition: Condition): number | null {
  const target = conditionIndex(condition)
  return beats.find(beat => conditionIndex(beat.condition) >= target)?.turn ?? null
}

function pct(part: number, whole: number): string {
  return whole === 0 ? '   —' : `${Math.round((part / whole) * 100)}%`.padStart(4)
}

/**
 * What the same campaign would have cost at each danger setting.
 *
 * A replay rather than three live runs, and this is the one methodological
 * choice in the file worth arguing with.
 *
 * Three live runs would differ by the model's mood as much as by the dial —
 * different scenes, different DCs, different severities — and separating the
 * dial's effect from that noise would take far more runs than anyone is going
 * to pay for. The dial does not touch what the DM decides; it only changes what
 * a decision costs. So replaying the *recorded* (severity, band) sequence
 * through `damageFor` at each setting is the exact counterfactual: the same
 * campaign, three lethalities, no extra API calls.
 *
 * It has one honest limit and the table says so. The replay is only faithful up
 * to the first divergence — once a setting kills the character, the real
 * campaign would have ended there and everything after it is a story that would
 * not have happened. So this reports **the turn each setting would first have
 * killed them**, and stops counting there, rather than pretending to know what
 * turn 14 looks like for someone who died on turn 9.
 */
function replay(beats: Beat[], danger: Danger): { end: Condition; died: number | null } {
  let condition: Condition = 'unhurt'
  let died: number | null = null

  for (const beat of beats) {
    for (const event of beat.events) {
      if (!event.applied || !event.severity) continue
      const band = event.band ?? 'failure'
      const steps = damageFor(event.severity, band, danger)
      condition = worsen(condition, steps, damageRow(event.severity).fatal)
      if (condition === 'dead' && died === null) died = beat.turn
    }
    if (died !== null) break
  }

  return { end: condition, died }
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Run via `npm run damage:dicebound`.')
    process.exit(1)
  }

  const turns = arg('turns', 16)
  const runs = arg('runs', 1)

  console.log(`Dicebound damage check — ${runs} run(s) of ${turns} turns against the live API.`)
  console.log(`Premise: "${PREMISE}"\n`)

  const all: Run[] = []
  for (let index = 0; index < runs; index++) {
    all.push(await playCampaign(turns, `run ${index + 1}`))
  }

  const beats = all.flatMap(run => run.beats)
  const events = beats.flatMap(beat => beat.events)
  const failed = all.reduce((sum, run) => sum + run.failed, 0)
  const attempted = runs * turns

  // First, and on its own, because everything below it is worthless if this is
  // not near zero.
  console.log(`\n${'='.repeat(64)}`)
  console.log(`turns that failed: ${failed} of ${attempted}`)
  if (failed > 0) {
    console.log('  ^ RERUN. A run that lost turns is not a sample — the survivors are not')
    console.log('    representative, and a damaged measurement looks exactly like a result.')
  }
  console.log('='.repeat(64))

  const checks = events.filter(event => event.tool === 'roll_check')
  const dangerous = checks.filter(event => event.severity !== null)
  const harms = events.filter(event => event.tool === 'harm')
  const refused = harms.filter(event => !event.applied)

  console.log('\nHOW OFTEN THE GAME REACHED FOR DAMAGE')
  console.log(`  checks rolled                ${String(checks.length).padStart(4)}`)
  console.log(
    `  ...carrying a severity       ${String(dangerous.length).padStart(4)}  ${pct(dangerous.length, checks.length)} of checks`
  )
  console.log(`  harm calls (applied)         ${String(harms.length - refused.length).padStart(4)}`)
  console.log(`  harm calls (refused, 2nd/turn)${String(refused.length).padStart(3)}`)
  console.log(
    `  harm : dangerous check       ${
      dangerous.length === 0
        ? '   — (nothing was dangerous)'
        : `${(harms.length / dangerous.length).toFixed(2)} : 1`
    }`
  )
  console.log('  The prompt claims most checks are not dangerous. At 60% the world is a meat')
  console.log('  grinder; at 2% the system is decoration. A rising harm ratio is the drift')
  console.log('  that matters — a DM reaching for harm because it is simpler drains a')
  console.log('  character without ever rolling a die, and nothing else would notice.')

  console.log('\nWHICH ROW THE DM PICKED')
  for (const severity of SEVERITY_ORDER) {
    const named = events.filter(event => event.severity === severity)
    console.log(
      `  ${severity.padEnd(10)} ${String(named.length).padStart(4)}  ${pct(named.length, events.filter(e => e.severity).length)}`
    )
  }
  console.log('  If lethal shows up on ordinary climbing checks, the table examples are not')
  console.log('  anchoring it, and that is a prompt fix rather than a mapping fix.')

  console.log('\nHOW FAR DOWN THE TRACK, AND WHEN')
  for (const condition of CONDITION_ORDER.slice(1)) {
    const turn = all.map(run => reached(run.beats, condition)).filter(t => t !== null)
    console.log(
      `  first ${condition.padEnd(9)} turn ${
        turn.length === 0 ? '—  (never reached)' : turn.map(String).join(', ')
      }`
    )
  }
  const survived = all.filter(run => run.died === null).length
  console.log(`  ended alive                  ${survived} of ${all.length}`)

  console.log('\nWHAT THE DANGER DIAL WOULD HAVE CHANGED')
  console.log('  A replay of the recorded severities and bands, not three live runs — the')
  console.log('  dial changes what a decision costs, never what the DM decides, so the same')
  console.log('  campaign at three lethalities is the exact counterfactual and costs nothing.')
  console.log('  Faithful only up to the first death; after that the real story would have')
  console.log('  diverged, so it stops counting there rather than inventing a turn 14 for')
  console.log('  someone who died on turn 9.')
  for (const danger of DANGER_ORDER) {
    const replayed = all.map(run => replay(run.beats, danger))
    const deaths = replayed.filter(r => r.died !== null)
    console.log(
      `  ${danger.padEnd(9)} ends ${replayed
        .map(r => r.end)
        .join(', ')
        .padEnd(28)} deaths ${deaths.length}/${all.length}${
        deaths.length > 0 ? ` (turn ${deaths.map(r => r.died).join(', ')})` : ''
      }`
    )
  }
  console.log('  Three settings that produce the same ending are three settings nobody')
  console.log('  needed. That is a real possible outcome and it is what this row is for.')

  console.log('\nNOT MEASURED HERE')
  console.log('  Statuses. #3774 and #3775 have not landed, so there is nothing to count:')
  console.log('  no applications per turn, no live-at-once, no cap hits, no slug collisions.')
  console.log('  Those rows belong in this file and should be added with that work.')
  console.log('  Whether the condition on the sheet agrees with the condition in the prose')
  console.log('  is not automated either. It is a sampled read of transcripts, and saying so')
  console.log('  is better than a metric that does not mean anything.\n')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
