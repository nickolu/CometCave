/**
 * A sentence becomes a character.
 *
 * The player writes "a nervous apprentice locksmith who talks too much" and
 * this hands back a name, eight numbers, and one line explaining how the
 * sentence produced them. That explanation is not decoration — it is the whole
 * reason this is a model call instead of a form. Seeing "Power −1, because
 * nervous" is the moment the player understands that what they wrote is now
 * mechanically true about them.
 *
 * The model proposes; `normalizeAttributes` disposes. Range and budget are
 * enforced in code after the fact, so a model in a generous mood cannot mint a
 * character who is good at everything — see `domain/character.ts`.
 *
 * A failure here never blocks play. No key, model error, refusal, nonsense
 * output: the player still gets a playable character, because being told "the
 * cave could not imagine you" and dumped back at an empty text field is a much
 * worse experience than a slightly generic hero.
 */
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import {
  ATTRIBUTES,
  ATTRIBUTE_IDS,
  SKILLS,
  SKILL_IDS,
  type SkillId,
  skillsOf,
} from '@/app/dicebound/domain/attributes'
import { MAX_CONCEPT } from '@/app/dicebound/domain/campaign'
import {
  ATTRIBUTE_BUDGET,
  type Character,
  MAX_ATTRIBUTE,
  MAX_STARTING_SKILLS,
  MIN_ATTRIBUTE,
  blankAttributes,
  normalizeAttributes,
  startingSkills,
} from '@/app/dicebound/domain/character'
import { NoApiKeyError, callForTool, requireApiKey, toolSchema } from '@/lib/dicebound/anthropic'

export const maxDuration = 60

const AttributeSchema = z.number().int().min(MIN_ATTRIBUTE).max(MAX_ATTRIBUTE)

/**
 * Only the earnable skills are offered. `size` and `looks` are set by the
 * `innate` block and are not part of the starting budget, so listing them here
 * would invite the model to spend a slot on something it has already been asked
 * for separately.
 */
const STARTING_SKILL_IDS = SKILL_IDS.filter(id => !SKILLS[id].innate)

const SkillEnum = z.enum(STARTING_SKILL_IDS as unknown as [SkillId, ...SkillId[]])

const STARTING_SKILL_LINES = ATTRIBUTE_IDS.map(
  id =>
    `  ${ATTRIBUTES[id].name} — ${skillsOf(id)
      .filter(skill => !skill.innate)
      .map(skill => skill.name)
      .join(', ')}`
).join('\n')

const CreationSchema = z.object({
  name: z
    .string()
    .describe(
      'The character\'s name. Use the name the player gave if they gave one; otherwise invent one that fits the description and the world. Never "The Locksmith" — a real name.'
    ),
  attributes: z
    .object({
      intellect: AttributeSchema.describe('Reasoning, learning, knowing things on purpose'),
      wisdom: AttributeSchema.describe('Noticing, patience, reading people, living off the land'),
      strength: AttributeSchema.describe('Lifting, hauling, hitting, not stopping'),
      dexterity: AttributeSchema.describe('Precision, balance, quickness, clever hands'),
      constitution: AttributeSchema.describe('Bulk, guts, taking a beating'),
      charm: AttributeSchema.describe('Being liked, being funny, going unnoticed when useful'),
      power: AttributeSchema.describe('Leverage — influence, pressure, hard bargains'),
      beauty: AttributeSchema.describe('Presence, presentation, control of your own face'),
    })
    .describe(
      `Each from ${MIN_ATTRIBUTE} to ${MAX_ATTRIBUTE}. They must sum to ${ATTRIBUTE_BUDGET} or less.`
    ),
  innate: z
    .object({
      size: z
        .number()
        .int()
        .min(-2)
        .max(2)
        .describe(
          'How physically large they are. 0 for an ordinary adult. Only non-zero if the description clearly says so.'
        ),
      looks: z
        .number()
        .int()
        .min(-2)
        .max(2)
        .describe('How striking they are to look at. 0 unless the description clearly says so.'),
    })
    .describe(
      'Set once and never earned — these describe what the character is, not what they practise.'
    ),
  skills: z
    .array(SkillEnum)
    .max(MAX_STARTING_SKILLS)
    .describe(
      `Two or three skills the sentence plainly implies they have already been doing. A locksmith has Hand/Eye; someone who talks too much has Humor. Name only what the sentence actually supports — do not round the character out, and do not reach for something exotic. At most ${MAX_STARTING_SKILLS}.`
    ),
  reading: z
    .string()
    .describe(
      'One or two short sentences, addressed to the player as "you", naming which words in their description produced which numbers AND which starting skills. This is read aloud at the table — make it warm and specific, not a list.'
    ),
})

