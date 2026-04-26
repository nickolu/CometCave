import { Spell } from '@/app/tap-tap-adventure/models/spell'

/**
 * Hardcoded "complex" spells — dual-use spells with both combat effects and
 * duration-based exploration effects. These are delivered through the spell
 * generator at higher levels or via other acquisition mechanics.
 */
export const COMPLEX_SPELLS: Spell[] = [
  {
    id: 'complex-charm-person',
    name: 'Charm Person',
    description: 'A subtle arcane enchantment that bends the will of others.',
    school: 'arcane',
    manaCost: 10,
    cooldown: 2,
    target: 'enemy',
    effects: [
      { type: 'stun', value: 1, duration: 1 },
    ],
    tags: ['arcane', 'crowd_control', 'social'],
    explorationEffect: {
      type: 'cha_boost',
      value: 5,
      description: 'Boosts your charisma by 5 for NPC interactions (150 steps).',
      duration: 150,
    },
    explorationManaCost: 8,
  },
  {
    id: 'complex-flight',
    name: 'Flight',
    description: 'Arcane winds lift you aloft, granting aerial mobility.',
    school: 'arcane',
    manaCost: 12,
    cooldown: 2,
    target: 'self',
    effects: [
      { type: 'buff', value: 2, stat: 'defense', duration: 2 },
    ],
    tags: ['arcane', 'buff', 'mobility'],
    explorationEffect: {
      type: 'faster_travel',
      value: 2,
      description: 'Doubles your travel speed for 50 steps.',
      duration: 50,
    },
    explorationManaCost: 12,
  },
  {
    id: 'complex-polymorph',
    name: 'Polymorph',
    description: 'Transforms the target, suppressing their natural abilities.',
    school: 'nature',
    manaCost: 14,
    cooldown: 3,
    target: 'enemy',
    effects: [
      { type: 'debuff', value: 3, stat: 'attack', duration: 2 },
    ],
    tags: ['nature', 'debuff', 'transform'],
    explorationEffect: {
      type: 'disguise',
      value: 1,
      description: 'Disguises you as a harmless creature for 100 steps.',
      duration: 100,
    },
    explorationManaCost: 10,
  },
  {
    id: 'complex-speak-with-animals',
    name: 'Speak with Animals',
    description: 'You commune with beasts, understanding their primal language.',
    school: 'nature',
    manaCost: 8,
    cooldown: 1,
    target: 'enemy',
    effects: [
      { type: 'stun', value: 1, duration: 1 },
    ],
    tags: ['nature', 'crowd_control', 'beast'],
    explorationEffect: {
      type: 'animal_affinity',
      value: 30,
      description: 'Grants affinity with animals, granting a 30% chance to avoid beast encounters for 150 steps.',
      duration: 150,
    },
    explorationManaCost: 6,
  },
  {
    id: 'complex-invisibility',
    name: 'Invisibility',
    description: 'Cloaks you in shadow, striking before enemies can react.',
    school: 'shadow',
    manaCost: 10,
    cooldown: 2,
    target: 'self',
    effects: [
      { type: 'buff', value: 3, stat: 'attack', duration: 1 },
    ],
    tags: ['shadow', 'buff', 'stealth'],
    explorationEffect: {
      type: 'auto_stealth',
      value: 1,
      description: 'Renders you invisible for 30 steps, automatically avoiding random encounters.',
      duration: 30,
    },
    explorationManaCost: 10,
  },
  {
    id: 'complex-detect-magic',
    name: 'Detect Magic',
    description: 'Reveals magical auras, exposing enemy vulnerabilities.',
    school: 'arcane',
    manaCost: 8,
    cooldown: 1,
    target: 'enemy',
    effects: [
      { type: 'debuff', value: 2, stat: 'defense', duration: 2 },
    ],
    tags: ['arcane', 'debuff', 'utility'],
    explorationEffect: {
      type: 'see_weaknesses',
      value: 1,
      description: 'Reveals the weaknesses of nearby enemies and landmarks for 100 steps.',
      duration: 100,
    },
    explorationManaCost: 5,
  },
  {
    id: 'complex-teleport',
    name: 'Teleport',
    description: 'Instantly translocates you across vast distances.',
    school: 'arcane',
    manaCost: 20,
    cooldown: 0,
    target: 'self',
    effects: [],
    tags: ['arcane', 'mobility', 'instant'],
    explorationEffect: {
      type: 'instant_travel',
      value: 20,
      description: 'Instantly advances you 20 km toward your destination.',
    },
    explorationManaCost: 15,
  },
  {
    id: 'complex-summon-familiar',
    name: 'Summon Familiar',
    description: 'Calls forth a magical familiar that fights and scouts for you.',
    school: 'arcane',
    manaCost: 14,
    cooldown: 2,
    target: 'enemy',
    effects: [
      { type: 'damage', value: 10, element: 'arcane' },
    ],
    tags: ['arcane', 'summon', 'intelligence'],
    explorationEffect: {
      type: 'scouting',
      value: 1,
      description: 'Your familiar scouts ahead for 100 steps, revealing upcoming landmarks.',
      duration: 100,
    },
    explorationManaCost: 14,
  },
]

export function getComplexSpellById(id: string): Spell | undefined {
  return COMPLEX_SPELLS.find(s => s.id === id)
}
