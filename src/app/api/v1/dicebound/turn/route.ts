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
  type Body,
  CONDITION_LABEL,
  CONDITION_PHRASE,
  DAMAGE_TABLE,
  DEFAULT_DANGER,
  SEVERITY_ORDER,
  type Severity,
  applyDamage,
  applyHarm,
  isDead,
  validateSeverity,
} from '@/app/dicebound/domain/body'
import {
  CONDENSE_AT,
  type Campaign,
  type CheckEntry,
  MAX_ACTION,
  TRANSCRIPT_WINDOW,
  type TranscriptEntry,
  isEnded,
  trimToFit,
  validateCampaign,
} from '@/app/dicebound/domain/campaign'
import {
  attributeRank,
  earnedRanks,
  earnedSkills,
  openWindows,
  skillRank,
} from '@/app/dicebound/domain/character'
import {
  type AdvantageSource,
  BAND_BRIEF,
  BAND_LABEL,
  BAND_MOVE,
  BAND_ORDER,
  DC_TABLE,
  HARD_MOVES,
  MAX_SITUATIONAL,
  type Modifier,
  clampDc,
  clampSituational,
  resolveCheck,
} from '@/app/dicebound/domain/dice'
import {
  type Applicability,
  type Item,
  type Kit,
  MAX_ITEMS,
  MAX_TIER,
  MIN_TIER,
  POWER_SHAPES,
  type PowerShape,
  addItem,
  addPower,
  appliesTo,
  canGrantPower,
  chargesRestored,
  kitModifiers,
  levelFor,
  powerEffect,
  powerFromGrant,
  restFor,
  restore,
  spendItemCharges,
  spendPower,
  validateApplicability,
} from '@/app/dicebound/domain/kit'
import {
  type ClassShape,
  classShape,
  fallbackClass,
  readClass,
  shouldNameClass,
} from '@/app/dicebound/domain/klass'
import {
  PROVENANCES,
  type Provenance,
  describeQuality,
  rollQuality,
  traitsFor,
  worthOf,
} from '@/app/dicebound/domain/loot'
import {
  GRANT_ITEM_TOOL,
  GRANT_POWER_TOOL,
  HARM_TOOL,
  NARRATE_TOOL,
  RECALL_TOOL,
  ROLL_CHECK_TOOL,
  type TurnResult,
  USE_POWER_TOOL,
  applyTurn,
  creditSkills,
  partitionTurnCalls,
} from '@/app/dicebound/domain/turn'
import { bool, boundedInt, isPlainObject, oneOf, slug, str } from '@/app/dicebound/domain/validate'
import {
  EDGE_KINDS,
  ENTITY_KINDS,
  ENTITY_STATUSES,
  type EdgeKind,
  type EntityKind,
  type EntityStatus,
  MAX_DISPOSITION,
  MAX_EDGES_PER_TURN,
  MAX_TOUCH_PER_TURN,
  MAX_TURN_MINUTES,
  MIN_DISPOSITION,
  PLAYER_ID,
  PRESSURES,
  type Pressure,
  RECONCILE_EDGES,
  RECONCILE_TOUCH,
  RESOLUTIONS,
  type Resolution,
  type ThreadEntity,
  type World,
  applyWorldDelta,
  currentPlace,
  describeClock,
  edgesFor,
  ensurePlayer,
  findEntities,
  reconcileWorld,
  relevanceWindow,
} from '@/app/dicebound/domain/world'
import { verifyRequestAuth } from '@/lib/api/auth'
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
import { archiveChapter, loadCampaign, saveCampaign } from '@/lib/dicebound/campaign-store'

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

/**
 * Output ceiling for a pass of the turn loop. Was 2000, which is permission to
 * write an essay.
 *
 * This is a backstop, not the mechanism — the budget on the `narrate` tool is
 * what actually shortens a turn. It has to stay clear of the ceiling because
 * truncation here is not a shorter paragraph, it is a `tool_use` block whose
 * JSON stops mid-string: unparseable input, a turn that resolves to the
 * fallback narration, and a player who gets "the moment resolves" instead of
 * their scene. Two short paragraphs is roughly 200 tokens and a pass may also
 * carry several `roll_check` calls, so this leaves several times the headroom
 * the budget asks for while still refusing an essay.
 *
 * `openStory` keeps the old ceiling. The opening is the one place the game is
 * allowed to be expansive.
 */
const TURN_TOKENS = 900

/** Sent back for a `narrate` the model wrote before it could have known the die. */
const PREMATURE_NARRATION =
  'That narration was written in the same message as a roll, before the dice were known, so it has been discarded. Read the roll result above and narrate what actually happened.'

const DC_LINES = DC_TABLE.map(row => `  DC ${row.dc} — ${row.label} (${row.example})`).join('\n')

/**
 * The move table, rendered from the same record the tool result quotes.
 *
 * Written out by hand in the prompt it would be a second copy of `BAND_MOVE`,
 * and the acceptance criterion on this is precisely that the two must not
 * drift — a model given one instruction in the table and a different one at the
 * moment of the roll resolves the contradiction in the player's favour.
 */
const MOVE_LINES = BAND_ORDER.map(band => `  ${BAND_LABEL[band]} — ${BAND_MOVE[band]}`).join('\n')

const HARD_MOVE_LINES = HARD_MOVES.map(move => `  - ${move}`).join('\n')

/**
 * The severity table, rendered from the same rows the tool enum is built from.
 *
 * The examples are not decoration and this is the only place the model ever
 * reads them. The failure they exist to prevent is a DM reaching for `lethal`
 * because the sentence was dramatic — the player writes "I climb down into the
 * ravine" and a forty-turn character is gone. Nothing downstream can fix that,
 * because by the time the roll resolves the row has already been chosen. So the
 * rows are anchored in things a reader can picture, exactly the way `DC_LINES`
 * anchors difficulty.
 *
 * What is deliberately *not* rendered is `DamageRow.fatal` or anything about
 * how many rungs a row costs. The DM picks a row and is told the result; a
 * model shown the mapping starts tuning it.
 */
const SEVERITY_LINES = DAMAGE_TABLE.map(row => `  ${row.label} — ${row.example}`).join('\n')

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
Most turns are not checks. The commonest move you have is IT SIMPLY WORKS: the thing happens, you say what the player now sees, and you hand the ball back. That is a real move and it is the one to reach for first.
- Looking, listening, asking, waiting, walking somewhere safe, picking something up, talking to someone who has no reason to refuse — these are not checks. They just happen. Say what they find and move on.
- A check needs BOTH halves: it could plausibly fail for this character, AND the failure would make the story more interesting. Only one half is not enough. "They might not notice" is not a check if not noticing changes nothing.
- Before you call roll_check you must state what could go wrong. If you cannot say it in a clause, there is nothing at stake and this is not a check.
- Two or three checks in a scene is a lot. A turn where nothing is rolled is not a turn you got wrong — it is most turns.
- Narrate by DEGREE. The tool tells you which band you got, and the band tells you which move to make. You do not get to pick the band.

WHEN THE DICE HAVE SPOKEN
Every roll comes back in one of six bands. Each band has a move. Make that move — do not improvise a different one, and do not blend two because the result was close.
${MOVE_LINES}

THE HARD MOVES
When a band calls for a hard move, take one of these. One is enough for a turn.
${HARD_MOVE_LINES}
A hard move is not a punishment and it is never the end of the story. It changes the situation and hands the ball back. If the player is in the same position after your move as before it, you did not make one.

DIFFICULTY
${DC_LINES}
Pick the row that honestly fits the attempt. Do not soften a DC because you like the player's idea, and do not inflate one because their idea is clever — a clever idea earns a situational bonus, not a rewritten table.

SITUATIONAL MODIFIERS
Add small bonuses and penalties for what is true in the scene right now: the floor is wet (−2), you have rope (+2), you just mentioned his daughter (−3), you spent the last scene earning her trust (+2). Each is at most ±${MAX_SITUATIONAL}. Name them plainly — the player sees every one on the die card, and this is where they learn that the fiction affects the odds.

WHEN A CHECK CAN HURT THEM
Most cannot, and leaving severity off is the ordinary case. Picking a lock badly costs time, not blood. Losing an argument costs the argument. A DM that stamps a severity on every check has turned a story into a war of attrition, and the player will feel it long before they can say why.
Fill it in only when the scene itself contains something that could physically hurt them — a drop, an edge, a fire, a blade already in the air. Then pick the row that matches what is actually there, not the row that matches how exciting the moment feels:
${SEVERITY_LINES}
You are choosing this BEFORE the dice are thrown, and that is the entire point of putting it here: you do not yet know whether it lands. A success costs them nothing at all, whatever row you named.
Never pick lethal for something the player could not have seen coming. If the fiction did not already tell them this could kill them, it is not that row — and if you are reaching for it because the scene needs weight, use a hard move instead.
The game decides what a hit costs. You are told afterwards what state they are in, and you narrate that and nothing heavier. Do not decide how badly they are hurt, do not describe a wound the roll did not give them, and do not soften one it did.
A character can die. You never decide that and you are never asked — if a blow ends them you will be told so in the result, plainly, and then the story is over. Narrate their death once, in voice, and stop. Do not leave them clinging on and do not write a rescue the dice did not give them.

WHEN THE WORLD HURTS THEM ANYWAY
Not all damage comes from a failed attempt. An ambush lands before anyone can react. A thread they have been ignoring catches up with them. Poison, fever, cold and hunger do what they were always going to do, whatever the player does that turn. When the fiction is already hurting them and no attempt of theirs is being tested, call harm — the same severity table as roll_check, plus a few words saying why.
Call it BEFORE you narrate, exactly as you call roll_check before you narrate. You do not know what the injury cost until the game tells you, and a wound you describe first is a wound you invented.
The line between the two tools is not a matter of taste and nothing sits in the middle:
- They tried something and it could have gone wrong -> roll_check with a severity. ALWAYS, even when you are certain it fails.
- Nothing they did is being tested -> harm.
Do not use harm to avoid setting a DC. At most one in a turn.

