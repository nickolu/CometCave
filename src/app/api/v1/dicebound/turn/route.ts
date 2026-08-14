/**
 * One turn at the table.
 *
 * The player says what they attempt; this returns what happened. In between,
 * the dungeon master may stop and ask for a die roll — and that is the whole
 * architecture of this file.
 *
 * The model is given two tools. `roll_check` decides *whether* the attempt is
 * uncertain, *which* attribute and skill it leans on, *how hard* it is, and
 * *what* in the scene makes it easier or harder. Then it stops, because it has
 * to: the tool returns the result, and the model has already committed to the
 * difficulty by the time it learns the number. It narrates around a fact it
 * cannot edit.
 *
 * If instead the model rolled its own dice, the difficulty and the outcome
 * would be chosen at the same instant by something that wants the story to go
 * well, and every attempt would quietly succeed. That is not a prompting
 * problem to be solved with a stern instruction; it is why `resolveCheck` lives
 * in code and this route is a loop rather than a single call.
 *
 * `narrate` is the other tool, and it ends the turn. The terminal state is
 * *declared* rather than inferred from an absence of tool calls, which matters
 * for two reasons: the model saying "I am done" is a stronger signal than it
 * happening not to call anything, and sprint 3 needs somewhere to hang the
 * clock and the world deltas that a finished turn also produces.
 *
 * The loop runs at most MAX_CHECKS times, then forces `narrate` — a turn that
 * never stops rolling is a turn that never comes back.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  ATTRIBUTES,
  ATTRIBUTE_IDS,
  type AttributeId,
  SKILLS,
  SKILL_IDS,
  type SkillId,
  applicableSkill,
  isAttributeId,
  skillsOf,
} from '@/app/dicebound/domain/attributes'
import {
  CONDENSE_AT,
  type Campaign,
  type CheckEntry,
  MAX_ACTION,
  TRANSCRIPT_WINDOW,
  type TranscriptEntry,
  validateCampaign,
} from '@/app/dicebound/domain/campaign'
import { attributeRank, earnedSkills, skillRank } from '@/app/dicebound/domain/character'
import {
  BAND_BRIEF,
  DC_TABLE,
  MAX_SITUATIONAL,
  type Modifier,
  clampDc,
  clampSituational,
  resolveCheck,
} from '@/app/dicebound/domain/dice'
import {
  NARRATE_TOOL,
  ROLL_CHECK_TOOL,
  type TurnResult,
  partitionTurnCalls,
} from '@/app/dicebound/domain/turn'
import {
  type ContentBlock,
  DM_MODEL,
  type Message,
  NoApiKeyError,
  RefusedError,
  type ToolDef,
  UTILITY_MODEL,
  callForTool,
  callModel,
  requireApiKey,
  textOf,
  toolSchema,
  toolUses,
} from '@/lib/dicebound/anthropic'

/** The DM can be slow, and a scene worth waiting for is worth the headroom. */
export const maxDuration = 120

/**
 * Checks allowed in a single turn.
 *
 * Three is enough for "you leap the gap, catch the ledge, and haul yourself
 * up" to be three real rolls. More than that and one player action has
 * swallowed a whole scene, which robs the player of the decisions in between.
 */
const MAX_CHECKS = 3

/** Sent back for a `narrate` the model wrote before it could have known the die. */
const PREMATURE_NARRATION =
  'That narration was written in the same message as a roll, before the dice were known, so it has been discarded. Read the roll result above and narrate what actually happened.'

const DC_LINES = DC_TABLE.map(row => `  DC ${row.dc} — ${row.label} (${row.example})`).join('\n')

const SKILL_LINES = ATTRIBUTE_IDS.map(
  id =>
    `  ${ATTRIBUTES[id].name} — ${skillsOf(id)
      .map(s => s.name)
      .join(', ')}`
).join('\n')

