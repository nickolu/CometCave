import { OpenAI } from 'openai'
import { z } from 'zod'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatEnemy, CombatEnemySchema } from '@/app/tap-tap-adventure/models/combat'

import { getReputationTier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'
import { generateSpellForLevel } from './spellGenerator'

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const combatResponseSchema = z.object({
  enemy: CombatEnemySchema,
  scenario: z.string(),
})

const enemySchemaForOpenAI = {
  type: 'object',
  properties: {
    enemy: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        hp: { type: 'number' },
        maxHp: { type: 'number' },
        attack: { type: 'number' },
        defense: { type: 'number' },
        level: { type: 'number' },
        goldReward: { type: 'number' },
        lootTable: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              description: { type: 'string' },
              quantity: { type: 'number' },
              type: { type: 'string', enum: ['consumable', 'equipment', 'quest', 'misc'] },
              effects: {
                type: 'object',
                properties: {
                  gold: { type: 'number' },
                  reputation: { type: 'number' },
                  strength: { type: 'number' },
                  intelligence: { type: 'number' },
                  luck: { type: 'number' },
                  heal: { type: 'number', description: 'Directly restores this amount of HP. Use for healing items instead of strength.' },
                },
              },
            },
            required: ['id', 'name', 'description', 'quantity'],
          },
        },
        specialAbility: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
            damage: { type: 'number' },
            cooldown: { type: 'number' },
          },
          required: ['name', 'description', 'damage', 'cooldown'],
        },
        statusAbility: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['poison', 'burn', 'slow', 'curse', 'fear'] },
            value: { type: 'number' },
            duration: { type: 'number' },
            chance: { type: 'number' },
          },
          required: ['type', 'value', 'duration', 'chance'],
        },
        element: {
          type: 'string',
          enum: ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane', 'none'],
          description: 'The elemental affinity of the enemy. Determines weaknesses/resistances in combat.',
        },
      },
      required: [
        'id',
        'name',
        'description',
        'hp',
        'maxHp',
        'attack',
        'defense',
        'level',
        'goldReward',
      ],
    },
    scenario: { type: 'string' },
  },
  required: ['enemy', 'scenario'],
}

export async function generateCombatEncounter(
  character: FantasyCharacter,
  context: string
): Promise<{ enemy: CombatEnemy; scenario: string }> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate a combat encounter for this fantasy character. Create an enemy appropriate for the character's level with a vivid scenario description.

Region context: Generate an enemy appropriate for the ${getRegion(character.currentRegion ?? 'green_meadows').name} region. Common enemy types: ${getRegion(character.currentRegion ?? 'green_meadows').enemyTypes.join(', ') || 'none'}. Dominant element: ${getRegion(character.currentRegion ?? 'green_meadows').element}. Setting: ${getRegion(character.currentRegion ?? 'green_meadows').theme}.

Stat guidelines for a level ${character.level} character:
- Enemy HP: ${35 + character.level * 15} (±20%)
- Enemy attack: ${6 + character.level * 3} (±20%)
- Enemy defense: ${2 + character.level} (±20%)
- Gold reward: ${5 + character.level * 5}
- Include 1-2 loot items (potions, scrolls, gems, etc.). For healing items, use the 'heal' effect (e.g., heal: 15 restores 15 HP). The 'strength' effect permanently increases the strength stat.
- Optionally include a special ability with cooldown of 2-4 turns
- Some enemies can inflict status effects (poison, burn, slow, curse, fear). Include a statusAbility field with type, value (damage per turn or effect strength), duration (2-4 turns), and chance (0-1 probability of inflicting)
- Assign an element to the enemy (fire, ice, lightning, shadow, nature, arcane, or none). Choose an element that fits the enemy's theme. For example: wolves = nature, fire elementals = fire, undead = shadow, golems = none.

Reputation context: This character's reputation is ${character.reputation} (${getReputationTier(character.reputation)}).
${character.reputation >= 50 ? 'High reputation: the enemy might offer to surrender or parley before fighting. Consider less aggressive enemies like misguided guards or territorial creatures rather than outright villains.' : ''}${character.reputation <= -20 ? 'Low reputation: enemies are more aggressive. Consider bounty hunters, rival adventurers seeking the bounty on this character, or vengeful NPCs.' : ''}

Character:
${JSON.stringify(character, null, 2)}