ATTRIBUTES AND SKILLS
Every check names one attribute. It may also name one sub-skill, and you should whenever a specific one genuinely applies:
${SKILL_LINES}

Naming a skill matters mechanically: skills are EARNED by being called on, so the skills you name are the ones the character slowly becomes good at. Name the honest one. Do not spread them around to be generous, and do not reach for an exotic skill when the plain attribute is what is really being tested.

NARRATING
- Deliver every scene through a tool call — narrate during play, begin_story when opening. Never answer with bare prose. The narrate tool tells you your length budget for that turn. It is a budget, not a target: coming in far under it is good.
- Second person, present tense. "You push the door; it gives an inch and stops."
- Begin and end with the fiction. No recap, no summary, no scene-setting preamble, no stepping outside to comment. The player was there last turn; do not replay it for them.
- Never speak the name of your move. Do not write "you fail" or "you succeed". Do not name the DC, the margin, or how well the roll went. Do not announce a setback as a setback — just let the thing happen and let the player work out what it cost them.
- Once play is under way, you may ask the player a question about their world and treat the answer as true: "Which of these guards do you already owe money to?" "What did your sister tell you about this place?" A question is two lines where description would take twelve, and it makes the player a co-author instead of an audience. Use it sparingly — at most one turn in four, and never twice running.
- Two hard limits on that. It is never available in the opening scene: the first thing a new player reads must be a world, not a request for one. And it is never a question about what they do next — "What do you do?" and every variant of it are banned outright. Stop on a situation that obviously wants an answer instead.
- NEVER decide what the player's character does, says, thinks or feels. That is theirs. You control the world and everyone else in it.
- Let failure move the story rather than stall it. A failed attempt should change the situation, not repeat it.
- Keep the world consistent. Names, places and promises from earlier still hold.

KEEPING THE WORLD
Every narrate call also reports what changed. This is an index of the story, not a copy of it — the transcript is still the record, and anything you miss gets picked up later.
- elapsed: how many minutes of story this turn actually took. Most turns are minutes. Be honest about long ones; you cannot skip past trouble by claiming a week went by.
- safe: true only if the character could have rested here uninterrupted.
- touch: the two or three things that changed or first appeared. Reuse the same id for the same thing forever — "harbour-guard" stays "harbour-guard". Do not restate what did not change.
- edges: connections that formed or changed. Both ends must be things you registered in touch.
- threads: loose ends that moved. Close one only when the story is genuinely finished with it.
WHAT THEY CARRY
- When the fiction actually hands something over — they pick it up, are given it, take it — call grant_item. Not for scenery, and not for things they merely saw.
- Almost everything is plain. A rope is a permission, not a bonus: it turns "you cannot climb that" into a roll you can make. Reserve the better bands for things the story made a moment of.
- You say what a thing is. The game says what it is worth, and the answer is usually nothing. Do not describe an ordinary object as though it improved them.
- When something they carry genuinely bears on an attempt, name it in roll_check's items. Name it because it is true, not to help — most named items add nothing to the number and appear on the card anyway.

WHAT THEY CAN DO
- A power is rare and it is earned. Somebody taught it, something changed them, a place left a mark. Call grant_power only when the story has actually spent a scene on that, and never more than once in a long while.
- It has to come from something already in the story — name that thing's id in source. Someone you invented this turn does not count. If the teacher is new, introduce them properly first and let them teach it later.
- A power never decides an outcome. It makes one available: it turns "you cannot hurt him from here" into a roll that can still miss. Write it as a permission, not as a result.
- You say what it is and what it costs. The game says how strong it is and how often it comes back. You may be told the character is not ready, or that the source does not count — that is a normal answer. Narrate the moment without the power and carry on; do not mention that anything was refused.
- When they reach for a power they have, call use_power. The charge is spent the moment they reach, whether or not it works — so do not call it to decorate a description, and do not call it twice for one action.
- A power never settles anything. It makes something possible that was not, and then you still call roll_check for whatever is uncertain about it. Fire in your hand does not kill the guard; it means you can try.

REMEMBERING
What you are shown is a window on the story, not the whole of it. Places, people and promises that have gone quiet are still there and are not listed.
- If the player refers to someone or something you cannot see in the list, call recall BEFORE you answer. Do not decide it is new because it is not in front of you.
- Recall is free and costs the player nothing. Inventing a stranger over the top of somebody the story already contains is the one mistake a player always catches, and it is the mistake that makes a long campaign feel disposable.
- If recall comes back with nothing, then it really is new, and you should invent it with a free hand.

You report what happened. The server decides what it is worth — how far a disposition moves, when a relationship becomes old enough to matter, how much time a turn may consume. Do not try to set those.

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
  uncertain: z
    .string()
    .describe(
      'What could actually go wrong here, in a clause, and why that failure would be interesting. "The rope is old and he is heavier than he looks." If you cannot fill this in without straining, do not call this tool — narrate it happening instead.'
    ),
  items: z
    .array(z.string())
    .max(4)
    .optional()
    .describe(
      'Ids of things the character is carrying that genuinely bear on THIS attempt. Name them and the game decides what they are worth — most are worth nothing, and are named on the card anyway because the reason is real even when the number is not.'
    ),
  dc: z.number().int().min(0).max(30).describe('The difficulty, from the table. Be honest.'),
  severity: z
    .enum(SEVERITY_ORDER as unknown as [Severity, ...Severity[]])
    .optional()
    .describe(
      'Only when failing this could physically hurt them, which is not most checks. The row from the table matching what is actually in the scene. Omit it entirely when nothing here can draw blood — that is the ordinary case. A success costs nothing whatever you name here.'
    ),
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
      'What happens. Second person, present tense. Open on the fiction and close on the fiction, within the word budget given for this turn. Never state the outcome in the abstract ("you fail", "you succeed") — show the thing itself.'
    ),
  elapsed: z
    .number()
    .int()
    .min(0)
    .max(MAX_TURN_MINUTES)
    .describe(
      'Minutes of story this turn consumed. A conversation is 5, crossing a town is 30, a night is 480. Be honest and be small — most turns are minutes, not hours.'
    ),
  safe: z
    .boolean()
    .describe('True only if the character could have rested here without being interrupted.'),
  touch: z
    .array(
      z.object({
        id: z.string().describe('Stable lowercase slug. Reuse the same id for the same thing.'),
        kind: z.enum(ENTITY_KINDS as unknown as [EntityKind, ...EntityKind[]]),
        name: z.string().describe('What the player would call it.'),
        note: z.string().optional().describe('One line, the first time you meet it.'),
        state: z
          .string()
          .optional()
          .describe('What is true about it NOW: "the bridge is burned", "hiding in the cellar".'),
        status: z.enum(ENTITY_STATUSES as unknown as [EntityStatus, ...EntityStatus[]]).optional(),
        disposition: z
          .number()
          .int()
          .min(MIN_DISPOSITION)
          .max(MAX_DISPOSITION)
          .optional()
          .describe(
            'Actors only. Where this person now stands toward the player. Move it by one at most; the server will not take a larger step.'
          ),
      })
    )
    .max(MAX_TOUCH_PER_TURN)
    .optional()
    .describe(
      'Only the two or three things that actually changed or first appeared this turn. This is an index, not a world state — do not restate what is unchanged.'
    ),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum(EDGE_KINDS as unknown as [EdgeKind, ...EdgeKind[]]),
        note: z.string().optional().describe('Why, in a few words: "for the boat he lost".'),
      })
    )
    .max(MAX_EDGES_PER_TURN)
    .optional()
    .describe('New or changed connections. Both ends must be things you have registered in touch.'),
  threads: z
    .array(
      z.object({
        id: z.string(),
        resolution: z
          .enum(RESOLUTIONS as unknown as [Resolution, ...Resolution[]])
          .optional()
          .describe('Close a thread when the story has actually finished with it.'),
        pressure: z
          .enum(PRESSURES as unknown as [Pressure, ...Pressure[]])
          .optional()
          .describe('How soon this presses again.'),
      })
    )
    .max(MAX_TOUCH_PER_TURN)
    .optional()
    .describe('Loose ends that moved. Register the thread itself in touch first.'),
})

const ROLL_CHECK: ToolDef = {
  name: ROLL_CHECK_TOOL,
  description:
    'Roll the dice for an uncertain attempt. Returns the roll, the total, and how far above or below the DC it landed. Call this BEFORE narrating an uncertain outcome — you do not know whether it works until you do.',
  input_schema: toolSchema(RollCheckSchema),
}

/**
 * Damage with no check behind it.
 *
 * `roll_check` covers exactly one case: the player attempted something and the
 * die went against them. It covers none of the others — a fuse fires and the
 * thing they have been ignoring catches up, an ambush starts, a fever does what
 * it promised five turns ago, the cold finally gets through. Without a tool for
 * those, the dungeon master's only options are to narrate a wound the sheet
 * never records, or to invent a roll the player never earned. Both are worse
 * than a second tool.
 *
 * There is no outcome field, and there is no DC. The model says *that*
 * something hurt them and roughly how badly, from the same table `roll_check`
 * uses, and the game says what it cost.
 *
 * `reason` is not decoration and it is not stored anywhere. It is a commitment
 * device, the same job `uncertain` does on `roll_check`: a model that has to
 * write "the fever takes hold" before it learns what the fever cost reaches for
 * this tool less freely than one that only has to pick an enum. A `harm` whose
 * reason cannot be stated in a few words is usually a `roll_check` the model
 * did not want to make.
 */
const HarmSchema = z.object({
  severity: z
    .enum(SEVERITY_ORDER as unknown as [Severity, ...Severity[]])
    .describe('How badly this hurts, from the same table roll_check uses.'),
  reason: z
    .string()
    .describe(
      'Why, in a few words, as the player would understand it: "the fever takes hold", "the beam comes down". If the character was attempting something, this is the wrong tool — call roll_check instead.'
    ),
})

