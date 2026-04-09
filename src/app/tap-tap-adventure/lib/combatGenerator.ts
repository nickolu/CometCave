import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { CombatEnemy, CombatEnemySchema } from '@/app/tap-tap-adventure/models/combat'

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
        xpReward: { type: 'number' },
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
                  xp: { type: 'number' },
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
        'xpReward',
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
- Enemy HP: ${30 + character.level * 15} (±20%)
- Enemy attack: ${3 + character.level * 2} (±20%)
- Enemy defense: ${2 + character.level} (±20%)
- XP reward: ${20 + character.level * 15}
- Gold reward: ${5 + character.level * 5}
- Include 1-2 loot items (potions, scrolls, gems, etc.)
- Optionally include a special ability with cooldown of 2-4 turns

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
      hp: 30 + level * 15,
      maxHp: 30 + level * 15,
      attack: 3 + level * 2,
      defense: 2 + level,
      level,
      xpReward: 20 + level * 15,
      goldReward: 5 + level * 5,
      lootTable: [
        inferItemTypeAndEffects({
          id: `loot-potion-${suffix}`,
          name: 'Healing Potion',
          description: 'A small vial of restorative liquid.',
          quantity: 1,
        }),
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
    },
  }
}
