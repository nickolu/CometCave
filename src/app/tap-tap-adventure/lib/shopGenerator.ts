import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item, ItemSchema } from '@/app/tap-tap-adventure/models/item'
import { Mount } from '@/app/tap-tap-adventure/models/mount'
import { getMountPrice, getShopMount } from '@/app/tap-tap-adventure/config/mounts'

import { getCharismaPriceMultiplier, getReputationPriceMultiplier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'
import { generateSpellForLevel } from './spellGenerator'

export interface ShopMount {
  mount: Mount
  price: number
}

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
          rarity: { type: 'string', enum: ['common', 'uncommon', 'rare', 'epic', 'legendary'] },
          effects: {
            type: 'object',
            properties: {
              gold: { type: 'number' },
              reputation: { type: 'number' },
              strength: { type: 'number' },
              intelligence: { type: 'number' },
              luck: { type: 'number' },
              heal: { type: 'number', description: 'Directly restores this amount of HP. Use for healing items instead of strength.' },
              revealLandmark: { type: 'boolean', description: 'Set to true for map items that reveal hidden landmarks. Use for items like treasure maps, ancient charts, or cartographer notes.' },
            },
          },
        },
        required: ['id', 'name', 'description', 'quantity', 'price'],
      },
    },
  },
  required: ['items'],
}

export function generateShopMount(character: FantasyCharacter): ShopMount | null {
  if (Math.random() > 0.3) return null // 30% chance
  const mount = getShopMount(character.level)
  const price = getMountPrice(mount.rarity)
  return { mount, price }
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
- Healing potions/consumables (use the 'heal' effect for HP restoration, e.g., heal: 15 restores 15 HP. The 'strength' effect permanently increases the strength stat.)
- Stat-boosting items (strength, intelligence, luck)
- Interesting thematic items that fit the fantasy setting
- Occasionally a spell scroll (type: "spell_scroll") with a spell object containing id, name, description, school, manaCost, cooldown, target, effects, and tags
- Occasionally a map or chart (type: "consumable" with effects: { revealLandmark: true }) that reveals hidden landmarks. Price these at 2-3x the base price. Use names like "Treasure Map", "Ancient Chart", "Explorer's Map", etc.

Each item needs a unique id (e.g. "shop-item-1"), a creative name, a short description, quantity of 1, a gold price, and effects.

- Each item should have a rarity: common (basic supplies), uncommon (quality goods), rare (special finds), epic (very rare), legendary (once in a lifetime)
- Most items should be common or uncommon. Include at most 1 rare item. Epic/legendary items should almost never appear in shops.

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
      const priceMultiplier = Math.max(0.60, getReputationPriceMultiplier(character.reputation) * getCharismaPriceMultiplier(character.charisma))
      return validated.items.map(item => inferItemTypeAndEffects({
        ...item,
        price: item.price !== undefined ? Math.round(item.price * priceMultiplier) : undefined,
      }))
    }

    throw new Error('No tool call in response')
  } catch (err) {
    console.error('Shop generation failed, using fallback', err)
    return getFallbackShopItems(character.level, character.reputation, character.charisma)
  }
}

export function getFallbackShopItems(level: number, reputation: number = 0, charisma: number = 5): Item[] {
  const basePrice = 10 + level * 5
  const reputationMultiplier = Math.max(0.60, getReputationPriceMultiplier(reputation) * getCharismaPriceMultiplier(charisma))
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const items: Item[] = [
    {
      id: `shop-heal-${suffix}`,
      name: 'Healing Potion',
      description: 'A warm, glowing vial that restores vitality.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 0.8 * reputationMultiplier),
      effects: { heal: 10 + level * 5 },
      rarity: 'common',
    },
    {
      id: `shop-str-${suffix}`,
      name: 'Elixir of Strength',
      description: 'A thick, crimson brew that bolsters raw power.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 1.5 * reputationMultiplier),
      effects: { strength: 2 + Math.floor(level / 2) },
      rarity: 'uncommon',
    },
    {
      id: `shop-int-${suffix}`,
      name: 'Scroll of Wisdom',
      description: 'Ancient parchment inscribed with arcane knowledge.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * 1.5 * reputationMultiplier),
      effects: { intelligence: 2 + Math.floor(level / 2) },
      rarity: 'uncommon',
    },
    {
      id: `shop-luck-${suffix}`,
      name: 'Lucky Charm',
      description: 'A small trinket that seems to shimmer with fortune.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(basePrice * reputationMultiplier),
      effects: { luck: 2 + Math.floor(level / 3) },
      rarity: 'common',
    },
  ]

  // Add 1-2 spell scrolls to the shop
  const spellPrice = 20 + level * 10
  const spell1 = generateSpellForLevel(level)
  items.push({
    id: `shop-spell-${suffix}`,
    name: `Scroll of ${spell1.name}`,
    description: `A magical scroll containing the spell ${spell1.name}.`,
    quantity: 1,
    type: 'spell_scroll',
    price: Math.round(spellPrice * reputationMultiplier),
    spell: spell1,
    rarity: 'rare',
  })

  // 50% chance for a second spell scroll
  if (Math.random() < 0.5) {
    const spell2 = generateSpellForLevel(level)
    items.push({
      id: `shop-spell2-${suffix}`,
      name: `Scroll of ${spell2.name}`,
      description: `A magical scroll containing the spell ${spell2.name}.`,
      quantity: 1,
      type: 'spell_scroll',
      price: Math.round(spellPrice * reputationMultiplier),
      spell: spell2,
      rarity: 'rare',
    })
  }

  // 40% chance to stock a region map
  if (Math.random() < 0.4) {
    const mapPrice = basePrice * 2
    items.push({
      id: `shop-map-${suffix}`,
      name: 'Mysterious Map Fragment',
      description: 'A weathered parchment that reveals the location of a hidden place in this region.',
      quantity: 1,
      type: 'consumable',
      price: Math.round(mapPrice * reputationMultiplier),
      effects: { revealLandmark: true },
      rarity: 'uncommon',
    })
  }

  return items.map(inferItemTypeAndEffects)
}