const HARM: ToolDef = {
  name: HARM_TOOL,
  description:
    'The world hurts the character, with no attempt of theirs being tested: an ambush landing, a thread catching up with them, poison, fever, cold. Call this BEFORE narrating the injury — it returns what state they are now in, and you narrate that. If they tried something that could go wrong, use roll_check with a severity instead. At most once per turn.',
  input_schema: toolSchema(HarmSchema),
}

/**
 * The word budget, and why it lives on the tool rather than in the system
 * prompt.
 *
 * A turn that resolved a roll has more to carry than a turn that did not — the
 * player is owed the outcome of the thing they attempted, which is a beat the
 * quiet turn simply does not have. One budget for both would either strangle
 * the roll turn or licence the quiet one, so the budget is built per pass and
 * stated on the tool the model is about to fill in.
 *
 * It also cannot live in SYSTEM, because SYSTEM is shared with `openStory`, and
 * the opening scene is the one moment the game is allowed to be expansive.
 * Putting 70 words in the shared prompt would quietly shrink the first thing a
 * new player ever reads.
 */
function narrateTool(rolled: boolean): ToolDef {
  const budget = rolled
    ? 'The dice have been rolled, so you have a little more room: two short paragraphs at the very most, and one is usually better.'
    : 'Nothing was rolled, so this is a small turn. Keep it under about 70 words — one short paragraph.'

  return {
    name: NARRATE_TOOL,
    description: `Tell the player what happens, and end your turn. This is the last thing you do. ${budget} If the attempt was uncertain, call roll_check first and wait for the result — narration sent in the same message as a roll was written before the dice were known, and is discarded.`,
    input_schema: toolSchema(NarrateSchema),
  }
}

const RecallSchema = z.object({
  query: z
    .string()
    .describe(
      'What you are trying to remember, in the player\'s words: "the man from the harbour", "the debt to Maren".'
    ),
})

const RECALL: ToolDef = {
  name: RECALL_TOOL,
  description:
    'Look something up that is not in front of you. Use this when the player refers to a person, place or promise you cannot see listed — the story may well contain it. Returns nothing if there is genuinely no match, and nothing means it is new.',
  input_schema: toolSchema(RecallSchema),
}

const ProvenanceEnum = z.enum(['underfoot', 'given', 'bought', 'taken', 'hoard'] as const)

const GrantItemSchema = z.object({
  name: z
    .string()
    .describe(
      'What the player would call it. The game slugs this into a stable id — reuse the same name for the same thing.'
    ),
  note: z
    .string()
    .optional()
    .describe('One line: what it is and where it came from, as the player would understand it.'),
  how: ProvenanceEnum.describe(
    'How it arrived. underfoot: lying around; given: handed over; bought: paid for; taken: off something that did not want to give it up; hoard: from a cache or vault. The game rolls the quality from this — do not try to name a quality, and do not describe the object as though it is good.'
  ),
  from: z
    .string()
    .optional()
    .describe(
      'The id of the world entity it came from, if any. Looked up — if it does not exist in the graph, the item is still granted.'
    ),
  consumable: z.boolean().optional().describe('True if using it uses it up.'),
  uses: z.number().int().min(1).max(9).optional().describe('For a consumable: how many times.'),
  traits: z
    .array(
      z.object({
        label: z
          .string()
          .describe(
            'What is true because they have it, as the player would say it: "you have rope". The game assigns the number.'
          ),
        applies: z
          .object({
            attributes: z.array(AttributeEnum).optional(),
            skills: z.array(SkillEnum).optional(),
          })
          .optional()
          .describe(
            'Leave empty when it applies everywhere. Name attributes or skills to narrow it.'
          ),
      })
    )
    .max(2)
    .optional()
    .describe('Labels only. The game decides which ones survive and what they are worth.'),
  replace: z
    .string()
    .optional()
    .describe(
      'Id of an item already in the pack to swap out. Use this when the pack is full and the player chose what to put down.'
    ),
})

const GRANT_ITEM: ToolDef = {
  name: GRANT_ITEM_TOOL,
  description:
    'Give the character something to carry. Call only when the fiction hands it over — picked up, given, taken. Name the thing and how it arrived; the game decides what it is worth. Do not name a quality and do not describe it as powerful.',
  input_schema: toolSchema(GrantItemSchema),
}

/**
 * Note what is absent: charges, refresh, and any way to say how strong this is.
 *
 * `tier` is the only magnitude the model may touch and it is a request, not a
 * setting — `canGrantPower` clamps it down to what the level allows and never
 * up. Everything else that turns into a number comes from `TIER_CHARGES`.
 */
const GrantPowerSchema = z.object({
  id: z.string().describe('Stable lowercase slug. Never reuse one they already have.'),
  name: z.string().describe('What the player would call it.'),
  note: z.string().optional().describe('One line: what it looks like when they use it.'),
  source: z
    .string()
    .describe(
      'The id of the person, place or thing this came from. It must already exist in the story — someone you introduce this turn does not count.'
    ),
  shape: z
    .enum(POWER_SHAPES as unknown as [PowerShape, ...PowerShape[]])
    .describe(
      'permits: it makes something possible that was not, and they still roll for it. advantage: they roll twice and keep the better die, in the situations you name.'
    ),
  permits: z
    .string()
    .optional()
    .describe('For permits: the capability in plain language. "throw fire, at range".'),
  applies: z
    .object({
      attributes: z.array(AttributeEnum).optional(),
      skills: z.array(SkillEnum).optional(),
    })
    .optional()
    .describe(
      'For advantage: where it applies. Narrow it — advantage on everything is not a power.'
    ),
  cost: z.string().optional().describe('What using it costs them, in the fiction, if anything.'),
  tier: z
    .number()
    .int()
    .min(MIN_TIER)
    .max(MAX_TIER)
    .optional()
    .describe(
      'How significant this is, 1 to 3. A request only — if they are not far enough along, they get a lesser version rather than this one.'
    ),
})

const GRANT_POWER: ToolDef = {
  name: GRANT_POWER_TOOL,
  description:
    'Give the character something they can do. Only when the story has earned it and only from a source it already contains. The game decides how strong it is, how many charges it has, and whether they are ready for it at all — and it may say no, which is a normal answer and not a problem to mention.',
  input_schema: toolSchema(GrantPowerSchema),
}

/**
 * Note that there is nothing here to say what the power *does* this time.
 *
 * The power already said that when it was granted. Letting the model restate
 * it at the moment of use is letting it restate it larger, and a power whose
 * effect is re-described every time it is spent is a power the model is
 * pricing.
 */
const UsePowerSchema = z.object({
  id: z.string().describe('The id of a power they already have.'),
})

const USE_POWER: ToolDef = {
  name: USE_POWER_TOOL,
  description:
    'Spend one charge of a power the character has. The charge goes whether or not anything comes of it. This does not decide what happens — it tells you what is now possible, and you still call roll_check for anything uncertain.',
  input_schema: toolSchema(UsePowerSchema),
}

const OpeningSchema = z.object({
  title: z
    .string()
    .describe('A short, evocative title for this story. Two to five words. No subtitle, no colon.'),
  opening: z
    .string()
    .describe(
      'The opening scene. Put the character somewhere specific, with something already happening, and stop somewhere that wants a decision. Two or three short paragraphs. Second person. Do not ask the player a question here — the co-authoring question is a move for later turns, and the first thing a new player reads should be a world, not a request for one.'
    ),
})

interface TurnRequest {
  campaign?: unknown
  action?: unknown
}

/**
 * Find the campaign this turn runs against, and say whether the server owns it.
 *
 * Two callers, and the difference is not cosmetic.
 *
 * A request carrying a token gets the *stored* campaign, whatever it sent. That
 * is the whole point of this issue: the mechanical facts of a saved game — skill
 * ranks, and soon items, powers and edges — stop being something the client can
 * assert and become something only a resolved turn can produce. The body's
 * campaign is ignored outright once a stored one exists.
 *
 * The exception is a player who has no stored campaign yet, whose first turn
 * carries the campaign that character creation just built. That is a creation,
 * not an edit, and it is no weaker than the `PUT /campaign` the client would
 * otherwise have called a moment earlier.
 *
 * A request with no token is the local-only backend — Firebase unconfigured, so
 * there is no server-side story to protect and nothing to load. It keeps the old
 * shape. Sending no token buys an attacker nothing: without a uid there is
 * nowhere to persist the result, and they already own their own localStorage.
 */
async function campaignFor(
  request: NextRequest,
  body: TurnRequest
): Promise<
  { campaign: Campaign; uid: string | null } | { error: NextResponse } | { notFound: true }
> {
  const hasToken = /^Bearer\s+.+$/i.test(
    request.headers.get('authorization') ?? request.headers.get('Authorization') ?? ''
  )

  if (!hasToken) {
    const campaign = validateCampaign(body.campaign)
    if (!campaign) {
      return { error: NextResponse.json({ error: 'That is not a campaign.' }, { status: 400 }) }
    }
    return { campaign, uid: null }
  }

  const auth = await verifyRequestAuth(request)
  if ('error' in auth) return { error: auth.error }

  const stored = await loadCampaign(auth.claims.uid)
  if (stored) return { campaign: stored, uid: auth.claims.uid }

  const created = validateCampaign(body.campaign)
  if (!created) return { notFound: true }
  return { campaign: created, uid: auth.claims.uid }
}

