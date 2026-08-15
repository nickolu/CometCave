/**
 * Does the dungeon master actually talk less?
 *
 * The GM-moves epic (#3517) claims turns are too long and too expository. That
 * is a claim about length, and "it feels shorter" is not a measurement — prose
 * quality is hard to judge from inside a change you just made, and the failure
 * mode of a brevity instruction is a model that writes the same paragraph with
 * a shorter first sentence. So this plays a real campaign against the real API
 * and prints the distribution.
 *
 * It drives the actual route handler rather than reimplementing the turn loop.
 * A harness with its own copy of the loop measures the harness: it would not
 * see a prompt change, a tool schema change, or a pass that quietly stopped
 * terminating. Importing `POST` means whatever the player would get is what
 * gets counted.
 *
 * Nothing here touches Firestore. The campaign is threaded through in memory by
 * `applyTurn`, exactly as the browser store does it, and thrown away at the end.
 *
 * Usage:
 *   npm run voice:dicebound                  # 20 turns, the full run
 *   npm run voice:dicebound -- --turns 4     # a quick smoke check
 *
 * The npm script reads `.env.local` with `--env-file-if-exists` rather than the
 * `--env-file` the other scripts here use. The difference only shows up on a
 * checkout that has no `.env.local` and exports `ANTHROPIC_API_KEY` in the
 * environment instead: `--env-file` aborts on the missing file before this
 * script runs at all, and the person running it gets a node error about a
 * dotfile rather than the run they asked for.
 *
 * It also prints a SKILL CREDIT section, which is about progression rather than
 * voice. It lives here because this is the only thing in the repo that plays a
 * real campaign end to end, and skill advancement is the one system whose
 * behaviour cannot be seen from a single turn: ranks 2 and 3 are eight and
 * eighteen uses of the *same* skill, so whether they are reachable depends
 * entirely on how much the DM concentrates its calls — a thing no unit test can
 * observe.
 *
 * Run it BEFORE and AFTER a voice change and paste both tables. Note that the
 * model is not deterministic and there is no seed to fix: a few words of
 * movement between runs is noise, and only a shift across the whole
 * distribution is evidence.
 */
import { POST as characterRoute } from '@/app/api/v1/dicebound/character/route'
import { POST as turnRoute } from '@/app/api/v1/dicebound/turn/route'
import { SKILLS, type SkillId } from '@/app/dicebound/domain/attributes'
import {
  type Campaign,
  type CheckEntry,
  type NarrationEntry,
  type TranscriptEntry,
  newCampaign,
  validateCharacter,
} from '@/app/dicebound/domain/campaign'
import {
  type Character,
  type SkillRecord,
  earnedRanks,
  openWindows,
} from '@/app/dicebound/domain/character'
import { type Kit, type Power, levelFor } from '@/app/dicebound/domain/kit'
import { type TurnResult, applyTurn } from '@/app/dicebound/domain/turn'

import type { NextRequest } from 'next/server'

/**
 * Fixed, so two runs differ by the prompt and the model's mood rather than by
 * the story. A concept with a negative innate rank in it also keeps the sheet
 * honest — see the Size −2 regression in the design notes.
 */
const CONCEPT = 'a very small mouse knight with a sewing-needle sword, brave past all sense'
const PREMISE = 'the cellar under a bakery, which the mouse knights call the Deeplands'

/**
 * Deliberately story-agnostic. The DM invents the world, so an action list that
 * named places or characters would fall apart on the second run. These are the
 * things a player can always do: look, ask, move, try, wait, push.
 *
 * The mix matters as much as the count. Roughly half of these should not need a
 * roll at all, because "share of turns with a check" is the other number this
 * script exists to watch — a DM that answers every line with dice is a
 * different problem from a DM that writes too much, and a brevity change that
 * fixes one by worsening the other should be visible here.
 */
const ACTIONS: readonly string[] = [
  'I look around and take in where I am.',
  'I call out to see if anyone answers.',
  'I move toward whatever is making the most noise.',
  'I search the nearest container or hiding place.',
  'I ask the nearest person what is going on here.',
  'I wait, and listen, and let the moment pass.',
  'I try to climb up somewhere higher to get a better view.',
  'I draw my sword and stand ready.',
  'I try to talk my way past whoever is in front of me.',
  'I go back the way I came.',
  'I look closely at the thing that seems most out of place.',
  'I try to move quietly and stay out of sight.',
  'I offer to help with whatever is wrong.',
  'I push on the nearest door or barrier as hard as I can.',
  'I ask about the thing nobody has explained yet.',
  'I sit down and rest for a moment.',
  'I follow whoever left most recently.',
  'I try something reckless rather than wait any longer.',
  'I take stock of what I am carrying.',
  'I head for the way out.',
]

