/**
 * The character sheet's vocabulary.
 *
 * Eight attributes, each with a handful of skills beneath it. The split matters:
 * attributes are chosen once, at creation, from a sentence the player writes.
 * Skills are *earned* — they do not exist on a new sheet at all, and appear only
 * after the dungeon master has leaned on them enough times to make them real.
 *
 * That is the whole progression system, and it is why this file is a table
 * rather than a class hierarchy. The DM model is handed these ids as tool
 * enums, the resolver looks up ranks by id, and the sheet renders the tree —
 * three consumers, one source. Adding a skill is one line here and it is
 * immediately rollable, earnable and displayable.
 *
 * Ids are stable and stored in save data. Rename a `name`, never an `id`.
 */

export const ATTRIBUTE_IDS = [
  'intellect',
  'wisdom',
  'strength',
  'dexterity',
  'constitution',
  'charm',
  'power',
  'beauty',
] as const

export type AttributeId = (typeof ATTRIBUTE_IDS)[number]

export type AttributeGroup = 'Mental' | 'Physical' | 'Social'

interface Attribute {
  id: AttributeId
  name: string
  group: AttributeGroup
  /** Shown on the sheet, and given to the DM so it calls the right one. */
  blurb: string
}

export const ATTRIBUTES: Record<AttributeId, Attribute> = {
  intellect: {
    id: 'intellect',
    name: 'Intellect',
    group: 'Mental',
    blurb: 'Reasoning, learning, and knowing things on purpose',
  },
  wisdom: {
    id: 'wisdom',
    name: 'Wisdom',
    group: 'Mental',
    blurb: 'Noticing, waiting, reading a situation, living off the land',
  },
  strength: {
    id: 'strength',
    name: 'Strength',
    group: 'Physical',
    blurb: 'Lifting, hauling, hitting, and not stopping',
  },
  dexterity: {
    id: 'dexterity',
    name: 'Dexterity',
    group: 'Physical',
    blurb: 'Precision, balance, quickness, and clever hands',
  },
  constitution: {
    id: 'constitution',
    name: 'Constitution',
    group: 'Physical',
    blurb: 'Bulk, guts, and the ability to keep taking it',
  },
  charm: {
    id: 'charm',
    name: 'Charm',
    group: 'Social',
    blurb: 'Being liked, being funny, being unremarkable when useful',
  },
  power: {
    id: 'power',
    name: 'Power',
    group: 'Social',
    blurb: 'Leverage — influence, pressure, and the hard bargain',
  },
  beauty: {
    id: 'beauty',
    name: 'Beauty',
    group: 'Social',
    blurb: 'Presence, presentation, and control of your own face',
  },
}

export const ATTRIBUTE_GROUPS: readonly AttributeGroup[] = ['Mental', 'Physical', 'Social']

export const SKILL_IDS = [
  // Intellect
  'insight',
  'problem-solving',
  'mathematics',
  'science-and-nature',
  'language-and-writing',
  'chemistry',
  'engineering',
  'medicine',
  // Wisdom
  'observation',
  'patience',
  'self-control',
  'intuition',
  'fishing',
  'hunting-and-trapping',
  'survival-crafting',
  'navigation',
  'nature-lore',
  // Strength
  'upper-body',
  'lower-body',
  'throwing',
  'jumping',
  'endurance',
  'burst',
  // Dexterity
  'body-control',
  'hand-eye',
  'balance',
  'quickness',
  // Constitution
  'size',
  'stomach',
  'resolve',
  // Charm
  'society',
  'blending',
  'rapport',
  'humor',
  // Power
  'influence',
  'intimidation',
  'bargaining',
  // Beauty
  'looks',
  'fashion',
  'face-control',
] as const

export type SkillId = (typeof SKILL_IDS)[number]

interface Skill {
  id: SkillId
  name: string
  attribute: AttributeId
  /**
   * Innate skills describe what you *are*, not what you have practised, so
   * repetition can never grant them. They are set once at creation from the
   * player's own sentence and then never move — a character does not train
   * their way into being large, and pretending otherwise would make the earned
   * ranks elsewhere feel arbitrary.
   */
  innate?: true
}