const SYSTEM = `You build player characters for Dicebound, a dice-and-storytelling game played by all ages.

The player writes one sentence about who they are. You turn it into a character sheet.

THE NUMBERS
- Eight attributes, each from ${MIN_ATTRIBUTE} to ${MAX_ATTRIBUTE}, summing to ${ATTRIBUTE_BUDGET} or less.
- MAKE THEM POINTY. The budget is small so that you have to decide what this person is bad at. A character with +1 in everything is a character with no story in them. Two or three strengths, at least one real weakness.
- Read the whole sentence for weaknesses, not just the boasts. "Nervous" is Power ${MIN_ATTRIBUTE + 1}. "Talks too much" is Charm up and Blending down. "Old" is Constitution down and Wisdom up. "Brilliant but frail" is exactly what it says.
- A description that claims to be good at everything gets the strengths it names most vividly and negatives elsewhere. You are allowed to disagree with the player's self-assessment — that is more interesting than obeying it.

THE STARTING SKILLS
- Two or three skills, at rank 1, for what the sentence says they have ALREADY been doing. A locksmith has been picking locks; an apprentice locksmith who talks too much has been doing that and talking. Those are Hand/Eye and Humor.
- Pick from these and nothing else:
${STARTING_SKILL_LINES}
- Name only what the sentence supports. Do not round the character out with a useful third skill they were never described as having — an unearned skill is worse than a blank line, because the player can tell it did not come from anything they wrote.
- Everything else is still earned by playing. These are a head start on a life already lived, not a character build.

THE READING
- Account for the starting skills as well as the numbers, in the same breath and the same voice: "Locksmith gave you clever hands, and a mouth that will not stop." Not a list, not a justification — one line that reads like someone at the table looking you over.
- This matters more than it looks. Everywhere else this game teaches that skills are earned by using them, so a skill already sitting at rank 1 with nothing said about it reads as a bug. One sentence is the difference between "why do I have this?" and "of course I have this."

THE NAME
- If the player named their character, use that name exactly.
- If not, invent one that fits both the character and the kind of world their sentence implies.

TONE
- All ages. Warm, curious, adventurous. Nothing gruesome or cruel.
- If the description is inappropriate for a young player, quietly build the nearest wholesome character instead and do not comment on it. A kid who writes something silly should still get a hero.
- Take imaginative descriptions completely seriously. "A cat who is also a lawyer" is a cat who is also a lawyer.`

interface CreationInput {
  name?: unknown
  attributes?: Record<string, unknown>
  innate?: { size?: unknown; looks?: unknown }
  skills?: unknown
  reading?: unknown
}

export async function POST(request: NextRequest) {
  let body: { concept?: unknown; premise?: unknown }
  try {
    body = (await request.json()) as { concept?: unknown; premise?: unknown }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  const concept = typeof body.concept === 'string' ? body.concept.trim().slice(0, MAX_CONCEPT) : ''
  const premise = typeof body.premise === 'string' ? body.premise.trim().slice(0, 200) : ''

  if (concept.length < 2) {
    return NextResponse.json({ error: 'Tell me who you are first.' }, { status: 400 })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 50_000)

  try {
    const apiKey = requireApiKey()
    const input = (await callForTool({
      apiKey,
      system: SYSTEM,
      maxTokens: 2000,
      signal: controller.signal,
      messages: [
        {
          role: 'user',
          content: premise
            ? `The story they are about to play: "${premise}"\n\nWho they are: "${concept}"`
            : `Who they are: "${concept}"`,
        },
      ],
      tool: {
        name: 'build_character',
        description: 'Return the finished character sheet.',
        input_schema: toolSchema(CreationSchema),
      },
    })) as CreationInput

    return NextResponse.json({ source: 'model', character: fromInput(input, concept) })
  } catch (error) {
    if (!(error instanceof NoApiKeyError)) {
      console.error('dicebound character creation failed:', error)
    }
    return NextResponse.json({ source: 'offline', character: fallbackCharacter(concept) })
  } finally {
    clearTimeout(timeout)
  }
}

function fromInput(input: CreationInput, concept: string): Character {
  const name =
    typeof input.name === 'string' && input.name.trim()
      ? input.name.trim().slice(0, 60)
      : 'Wanderer'

  const size = clampInnate(input.innate?.size)
  const looks = clampInnate(input.innate?.looks)

  return {
    name,
    concept,
    reading: typeof input.reading === 'string' ? input.reading.trim().slice(0, 400) : '',
    attributes: normalizeAttributes(input.attributes ?? {}),
    skills: {
      // Starting skills first, so an innate rank can never be overwritten by a
      // model that named `size` as a starting skill — `startingSkills` drops
      // innates anyway, and this makes that belt-and-braces.
      ...startingSkills(input.skills),
      // Innate ranks carry a `uses` count of 0 forever, which is exactly right:
      // they were never practised. That is also why they are spread last.
      ...(size !== 0 ? { size: { uses: 0, rank: size } } : {}),
      ...(looks !== 0 ? { looks: { uses: 0, rank: looks } } : {}),
    },
  }
}

function clampInnate(value: unknown): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : 0
  return Math.max(-2, Math.min(2, n))
}

/**
 * The character you get when the model is unreachable.
 *
 * Deliberately capable-but-uneven rather than flat zeroes, so an offline
 * character still plays like someone in particular. The concept is preserved
 * verbatim, which means the dungeon master will still describe them correctly
 * even though nothing read it at creation time.
 */
function fallbackCharacter(concept: string): Character {
  const attributes = blankAttributes()
  attributes.wisdom = 2
  attributes.dexterity = 2
  attributes.charm = 1
  attributes.power = -1

  return {
    name: 'Wanderer',
    concept,
    reading:
      'The cave read you quickly this time — a sharp eye, quick hands, and a way with people. Play a while and it will learn the rest.',
    attributes,
    // The offline path gets starting skills too. Without them the failure path
    // ships a strictly worse character than the happy path, and the difference
    // is visible on the sheet: one player's story opens with three things they
    // are already good at and the other's opens with a blank list, for a reason
    // that is nothing to do with what either of them wrote.
    //
    // These match the attributes above rather than the concept, because nothing
    // read the concept on this path. Observation under Wisdom 2, Hand/Eye under
    // Dexterity 2, Humor under Charm 1.
    skills: startingSkills(['observation', 'hand-eye', 'humor']),
  }
}
