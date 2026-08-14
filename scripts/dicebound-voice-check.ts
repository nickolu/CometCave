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
 * Run it BEFORE and AFTER a voice change and paste both tables. Note that the
 * model is not deterministic and there is no seed to fix: a few words of
 * movement between runs is noise, and only a shift across the whole
 * distribution is evidence.
 */
import { POST as characterRoute } from '@/app/api/v1/dicebound/character/route'
import { POST as turnRoute } from '@/app/api/v1/dicebound/turn/route'
import {
  type Campaign,
  type NarrationEntry,
  type TranscriptEntry,
  newCampaign,
  validateCharacter,
} from '@/app/dicebound/domain/campaign'
import type { Character } from '@/app/dicebound/domain/character'
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
  let withCheck = 0
  let failed = 0

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

    campaign = applyTurn(campaign, result, now + i + 1)

    const narration = narrationWords(result.entries)
    const checks = result.entries.filter(e => e.kind === 'check').length

    lengths.push(narration)
    if (checks > 0) withCheck++
    console.log(
      `  turn ${String(i + 1).padStart(2)}: ${String(narration).padStart(4)} words, ${checks} check(s)`
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
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
