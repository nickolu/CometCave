import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item, ItemSchema } from '@/app/tap-tap-adventure/models/item'

import { inferItemTypeAndEffects } from './itemPostProcessor'

function getOpenAIClient() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

const shopResponseSchema = z.object({
  items: z.array(ItemSchema),
})

const shopSchemaForOpenAI = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          quantity: { type: 'number' },
          type: { type: 'string', enum: ['consumable', 'equipment', 'quest', 'misc'] },
          price: { type: 'number' },
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
        required: ['id', 'name', 'description', 'quantity', 'price'],
      },
    },
  },
  required: ['items'],
}

export async function generateShopItems(character: FantasyCharacter): Promise<Item[]> {
  try {
    const basePrice = 10 + character.level * 5
    const openai = getOpenAIClient()
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate 3-5 shop items for a fantasy merchant's shop. The items should be appropriate for a level ${character.level} ${character.class} ${character.race} character.

Price guidelines for level ${character.level}:
- Cheap items: ${Math.round(basePrice * 0.5)}-${basePrice} gold
- Medium items: ${basePrice}-${Math.round(basePrice * 2)} gold
- Expensive items: ${Math.round(basePrice * 2)}-${Math.round(basePrice * 3)} gold

Include a mix of:
- Healing potions/consumables
- Stat-boosting items (strength, intelligence, luck)
- Interesting thematic items that fit the fantasy setting

Each item needs a unique id (e.g. "shop-item-1"), a creative name, a short description, quantity of 1, a gold price, and effects.

Character:
${JSON.stringify({ name: character.name, race: character.race, class: character.class, level: character.level }, null, 2)}`,
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generate_shop',
            description: 'Generate shop items for a merchant.',
            parameters: shopSchemaForOpenAI,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generate_shop' } },
      temperature: 0.8,
      max_tokens: 800,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_shop') {
      const parsed = JSON.parse(toolCall.function.arguments)
      const validated = shopResponseSchema.parse(parsed)
      return validated.items.map(inferItemTypeAndEffects)
    }

    throw new Error('No tool call in response')
  } catch (err) {
    console.error('Shop generation failed, using fallback', err)
    return getFallbackShopItems(character.level)
  }
}

export function getFallbackShopItems(level: number): Item[] {
  const basePrice = 10 + level * 5
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const items: Item[] = [
    {
      id: `shop-heal-${suffix}`,
      name: 'Healing Potion',
      description: 'A warm, glowing vial that restores vitality.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 0.8),
      effects: { strength: 1 + Math.floor(level / 3) },
    },
    {
      id: `shop-str-${suffix}`,
      name: 'Elixir of Strength',
      description: 'A thick, crimson brew that bolsters raw power.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 1.5),
      effects: { strength: 2 + Math.floor(level / 2) },
    },
    {
      id: `shop-int-${suffix}`,
      name: 'Scroll of Wisdom',
      description: 'Ancient parchment inscribed with arcane knowledge.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 1.5),
      effects: { intelligence: 2 + Math.floor(level / 2) },
    },
    {
      id: `shop-luck-${suffix}`,
      name: 'Lucky Charm',
      description: 'A small trinket that seems to shimmer with fortune.',
      quantity: 1,
      type: 'consumable',
      price: basePrice,
      effects: { luck: 2 + Math.floor(level / 3) },
    },
  ]

  return items.map(inferItemTypeAndEffects)
}
