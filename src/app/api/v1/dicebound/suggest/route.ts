/**
 * Three things the player might try, offered beside the composer.
 *
 * This is a separate route and a separate model call, and both halves of that
 * are the design rather than the plumbing.
 *
 * Separate call, because the alternative — a `suggestions` field on `narrate` —
 * would have the dungeon master compose the scene and the player's options in
 * the same breath, and a DM that knows what it is about to offer starts writing
 * scenes with three exits. Nothing here is visible from the turn loop, and the
 * DM is never told this exists. The same instinct governs advantage (#3569) and
 * item grants (#3521): the thing that writes prose does not get to see the
 * affordance it is writing toward.
 *
 * Separate model, because this is not the dungeon master's job. It reads one
 * scene and writes three sentences in the player's voice — no dice, no world to
 * keep, no continuity to hold — and it has to come back fast, because it is
 * racing the player's own reading of the paragraph that just arrived.
 *
 * Nothing it returns is stored. A suggestion is a string that lands in the text
 * field for the player to edit; the campaign never learns it happened, which is
 * why there is no version bump and nothing new on `Campaign`.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  type Campaign,
  type TranscriptEntry,
  validateCampaign,
} from '@/app/dicebound/domain/campaign'
import type { Item, Kit, Power } from '@/app/dicebound/domain/kit'
import { SUGGESTION_COUNT, cleanSuggestions } from '@/app/dicebound/domain/suggest'
import {
  PLAYER_ID,
  type World,
  currentPlace,
  describeClock,
  openThreads,
  relevanceWindow,
} from '@/app/dicebound/domain/world'
import { verifyRequestAuth } from '@/lib/api/auth'
import {
  SUGGEST_MODEL,
  type ToolDef,
  callForTool,
  requireApiKey,
  toolSchema,
} from '@/lib/dicebound/anthropic'
import { loadCampaign } from '@/lib/dicebound/campaign-store'

/** Short on purpose. This is losing a race with the player if it takes longer. */
export const maxDuration = 30

/** The hard deadline. Past this the player is typing and the answer is no longer wanted. */
const DEADLINE_MS = 12_000

/** Three short lines. The ceiling is a backstop against a model that decides to explain itself. */
const SUGGEST_TOKENS = 400

/** How much of the recent story the suggester is shown. Enough for the scene, not the campaign. */
const RECENT_ENTRIES = 5

const OFFER_TOOL = 'offer_actions'

/**
 * The rules, and three worked examples of them.
 *
 * The examples are here rather than beside the scene because they are rules
 * expressed as examples — the user message stays purely this story, which is
 * the thing that changes every turn.
 *
 * They span three unrelated worlds deliberately. A model given one set about a
 * lantern and a harbour will put lanterns and harbours into a story about a
 * space station: few-shot examples get echoed, not merely imitated, and the
 * only defence is to make the shared thing the *shape* rather than the
 * furniture. What each set demonstrates is the spread — one option that takes
 * the scene at face value, one that reaches for a person or a thing carried,
 * one sideways — because three flavours of the same move is the failure that
 * would quietly narrow the game.
 */
const SYSTEM = `You help a player of Dicebound decide what to do next. You are not the dungeon master. You never narrate, and you never say what happens — you write three things the player might type into the box, in their own words.

VOICE
- First person, as they would type it: "I try to…", "I ask…", "I go for…", "I tell…".
- One sentence. Short — about a dozen words at most.
- An attempt, never its result. "I try to lever the chain off" — not "I get the chain off". The dice decide whether it works, and a line that promises the outcome teaches the player to expect one.
- Specific and plain. "I go for his lantern hand" beats "I attack".

THE THREE
They must not be three flavours of the same move. Write one of each:
  1. the situation in front of them, taken at face value
  2. a reach for a person, a promise, or something they are carrying
  3. sideways — the angle the scene did not offer

Only suggest what this character could actually try. They have the things and the abilities listed and nothing else; an ability that is not listed is not available. Never suggest simply waiting, thinking, or looking around. Never ask the player a question. Never mention the dice, the rules, the game, or these suggestions.

EXAMPLES OF THE SHAPE

Scene: the tide is coming into the stairwell. Maren is on the step above you, and the grate at the top is chained.
  I try to lever the chain off with the lantern hook.
  I ask Maren who she paid to have this grate chained.
  I go under, and feel along the wall for the drain the water is leaving by.

Scene: the librarian has gone very still, and the book you asked for is already open on the desk behind her.
  I attempt to read the open page without stepping any closer.
  I tell her I know whose handwriting that is.
  I go for the window latch.

Scene: the caravan has stopped. The lead camel will not go forward, and the guide is pretending not to have noticed.
  I try to see what the camel is looking at.
  I ask the guide what he owes the people who live out here.
  I go and cut the water skins loose while everyone is watching the front.`