export async function POST(request: NextRequest) {
  let body: TurnRequest
  try {
    body = (await request.json()) as TurnRequest
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body.' }, { status: 400 })
  }

  let found: Awaited<ReturnType<typeof campaignFor>>
  try {
    found = await campaignFor(request, body)
  } catch (error) {
    console.error('dicebound turn could not load the campaign:', error)
    return NextResponse.json({ error: 'Could not find your story.' }, { status: 500 })
  }

  if ('error' in found) return found.error
  if ('notFound' in found) {
    return NextResponse.json({ error: 'There is no story here yet.' }, { status: 404 })
  }

  const { campaign, uid } = found

  // A finished story does not take another turn.
  //
  // Nothing this game ships sends one — the client renders the ending screen
  // where the composer was — but the campaign is what is authoritative, so the
  // rule lives where the authority is rather than where the button is. It is
  // also the last line of defence for the thing the whole epic is about: a
  // player who kept a tab open across the turn that killed them, or who
  // replays a request, must not get to play on past their own ending.
  if (isEnded(campaign)) {
    return NextResponse.json({ error: 'That story has already found its ending.' }, { status: 409 })
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
      : await playTurn(apiKey, campaign, action, controller.signal, uid)

    // Anonymous-first (CLAUDE.md #1). `uid` is null only when there is no
    // Firebase at all, and that player still gets their turn — they just apply
    // and store it themselves, exactly as before.
    if (uid === null) return NextResponse.json({ result })

    // The server folds the turn in and hands back what it saved. Returning the
    // whole campaign rather than a diff is deliberate: the client applying its
    // own `applyTurn` to a result is precisely the client-side authority this
    // issue removes, and two implementations of that arithmetic is two chances
    // for the sheet and the save file to disagree. The request is a sentence;
    // it is the response that carries the story.
    const next = applyTurn(campaign, result, Date.now())
    try {
      await saveCampaign(uid, trimToFit(next))
    } catch (error) {
      // The turn happened and the player is owed it. A failed save reads as a
      // dropped turn next reload, which is worse than nothing but far better
      // than throwing away narration the model has already been paid for.
      console.error('dicebound turn save failed:', error)
    }
    return NextResponse.json({ result, campaign: next })
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
  signal: AbortSignal,
  uid: string | null
): Promise<TurnResult> {
  // Condense before building the prompt, so a long campaign sends a bounded
  // window and the synopsis the model reads is already current.
  let synopsis: string | undefined
  let dropped: number | undefined
  let chapters: number | undefined
  let repaired: World | undefined
  let chapterTurned = false

  if (campaign.transcript.length > CONDENSE_AT) {
    const cut = campaign.transcript.length - TRANSCRIPT_WINDOW
    const older = campaign.transcript.slice(0, cut)

    synopsis = await condense(apiKey, campaign, cut, signal)
    dropped = cut

    // Archived before anything else touches it. `condense` used to be the only
    // lossy operation in the game; the chapter is what makes the loss a change
    // of address rather than a deletion, and it has to happen even if the
    // reconciliation below falls over.
    if (uid) {
      try {
        await archiveChapter(uid, {
          index: campaign.chapters,
          entries: older,
          synopsis: synopsis || campaign.synopsis,
          archivedAt: campaign.world.clock.elapsed,
        })
        chapters = campaign.chapters + 1
        // A chapter boundary is the rarer refresh, and it is tied to the
        // archive *landing* rather than to the condense being attempted. A
        // failed archive already costs the player a slice of transcript; it
        // must not also hand them back charges for a chapter that was never
        // written, or the counter and the sheet start disagreeing.
        chapterTurned = true
      } catch (error) {
        // A failed archive must not cost the player their turn. It does cost
        // this slice of transcript, which is why it is logged loudly rather
        // than swallowed silently like a save.
        console.error('dicebound chapter archive failed:', error)
      }
    }

    repaired = await reconcile(apiKey, campaign, older, signal)
  }

  const history = campaign.transcript.slice(dropped ?? 0)
  const messages: Message[] = [
    {
      role: 'user',
      content: `${sheetBlock(campaign)}

${worldBlock(campaign.world, mentionedIn(action))}

PREMISE: "${campaign.premise}"
${(synopsis ?? campaign.synopsis) ? `\nTHE STORY SO FAR:\n${synopsis ?? campaign.synopsis}\n` : ''}
${transcriptBlock(history)}

The player says: "${action}"

Resolve it, then call narrate with what happens.`,
    },
  ]

  const entries: TranscriptEntry[] = [{ kind: 'player', text: action }]
  let narration = ''
  // The player is seeded before the first delta so that edges pointing at them
  // have somewhere to land. An `owes(guard -> you)` with no `you` is dropped for
  // having a missing endpoint, and that is most of what the graph is for.
  let world = ensurePlayer(repaired ?? campaign.world, campaign.character.name)
  // A fuse is allowed to reopen the turn exactly once. Without the flag a
  // thread that fires on the interruption's own elapsed minutes could keep
  // reopening it, and a turn that never stops is a turn that never comes back.
  let fuseAnswered = false
  let kit = campaign.kit
  // Carried through the turn the way `kit` and `world` are, rather than being
  // written back to the campaign at each roll. A turn can roll three times, and
  // the third blow has to land on the body the first two left behind.
  let body = campaign.body
  // One harm per turn, latched across passes rather than counted within one.
  // A turn that rolls, harms, and then rolls again has had its harm — the
  // ceiling is on the turn the player experiences, not on a single message.
  let harmed = false
  // Both fixed for the whole turn, on purpose.
  //
  // `level` is read once so a skill that ranks up mid-turn cannot also unlock a
  // power on the same turn. Levelling is a beat the player should get to read
  // before it starts changing what they are allowed to be handed.
  //
  // `turnStartedAt` is where the clock stood before this turn touched anything,
  // and it is what the provenance gate measures against. Using the live clock
  // would mean a fuse-interrupted turn — which advances time and then comes
  // back for another pass — started accepting entities it had minted moments
  // earlier as things the player had "already met".
  const level = levelFor(earnedRanks(campaign.character))
  const turnStartedAt = world.clock.elapsed
  // Spent powers, held for the length of the turn. Anything still pending when
  // the turn ends is discarded with its charge already gone.
  const powers: TurnPowers = { permissions: [], pending: [], spent: new Set() }
  // Latched for the turn. A fuse-interrupted turn narrates twice, and without
  // this the second narration could rest again off the same span — "a week of
  // travel is not seven rests" has to survive the one path that runs the clock
  // more than once.
  let rested = false
  let restoredCharges = 0

  // The chapter refresh happens here rather than inside the condense block
  // because `kit` does not exist yet up there, and because a refill that
  // happened before the turn ran would be invisible to anything the turn did.
  if (chapterTurned) {
    const refreshed = restore(kit, 'chapter')
    restoredCharges += chargesRestored(kit, refreshed)
    kit = refreshed
  }

  for (let step = 0; step <= MAX_CHECKS; step++) {
    // The final pass — or the pass after the one that killed them.
    //
    // A dead character has no more attempts left in them, so the turn stops
    // offering the tools that would take one. `narrate` is forced exactly as it
    // is at `MAX_CHECKS`, and for exactly the same reason: finishing is the
    // only move on the board. It also closes the fuse path below, which is
    // right — a thread catching up with someone who is already gone is a
    // deadline landing on an empty room.
    const lastStep = step === MAX_CHECKS || isDead(body)
    // Whether anything has actually been rolled this turn, which is what sets
    // the word budget. Derived from the entries rather than the step counter: a
    // model that spent a pass on nothing has not earned the longer budget.
    const rolled = entries.some(entry => entry.kind === 'check')
    const narrate = narrateTool(rolled)

    const data = await callModel({
      apiKey,
      model: DM_MODEL,
      system: SYSTEM,
      messages,
      maxTokens: TURN_TOKENS,
      signal,
      // On the final pass `roll_check` is withdrawn and `narrate` is forced,
      // which is a harder guarantee than asking nicely for prose. There is no
      // fourth roll available to reach for, and finishing is the only move
      // left on the board.
      tools: lastStep
        ? [narrate]
        : [ROLL_CHECK, HARM, RECALL, GRANT_ITEM, GRANT_POWER, USE_POWER, narrate],
      toolChoice: lastStep ? { type: 'tool', name: NARRATE_TOOL } : { type: 'auto' },
    })

    const { rolls, recalls, grants, powerGrants, powerUses, harms, ending, premature } =
      partitionTurnCalls(toolUses(data))

    if (ending) {
      const text = narrationOf(ending.input)
      if (text) {
        // Two narrations can happen in one turn — the action, then the thing
        // that interrupted it — and both are the player's to read.
        narration = narration ? `${narration}\n\n${text}` : text
      }

      const delta = (ending.input ?? {}) as Record<string, unknown>
      const before = world.clock.elapsed
      const applied = applyWorldDelta(world, delta)
      world = applied.world

      // Measured from the clock the server actually moved, not from the
      // `elapsed` the model asked for. `advance` stops at a fuse, so a DM that
      // claims a week and runs into something four hours in has had four hours
      // — and four hours is not a rest. The world is read after the deltas so a
      // thread that fired during the span is already urgent by the time this
      // asks.
      if (!rested) {
        const outcome = restFor(kit, world, world.clock.elapsed - before, bool(delta.safe))
        kit = outcome.kit
        rested = outcome.rested
        restoredCharges += outcome.restored
      }

      // The clock ran into an open thread's fuse. The turn is not over: the
      // player asked for a week and got four hours, and they are owed the
      // reason. This is the one place `narrate` is not terminal, and it costs a
      // pass only when a fuse actually fires.
      if (applied.interrupted && !fuseAnswered && !lastStep) {
        fuseAnswered = true
        // The narration is discarded, not kept, and this is the same rule that
        // governs a `narrate` sent alongside a roll: it was written before a
        // fact it depends on. The model narrated the whole span the player
        // asked for — "dawn finds you still moving, by the second afternoon" —
        // and then reported an `elapsed` that ran into a fuse forty-five
        // minutes in. Keeping both gives the player two days of walking
        // followed by an ambush that happened before breakfast. It could not
        // have known where the clock would stop, so it does not get to describe
        // the time that did not pass.
        narration = ''

        messages.push({ role: 'assistant', content: data.content ?? [] })
        messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: ending.id,
              content: fuseBrief(world, applied.fired),
            },
          ],
        })
        continue
      }

      break
    }

    if (
      rolls.length === 0 &&
      recalls.length === 0 &&
      grants.length === 0 &&
      powerGrants.length === 0 &&
      powerUses.length === 0 &&
      harms.length === 0 &&
      premature.length === 0
    ) {
      // The model answered in prose instead of declaring the end of the turn.
      // Take it anyway. The turn is over either way, and spending a round trip
      // teaching the model the ceremony would cost the player fifteen seconds
      // to arrive at the same paragraph.
      narration = textOf(data)
      break
    }

    messages.push({ role: 'assistant', content: data.content ?? [] })

    const results: ContentBlock[] = []
    // Spends run before rolls. A model that sends `use_power` and `roll_check`
    // in one message meant them in that order, and resolving the roll first
    // would drop the permission off its own die card.
    for (const call of powerUses) {
      const { kit: next, note } = spendPowerFor(kit, powers, call.input)
      kit = next
      results.push({ type: 'tool_result', tool_use_id: call.id, content: note })
    }
    for (const call of rolls) {
      const { entry, brief, body: afterBlow } = rollFor(campaign, kit, body, powers, call.input)
      entries.push(entry)
      body = afterBlow

      // Spend one charge per named item that bore on this check.
      const rawInput = (call.input ?? {}) as { items?: unknown }
      const { kit: afterSpend, consumed } = spendItemCharges(kit, rawInput.items)
      kit = afterSpend

      const fullBrief =
        consumed.length > 0
          ? `${brief} ${consumed.map(n => `${n} was used up`).join(', ')}.`
          : brief

      results.push({ type: 'tool_result', tool_use_id: call.id, content: fullBrief })
    }
    // After the rolls, so that a model sending both in one message gets them in
    // the order it meant them: the thing they attempted resolves, and then the
    // world does whatever it was going to do regardless.
    for (const call of harms) {
      const { body: afterHarm, note, spent } = harmFor(body, harmed, call.input)
      body = afterHarm
      harmed = harmed || spent
      results.push({ type: 'tool_result', tool_use_id: call.id, content: note })
    }
    for (const call of grants) {
      const { kit: next, note } = grantFor(kit, world, call.input)
      kit = next
      results.push({ type: 'tool_result', tool_use_id: call.id, content: note })
    }
    for (const call of powerGrants) {
      // `turnStartedAt` rather than the live clock. The provenance gate asks
      // whether the source predates *this turn*, so it has to be measured
      // against where the clock stood before the turn touched anything —
      // otherwise a fuse-interrupted turn, which advances the clock and then
      // comes back for another pass, would start accepting entities it minted
      // moments ago.
      const { kit: next, note } = grantPowerFor(kit, world, level, turnStartedAt, call.input)
      kit = next
      results.push({ type: 'tool_result', tool_use_id: call.id, content: note })
    }
    // A lookup costs a pass but not a check: it is the DM checking its notes,
    // not the story moving. `MAX_CHECKS` still bounds the loop, so a model that
    // did nothing but recall would still be forced to narrate at the end.
    for (const call of recalls) {
      results.push({
        type: 'tool_result',
        tool_use_id: call.id,
        content: recallFor(world, call.input),
      })
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
    // nothing usable. Rare, but the player is owed a turn either way — and on
    // the one turn that can never be taken again, owed it more than usual. The
    // ordinary fallback hands the player back the initiative, which is the one
    // thing a death does not do; told to "look around" after dying they would
    // reasonably conclude the game had broken rather than ended.
    narration = isDead(body)
      ? 'The story stops here, in the middle of itself, the way they do.'
      : 'The moment resolves, and the situation has changed. Look around.'
  }

  entries.push({ kind: 'narration', text: narration })

  // The cave forms an opinion, once.
  //
  // Level is recomputed from the character this turn produced rather than from
  // `level`, which was read before the turn ran — the check that pushed them to
  // level 2 usually happens *in* this turn, and reading the stale value would
  // hold the name back until the next one for no reason the player could see.
  //
  // `className === null` is the whole of the once-ness. Nothing re-reads the
  // histogram at level 3, and whether a class should ever be revisited is a
  // decision this issue deliberately does not settle by accident.
  //
  // `!isDead(body)` because the cave forming an opinion about what somebody was,
  // one paragraph after they stopped being it, is the single worst place this
  // line could land. A death is not a level-up screen.
  if (kit.className === null && !isDead(body)) {
    const { character: credited } = creditSkills(campaign.character, entries, world.clock.elapsed)
    if (shouldNameClass(kit, levelFor(earnedRanks(credited)))) {
      const shape = classShape(credited)
      const named = await nameClass(apiKey, campaign, shape, signal)
      kit = { ...kit, className: named.name }
      // A line in the DM's voice, not a modal and not a congratulations. The
      // cave noticed what they are; it does not need to celebrate it.
      entries.push({
        kind: 'narration',
        text: `Somewhere in all of that, without anybody deciding it, you became this: ${named.name}.${named.note ? ` ${named.note}` : ''}`,
      })
    }
  }

  // A quiet line, in the game's own voice, and only when something actually
  // came back. Not a toast and not a banner: the cave is light and ceremony
  // lives inside the game (CLAUDE.md #2), and this is a small thing that
  // happened in the fiction rather than an achievement. A rest that restored
  // nothing — because nothing was spent — says nothing at all, or the player
  // learns to read it as noise.
  //
  // It goes in the transcript rather than into a field, which is also how the
  // DM finds out: next turn it reads this line back, and the powers block in
  // the prompt already shows the refilled counts.
  //
  // Not for someone who is not there. A rest that "settles" after a death reads
  // as an afterlife the fiction never offered, and a turn can absolutely end
  // with both — a safe span of travel that a fuse fires into.
  if (restoredCharges > 0 && !isDead(body)) {
    entries.push({
      kind: 'narration',
      text: rested
        ? 'You sleep, and it is a real one. Whatever it is you spend doing the thing only you can do, it is back where you left it.'
        : 'Something settles, the way it does when one part of a story finishes and another has not started yet. What you spent has come back.',
    })
  }

  return { entries, synopsis, dropped, world, chapters, kit, body }
}