const SYSTEM = `You are the dungeon master for Dicebound, a storytelling game played at all ages, in a story the player invented.

THE LOOP
You describe the situation. The player says what their character attempts. You describe what happens. Then you stop and wait. That is the entire game.

DECIDING OUTCOMES
- If the attempt is trivial, or success is guaranteed for this character, it simply works. Describe it happening and move on. Do NOT call for a roll. Walking through an open door is not a Dexterity check, and asking for one is the fastest way to make a game feel like paperwork.
- If the attempt is uncertain — if it could plausibly fail, and failing would be interesting — call roll_check. Then narrate the result you are given.
- Narrate by DEGREE. A near miss and a disaster are different stories; so are a narrow success and a spectacular one. The tool tells you which you got.

DIFFICULTY
${DC_LINES}
Pick the row that honestly fits the attempt. Do not soften a DC because you like the player's idea, and do not inflate one because their idea is clever — a clever idea earns a situational bonus, not a rewritten table.

SITUATIONAL MODIFIERS
Add small bonuses and penalties for what is true in the scene right now: the floor is wet (−2), you have rope (+2), you just mentioned his daughter (−3), you spent the last scene earning her trust (+2). Each is at most ±${MAX_SITUATIONAL}. Name them plainly — the player sees every one on the die card, and this is where they learn that the fiction affects the odds.

ATTRIBUTES AND SKILLS
Every check names one attribute. It may also name one sub-skill, and you should whenever a specific one genuinely applies:
${SKILL_LINES}

Naming a skill matters mechanically: skills are EARNED by being called on, so the skills you name are the ones the character slowly becomes good at. Name the honest one. Do not spread them around to be generous, and do not reach for an exotic skill when the plain attribute is what is really being tested.

NARRATING
- Deliver every scene through a tool call — narrate during play, begin_story when opening. Never answer with bare prose.
- Second person, present tense. "You push the door; it gives an inch and stops."
- Short. Two or three paragraphs at the very most, usually one. This is a conversation, not a novel — the player is waiting to act.
- End on a situation, not a question. Do not write "What do you do?" — just stop somewhere that obviously wants an answer.
- NEVER decide what the player's character does, says, thinks or feels. That is theirs. You control the world and everyone else in it.
- Let failure move the story rather than stall it. A failed attempt should change the situation, not repeat it.
- Keep the world consistent. Names, places and promises from earlier still hold.

TONE
- All ages. Adventure, danger, mystery and real stakes are welcome. Gore, cruelty and horror are not.
- Take the player's premise completely seriously, however silly it is. "Pirates but everyone is a cat" is a real pirate story, and the cats are real pirates.
- If a player pushes toward something inappropriate, let the world decline naturally — an NPC changes the subject, a door is locked — and carry on. Do not lecture, and do not break character.`

const AttributeEnum = z.enum(ATTRIBUTE_IDS as unknown as [AttributeId, ...AttributeId[]])
const SkillEnum = z.enum(SKILL_IDS as unknown as [SkillId, ...SkillId[]])

const RollCheckSchema = z.object({
  attempt: z
    .string()
    .describe(
      'What the character is trying to do, as one short phrase. Shown to the player on the die card.'
    ),
  attribute: AttributeEnum.describe('The attribute this attempt tests.'),
  skill: SkillEnum.nullable()
    .optional()
    .describe(
      'The specific sub-skill, when one genuinely applies. Null when the plain attribute is what is being tested.'
    ),
  dc: z.number().int().min(0).max(30).describe('The difficulty, from the table. Be honest.'),
  situational: z
    .array(
      z.object({
        label: z
          .string()
          .describe(
            'Why, in a few words, as the player would understand it. e.g. "the floor is wet"'
          ),
        value: z.number().int().min(-MAX_SITUATIONAL).max(MAX_SITUATIONAL),
      })
    )
    .max(4)
    .optional()
    .describe(
      'Bonuses and penalties from the current scene. Omit when nothing in particular applies.'
    ),
})

/**
 * Text only, for now.
 *
 * Sprint 3 extends this same tool with the clock and the world deltas a
 * finished turn also produces (#3531). Landing it text-only first is what makes
 * that a schema change rather than a rewrite of the loop.
 */
const NarrateSchema = z.object({
  text: z
    .string()
    .describe(
      'What happens. Second person, present tense, short — usually one paragraph. End on a situation, not a question.'
    ),
})

const ROLL_CHECK: ToolDef = {
  name: ROLL_CHECK_TOOL,
  description:
    'Roll the dice for an uncertain attempt. Returns the roll, the total, and how far above or below the DC it landed. Call this BEFORE narrating an uncertain outcome — you do not know whether it works until you do.',
  input_schema: toolSchema(RollCheckSchema),
}

