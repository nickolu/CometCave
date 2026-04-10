import { Spell } from '@/app/tap-tap-adventure/models/spell'

export const STARTING_SPELLS: Record<string, Spell> = {
  mage: {
    id: 'starting-spell-mage-arcane-bolt',
    name: 'Arcane Bolt',
    description: 'A focused bolt of arcane energy that strikes an enemy and builds combo momentum.',
    school: 'arcane',
    manaCost: 5,
    cooldown: 0,
    target: 'enemy',
    effects: [
      { type: 'damage', value: 10, element: 'arcane' },
      { type: 'combo_boost', value: 1 },
    ],
    tags: ['arcane', 'ranged'],
  },
  ranger: {
    id: 'starting-spell-ranger-natures-mend',
    name: "Nature's Mend",
    description: 'A soothing natural magic that heals over time, doubling in power when wounded.',
    school: 'nature',
    manaCost: 4,
    cooldown: 2,
    target: 'self',
    effects: [
      { type: 'heal_over_time', value: 3, duration: 3 },
    ],
    conditions: [
      { when: 'caster_hp_below_30', bonus: 'double_heal' },
    ],
    tags: ['nature', 'heal'],
  },
  rogue: {
    id: 'starting-spell-rogue-shadow-step',
    name: 'Shadow Step',
    description: 'Meld with the shadows to sharpen your blade and strike with deadly precision.',
    school: 'shadow',
    manaCost: 5,
    cooldown: 2,
    target: 'self',
    effects: [
      { type: 'buff', value: 4, stat: 'attack', duration: 1 },
      { type: 'combo_boost', value: 2 },
    ],
    tags: ['shadow', 'melee'],
  },
  warrior: {
    id: 'starting-spell-warrior-iron-skin',
    name: 'Iron Skin',
    description: 'Harden your body like iron, reducing damage and cleansing harmful effects.',
    school: 'war',
    manaCost: 6,
    cooldown: 3,
    target: 'self',
    effects: [
      { type: 'damage_reduction', value: 0, percentage: 40, duration: 2 },
      { type: 'cleanse', value: 0 },
    ],
    tags: ['war', 'defense'],
  },
}

export function getStartingSpell(className: string): Spell | undefined {
  return STARTING_SPELLS[className.toLowerCase()]
}
