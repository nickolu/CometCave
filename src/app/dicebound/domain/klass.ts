/**
 * The name for what the player already is.
 *
 * Chosen classes fight what makes this game good. "Pick Fighter or Wizard"
 * turns the first screen into a menu, and it replaces a record of what you did
 * with a prescription about what you will do. So nobody picks: at level 2 the
 * game reads the skill-use histogram, notices what the player has actually been
 * doing, and the model puts a name on it. You did not choose Cat Burglar. You
 * kept picking locks, and the cave formed an opinion.
 *
 * The split is the same one everything else in here runs on. **Code computes
 * the shape** — which skills, how often, which attributes underneath, and
 * whether the spread is narrow or broad. **The model returns a name and a
 * line.** Nothing numeric is read back, because there is no number here it
 * could propose that anyone wants: a class in this game is a description, and
 * the moment it carries a bonus it becomes a thing to optimise for, and the
 * player starts steering toward the class instead of playing the character.
 *
 * Everything is pure. The model call lives in the route.
 */
import { ATTRIBUTES, type AttributeId, SKILLS, type SkillId } from './attributes'
import { isPlainObject, str } from './validate'

import type { Character } from './character'
import type { Kit } from './kit'

/** Level at which the cave has seen enough to have an opinion. */
export const CLASS_AT_LEVEL = 2

/** How many skills the shape is read from. */
export const CLASS_SKILLS = 3

/**
 * Share of all use that has to sit in the top skills for play to read as
 * narrow.
 *
 * Two thirds. A player who has spent two of every three checks on the same
 * handful of things is recognisably doing one thing; below that they are
 * ranging, and a name that claims a speciality would be describing somebody
 * else. The number exists so "narrow or broad" is decided by the histogram
 * rather than by whatever the model feels about the list it was handed.
 */
export const NARROW_SHARE = 2 / 3

export interface ClassShape {
  /** Most-used first, and only skills that have actually been used. */
  skills: { skill: SkillId; uses: number }[]
  /** The attributes beneath those skills, most represented first. */
  attributes: AttributeId[]
  /** True when play has concentrated rather than ranged. */
  narrow: boolean
  /** Every use counted, across every skill. */
  total: number
}

/**
 * Read what the character has been doing, from uses rather than from ranks.
 *
 * Uses, deliberately. A rank is a threshold that has been crossed and it
 * flattens everything above it — a skill used forty times and one used
 * eighteen are both rank 3 and are not the same character. The histogram is
 * the record; the ranks are a summary of it.
 *
 * Seeded starting skills are counted here even though they do not count toward
 * level. They are three uses each and they came from the player's own sentence,
 * so they are a real if small statement about who this person is — and unlike
 * level, a name is not something they can be handed too early: this only runs
 * once real play has produced enough ranks to reach level 2.
 */
export function classShape(character: Character): ClassShape {
  const used = Object.entries(character.skills)
    .map(([skill, record]) => ({ skill: skill as SkillId, uses: record?.uses ?? 0 }))
    .filter(entry => entry.uses > 0)
    .sort((a, b) => b.uses - a.uses || SKILLS[a.skill].name.localeCompare(SKILLS[b.skill].name))

  const total = used.reduce((sum, entry) => sum + entry.uses, 0)
  const skills = used.slice(0, CLASS_SKILLS)
  const top = skills.reduce((sum, entry) => sum + entry.uses, 0)

  // Attributes ranked by how much use sits under them, not by how many skills
  // they own — one skill used constantly says more about a character than three
  // used once each.
  const weight = new Map<AttributeId, number>()
  for (const entry of skills) {
    const attribute = SKILLS[entry.skill].attribute
    weight.set(attribute, (weight.get(attribute) ?? 0) + entry.uses)
  }

  return {
    skills,
    attributes: [...weight.entries()]
      .sort((a, b) => b[1] - a[1] || ATTRIBUTES[a[0]].name.localeCompare(ATTRIBUTES[b[0]].name))
      .map(([attribute]) => attribute),
    // A character with no history at all is not narrow, they are unwritten.
    narrow: total > 0 && top / total >= NARROW_SHARE,
    total,
  }
}

/**
 * Names for when the model cannot be reached.
 *
 * Play never blocks on a model call (invariant 16), and that includes this: a
 * character told the cave could not form an opinion about them is worse off
 * than one called a Wayfarer. Keyed on the attribute the play sits under, with
 * a second name for a character who has ranged rather than specialised —
 * breadth is a kind of identity too, and calling a generalist by a specialist's
 * name is the one way this fallback could actually be wrong.
 */
export const FALLBACK_CLASSES: Record<AttributeId, { narrow: string; broad: string }> = {
  intellect: { narrow: 'Reckoner', broad: 'Polymath' },
  wisdom: { narrow: 'Watcher', broad: 'Wanderer' },
  strength: { narrow: 'Bulwark', broad: 'Labourer' },
  dexterity: { narrow: 'Threadneedle', broad: 'Rooftopper' },
  constitution: { narrow: 'Enduring', broad: 'Long-Walker' },
  charm: { narrow: 'Smooth Tongue', broad: 'Company-Keeper' },
  power: { narrow: 'Kindler', broad: 'Strange One' },
  beauty: { narrow: 'Striking', broad: 'Well-Met' },
}

export function fallbackClass(shape: ClassShape): { name: string; note: string } {
  const attribute = shape.attributes[0]
  // No history at all should not be possible here — the level gate means play
  // has happened — but a name is owed either way rather than an empty string.
  const table = attribute ? FALLBACK_CLASSES[attribute] : FALLBACK_CLASSES.wisdom
  const name = shape.narrow ? table.narrow : table.broad

  const doing = shape.skills.map(entry => SKILLS[entry.skill].name.toLowerCase())
  return {
    name,
    note: doing.length
      ? `What you keep coming back to: ${doing.join(', ')}.`
      : 'What you are is still being decided by what you do.',
  }
}

/**
 * Read a name and a line out of a model response, and nothing else.
 *
 * Anything numeric is **discarded rather than clamped**. Clamping is what you
 * do to a number you wanted; this is a number nobody asked for, and keeping a
 * clamped version of it would be the first step toward a class that modifies
 * something. Returns null when there is no usable name, so the caller falls
 * back rather than storing an empty string.
 */
export function readClass(value: unknown): { name: string; note: string } | null {
  if (!isPlainObject(value)) return null

  const name = str(value.name, 40).trim()
  if (!name) return null

  return { name, note: str(value.note, 200).trim() }
}

/**
 * Should the cave name this character now?
 *
 * A predicate rather than an `if` in the route, because the once-ness is the
 * whole rule and it deserves somewhere a test can point at. `className === null`
 * is all of it: nothing re-reads the histogram at level 3, and a class is not
 * re-rolled every time the character grows.
 *
 * Whether a class should ever be revisited is a real question and a separate
 * decision. It is left open on purpose — this must not settle it quietly by
 * being idempotent-by-accident.
 */
export function shouldNameClass(kit: Kit, level: number): boolean {
  return kit.className === null && level >= CLASS_AT_LEVEL
}