const NARRATE: ToolDef = {
  name: NARRATE_TOOL,
  description:
    'Tell the player what happens, and end your turn. This is the last thing you do. If the attempt was uncertain, call roll_check first and wait for the result — narration sent in the same message as a roll was written before the dice were known, and is discarded.',
  input_schema: toolSchema(NarrateSchema),
}

const OpeningSchema = z.object({
  title: z
    .string()
    .describe('A short, evocative title for this story. Two to five words. No subtitle, no colon.'),
  opening: z
    .string()
    .describe(
      'The opening scene. Put the character somewhere specific, with something already happening, and stop somewhere that wants a decision. Two or three short paragraphs. Second person.'
    ),
})

interface TurnRequest {
  campaign?: unknown
  action?: unknown
}

export async function POST(request: NextRequest) {
  let body: TurnRequest
  try {
    body = (await request.json()) as TurnRequest
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const campaign = validateCampaign(body.campaign)
  if (!campaign) {
    return NextResponse.json({ error: 'That is not a campaign.' }, { status: 400 })
  }

  const action = typeof body.action === 'string' ? body.action.trim().slice(0, MAX_ACTION) : ''
  const isOpening = campaign.transcript.length === 0

  if (!isOpening && action.length < 1) {
    return NextResponse.json({ error: 'Say what you do.' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 105_000)

  try {
    const apiKey = requireApiKey()
    const result = isOpening
      ? await openStory(apiKey, campaign, controller.signal)
      : await playTurn(apiKey, campaign, action, controller.signal)
    return NextResponse.json({ result })
  } catch (error) {
    clearTimeout(timeout)

    if (error instanceof NoApiKeyError) {
      return NextResponse.json(
        { error: 'The dungeon master is not answering tonight.' },
        { status: 503 }
      )
    }
    if (error instanceof RefusedError) {
      // In voice, and playable — the story continues, it just goes somewhere
      // else. Breaking character to deliver a policy notice would be worse for
      // this audience than a locked door.
      return NextResponse.json({
        result: {
          entries: [
            {
              kind: 'narration',
              text: 'That thread goes somewhere the story will not follow. The moment passes, and the world waits for you to try something else.',
            },
          ],
        } satisfies TurnResult,
      })
    }

    console.error('dicebound turn failed:', error)
    return NextResponse.json({ error: 'The telling faltered. Try that again.' }, { status: 502 })
  } finally {
    clearTimeout(timeout)
  }
}

/** The first turn: a title and a scene, with no player action to react to. */
async function openStory(
  apiKey: string,
  campaign: Campaign,
  signal: AbortSignal
): Promise<TurnResult> {
  const input = (await callForTool({
    apiKey,
    system: SYSTEM,
    maxTokens: 2000,
    signal,
    messages: [
      {
        role: 'user',
        content: `${sheetBlock(campaign)}

The player's premise for this story: "${campaign.premise}"

Open the story. Establish where they are and what is already in motion, then stop.`,
      },
    ],
    tool: {
      name: 'begin_story',
      description: 'Title the story and narrate its opening scene.',
      input_schema: toolSchema(OpeningSchema),
    },
  })) as { title?: unknown; opening?: unknown }

  const opening =
    typeof input.opening === 'string' && input.opening.trim()
      ? input.opening.trim()
      : 'The story begins somewhere you do not yet recognise.'

  return {
    title:
      typeof input.title === 'string' && input.title.trim()
        ? input.title.trim().slice(0, 120)
        : 'An Untitled Story',
    entries: [{ kind: 'narration', text: opening }],
  }
}

/**
 * A normal turn: narrate, rolling as many times as the moment honestly needs.
 *
 * The loop is the point. Each pass either produces narration (and ends the
 * turn) or produces tool calls, which are resolved by the die and fed back as
 * tool results. The model never sees a roll before it has named the DC.
 */
async function playTurn(
  apiKey: string,
  campaign: Campaign,
  action: string,
  signal: AbortSignal
): Promise<TurnResult> {
  // Condense before building the prompt, so a long campaign sends a bounded
  // window and the synopsis the model reads is already current.
  let synopsis: string | undefined
  let dropped: number | undefined
  if (campaign.transcript.length > CONDENSE_AT) {
    const cut = campaign.transcript.length - TRANSCRIPT_WINDOW
    synopsis = await condense(apiKey, campaign, cut, signal)
    dropped = cut
  }

  const history = campaign.transcript.slice(dropped ?? 0)
  const messages: Message[] = [
    {
      role: 'user',
      content: `${sheetBlock(campaign)}

PREMISE: "${campaign.premise}"
${(synopsis ?? campaign.synopsis) ? `\nTHE STORY SO FAR:\n${synopsis ?? campaign.synopsis}\n` : ''}
${transcriptBlock(history)}

The player says: "${action}"

Resolve it, then call narrate with what happens.`,
    },
  ]

  const entries: TranscriptEntry[] = [{ kind: 'player', text: action }]
  let narration = ''

  for (let step = 0; step <= MAX_CHECKS; step++) {
    const lastStep = step === MAX_CHECKS
    const data = await callModel({
      apiKey,
      model: DM_MODEL,
      system: SYSTEM,
      messages,
      maxTokens: 2000,
      signal,
      // On the final pass `roll_check` is withdrawn and `narrate` is forced,
      // which is a harder guarantee than asking nicely for prose. There is no
      // fourth roll available to reach for, and finishing is the only move
      // left on the board.
      tools: lastStep ? [NARRATE] : [ROLL_CHECK, NARRATE],
      toolChoice: lastStep ? { type: 'tool', name: NARRATE_TOOL } : { type: 'auto' },
    })

    const { rolls, ending, premature } = partitionTurnCalls(toolUses(data))

    if (ending) {
      narration = narrationOf(ending.input)
      break
    }

    if (rolls.length === 0 && premature.length === 0) {
      // The model answered in prose instead of declaring the end of the turn.
      // Take it anyway. The turn is over either way, and spending a round trip
      // teaching the model the ceremony would cost the player fifteen seconds
      // to arrive at the same paragraph.
      narration = textOf(data)
      break
    }

    messages.push({ role: 'assistant', content: data.content ?? [] })

    const results: ContentBlock[] = []
    for (const call of rolls) {
      const { entry, brief } = rollFor(campaign, call.input)
      entries.push(entry)
      results.push({ type: 'tool_result', tool_use_id: call.id, content: brief })
    }
    // Answered, not honoured. The API requires a result for every tool_use
    // block, and this is the one place the model is told why its narration was
    // dropped rather than being left to wonder.
    for (const call of premature) {
      results.push({ type: 'tool_result', tool_use_id: call.id, content: PREMATURE_NARRATION })
    }
    messages.push({ role: 'user', content: results })
  }

  if (!narration) {
    // Every pass returned tool calls and the forced final call still produced
    // nothing usable. Rare, but the player is owed a turn either way.
    narration = 'The moment resolves, and the situation has changed. Look around.'
  }

  entries.push({ kind: 'narration', text: narration })
  return { entries, synopsis, dropped }
}

/**
 * The text out of a `narrate` call.
 *
 * Returns '' rather than a placeholder when the model sends a `narrate` with
 * nothing in it, so the caller's existing fallback narration is what the player
 * actually reads. A tool call is not a promise that the field arrived.
 */
function narrationOf(input: unknown): string {
  const raw = (input ?? {}) as { text?: unknown }
  return typeof raw.text === 'string' ? raw.text.trim() : ''
}

/** Resolve one `roll_check` call into a transcript entry and a model briefing. */
function rollFor(campaign: Campaign, input: unknown): { entry: CheckEntry; brief: string } {
  const raw = (input ?? {}) as {
    attempt?: unknown
    attribute?: unknown
    skill?: unknown
    dc?: unknown
    situational?: unknown
  }

  const attribute: AttributeId = isAttributeId(raw.attribute) ? raw.attribute : 'wisdom'
  const skill = applicableSkill(attribute, raw.skill)

  const dc = clampDc(raw.dc)

  const situational = clampSituational(
    Array.isArray(raw.situational)
      ? raw.situational
          .filter(
            (m): m is { label?: unknown; value?: unknown } => typeof m === 'object' && m !== null
          )
          .map(m => ({
            label: typeof m.label === 'string' ? m.label.slice(0, 80) : 'circumstance',
            value: typeof m.value === 'number' ? m.value : 0,
          }))
      : []
  )

  const modifiers: Modifier[] = [
    { label: ATTRIBUTES[attribute].name, value: attributeRank(campaign.character, attribute) },
  ]
  const rank = skillRank(campaign.character, skill)
  // Non-zero, not positive: an innate Size of −2 has to reach the roll, or a
  // very small character would be described as small and then quietly roll as
  // though they were average. A rank of 0 is left off because an unearned
  // skill has nothing to say — the attribute row already covers it.
  if (skill && rank !== 0) modifiers.push({ label: SKILLS[skill].name, value: rank })
  modifiers.push(...situational)

  const outcome = resolveCheck({ dc, modifiers })

  const entry: CheckEntry = {
    kind: 'check',
    attempt: typeof raw.attempt === 'string' ? raw.attempt.slice(0, 300) : 'the attempt',
    attribute,
    skill,
    dc: outcome.dc,
    dcLabel: outcome.dcLabel,
    roll: outcome.roll,
    modifiers: outcome.modifiers,
    modifier: outcome.modifier,
    total: outcome.total,
    margin: outcome.margin,
    band: outcome.band,
  }

  const sign = outcome.margin >= 0 ? '+' : ''
  const brief = [
    `Rolled ${outcome.roll} on a d20, ${outcome.modifier >= 0 ? '+' : ''}${outcome.modifier} = ${outcome.total} against DC ${outcome.dc}.`,
    `Margin ${sign}${outcome.margin}.`,
    BAND_BRIEF[outcome.band],
    'Narrate this outcome. Do not restate the numbers — the player can already see them.',
  ].join(' ')

  return { entry, brief }
}

/** The character sheet, as the DM sees it every turn. */
function sheetBlock(campaign: Campaign): string {
  const c = campaign.character
  const attributes = ATTRIBUTE_IDS.map(
    id => `${ATTRIBUTES[id].name} ${format(c.attributes[id])}`
  ).join(', ')

  const earned = earnedSkills(c)
  const skills = earned.length
    ? earned.map(({ skill, record }) => `${SKILLS[skill].name} ${format(record.rank)}`).join(', ')
    : 'none yet — they have not been doing anything long enough to be good at it'

  return `THE CHARACTER
${c.name} — ${c.concept}
Attributes: ${attributes}
Earned skills: ${skills}`
}

function format(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`
}

/** Recent history, rendered the way the DM should read it back. */
function transcriptBlock(entries: TranscriptEntry[]): string {
  if (entries.length === 0) return ''

  const lines = entries.map(entry => {
    switch (entry.kind) {
      case 'narration':
        return `DM: ${entry.text}`
      case 'player':
        return `PLAYER: ${entry.text}`
      case 'check':
        return `[${entry.attempt} — d20 ${entry.roll}${entry.modifier >= 0 ? '+' : ''}${entry.modifier} = ${entry.total} vs DC ${entry.dc}, ${entry.band}]`
      case 'earned':
        return `[${SKILLS[entry.skill].name} reached +${entry.rank}]`
    }
  })

  return `RECENT PLAY:\n${lines.join('\n\n')}`
}

/**
 * Compress the oldest turns into prose the DM can keep reading.
 *
 * A campaign is its transcript, so this is the only lossy thing in the game.
 * It is asked for continuity rather than summary — names, debts, promises and
 * wounds — because those are what a player notices going missing, and a
 * synopsis that reads like a plot outline loses exactly them.
 *
 * A failure here is survivable: the turn proceeds on the previous synopsis
 * plus a shorter window, which reads as the DM being slightly forgetful rather
 * than as an error.
 */
async function condense(
  apiKey: string,
  campaign: Campaign,
  cut: number,
  signal: AbortSignal
): Promise<string> {
  try {
    const older = campaign.transcript.slice(0, cut)
    const data = await callModel({
      apiKey,
      model: UTILITY_MODEL,
      system:
        "You keep the table's notes. You are given the earlier part of a campaign and you write down what a dungeon master must not forget. Names of people and places, what was promised, what was taken, what is owed, injuries, unresolved threats, and how things stand right now. Prose, past tense, no headings, no bullet points. Be specific — a name you drop is a name the story loses.",
      maxTokens: 1200,
      signal,
      messages: [
        {
          role: 'user',
          content: `Premise: "${campaign.premise}"
${campaign.synopsis ? `\nWhat you had already written down:\n${campaign.synopsis}\n` : ''}
Now fold this into it and return the whole updated account, under 400 words:

${transcriptBlock(older)}`,
        },
      ],
    })

    const text = textOf(data)
    return text || campaign.synopsis
  } catch (error) {
    console.error('dicebound condense failed:', error)
    return campaign.synopsis
  }
}