Context:
${context || 'A wandering adventurer encounters danger on the road.'}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_combat',
            description: 'Generate a combat encounter with an enemy and scenario.',
            parameters: enemySchemaForOpenAI,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generate_combat' } },
      temperature: 0.8,
      max_tokens: 800,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_combat') {
      const parsed = JSON.parse(toolCall.function.arguments)
      const validated = combatResponseSchema.parse(parsed)

      // Post-process loot items
      if (validated.enemy.lootTable) {
        validated.enemy.lootTable = validated.enemy.lootTable.map(inferItemTypeAndEffects)
      }

      return validated
    }

    throw new Error('No tool call in response')
  } catch (err) {
    console.error('Combat generation failed, using fallback', err)
    return getDefaultCombatEncounter(character)
  }
}

export async function generateBossEncounter(
  character: FantasyCharacter,
  context: string
): Promise<{ enemy: CombatEnemy; scenario: string }> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate a BOSS combat encounter for this fantasy character. This is a major battle — the boss should be powerful, intimidating, and memorable.

Region context: This boss guards the ${getRegion(character.currentRegion ?? 'green_meadows').name}. Theme: ${getRegion(character.currentRegion ?? 'green_meadows').theme}. The dominant element is ${getRegion(character.currentRegion ?? 'green_meadows').element}. Generate a boss that fits this setting. Common enemy types in this region: ${getRegion(character.currentRegion ?? 'green_meadows').enemyTypes.join(', ') || 'none'}.

Reputation context: This character's reputation is ${character.reputation} (${getReputationTier(character.reputation)}).
${character.reputation >= 50 ? 'High reputation: the boss might acknowledge the character\'s fame, offer a challenge of honor, or be a rival drawn by their renown.' : ''}${character.reputation <= -20 ? 'Low reputation: the boss might be a bounty hunter leader, a vengeful warlord who has heard of the character\'s crimes, or a dark entity drawn to their infamy.' : ''}

This is a level ${character.level} character facing a boss fight. The boss should be significantly stronger than normal enemies:
- Boss HP: ${Math.round((35 + character.level * 15) * 1.5)} (1.5x normal)
- Boss attack: ${Math.round((6 + character.level * 3) * 1.3)} (1.3x normal)
- Boss defense: ${Math.round((2 + character.level) * 1.3)} (1.3x normal)
- Gold reward: ${Math.round((5 + character.level * 5) * 3)} (3x normal)
- Include 2-3 high-quality loot items (rare potions, powerful scrolls, gems)
- MUST include a special ability with cooldown of 2-3 turns — this is a boss!
- Give the boss an imposing, unique name

Character:
${JSON.stringify(character, null, 2)}

Context:
${context}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_combat',
            description: 'Generate a boss combat encounter.',
            parameters: enemySchemaForOpenAI,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generate_combat' } },
      temperature: 0.8,
      max_tokens: 800,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_combat') {
      const parsed = JSON.parse(toolCall.function.arguments)
      const validated = combatResponseSchema.parse(parsed)
      if (validated.enemy.lootTable) {
        validated.enemy.lootTable = validated.enemy.lootTable.map(inferItemTypeAndEffects)
      }
      return validated
    }
    throw new Error('No tool call in response')
  } catch (err) {
    console.error('Boss generation failed, using fallback', err)
    return getDefaultBossEncounter(character)
  }
}

function getDefaultBossEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const region = getRegion(character.currentRegion ?? 'green_meadows')

  const bosses: Array<{ name: string; desc: string; special: string; specialDesc: string; element: 'none' | 'shadow' | 'nature' }> = [
    { name: 'The Iron Warden', desc: 'A colossal animated suit of armor, its eyes burning with ancient fury.', special: 'Crushing Blow', specialDesc: 'Slams the ground, sending shockwaves.', element: 'none' },
    { name: 'Vexara the Cursed', desc: 'A spectral sorceress wreathed in dark flame, whispering words of ruin.', special: 'Soul Drain', specialDesc: 'Drains life force from her victims.', element: 'shadow' },
    { name: 'Grimfang the Devourer', desc: 'A massive beast with razor teeth and impenetrable scales.', special: 'Rending Fury', specialDesc: 'Unleashes a devastating multi-strike attack.', element: 'nature' },
  ]
  const boss = bosses[level % bosses.length]

  return {
    scenario: `Deep within the ${region.name}, a powerful presence blocks your path. ${boss.name} emerges — a fearsome foe that will test everything you have. This is a boss battle!`,
    enemy: {
      id: `boss-${suffix}`,
      name: boss.name,
      description: boss.desc,
      hp: Math.round((35 + level * 15) * 1.5),
      maxHp: Math.round((35 + level * 15) * 1.5),
      attack: Math.round((6 + level * 3) * 1.3),
      defense: Math.round((2 + level) * 1.3),
      level: level + 2,
      goldReward: Math.round((5 + level * 5) * 3),
      lootTable: [
        inferItemTypeAndEffects({
          id: `boss-loot-1-${suffix}`,
          name: 'Greater Healing Potion',
          description: 'A potent restorative brew.',
          quantity: 1,
        }),
        inferItemTypeAndEffects({
          id: `boss-loot-2-${suffix}`,
          name: 'Tome of Power',
          description: 'An ancient book radiating magical energy.',
          quantity: 1,
        }),
        (() => {
          const spell = generateSpellForLevel(level)
          return {
            id: `boss-loot-spell-${suffix}`,
            name: `Scroll of ${spell.name}`,
            description: `A powerful spell scroll dropped by ${boss.name}.`,
            quantity: 1,
            type: 'spell_scroll' as const,
            spell,
          }
        })(),
      ],
      specialAbility: {
        name: boss.special,
        description: boss.specialDesc,
        damage: Math.round((5 + level * 2) * 1.8),
        cooldown: 2,
      },
      element: (region.element !== 'none' ? region.element : boss.element) as CombatEnemy['element'],
    },
  }
}

function getDefaultCombatEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const region = getRegion(character.currentRegion ?? 'green_meadows')

  const enemyName = region.enemyTypes.length > 0
    ? region.enemyTypes[Math.floor(Math.random() * region.enemyTypes.length)]
    : (level <= 2 ? 'Wild Goblin' : level <= 5 ? 'Dark Wolf' : 'Shadow Knight')

  const enemyDescription = region.enemyTypes.length > 0
    ? `A dangerous ${enemyName} native to the ${region.name}.`
    : (level <= 2
        ? 'A snarling goblin wielding a rusty dagger.'
        : level <= 5
          ? 'A massive wolf with glowing red eyes.'
          : 'An armored knight wreathed in dark energy.')

  return {
    scenario: `In the ${region.name}, a hostile creature emerges from the shadows, blocking your path. You must fight or flee!`,
    enemy: {
      id: `enemy-${suffix}`,
      name: enemyName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      description: enemyDescription,
      hp: 35 + level * 15,
      maxHp: 35 + level * 15,
      attack: 6 + level * 3,
      defense: 2 + level,
      level,
      goldReward: 5 + level * 5,
      lootTable: [
        inferItemTypeAndEffects({
          id: `loot-potion-${suffix}`,
          name: 'Healing Potion',
          description: 'A small vial of restorative liquid.',
          quantity: 1,
        }),
        ...(level >= 2 ? [inferItemTypeAndEffects({
          id: `loot-equipment-${suffix}`,
          name: level <= 3 ? 'Rusty Dagger' : level <= 5 ? 'Iron Sword' : 'Steel Blade',
          description: level <= 3 ? 'A worn but still sharp dagger.' : level <= 5 ? 'A reliable iron sword.' : 'A finely crafted steel blade.',
          quantity: 1,
        })] : []),
      ],
      specialAbility:
        level >= 3
          ? {
              name: level <= 5 ? 'Savage Bite' : 'Shadow Strike',
              description: level <= 5 ? 'A vicious lunging bite.' : 'A devastating blow from the shadows.',
              damage: 5 + level * 2,
              cooldown: 3,
            }
          : undefined,
      statusAbility:
        level <= 2
          ? { type: 'slow' as const, value: 0, duration: 2, chance: 0.3 }
          : level <= 5
            ? { type: 'poison' as const, value: 3 + level, duration: 3, chance: 0.4 }
            : { type: 'curse' as const, value: 0, duration: 3, chance: 0.3 },
      element: (region.element !== 'none' ? region.element : (level <= 2 ? 'none' : level <= 5 ? 'nature' : 'shadow')) as CombatEnemy['element'],
    },
  }
}