export const SKILLS: Record<SkillId, Skill> = {
  insight: { id: 'insight', name: 'Insight', attribute: 'intellect' },
  'problem-solving': { id: 'problem-solving', name: 'Problem Solving', attribute: 'intellect' },
  mathematics: { id: 'mathematics', name: 'Mathematics', attribute: 'intellect' },
  'science-and-nature': {
    id: 'science-and-nature',
    name: 'Science & Nature',
    attribute: 'intellect',
  },
  'language-and-writing': {
    id: 'language-and-writing',
    name: 'Language & Writing',
    attribute: 'intellect',
  },
  chemistry: { id: 'chemistry', name: 'Chemistry', attribute: 'intellect' },
  engineering: { id: 'engineering', name: 'Engineering', attribute: 'intellect' },
  medicine: { id: 'medicine', name: 'Medicine & Biology', attribute: 'intellect' },

  observation: { id: 'observation', name: 'Observation', attribute: 'wisdom' },
  patience: { id: 'patience', name: 'Patience', attribute: 'wisdom' },
  'self-control': { id: 'self-control', name: 'Self Control', attribute: 'wisdom' },
  intuition: { id: 'intuition', name: 'Intuition', attribute: 'wisdom' },
  fishing: { id: 'fishing', name: 'Fishing', attribute: 'wisdom' },
  'hunting-and-trapping': {
    id: 'hunting-and-trapping',
    name: 'Hunting & Trapping',
    attribute: 'wisdom',
  },
  'survival-crafting': { id: 'survival-crafting', name: 'Survival Crafting', attribute: 'wisdom' },
  navigation: { id: 'navigation', name: 'Navigating', attribute: 'wisdom' },
  'nature-lore': { id: 'nature-lore', name: 'Nature', attribute: 'wisdom' },

  'upper-body': { id: 'upper-body', name: 'Upper Body', attribute: 'strength' },
  'lower-body': { id: 'lower-body', name: 'Lower Body', attribute: 'strength' },
  throwing: { id: 'throwing', name: 'Throwing', attribute: 'strength' },
  jumping: { id: 'jumping', name: 'Jumping', attribute: 'strength' },
  endurance: { id: 'endurance', name: 'Endurance', attribute: 'strength' },
  burst: { id: 'burst', name: 'Burst', attribute: 'strength' },

  'body-control': { id: 'body-control', name: 'Body Control', attribute: 'dexterity' },
  'hand-eye': { id: 'hand-eye', name: 'Hand/Eye Coordination', attribute: 'dexterity' },
  balance: { id: 'balance', name: 'Balance', attribute: 'dexterity' },
  quickness: { id: 'quickness', name: 'Quickness', attribute: 'dexterity' },

  size: { id: 'size', name: 'Size', attribute: 'constitution', innate: true },
  stomach: { id: 'stomach', name: 'Stomach', attribute: 'constitution' },
  resolve: { id: 'resolve', name: 'Resolve', attribute: 'constitution' },

  society: { id: 'society', name: 'Society', attribute: 'charm' },
  blending: { id: 'blending', name: 'Blending', attribute: 'charm' },
  rapport: { id: 'rapport', name: 'Rapport', attribute: 'charm' },
  humor: { id: 'humor', name: 'Humor', attribute: 'charm' },

  influence: { id: 'influence', name: 'Influence', attribute: 'power' },
  intimidation: { id: 'intimidation', name: 'Intimidation', attribute: 'power' },
  bargaining: { id: 'bargaining', name: 'Bargaining', attribute: 'power' },

  looks: { id: 'looks', name: 'Looks', attribute: 'beauty', innate: true },
  fashion: { id: 'fashion', name: 'Fashion', attribute: 'beauty' },
  'face-control': { id: 'face-control', name: 'Face Control', attribute: 'beauty' },
}

/** Skill ids under one attribute, in table order. */
export function skillsOf(attribute: AttributeId): Skill[] {
  return SKILL_IDS.map(id => SKILLS[id]).filter(s => s.attribute === attribute)
}

/**
 * The skill that may add its rank to a check on `attribute`, or null.
 *
 * A skill only counts when it actually sits beneath the attribute being
 * tested. Without this, a model naming a mismatched pair — Engineering on a
 * Strength check to climb a fence — would quietly stack an unrelated earned
 * rank onto the roll, and a player who noticed would be right to stop trusting
 * the die card. Mismatches are dropped rather than rejected: the check still
 * happens, it just runs on the attribute alone.
 */
export function applicableSkill(attribute: AttributeId, skill: unknown): SkillId | null {
  if (!isSkillId(skill)) return null
  return SKILLS[skill].attribute === attribute ? skill : null
}

export function isAttributeId(value: unknown): value is AttributeId {
  return typeof value === 'string' && (ATTRIBUTE_IDS as readonly string[]).includes(value)
}

export function isSkillId(value: unknown): value is SkillId {
  return typeof value === 'string' && (SKILL_IDS as readonly string[]).includes(value)
}
