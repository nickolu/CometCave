import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatEnemy, CombatEnemySchema } from '@/app/tap-tap-adventure/models/combat'

import { getReputationTier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate a combat encounter for this fantasy character. Create an enemy appropriate for the character's level with a vivid scenario description.

Stat guidelines for a level ${character.level} character:
- Enemy HP: ${40 + character.level * 20} (±20%)
- Enemy attack: ${4 + character.level * 3} (±20%)
- Enemy defense: ${3 + character.level * 2} (±20%)
- Gold reward: ${5 + character.level * 5}
- Include 1-2 loot items (potions, scrolls, gems, etc.)
- Optionally include a special ability with cooldown of 2-4 turns

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate a BOSS combat encounter for this fantasy character. This is a major battle — the boss should be powerful, intimidating, and memorable.

This is a level ${character.level} character facing a boss fight. The boss should be significantly stronger than normal enemies:
- Boss HP: ${Math.round((40 + character.level * 20) * 2.5)} (2.5x normal)
- Boss attack: ${Math.round((4 + character.level * 3) * 1.8)} (1.8x normal)
- Boss defense: ${Math.round((3 + character.level * 2) * 1.5)} (1.5x normal)
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

  const bosses = [
    { name: 'The Iron Warden', desc: 'A colossal animated suit of armor, its eyes burning with ancient fury.', special: 'Crushing Blow', specialDesc: 'Slams the ground, sending shockwaves.' },
    { name: 'Vexara the Cursed', desc: 'A spectral sorceress wreathed in dark flame, whispering words of ruin.', special: 'Soul Drain', specialDesc: 'Drains life force from her victims.' },
    { name: 'Grimfang the Devourer', desc: 'A massive beast with razor teeth and impenetrable scales.', special: 'Rending Fury', specialDesc: 'Unleashes a devastating multi-strike attack.' },
  ]
  const boss = bosses[level % bosses.length]

  return {
    scenario: `A powerful presence blocks your path. ${boss.name} emerges — a fearsome foe that will test everything you have. This is a boss battle!`,
    enemy: {
      id: `boss-${suffix}`,
      name: boss.name,
      description: boss.desc,
      hp: Math.round((40 + level * 20) * 2.5),
      maxHp: Math.round((40 + level * 20) * 2.5),
      attack: Math.round((4 + level * 3) * 1.8),
      defense: Math.round((3 + level * 2) * 1.5),
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
      ],
      specialAbility: {
        name: boss.special,
        description: boss.specialDesc,
        damage: Math.round((5 + level * 2) * 1.8),
        cooldown: 2,
      },
    },
  }
}

function getDefaultCombatEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  return {
    scenario: 'A hostile creature emerges from the shadows, blocking your path. You must fight or flee!',
    enemy: {
      id: `enemy-${suffix}`,
      name: level <= 2 ? 'Wild Goblin' : level <= 5 ? 'Dark Wolf' : 'Shadow Knight',
      description:
        level <= 2
          ? 'A snarling goblin wielding a rusty dagger.'
          : level <= 5
            ? 'A massive wolf with glowing red eyes.'
            : 'An armored knight wreathed in dark energy.',
      hp: 40 + level * 20,
      maxHp: 40 + level * 20,
      attack: 4 + level * 3,
      defense: 3 + level * 2,
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
              damage: 6 + level * 3,
              cooldown: 3,
            }
          : undefined,
    },
  }
}