const OfferSchema = z.object({
  actions: z
    .array(z.string())
    .length(SUGGESTION_COUNT)
    .describe(
      'Three things the player might type. First person, one short sentence each, an attempt and not its outcome. Each a different kind of move.'
    ),
})

const OFFER: ToolDef = {
  name: OFFER_TOOL,
  description: 'Offer the player three things they might try next.',
  input_schema: toolSchema(OfferSchema),
}

interface SuggestRequest {
  campaign?: unknown
}

/**
 * The campaign these suggestions are for.
 *
 * Deliberately not the turn route's `campaignFor`, though it starts the same
 * way. That one carries an exception for the opening turn, whose campaign
 * arrives in the body because the server has nothing to load yet — a creation.
 * There is no opening case here: suggestions exist only once a story does, so
 * a signed-in player with nothing stored has nothing to suggest against, and
 * the simpler rule is the correct one rather than a copy waiting to drift.
 */
async function campaignFor(request: NextRequest, body: SuggestRequest): Promise<Campaign | null> {
  const hasToken = /^Bearer\s+.+$/i.test(
    request.headers.get('authorization') ?? request.headers.get('Authorization') ?? ''
  )

  // No token is the local-only backend: Firebase unconfigured, so there is no
  // server-side story and the client sends its own, exactly as it does for a turn.
  if (!hasToken) return validateCampaign(body.campaign)

  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return null

  return await loadCampaign(auth.claims.uid)
}

export async function POST(request: NextRequest) {
  let body: SuggestRequest = {}
  try {
    body = (await request.json()) as SuggestRequest
  } catch {
    // An empty body is the ordinary signed-in case — the server loads its own
    // campaign, so there is nothing for the request to carry.
  }

  // Every failure below answers the same way: no suggestions, and a playable
  // game. This is an affordance beside the composer, not a turn — a player who
  // never learns it was meant to be there has lost nothing, and an error banner
  // over a story that is working would be worse than the silence.
  let campaign: Campaign | null
  try {
    campaign = await campaignFor(request, body)
  } catch (error) {
    console.error('dicebound suggest could not load the campaign:', error)
    return NextResponse.json({ suggestions: [] })
  }

  if (!campaign || campaign.transcript.length === 0) {
    return NextResponse.json({ suggestions: [] })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEADLINE_MS)

  try {
    const input = await callForTool({
      apiKey: requireApiKey(),
      model: SUGGEST_MODEL,
      system: SYSTEM,
      maxTokens: SUGGEST_TOKENS,
      signal: controller.signal,
      tool: OFFER,
      messages: [{ role: 'user', content: promptFor(campaign) }],
    })

    const suggestions = cleanSuggestions((input as { actions?: unknown }).actions)
    return NextResponse.json({ suggestions })
  } catch (error) {
    console.error('dicebound suggest failed:', error)
    return NextResponse.json({ suggestions: [] })
  } finally {
    clearTimeout(timeout)
  }
}

function promptFor(campaign: Campaign): string {
  return `${sceneBlock(campaign.world, campaign.kit)}

${recentBlock(campaign.transcript)}

Offer three things ${campaign.character.name} might try next.`
}