/**
 * What the DM is told when the clock ran into a fuse.
 *
 * It is handed a move to make, not a fact to mention. The thread caught up with
 * the player; that is a hard move by definition, and the alternative — noting
 * that time passed and carrying on — is how a deadline becomes scenery.
 */
function fuseBrief(world: World, fired: readonly string[]): string {
  const names = fired
    .map(id => world.entities[id])
    .filter(entity => entity !== undefined)
    .map(entity => `${entity.name}${entity.state ? ` (${entity.state})` : ''}`)

  return [
    `Your narration has been discarded — it described time that did not happen. The player did not get the span they asked for: ${names.join('; ') || 'something they had been ignoring'} caught up with them first, and it is now ${describeClock(world.clock)}.`,
    'Narrate the whole turn again from the start, short, ending on that interruption as a hard move. Begin where they began, cover only the time that actually passed, and never mention a clock or say that less time went by than they wanted — just let the thing arrive.',
    'If the thing that caught up with them hurts them on the way in, call harm first and narrate the injury the game gives you back. This is the case that tool exists for.',
  ].join(' ')
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

/**
 * Answer a `recall`.
 *
 * Says so plainly when there is no match, because the alternative is a DM that
 * narrates a stranger as an old acquaintance and a player who is the only one
 * who notices. "Nothing" is a useful answer here — it means the thing is new,
 * and inventing it is then the right move rather than a mistake.
 */
function recallFor(world: World, input: unknown): string {
  const query = (input ?? {}) as { query?: unknown }
  const found = findEntities(world, query.query)

  if (found.length === 0) {
    return 'Nothing in the story so far matches that. It is new — invent it freely.'
  }

  return found
    .map(entity => {
      const ties = edgesFor(world, entity.id)
        .slice(0, 4)
        .map(edge => `${edge.from} ${edge.kind} ${edge.to}${edge.note ? ` (${edge.note})` : ''}`)
      return [
        `${entity.name} (${entity.id}, ${entity.kind})`,
        entity.note,
        entity.state ? `Currently: ${entity.state}` : '',
        ties.length ? `Ties: ${ties.join('; ')}` : '',
      ]
        .filter(Boolean)
        .join(' ')
    })
    .join('\n')
}

/**
 * Hand something over, and tell the DM what it turned out to be worth.
 *
 * The reply matters as much as the write. A model that grants a sword and is
 * told nothing will describe it as mighty; told the sword is plain and worth
 * nothing on the die, it describes a sword. That is the same loop `roll_check`
 * runs — commit first, then narrate around a number you did not choose.
 */
function grantFor(kit: Kit, world: World, input: unknown): { kit: Kit; note: string } {
  const now = world.clock.elapsed
  const raw = isPlainObject(input) ? input : {}

  const name = str(raw.name, 80).trim()
  if (!name) {
    return { kit, note: 'That did not describe a thing anyone could pick up. Nothing was added.' }
  }

  const id = slug(name)

  // Duplicate guard — same id or same normalised name
  const existing = kit.items.find(
    i => i.id === id || i.name.trim().toLowerCase() === name.toLowerCase()
  )
  if (existing) {
    return {
      kit,
      note: `${existing.name} is already in the pack. Nothing was added.`,
    }
  }

  // Roll the band from provenance — the model does not choose this
  const provenance = oneOf(raw.how, PROVENANCES, 'underfoot' as Provenance)
  const band = rollQuality(provenance, Math.random)

  // Traits: labels from model, bonuses from band
  const rawTraits = Array.isArray(raw.traits) ? raw.traits : []
  const labels = rawTraits
    .filter(isPlainObject)
    .slice(0, 2)
    .map(t => ({
      label: str(t.label, 80).trim() || name,
      applies: validateApplicability(t.applies),
    }))
    .filter(l => l.label.length > 0)

  const traits = traitsFor(band, labels)

  // Origin: looked up in the world graph; unresolvable means null
  const fromId = typeof raw.from === 'string' ? slug(raw.from) : null
  const origin = fromId && world.entities[fromId] ? fromId : null

  const consumable = bool(raw.consumable)
  const uses = boundedInt(raw.uses, 1, 9, 1)

  const item: Item = {
    id,
    name,
    note: str(raw.note, 240),
    traits,
    ...(consumable ? { charges: { now: uses, max: uses } } : {}),
    consumable,
    origin,
    gainedAt: now,
  }

  // Replace path: swap one item for another (pack never grows)
  const replaceId = typeof raw.replace === 'string' ? slug(raw.replace) : null
  if (replaceId) {
    const replaceIdx = kit.items.findIndex(i => i.id === replaceId)
    if (replaceIdx !== -1) {
      const items = [...kit.items]
      items[replaceIdx] = item
      const next = { ...kit, items }
      const worth = worthOf(item)
      return {
        kit: next,
        note: `${item.name} is theirs, in place of what they set down. ${describeQuality(band, worth)}.`,
      }
    }
    // Replace target not found — fall through to normal add
  }

  const { kit: next, added } = addItem(kit, item)

  if (!added) {
    // Pack full — list contents so the DM can name what to set down
    const contents = kit.items.map(i => `${i.id} "${i.name}"`).join(', ')
    return {
      kit,
      note: `The pack is full (${MAX_ITEMS} items). They are carrying: ${contents}. Say so in the fiction and have them choose what to put down. When they do, call grant_item again with replace set to the id of what they dropped.`,
    }
  }

  const worth = worthOf(item)
  return {
    kit: next,
    note: `${item.name} is theirs. ${describeQuality(band, worth)}.`,
  }
}

/**
 * What a spent power left lying on the table for the rest of this turn.
 *
 * Neither of these is a number and neither of them decides anything. A
 * permission becomes a +0 row on the die card — named, because the reason is
 * real even when the value is nothing (invariant 18) — and an advantage becomes
 * a flag the next matching check picks up.
 */
interface TurnPowers {
  /** `permits` powers spent this turn, as die-card rows worth nothing. */
  permissions: Modifier[]
  /**
   * `advantage` powers spent this turn and not yet claimed by a check.
   *
   * Held rather than applied because the check that matches has not happened
   * yet — and if none ever does, these are simply thrown away at the end of the
   * turn with the charges already gone. That is the point: the player spent it
   * on the wrong moment, which is a real decision, and refunding it would make
   * it a free one.
   */
  pending: { source: AdvantageSource; applies: Applicability }[]
  /** Ids spent this turn, so one power cannot be paid for once and used twice. */
  spent: Set<string>
}

/**
 * Spend a charge and report what it made available — never what it did.
 *
 * The ordering is the whole rule. The charge is gone before any check is
 * rolled and without knowing whether one will land, because a power that only
 * costs you something when it works is not a choice.
 *
 * The reply is written to stop the model treating the spend as the outcome. It
 * says what is now possible and then says, in as many words, that a roll is
 * still owed — a DM handed "you may now throw fire" and nothing else will write
 * the guard's death in the next sentence.
 */
function spendPowerFor(
  kit: Kit,
  powers: TurnPowers,
  input: unknown
): { kit: Kit; powers: TurnPowers; note: string } {
  const raw = (input ?? {}) as { id?: unknown }
  const { kit: next, power, reason } = spendPower(kit, raw.id, powers.spent)

  if (!power) return { kit, powers, note: reason }

  powers.spent.add(power.id)
  const left = `${power.charges.now} of ${power.charges.max} left`
  const effect = powerEffect(power)

  if (effect.advantage) {
    powers.pending.push(effect.advantage)
    return {
      kit: next,
      powers,
      note: `${power.name} is spent — ${left}. The next roll it bears on is made twice, keeping the better die. It changes the odds and nothing else: no number moves, and the roll can still fail. If nothing this turn is the kind of thing it helps with, the charge is gone anyway.`,
    }
  }

  if (effect.permission) powers.permissions.push(effect.permission)
  return {
    kit: next,
    powers,
    // Deliberately blunter than the other tool results. Live runs showed the DM
    // spending the charge and then narrating the result outright — fire thrown,
    // guard down, no die — which is precisely the failure this whole shape
    // exists to prevent. The usual "most turns are not checks" guidance is
    // right about most turns and wrong about this one: reaching for a power is
    // the character betting something scarce on a moment, and a bet that cannot
    // fail is not a bet.
    note: `${power.name} is spent — ${left}.${power.permits ? ` They can now ${power.permits}.` : ''} That is a permission, not a result. Do NOT narrate whether it worked. Call roll_check now, for the thing they were trying to achieve with it, at a difficulty the fiction sets — spending a charge is the character betting something scarce on a moment, and it has to be able to fail. If you narrate this without rolling, the power has decided the outcome, and it must not.`,
  }
}

/**
 * Answer a `grant_power`, and say what it turned out to be.
 *
 * Every refusal here is a thing that happens in ordinary play — the character
 * is not far enough along, the teacher was invented this turn, the trick has
 * already been granted under another name — so none of them is an error. The
 * turn continues, the DM narrates around the answer, and the player never
 * learns a tool call was rejected. That is the same contract `grant_item` has
 * for a full pack.
 *
 * The reply carries the tier and the charges for the reason `roll_check` and
 * `grant_item` carry theirs: a model told nothing about a number narrates as
 * though the number were enormous. A tier 1 power described as though it were
 * tier 3 is a sheet and a story that disagree, and the player believes the
 * story until the charges run out a scene early.
 */
function grantPowerFor(
  kit: Kit,
  world: World,
  level: number,
  turnStartedAt: number,
  input: unknown
): { kit: Kit; note: string } {
  const grant = (input ?? {}) as Record<string, unknown>
  const verdict = canGrantPower(
    kit,
    world,
    level,
    {
      id: typeof grant.id === 'string' ? grant.id : '',
      source: typeof grant.source === 'string' ? grant.source : '',
      tier: grant.tier,
    },
    turnStartedAt
  )

  if (!verdict.granted) return { kit, note: verdict.reason }

  const power = powerFromGrant(grant, verdict.tier, world.clock.elapsed)
  if (!power) {
    return { kit, note: 'That did not describe something anyone could do. Nothing was added.' }
  }

  const { kit: next, added } = addPower(kit, power)
  if (!added) {
    return { kit, note: `They cannot hold any more than the powers they already have.` }
  }

  const asked = typeof grant.tier === 'number' ? Math.round(grant.tier) : power.tier
  const lowered =
    asked > power.tier
      ? ` You asked for tier ${asked}; they are not far enough along for that yet, so this is the lesser version of it.`
      : ''

  return {
    kit: next,
    note: `${power.name} is theirs, at tier ${power.tier} of ${MAX_TIER}.${lowered} It has ${power.charges.max} ${power.charges.max === 1 ? 'charge' : 'charges'} and they come back ${power.refresh === 'rest' ? 'after a real rest' : 'once a chapter'}. Narrate it as what it is at that size — it opens a door, it does not settle anything, and they still roll.`,
  }
}

/**
 * Resolve one `roll_check` call into a transcript entry and a model briefing.
 *
 * `powers` is mutated: a pending advantage is *claimed* by the first check it
 * bears on, and claiming it has to be visible to the next check in the same
 * pass. Threading it back through a return value would work too, and would be
 * one more thing to forget at the second call site.
 */
function rollFor(
  campaign: Campaign,
  kit: Kit,
  body: Body,
  powers: TurnPowers,
  input: unknown
): { entry: CheckEntry; brief: string; body: Body } {
  const raw = (input ?? {}) as {
    attempt?: unknown
    attribute?: unknown
    skill?: unknown
    dc?: unknown
    situational?: unknown
    items?: unknown
    severity?: unknown
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
  // Kit is capped on its own, before the situational set is added, so a full
  // pack cannot eat the ±6 budget the scene is entitled to.
  modifiers.push(...kitModifiers(kit, raw.items, attribute, skill))
  modifiers.push(...situational)
  // Permissions ride along at +0 and are not clamped with the situational set,
  // because there is nothing to clamp. They are on the card so the player can
  // see *why* a thing they could not do a moment ago is suddenly a roll — the
  // same reason a +0 item trait is named (invariant 18).
  modifiers.push(...powers.permissions)

  // The first check a spent advantage bears on claims it. Anything left over at
  // the end of the turn is simply gone, charge included.
  const claimed = powers.pending.filter(entry => appliesTo(entry.applies, attribute, skill))
  if (claimed.length > 0) {
    powers.pending = powers.pending.filter(entry => !claimed.includes(entry))
  }

  const outcome = resolveCheck({ dc, modifiers, advantage: claimed.map(entry => entry.source) })

  // Read *before* `validateSeverity`, not through it. That function repairs an
  // unrecognised row to the mildest one, which is right for a garbled field and
  // catastrophic for a missing one: passing `undefined` straight through would
  // stamp `bruising` on every check in the game and turn the ordinary case —
  // no severity at all — into a slow bleed nobody chose.
  const severity = typeof raw.severity === 'string' ? validateSeverity(raw.severity) : null
  // `DEFAULT_DANGER` until the dial exists (#3777). It is passed rather than
  // defaulted inside `applyDamage` so that the day `Campaign.danger` lands, the
  // only edit is this argument.
  const change = severity ? applyDamage(body, severity, outcome.band, DEFAULT_DANGER) : null

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
    ...(outcome.twice ? { twice: outcome.twice } : {}),
  }

  const sign = outcome.margin >= 0 ? '+' : ''
  const brief = [
    outcome.twice
      ? `Rolled twice for ${outcome.twice.reason}, keeping the ${outcome.twice.direction === 'advantage' ? 'better' : 'worse'} of ${outcome.roll} and ${outcome.twice.discarded}.`
      : '',
    `Rolled ${outcome.roll} on a d20, ${outcome.modifier >= 0 ? '+' : ''}${outcome.modifier} = ${outcome.total} against DC ${outcome.dc}.`,
    `Margin ${sign}${outcome.margin}.`,
    `${BAND_LABEL[outcome.band]}. ${BAND_BRIEF[outcome.band]}`,
    // The same string the move table in the prompt was rendered from, repeated
    // at the one moment it is actually being acted on. A table read once at the
    // top of a long prompt loses to whatever the model feels like doing by the
    // time a roll comes back; the move quoted next to the number does not.
    `YOUR MOVE: ${BAND_MOVE[outcome.band]}`,
    // What the model is told about a number changes how it narrates
    // (invariant 19), and nowhere more sharply than here. A DM told a blow
    // landed but not how hard writes a maiming, because a maiming is the more
    // interesting sentence — and then the prose and the sheet describe two
    // different injuries, which is a bug no test can see.
    woundBrief(change, outcome.succeeded),
    'Narrate this outcome. Do not restate the numbers — the player can already see them.',
  ]
    .filter(Boolean)
    .join(' ')

  return { entry, brief, body: change ? change.body : body }
}

/**
 * Resolve one `harm` call.
 *
 * `already` is whether this turn has spent its one harm. The ceiling is real
 * rather than advisory, and it is enforced here instead of in the prompt
 * because the failure it prevents is not the model misunderstanding the rule —
 * it is a model that reaches for the simpler tool twice in a scene that felt
 * like it deserved it, and drains a character across a turn nobody rolled a die
 * in. A refusal is answered plainly and the turn carries on; it is a normal
 * answer, not an error, and the DM narrates the scene without the second blow.
 */
function harmFor(
  body: Body,
  already: boolean,
  input: unknown
): { body: Body; note: string; spent: boolean } {
  if (already) {
    return {
      body,
      spent: false,
      note: 'They have already been hurt once this turn, and once is the limit. Narrate what is happening to them without a second injury — a scene can be desperate without costing them twice.',
    }
  }

  const raw = (input ?? {}) as { severity?: unknown; reason?: unknown }
  // Unlike `roll_check`, severity is required here: a `harm` with no severity is
  // not a milder harm, it is a tool call with nothing in it. Repairing it to the
  // gentlest row is right — the alternative is refusing, and a refused harm on a
  // turn where the fiction has already committed to an ambush leaves the DM
  // narrating a blow the sheet never took.
  const severity = validateSeverity(raw.severity)
  const change = applyHarm(body, severity, DEFAULT_DANGER)
  const reason = typeof raw.reason === 'string' ? raw.reason.slice(0, 120) : ''

  return {
    body: change.body,
    spent: true,
    note: [
      reason ? `${reason} —` : '',
      change.died
        ? 'that killed them. The story ends here, and this is the last thing you will ever write in it. Narrate their death once, in voice, and stop — no clinging on, no help arriving.'
        : change.steps > 0
          ? `that hurt them. They are now ${CONDITION_LABEL[change.to].toLowerCase()}: ${CONDITION_PHRASE[change.to]} Narrate it at exactly that weight, no heavier.`
          : change.from === 'unhurt'
            ? 'it did not mark them. Narrate the moment without an injury.'
            : `it cost them nothing further — they are still ${CONDITION_LABEL[change.to].toLowerCase()}. Do not narrate a new wound.`,
    ]
      .filter(Boolean)
      .join(' '),
  }
}

/**
 * What the DM is told a wound actually cost, in words.
 *
 * The rung is reported and the arithmetic is not. The model named a row and is
 * handed a state; it never learns how many steps a row is worth, because a
 * model that can see the mapping can aim at it, and aiming at it is how a DM
 * that likes the protagonist arranges for them to sit one rung above dead
 * forever.
 *
 * A check the DM flagged as dangerous and then *passed* says nothing at all.
 * The character is fine, that is what passing means, and a line reading "it did
 * not hurt them" invites a paragraph about the wound they nearly took.
 */
function woundBrief(change: ReturnType<typeof applyDamage> | null, succeeded: boolean): string {
  if (!change || succeeded) return ''
  // Told plainly, and told *here*, because there is no version of this where a
  // dungeon master that has not been told writes the right paragraph. It has
  // spent the whole campaign narrating consequences it can walk back; this is
  // the one it cannot, and a model left to infer it from the word "dead" on a
  // sheet writes a wound and a rescue. The instruction is what buys the ending.
  if (change.died) {
    return 'THAT KILLED THEM. The story ends here, and this is the last thing you will ever write in it. Narrate their death — once, in the voice you have been telling this in, inside the budget. Do not leave them clinging on, do not put help on the way, and do not soften it into a wound they might survive. Close on the fiction and stop.'
  }
  if (change.steps > 0) {
    return `THAT HURT THEM. They are now ${CONDITION_LABEL[change.to].toLowerCase()}: ${CONDITION_PHRASE[change.to]} Narrate the injury at exactly that weight — not heavier because the moment deserved it, and not lighter because you would rather they were fine.`
  }
  // The blow landed on a body the table could not move: a failure whose row
  // cost nothing at this danger, or `bruising` on someone already dying, where
  // the floor holds. Said out loud because silence here reads as a success.
  if (change.from === 'unhurt') return 'It did not mark them. Do not narrate a wound.'
  return `It cost them nothing further — they are still ${CONDITION_LABEL[change.to].toLowerCase()}. Do not narrate a new wound.`
}

/**
 * The world as the DM reads it: prose, not JSON.
 *
 * Bounded by `relevanceWindow` rather than by the size of the graph, which is
 * the point — a campaign four hundred turns deep sends the same amount of world
 * as one twenty turns deep, because what it sends is the scene rather than the
 * archive. Everything outside the window stays in the campaign and is reachable
 * with `recall`.
 *
 * Rendered as sentences because the model reads them better than it reads a
 * data structure, and because a prompt full of JSON teaches it to answer in the
 * same register.
 */
function worldBlock(world: World, mentioned: readonly string[]): string {
  const { entities, edges } = relevanceWindow(world, mentioned)
  const here = currentPlace(world)

  const byId = new Map(entities.map(entity => [entity.id, entity]))
  const name = (id: string) => byId.get(id)?.name ?? id

  const people = entities
    .filter(entity => entity.kind === 'actor' && entity.id !== PLAYER_ID)
    .map(entity => `  ${entity.name} (${entity.id})${entity.state ? ` — ${entity.state}` : ''}`)

  const things = entities
    .filter(entity => entity.kind === 'place' || entity.kind === 'thing')
    .filter(entity => entity.id !== here?.id)
    .map(entity => `  ${entity.name} (${entity.id})${entity.state ? ` — ${entity.state}` : ''}`)

  const threads = entities
    .filter((entity): entity is ThreadEntity => entity.kind === 'thread')
    .map(entity => `  ${entity.name} (${entity.id}) — ${entity.pressure}`)

  const ties = edges.map(
    edge =>
      `  ${name(edge.from)} ${edge.kind} ${name(edge.to)}${edge.note ? ` — ${edge.note}` : ''}`
  )

  return [
    `TIME: ${describeClock(world.clock)}`,
    here ? `WHERE YOU ARE: ${here.name} (${here.id})${here.state ? ` — ${here.state}` : ''}` : '',
    people.length ? `WHO IS AROUND (reuse these ids):\n${people.join('\n')}` : '',
    things.length ? `WHAT IS AROUND:\n${things.join('\n')}` : '',
    ties.length ? `HOW THEY STAND:\n${ties.join('\n')}` : '',
    threads.length ? `LOOSE ENDS:\n${threads.join('\n')}` : '',
    'Anyone or anything not listed here may still exist. If the player refers to something you do not see, call recall before deciding it is new.',
  ]
    .filter(Boolean)
    .join('\n\n')
}

/**
 * The words in the player's action worth trying to match against the graph.
 *
 * Crude on purpose. It is a hint to the ranking, not a parser: the cost of a
 * false positive is one extra entity in a twenty-entity window, and the cost of
 * a false negative is the DM forgetting someone the player just named.
 */
function mentionedIn(action: string): string[] {
  return action
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(word => word.length >= 4)
    .slice(0, 24)
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
Earned skills: ${skills}${bodyBlock(campaign.body)}${windowBlock(campaign)}${powersBlock(campaign.kit)}${packBlock(campaign.kit)}`
}

/**
 * What is wrong with them, when anything is.
 *
 * Absent entirely for an unhurt character, and that is not just tidiness. A
 * standing line reading "Condition: unhurt" puts the track in front of the DM
 * on every one of the many turns where nobody is in any danger, and a model
 * shown a health bar starts looking for reasons to move it. A character who has
 * never been hurt should not be able to tell this system is here.
 *
 * The harder question is whether to show it at all, because the DM both reads
 * this and picks the severity — which is the exact pairing #3769 warns about: a
 * model that can see the rung and choose the damage will keep the protagonist
 * one step above dead. It is shown anyway, for a failure that is worse and
 * certain rather than gradual and possible. Without it the DM has no memory of
 * injury across turns, so a character bleeding out gets narrated as fine on the
 * very next line, and the track becomes a number on a sheet that the story
 * never once acknowledges — which is a longer way of saying it does not exist.
 *
 * What keeps the pairing safe is that seeing the rung buys the model no
 * arithmetic. It can pick a milder row, and that is a real risk; it cannot pick
 * a smaller number, cannot see the mapping, and cannot know the die when it
 * chooses. #3779 is what measures whether the mild-row drift actually happens.
 */
function bodyBlock(body: Body): string {
  if (body.condition === 'unhurt') return ''
  return `\nCondition: ${CONDITION_LABEL[body.condition].toLowerCase()} — ${CONDITION_PHRASE[body.condition]} Let this show in how they move and what they can face. Do not heal it, and do not forget it.`
}

/**
 * A skill that has just matured, mentioned once and left alone.
 *
 * This is the other path to a power, and the one that makes them read as a
 * story rather than as a level-up screen: you did the thing enough times.
 *
 * The wording is the entire issue. It is a **fact told to the DM**, not an
 * instruction — "if the fiction offers a moment" and "may" are load-bearing,
 * and so is the sentence saying outright that most turns should do nothing
 * with it. A model handed "something may come of it" and nothing else reads it
 * as "grant a power now", and then the power arrives because a counter said so
 * rather than because the story had anywhere to put it.
 *
 * It sits in the sheet block, above the world and the transcript, so the DM has
 * it before it decides what the turn is about rather than as a footnote it
 * reaches after the scene is already planned.
 *
 * The provenance rule gets no exception here. Twenty turns of throwing burning
 * things is not a source; the person who taught you, the thing you were
 * throwing, or the place it happened is. That is stated in the line because the
 * gate will otherwise refuse the grant and the DM will not know why.
 */
function windowBlock(campaign: Campaign): string {
  const windows = openWindows(campaign.character, campaign.world.clock.elapsed)
  if (windows.length === 0) return ''

  const named = windows.map(w => SKILLS[w.skill].name).join(', ')
  return `\nLately mastered: ${named}. They have done this enough times to be genuinely, unusually good at it, and the story has noticed. If a moment comes where that mastery turns into something they can DO — someone teaching them the last of it, a place that marks them, a thing that answers to it — take the moment and call grant_power, sourced from that person, place or thing. Do not manufacture one out of nothing. Do not mention any of this to the player.`
}

/**
 * The powers the character actually has, by id, or nothing.
 *
 * Without this `use_power` is a tool the model cannot reach: it is asked for
 * the id of a power the kit holds and never told what the kit holds. Live runs
 * bore that out exactly — a power the player named in their own message got
 * spent, because the model could guess the id from their words, and a power
 * they referred to by name got ignored every single time.
 *
 * Charges are shown because "you have this" and "you have this, twice more" are
 * different pieces of advice, and a DM that cannot see the counter will reach
 * for a spent power and have to be refused.
 *
 * Nothing is printed when there are no powers. The prompt is the DM's version
 * of the sheet, and invariant 17 applies to it for the same reason it applies
 * to the player's: a heading with nothing under it is an invitation to invent
 * something to put there.
 */
function powersBlock(kit: Kit): string {
  if (kit.powers.length === 0) return ''

  const lines = kit.powers.map(power => {
    const what =
      power.shape === 'permits'
        ? `lets them ${power.permits || 'do something they otherwise could not'}`
        : 'makes one roll it bears on come up twice, keeping the better die'
    const spent = power.charges.now <= 0 ? ' — SPENT, they cannot use this now' : ''
    return `  ${power.id} "${power.name}" — ${what}. ${power.charges.now}/${power.charges.max} charges${spent}.`
  })

  return `\nThings they can do (call use_power with the id, and they still roll afterwards):\n${lines.join('\n')}`
}

/**
 * What the character is carrying, shown to the DM so it can name items in roll_check.
 *
 * Trait labels are shown; their numbers are not. A DM shown "+2" narrates around
 * the +2; one shown "the edge is sharp" narrates around a knife.
 */
function packBlock(kit: Kit): string {
  const lines: string[] = []

  if (kit.species) {
    const { name, note, trait, drawback } = kit.species
    lines.push(
      `\nSpecies: ${name} — ${note}. ${trait.label} (upside). ${drawback.label} (drawback — applies automatically, always).`
    )
  }

  if (kit.items.length === 0) return lines.join('')

  const itemLines = kit.items.map(item => {
    const traitList = item.traits.map(t => t.label).join(', ')
    const traitsStr = traitList ? ` — ${traitList}` : ''
    const charges = item.charges ? ` (${item.charges.now}/${item.charges.max} uses)` : ''
    return `  ${item.id} "${item.name}"${charges}${traitsStr}`
  })

  lines.push(
    `\nThey are carrying (name the id in roll_check's items when it genuinely applies — the game decides what it is worth):\n${itemLines.join('\n')}`
  )

  return lines.join('')
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

const ReconcileSchema = z.object({
  touch: z
    .array(
      z.object({
        id: z.string().describe('Stable lowercase slug.'),
        kind: z.enum(ENTITY_KINDS as unknown as [EntityKind, ...EntityKind[]]),
        name: z.string(),
        note: z.string().optional(),
        state: z.string().optional().describe('How it stands at the END of this stretch.'),
      })
    )
    .max(RECONCILE_TOUCH)
    .optional(),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        kind: z.enum(EDGE_KINDS as unknown as [EdgeKind, ...EdgeKind[]]),
        note: z.string().optional(),
      })
    )
    .max(RECONCILE_EDGES)
    .optional(),
})