function arg(name: string, fallback: number): number {
  const index = process.argv.indexOf(`--${name}`)
  if (index === -1) return fallback
  const value = Number(process.argv[index + 1])
  return Number.isFinite(value) && value > 0 ? value : fallback
}

/**
 * The route handlers only ever call `request.json()`, so a plain `Request` is
 * enough. This is a cast rather than a real `NextRequest` because constructing
 * one outside the Next runtime pulls in machinery none of this needs.
 */
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

  // `source: 'offline'` means the model call failed and the route fell back to a
  // playable default. That is correct behaviour for a player and useless for a
  // measurement, so say so loudly rather than quietly reporting a run that was
  // never really about the prompt.
  if (data.source !== 'model') {
    console.warn(`WARNING: character came from the '${data.source}' path, not the model.`)
  }
  return character
}

async function playTurn(campaign: Campaign, action: string): Promise<TurnResult> {
  const response = await turnRoute(post({ campaign, action }))
  const data = (await response.json()) as { result?: TurnResult; error?: string }
  if (!data.result) throw new Error(data.error ?? 'turn route returned no result')
  return data.result
}

/** Words as a reader counts them, not as a tokenizer does. */
function words(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

/** The checks a turn rolled, in order. */
function checksIn(entries: TranscriptEntry[]): CheckEntry[] {
  return entries.filter((e): e is CheckEntry => e.kind === 'check')
}

/** Total words of narration in a turn, across however many entries it produced. */
function narrationWords(entries: TranscriptEntry[]): number {
  return entries
    .filter((e): e is NarrationEntry => e.kind === 'narration')
    .reduce((sum, e) => sum + words(e.text), 0)
}

/**
 * Nearest-rank percentile. No interpolation: with twenty samples an interpolated
 * p90 invents a number that no turn actually was, and the point of this table is
 * to describe turns that happened.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const rank = Math.ceil((p / 100) * sorted.length)
  return sorted[Math.min(sorted.length, Math.max(1, rank)) - 1]
}

function row(label: string, value: string): string {
  return `  ${label.padEnd(26)}${value.padStart(8)}`
}

/**
 * What one turn did to the progression curve.
 *
 * Recorded per turn rather than summed at the end, because the interesting
 * question is not "where did they get to" but "how fast" — a table of totals
 * cannot tell you whether level 4 arrived on turn six or turn nineteen.
 */
interface Beat {
  turn: number
  ranks: number
  level: number
  /** Powers granted this turn, with the tier they actually got. */
  granted: { id: string; tier: number; emerged: boolean }[]
  /** Charges spent this turn, across every power. */
  spent: number
  /** Charges that came back this turn. */
  restored: number
}

/**
 * Charges spent and restored between two states of the kit.
 *
 * Counted as a delta rather than as `max - now`, because a rest refills and a
 * running total taken at the end would report only whatever happened to be
 * spent when the music stopped. A power granted this turn contributes nothing
 * to either number: it arrives full, and arriving is not restoring.
 */
function chargeDelta(before: Kit, after: Kit): { spent: number; restored: number } {
  const was = new Map(before.powers.map(power => [power.id, power.charges.now]))
  let spent = 0
  let restored = 0

  for (const power of after.powers) {
    const previous = was.get(power.id)
    if (previous === undefined) continue
    if (power.charges.now < previous) spent += previous - power.charges.now
    if (power.charges.now > previous) restored += power.charges.now - previous
  }

  return { spent, restored }
}

function newPowers(before: Kit, after: Kit): Power[] {
  const had = new Set(before.powers.map(power => power.id))
  return after.powers.filter(power => !had.has(power.id))
}

/** The first turn at which a level was reached, or null if it never was. */
function turnsTo(beats: Beat[], level: number): number | null {
  return beats.find(beat => beat.level >= level)?.turn ?? null
}

async function main(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set. Run via `npm run voice:dicebound`.')
    process.exit(1)
  }

  const turns = Math.min(arg('turns', 20), ACTIONS.length)
  const now = Date.now()

  console.log(`Dicebound voice check — ${turns} turns against the live API.`)
  console.log(`Concept: "${CONCEPT}"\n`)

  const character = await makeCharacter()
  let campaign = newCampaign(PREMISE, character, now, null)

  // The opening turn takes no action and produces the title. It is measured
  // separately below: it is allowed to be longer than a normal turn, and
  // folding it into the distribution would flatter every table by one long
  // sample that no brevity change is trying to shorten.
  const opening = await playTurn(campaign, '')
  campaign = applyTurn(campaign, opening, now)
  const openingWords = narrationWords(opening.entries)
  console.log(`  opening: "${campaign.title}" (${openingWords} words)\n`)

  const lengths: number[] = []
  const beats: Beat[] = []
  let withCheck = 0
  let failed = 0

  // Skill credit, counted from the checks themselves rather than inferred from
  // the sheet at the end.
  //
  // A skill only advances when a check names one that actually sits beneath the
  // attribute being tested: `rollFor` runs the DM's choice through
  // `applicableSkill`, and a mismatch is dropped to null. The check still
  // happens and the prose still reads correctly, so a DM that habitually pairs
  // the wrong two is invisible from the outside — every skill simply crawls,
  // and a player reasonably concludes that +1 is the ceiling.
  //
  // What lands in the entry is `skill: null`, which is also what an ordinary
  // attribute-only check looks like. This counter therefore measures the two
  // together: the share of rolls that taught the character nothing. It cannot
  // separate "the DM named no skill" from "the DM named one and it was thrown
  // away" — that distinction only exists inside the route — but a high number
  // here is the signal that the split is worth instrumenting there.
  let credited = 0
  let uncredited = 0
  const creditCheck = (entries: TranscriptEntry[]) => {
    for (const check of checksIn(entries)) {
      if (check.skill) credited++
      else uncredited++
    }
  }
  creditCheck(opening.entries)

  for (let i = 0; i < turns; i++) {
    const action = ACTIONS[i]

    // A turn that fails is recorded and stepped over rather than thrown.
    // Letting one failure end the process throws away every turn measured
    // before it, which is how a twenty-minute run produces a stack trace and no
    // table — and the failure this actually caught was worth measuring: the
    // route aborts a turn at 105 seconds, and turns get slower as the
    // transcript grows, so a long campaign starts losing them.
    let result: TurnResult
    try {
      result = await playTurn(campaign, action)
    } catch (error) {
      failed++
      console.log(
        `  turn ${String(i + 1).padStart(2)}: FAILED — ${error instanceof Error ? error.message : String(error)}`
      )
      continue
    }

    // Read before applyTurn: the windows that were open when the DM decided
    // what this turn was about are the ones that could have produced a power,
    // and applyTurn is what credits the skill that might open a new one.
    const windowsOpen = openWindows(campaign.character, campaign.world.clock.elapsed).length > 0
    const kitBefore = campaign.kit

    campaign = applyTurn(campaign, result, now + i + 1)

    const narration = narrationWords(result.entries)
    const checks = checksIn(result.entries).length
    creditCheck(result.entries)

    const ranks = earnedRanks(campaign.character)
    const { spent, restored } = chargeDelta(kitBefore, campaign.kit)
    beats.push({
      turn: i + 1,
      ranks,
      level: levelFor(ranks),
      // `emerged` is a proxy, not a fact the route reports: it says a window
      // was open when this power arrived, which is the only signal the two
      // paths leave behind. A grant that would have happened anyway on a turn
      // that also had a window open counts as emerged here.
      granted: newPowers(kitBefore, campaign.kit).map(power => ({
        id: power.id,
        tier: power.tier,
        emerged: windowsOpen,
      })),
      spent,
      restored,
    })

    lengths.push(narration)
    if (checks > 0) withCheck++
    console.log(
      `  turn ${String(i + 1).padStart(2)}: ${String(narration).padStart(4)} words, ${checks} check(s), ` +
        `${ranks} rank${ranks === 1 ? '' : 's'}, level ${levelFor(ranks)}`
    )
  }

  const sorted = [...lengths].sort((a, b) => a - b)
  const total = sorted.reduce((sum, n) => sum + n, 0)

  console.log(`\nNARRATION LENGTH (words per turn, n=${lengths.length})`)
  console.log(row('min', String(sorted[0] ?? 0)))
  console.log(row('median', String(percentile(sorted, 50))))
  console.log(row('p90', String(percentile(sorted, 90))))
  console.log(row('max', String(sorted[sorted.length - 1] ?? 0)))
  console.log(row('mean', lengths.length ? (total / lengths.length).toFixed(1) : '0'))

  console.log(`\nTURN SHAPE`)
  console.log(row('turns with a check', `${withCheck}/${lengths.length}`))
  console.log(
    row(
      'share with a check',
      lengths.length ? `${Math.round((withCheck / lengths.length) * 100)}%` : '0%'
    )
  )
  console.log(row('opening (not counted)', String(openingWords)))
  // Printed always, including as 0. A reader comparing two tables needs to know
  // whether the second one is shorter or simply missing its slowest turns.
  console.log(row('turns that failed', `${failed}/${turns}`))
  console.log(row('total checks rolled', String(campaign.stats.checks)))

  const rolled = credited + uncredited
  console.log(`\nSKILL CREDIT`)
  console.log(row('checks crediting a skill', `${credited}/${rolled}`))
  console.log(
    row('checks crediting none', rolled ? `${Math.round((uncredited / rolled) * 100)}%` : '0%')
  )

  // --------------------------------------------------------- progression
  //
  // This is the table #3566 exists for. TIER_LEVELS is described in the code as
  // "a starting guess, expected to move", and it is the number that decides how
  // long a campaign takes to feel powerful — the most consequential unmeasured
  // constant in the game. Read the failure row above before any of this: a run
  // that lost turns has lost ranks with them, and a damaged curve looks exactly
  // like a slow one.
  const last = beats[beats.length - 1]
  const ranks = last?.ranks ?? 0

  console.log(`\nPROGRESSION`)
  console.log(row('ranks earned in play', String(ranks)))
  console.log(row('level reached', String(last?.level ?? 1)))
  for (const level of [2, 4, 7]) {
    const at = turnsTo(beats, level)
    console.log(
      row(`turns to level ${level}`, at === null ? `NOT REACHED in ${beats.length}` : String(at))
    )
  }

  // The specific question the issue asks: is level 7 — eighteen ranks earned in
  // play — reachable in a campaign anyone actually finishes? Twenty turns will
  // not get there, so the honest answer is an extrapolation, and it is labelled
  // as one. It assumes the rate holds, which it does not: ranks 2 and 3 cost 5
  // and 10 further uses of the *same* skill, so the real curve is slower than
  // this line. Treat it as a floor on the answer, not an estimate.
  const perTurn = beats.length ? ranks / beats.length : 0
  console.log(
    row(
      'ranks per turn',
      beats.length ? `${perTurn.toFixed(2)} (${ranks} over ${beats.length})` : 'n/a'
    )
  )
  console.log(
    row(
      'turns to lvl 7 (linear)',
      perTurn > 0 ? `~${Math.ceil(18 / perTurn)} (a floor — the curve slows)` : 'never at this rate'
    )
  )

  // --------------------------------------------------------------- powers
  const grants = beats.flatMap(beat => beat.granted.map(power => ({ ...power, turn: beat.turn })))
  const spent = beats.reduce((sum, beat) => sum + beat.spent, 0)
  const restored = beats.reduce((sum, beat) => sum + beat.restored, 0)
  // A rest that restored nothing is invisible here, and that is the right
  // behaviour rather than a gap: a rest with nothing to give back has no effect
  // on the curve this table is about.
  const rests = beats.filter(beat => beat.restored > 0).length

  console.log(`\nPOWERS`)
  console.log(row('granted', String(grants.length)))
  for (const power of grants) {
    console.log(
      row(
        `  turn ${power.turn}`,
        `${power.id} tier ${power.tier}, ${power.emerged ? 'window open' : 'granted outright'}`
      )
    )
  }
  console.log(row('charges spent', String(spent)))
  console.log(row('charges restored', String(restored)))
  console.log(row('turns that restored charges', String(rests)))

  // The sheet at the end of the run, best first. This is the answer to "does
  // anything ever reach +2": rank 2 is eight uses of one skill out of forty, so
  // the question is not whether the thresholds work — the unit tests cover that
  // — but whether a real DM concentrates its calls enough to reach one inside a
  // campaign. A column of skills sitting at one or two uses each says the
  // credit is being spread too thin to ever land, which is a prompt problem
  // rather than an arithmetic one.
  const touched = Object.entries(campaign.character.skills)
    .filter((entry): entry is [string, SkillRecord] => Boolean(entry[1]))
    .sort(([, a], [, b]) => b.uses - a.uses || b.rank - a.rank)

  if (touched.length === 0) {
    console.log(row('skills touched', '0'))
  } else {
    for (const [skill, record] of touched.slice(0, 8)) {
      const seeded = record.seeded ? ' (seeded)' : ''
      const rank = record.rank >= 0 ? `+${record.rank}` : `${record.rank}`
      console.log(row(`  ${SKILLS[skill as SkillId].name}${seeded}`, `${record.uses}u ${rank}`))
    }
    if (touched.length > 8) console.log(row('  …and more', String(touched.length - 8)))
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