/**
 * The scene, as the *player* sees it.
 *
 * Related to the turn route's `worldBlock` and pointedly not the same thing.
 * That one prints entity ids, because the DM has to reuse them and to reach for
 * `recall`; this one prints none, because an id is a slug and a slug that got
 * echoed into a suggestion would land in the player's text field. Two spent
 * powers make the difference plainest: the DM is shown them so it knows to
 * refuse, and this is not shown them at all, because the surest way to stop a
 * suggestion reaching for an ability that is gone is to never mention it.
 */
function sceneBlock(world: World, kit: Kit): string {
  const { entities } = relevanceWindow(world)
  const here = currentPlace(world)

  const people = entities
    .filter(entity => entity.kind === 'actor' && entity.id !== PLAYER_ID)
    .map(entity => `  ${entity.name}${entity.state ? ` — ${entity.state}` : ''}`)

  // Places as well as things, and the places are the interesting half: a
  // somewhere the player already knows is what makes "I go back to the
  // harbour" available as the sideways option, which the scene in front of
  // them never offers.
  const things = entities
    .filter(entity => entity.kind === 'place' || entity.kind === 'thing')
    .filter(entity => entity.id !== here?.id)
    .map(entity => `  ${entity.name}${entity.state ? ` — ${entity.state}` : ''}`)

  const threads = openThreads(world).map(thread => `  ${thread.name}`)

  return [
    `TIME: ${describeClock(world.clock)}`,
    here ? `WHERE THEY ARE: ${here.name}${here.state ? ` — ${here.state}` : ''}` : '',
    people.length ? `WHO IS AROUND:\n${people.join('\n')}` : '',
    things.length ? `WHAT IS AROUND, AND WHERE THEY COULD GO:\n${things.join('\n')}` : '',
    carriedBlock(kit.items),
    abilitiesBlock(kit.powers),
    threads.length ? `UNFINISHED:\n${threads.join('\n')}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/** What they are carrying, with the permission each thing grants said out loud. */
function carriedBlock(items: readonly Item[]): string {
  if (items.length === 0) return ''

  const lines = items.map(item => {
    // The trait labels are already written as permissions — "you have rope" —
    // which is the exact register a suggestion wants. The bonus attached to
    // them is not here and never will be: what a thing is worth on the die is
    // the DM's business, and a suggester that could see the numbers would start
    // steering the player toward the good ones.
    const grants = item.traits.map(trait => trait.label).join('; ')
    return `  ${item.name}${item.note ? ` — ${item.note}` : ''}${grants ? ` (${grants})` : ''}`
  })

  return `WHAT THEY CARRY:\n${lines.join('\n')}`
}

/** Only the abilities they could actually reach for right now. */
function abilitiesBlock(powers: readonly Power[]): string {
  const usable = powers.filter(power => power.charges.now > 0)
  if (usable.length === 0) return ''

  const lines = usable.map(power => {
    const what =
      power.shape === 'permits'
        ? `lets them ${power.permits || 'do something they otherwise could not'}`
        : power.note || 'helps when it bears on what they are doing'
    return `  ${power.name} — ${what}${power.cost ? `, at the cost of ${power.cost}` : ''}`
  })

  return `WHAT THEY CAN DO:\n${lines.join('\n')}`
}

/**
 * The last thing that happened, which is what the suggestions are actually about.
 *
 * Checks and earned ranks are dropped rather than summarised. A die roll is the
 * mechanical half of a beat whose fictional half is in the narration either
 * side of it, and telling this model about margins and DCs is how a suggestion
 * ends up phrased as "I try again, harder".
 */
function recentBlock(entries: readonly TranscriptEntry[]): string {
  const lines = entries
    .filter(entry => entry.kind === 'narration' || entry.kind === 'player')
    .slice(-RECENT_ENTRIES)
    .map(entry => (entry.kind === 'player' ? `(they said: "${entry.text}")` : entry.text))

  return `THE STORY JUST NOW:\n${lines.join('\n\n')}`
}