/**
 * Rebuild the graph from the prose, then tidy what is left.
 *
 * The DM maintains the index in passing, two or three entities at a time, while
 * doing something else. It drifts — people get named and never registered,
 * relationships get described and never drawn — and that drift is the price of
 * not making it run a simulation every turn. This is where the price is paid,
 * inside `condense`, because that is the one moment the game has already
 * accepted a slow call and the player is already waiting.
 *
 * The transcript is the authority here, not the graph. That is the whole
 * premise: the index is rebuilt from the story, never the other way round.
 *
 * A failure is survivable by construction. The caller keeps the previous world
 * and the turn proceeds, which reads as a DM whose notes are slightly behind —
 * exactly how a failed `condense` already reads.
 */
async function reconcile(
  apiKey: string,
  campaign: Campaign,
  older: TranscriptEntry[],
  signal: AbortSignal
): Promise<World> {
  const now = campaign.world.clock.elapsed

  try {
    const input = (await callForTool({
      apiKey,
      model: UTILITY_MODEL,
      system: `You keep the table's index. You are given a stretch of play and the entities already on file, and you list what the story actually contains: the people, places, things and loose ends that matter, and how they are connected.

Reuse an existing id whenever the story means the same thing — matching an id is the entire point, and a second id for the same person is worse than a missing one. Invent an id only for something genuinely absent from the file. Use lowercase-hyphenated ids.

Register only what the story would notice going missing. A tavern the player slept in once is worth keeping; the bowl they ate from is not. Describe state as it stands at the END of this stretch, not as it was in the middle.`,
      maxTokens: 2000,
      signal,
      messages: [
        {
          role: 'user',
          content: `ALREADY ON FILE:
${
  Object.values(campaign.world.entities)
    .map(entity => `  ${entity.id} (${entity.kind}) — ${entity.name}`)
    .join('\n') || '  nothing yet'
}

THE STRETCH OF PLAY:
${transcriptBlock(older)}`,
        },
      ],
      tool: {
        name: 'index_world',
        description: 'Record what this stretch of story contains.',
        input_schema: toolSchema(ReconcileSchema),
      },
    })) as Record<string, unknown>

    // Applied through the same path a turn's deltas take, so reconciliation
    // cannot write anything a turn could not have written. `elapsed: 0` because
    // this is bookkeeping about time that has already passed — advancing the
    // clock here would move the story forward for having tidied its notes.
    const { world } = applyWorldDelta(
      campaign.world,
      { elapsed: 0, touch: input.touch, edges: input.edges },
      { touch: RECONCILE_TOUCH, edges: RECONCILE_EDGES }
    )
    return reconcileWorld(world, now)
  } catch (error) {
    console.error('dicebound reconcile failed:', error)
    // Still worth the pure pass: dormancy and cold threads need no model.
    return reconcileWorld(campaign.world, now)
  }
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
const NameClassSchema = z.object({
  name: z
    .string()
    .describe(
      'Two or three words at most, the way people at a table would refer to this person. Not a job title and not a fantasy-game class. "Cat Burglar", "Ropewalker", "The One Who Asks".'
    ),
  note: z
    .string()
    .describe(
      'One short line saying what they are, in the second person. No numbers, no mechanics.'
    ),
})

const NAME_CLASS: ToolDef = {
  name: 'name_class',
  description: 'Give the character the name for what they have turned out to be.',
  input_schema: toolSchema(NameClassSchema),
}

/**
 * Put a name on what the player has already been doing.
 *
 * Code has done the reading: which skills, how often, which attributes
 * underneath, and whether that is narrow or broad. All the model does is name
 * it, and it is told not to invent mechanics because a class that carries a
 * bonus is a class the player starts steering toward instead of playing the
 * character.
 *
 * Never throws. A failed call falls back to a table, because play does not
 * block on a model call (invariant 16) and a character told the cave could not
 * form an opinion about them is worse off than one called a Wayfarer.
 */
async function nameClass(
  apiKey: string,
  campaign: Campaign,
  shape: ClassShape,
  signal: AbortSignal
): Promise<{ name: string; note: string }> {
  const doing = shape.skills
    .map(entry => `${SKILLS[entry.skill].name} (${entry.uses} times)`)
    .join(', ')
  const under = shape.attributes.map(id => ATTRIBUTES[id].name).join(', ')

  try {
    const input = await callForTool({
      apiKey,
      model: UTILITY_MODEL,
      tool: NAME_CLASS,
      maxTokens: 400,
      signal,
      system:
        'You name people by what they have been doing. You are given a character and a tally of what they actually spent their time on, and you return the name a person at the table would use for them. Do not invent abilities, bonuses, numbers or mechanics of any kind — you are describing what somebody already is, not granting them anything. Avoid stock fantasy classes: no Fighter, Rogue, Wizard, Cleric, Ranger, Bard.',
      messages: [
        {
          role: 'user',
          content: `${campaign.character.name} — ${campaign.character.concept}
Story: "${campaign.premise}"

What they have actually been doing, most first: ${doing}
Which sits under: ${under}
Their play is ${shape.narrow ? 'narrow — they keep returning to the same few things' : 'broad — they range across a lot of different things'}.

Name what they have turned out to be.`,
        },
      ],
    })

    return readClass(input) ?? fallbackClass(shape)
  } catch (error) {
    // Logged rather than swallowed: unlike a save, this one is recoverable and
    // the player still gets a name, but a generator that has quietly stopped
    // working should be visible to whoever looks.
    console.error('dicebound class naming failed:', error)
    return fallbackClass(shape)
  }
}

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
