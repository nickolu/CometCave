import { OpenAI } from 'openai'
import { z } from 'zod'

import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { SpellSchema } from '@/app/tap-tap-adventure/models/spell'

import { getReputationTier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'

const processFallbackRewardItems = (
  items?: { id: string; name?: string; description?: string; quantity: number; type?: string; effects?: Record<string, number> }[]
): Item[] | undefined =>
  items?.map(item => inferItemTypeAndEffects({
    id: item.id,
    quantity: item.quantity,
    name: item.name || 'Unknown Item',
    description: item.description || 'No description available',
    type: (item.type as Item['type']) || 'misc',
    effects: item.effects,
  })) || []

export interface LLMEventOption {
  id: string
  text: string
  successProbability: number
  successDescription: string
  successEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
  }
  failureDescription: string
  failureEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
  }
  triggersCombat?: boolean
}

export interface LLMGeneratedEvent {
  id: string
  description: string
  options: LLMEventOption[]
}

const rewardItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number(),
  type: z.enum(['consumable', 'equipment', 'quest', 'misc', 'spell_scroll']).optional().default('misc'),
  effects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    strength: z.number().optional(),
    intelligence: z.number().optional(),
    luck: z.number().optional(),
    heal: z.number().optional(),
  }).optional(),
  spell: SpellSchema.optional(),
})

const eventOptionSchema = z.object({
  id: z.string(),
  text: z.string(),
  successProbability: z.number().min(0).max(1),
  successDescription: z.string(),
  successEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
  }),
  failureDescription: z.string(),
  failureEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
  }),
  triggersCombat: z.boolean().optional(),
})

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
})

const eventsArraySchema = z.array(eventSchema).length(3)

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// Function calling schema for event generation
const spellEffectSchemaForOpenAI = {
  type: 'object',
  properties: {
    type: { type: 'string', enum: ['damage', 'damage_over_time', 'true_damage', 'lifesteal', 'heal', 'heal_over_time', 'shield', 'damage_reduction', 'buff', 'debuff', 'stun', 'bleed', 'cleanse', 'mana_restore', 'combo_boost'] },
    value: { type: 'number' },
    element: { type: 'string', enum: ['fire', 'ice', 'lightning', 'shadow', 'nature', 'arcane', 'none'] },
    stat: { type: 'string' },
    duration: { type: 'number' },
    percentage: { type: 'number' },
  },
  required: ['type', 'value'],
}

const spellSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    name: { type: 'string' },
    description: { type: 'string' },
    school: { type: 'string', enum: ['arcane', 'nature', 'shadow', 'war'] },
    manaCost: { type: 'number' },
    cooldown: { type: 'number' },
    target: { type: 'string', enum: ['enemy', 'self'] },
    effects: { type: 'array', items: spellEffectSchemaForOpenAI },
    tags: { type: 'array', items: { type: 'string' } },
  },
  required: ['id', 'name', 'description', 'school', 'manaCost', 'cooldown', 'target', 'effects', 'tags'],
}

const rewardItemSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    quantity: { type: 'number', minimum: 1 },
    name: { type: 'string' },
    description: { type: 'string' },
    type: { type: 'string', enum: ['consumable', 'equipment', 'quest', 'misc', 'spell_scroll'] },
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
    spell: spellSchemaForOpenAI,
  },
  required: ['id', 'quantity', 'name', 'description'],
}

const eventOptionSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    text: { type: 'string' },
    successProbability: { type: 'number', minimum: 0, maximum: 1 },
    successDescription: { type: 'string' },
    successEffects: {
      type: 'object',
      properties: {
        gold: { type: 'number' },
        reputation: { type: 'number' },
        statusChange: { type: 'string' },
        rewardItems: {
          type: 'array',
          items: rewardItemSchemaForOpenAI,
        },
      },
    },
    failureDescription: { type: 'string' },
    failureEffects: {
      type: 'object',
      properties: {
        gold: { type: 'number' },
        reputation: { type: 'number' },
        statusChange: { type: 'string' },
        rewardItems: {
          type: 'array',
          items: rewardItemSchemaForOpenAI,
        },
      },
    },
    triggersCombat: { type: 'boolean', description: 'Set to true if this option leads to a fight' },
  },
  required: [
    'id',
    'text',
    'successProbability',
    'successDescription',
    'successEffects',
    'failureDescription',
    'failureEffects',
  ],
  additionalProperties: false,
}

const eventSchemaForOpenAI = {
  type: 'object',
  properties: {
    id: { type: 'string' },
    description: { type: 'string' },
    options: {
      type: 'array',
      items: eventOptionSchemaForOpenAI,
      minItems: 2,
      maxItems: 4,
    },
  },
  required: ['id', 'description', 'options'],
  additionalProperties: false,
}

const eventsArraySchemaForOpenAI = {
  type: 'array',
  items: eventSchemaForOpenAI,
  minItems: 3,
  maxItems: 3,
}

export async function generateLLMEvents(
  character: FantasyCharacter,
  context: string
): Promise<LLMGeneratedEvent[]> {
  const { model, messages, tools, toolChoice, temperature, maxTokens } = getCompletionsConfig(
    character,
    context
  )
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      tools,
      temperature,
      tool_choice: toolChoice,
      max_tokens: maxTokens,
    })
    // Parse tool calls response
    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_events') {
      return parseEventsFromToolCall(toolCall)
    }
    const raw = response.choices[0]?.message?.content?.trim()
    return parseRawEvents(raw)
  } catch (err) {
    console.error('LLM event generation failed', err)
    return getDefaultEvents()
  }
}

function getCompletionsConfig(character: FantasyCharacter, context: string) {
  const model = 'gpt-4o'
  const reputationTier = getReputationTier(character.reputation)

  let reputationGuidance = ''
  if (character.reputation >= 50) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be friendly and welcoming. Offer better deals, share secrets, and present important quests. Some NPCs may recognize the character by name and ask for help with critical tasks.`
  } else if (character.reputation >= 20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be generally positive and willing to help. Fair deals and occasional bonus opportunities.`
  } else if (character.reputation >= 0) {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are neutral — standard interactions and pricing.`
  } else if (character.reputation >= -20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be suspicious and wary. Prices are higher, information is harder to obtain, and some may refuse to deal with the character.`
  } else {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are hostile or fearful. Bounty hunters or rival adventurers may appear. Prices are much higher. Very few friendly encounters — most NPCs want nothing to do with this character.`
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Generate 3 fantasy adventure events for this character. Reference their past adventures and current state when creating events. Events should feel like a continuation of their story, not random encounters.

IMPORTANT — Reputation guidance:
${reputationGuidance}
Tailor the tone, NPC attitudes, and available opportunities to reflect the character's reputation tier.

When rewarding items, sometimes include consumable items (type: "consumable") with effects like stat boosts or gold. For healing items, use the 'heal' effect (e.g., heal: 15 restores 15 HP). The 'strength' effect permanently increases the strength stat. Examples: healing potions with heal: 10, scrolls that grant +2 intelligence, lucky coins that grant +1 luck, strength potions with +2 strength.
Sometimes include equipment items (type: "equipment") like weapons, armor, or accessories with stat-boosting effects. Examples: a steel sword with +2 strength, iron armor with +2 intelligence, or a lucky charm with +1 luck.
Sometimes reward spell scrolls — items with type "spell_scroll" containing a spell with a creative name, 2-3 effects, optional conditions, and tags. The spell field should have: id, name, description, school (arcane/nature/shadow/war), manaCost, cooldown, target (enemy/self), effects array, optional conditions array, and tags array.

IMPORTANT: About 1 in 3 events should involve a potential confrontation (bandits, monsters, rivals, etc.). For these events, include at least one option with "triggersCombat": true — this represents the character choosing to fight. Other options can be peaceful alternatives (negotiate, flee, pay a toll, sneak past). This gives the player agency over whether to fight.

Character:
${JSON.stringify(character, null, 2)}

Recent History & Context:
${context || 'No prior adventures yet — this is the beginning of their journey.'}`,
    },
  ]

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'generate_events',
        description: 'Generate 3 fantasy adventure event objects as an array.',
        parameters: {
          type: 'object',
          properties: {
            events: eventsArraySchemaForOpenAI,
          },
          required: ['events'],
        },
      },
    },
  ]
  const toolChoice: OpenAI.Chat.Completions.ChatCompletionToolChoiceOption = {
    type: 'function',
    function: { name: 'generate_events' },
  }
  const temperature = 0.7
  const maxTokens = 1200

  return {
    model,
    messages,
    tools,
    toolChoice,
    temperature,
    maxTokens,
  }
}

function parseEventsFromToolCall(toolCall: OpenAI.Chat.Completions.ChatCompletionMessageToolCall) {
  const toolArgs = JSON.parse(toolCall.function.arguments)
  const events = eventsArraySchema.parse(toolArgs.events)
  // Ensure unique event ids
  const seenIds = new Set<string>()
  const uniqueEvents: LLMGeneratedEvent[] = events.map(event => {
    let newId = event.id
    if (seenIds.has(event.id)) {
      newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
    seenIds.add(newId)

    // Process options with the new structure
    const processedOptions: LLMEventOption[] = event.options.map(option => ({
      ...option,
      successEffects: {
        ...option.successEffects,
        rewardItems: processFallbackRewardItems(option.successEffects.rewardItems),
      },
      failureEffects: {
        ...option.failureEffects,
        rewardItems: processFallbackRewardItems(option.failureEffects.rewardItems),
      },
    }))

    return { ...event, id: newId, options: processedOptions }
  })
  return uniqueEvents
}

function getDefaultEvents(): LLMGeneratedEvent[] {
  const s = `fallback-${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const pool: LLMGeneratedEvent[] = [
    // Discovery events
    {
      id: `fb-chest-${s}`,
      description: 'You spot a weathered chest half-buried in the undergrowth.',
      options: [
        { id: `open-${s}`, text: 'Pry it open', successProbability: 0.6,
          successDescription: 'Inside you find a handful of coins and a small vial.',
          successEffects: { gold: 8, rewardItems: processFallbackRewardItems([{ id: `vial-${s}`, name: 'Small Healing Vial', description: 'Restores a bit of vigor', quantity: 1, type: 'consumable', effects: { heal: 10 } }]) },
          failureDescription: 'The chest is empty save for dust and cobwebs.',
          failureEffects: {} },
        { id: `leave-${s}`, text: 'Leave it alone', successProbability: 1.0,
          successDescription: 'You walk on, deciding not to risk a trap.',
          successEffects: {}, failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-shrine-${s}`,
      description: 'A crumbling stone shrine sits beside the path, faintly glowing.',
      options: [
        { id: `pray-${s}`, text: 'Offer a prayer', successProbability: 0.7,
          successDescription: 'A warm light washes over you. You feel restored.',
          successEffects: { reputation: 3 },
          failureDescription: 'Nothing happens. The glow fades.',
          failureEffects: {} },
        { id: `examine-${s}`, text: 'Search around the shrine', successProbability: 0.5,
          successDescription: 'You find a few coins left as offerings.',
          successEffects: { gold: 5 },
          failureDescription: 'You find nothing but old stones.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-campfire-${s}`,
      description: 'You come across an abandoned campfire, still warm. Someone left supplies behind.',
      options: [
        { id: `rest-${s}`, text: 'Rest by the fire', successProbability: 1.0,
          successDescription: 'You take a moment to rest and warm yourself. The pause does you good.',
          successEffects: { reputation: 1 },
          failureDescription: '', failureEffects: {} },
        { id: `scavenge-${s}`, text: 'Search the camp for supplies', successProbability: 0.6,
          successDescription: 'You find a potion and a few coins.',
          successEffects: { gold: 5, rewardItems: processFallbackRewardItems([{ id: `camp-potion-${s}`, name: 'Traveler\'s Brew', description: 'A simple restorative drink', quantity: 1, type: 'consumable', effects: { heal: 10 } }]) },
          failureDescription: 'The camp has already been picked clean.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-traveler-${s}`,
      description: 'A weary traveler approaches and asks for directions.',
      options: [
        { id: `help-${s}`, text: 'Help them find their way', successProbability: 0.8,
          successDescription: 'The traveler thanks you warmly and shares some food.',
          successEffects: { reputation: 3 },
          failureDescription: 'You point them in the wrong direction by mistake. They grumble and leave.',
          failureEffects: { reputation: -1 } },
        { id: `ignore-${s}`, text: 'Keep walking', successProbability: 1.0,
          successDescription: 'You nod politely and continue on your way.',
          successEffects: {},
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-stream-${s}`,
      description: 'A clear stream crosses the path. The water looks refreshing.',
      options: [
        { id: `drink-${s}`, text: 'Drink from the stream', successProbability: 0.8,
          successDescription: 'The water is cool and invigorating.',
          successEffects: {},
          failureDescription: 'The water has a slightly off taste. You feel fine though.',
          failureEffects: {} },
        { id: `ford-${s}`, text: 'Search the streambed for valuables', successProbability: 0.4,
          successDescription: 'You spot a glinting gem among the pebbles!',
          successEffects: { gold: 10 },
          failureDescription: 'Just rocks and mud.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-ruins-${s}`,
      description: 'Ancient ruins loom ahead, overgrown with vines. Something glints inside.',
      options: [
        { id: `explore-${s}`, text: 'Explore the ruins', successProbability: 0.5,
          successDescription: 'You find a stash of old coins and a scroll.',
          successEffects: { gold: 12, rewardItems: processFallbackRewardItems([{ id: `scroll-${s}`, name: 'Dusty Scroll', description: 'An old scroll with faded writing', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
          failureDescription: 'The ruins are unstable. A stone falls, but you dodge it.',
          failureEffects: {} },
        { id: `pass-${s}`, text: 'Walk past carefully', successProbability: 1.0,
          successDescription: 'You keep your distance and continue safely.',
          successEffects: {},
          failureDescription: '', failureEffects: {} },
      ],
    },
    // Social events
    {
      id: `fb-bard-${s}`,
      description: 'A traveling bard offers to sing you a song in exchange for a coin.',
      options: [
        { id: `pay-${s}`, text: 'Toss them a coin', successProbability: 0.9,
          successDescription: 'The bard sings a rousing tale. Nearby travelers cheer and your reputation grows.',
          successEffects: { gold: -1, reputation: 4 },
          failureDescription: 'The song is terrible, but the bard appreciates the gesture.',
          failureEffects: { gold: -1, reputation: 1 } },
        { id: `decline-${s}`, text: 'Decline politely', successProbability: 1.0,
          successDescription: 'The bard shrugs and moves on.',
          successEffects: {},
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-lost-child-${s}`,
      description: 'A child stands by the road, clearly lost and frightened.',
      options: [
        { id: `help-child-${s}`, text: 'Help them find their family', successProbability: 0.8,
          successDescription: 'You reunite the child with their grateful parents. They insist you take a reward.',
          successEffects: { reputation: 5, gold: 5 },
          failureDescription: 'You search for a while but can\'t find the parents. At least the child calms down.',
          failureEffects: { reputation: 2 } },
        { id: `walk-on-${s}`, text: 'Continue your journey', successProbability: 1.0,
          successDescription: 'You feel a twinge of guilt as you walk away.',
          successEffects: { reputation: -1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-hermit-${s}`,
      description: 'An old hermit sitting beneath a tree offers you a piece of advice.',
      options: [
        { id: `listen-${s}`, text: 'Listen to the hermit', successProbability: 0.7,
          successDescription: '"Choose your battles wisely," the hermit says. You feel wiser for the exchange.',
          successEffects: { reputation: 2 },
          failureDescription: 'The hermit mumbles incoherently. You smile and nod.',
          failureEffects: {} },
        { id: `gift-${s}`, text: 'Share some food with the hermit', successProbability: 0.9,
          successDescription: 'The hermit gives you a small charm in return.',
          successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `charm-${s}`, name: 'Hermit\'s Charm', description: 'A small wooden charm', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
          failureDescription: 'The hermit thanks you kindly.',
          failureEffects: { reputation: 1 } },
      ],
    },
    // Nature/weather events
    {
      id: `fb-storm-${s}`,
      description: 'Dark clouds gather overhead. A storm is coming.',
      options: [
        { id: `shelter-${s}`, text: 'Find shelter and wait it out', successProbability: 1.0,
          successDescription: 'You find a cave and wait. The storm passes, and you feel rested.',
          successEffects: {},
          failureDescription: '', failureEffects: {} },
        { id: `push-${s}`, text: 'Push through the storm', successProbability: 0.5,
          successDescription: 'You brave the rain and come out stronger for it.',
          successEffects: { reputation: 2 },
          failureDescription: 'You get drenched and cold. Nothing serious.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-garden-${s}`,
      description: 'You stumble upon a hidden garden with herbs and berries growing wild.',
      options: [
        { id: `gather-${s}`, text: 'Gather herbs', successProbability: 0.7,
          successDescription: 'You collect useful herbs and berries.',
          successEffects: { rewardItems: processFallbackRewardItems([{ id: `herbs-${s}`, name: 'Wild Herbs', description: 'Fresh herbs with restorative properties', quantity: 1, type: 'consumable', effects: { heal: 10 } }]) },
          failureDescription: 'Most of the plants are wilted or inedible.',
          failureEffects: {} },
        { id: `admire-${s}`, text: 'Simply admire the beauty', successProbability: 1.0,
          successDescription: 'The peaceful scene refreshes your spirit.',
          successEffects: { reputation: 1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-landmark-${s}`,
      description: 'You reach a tall stone marker carved with ancient symbols.',
      options: [
        { id: `study-${s}`, text: 'Study the symbols', successProbability: 0.5,
          successDescription: 'You decipher a fragment — it reveals a nearby cache!',
          successEffects: { gold: 8 },
          failureDescription: 'The symbols are too worn to read.',
          failureEffects: {} },
        { id: `touch-${s}`, text: 'Touch the stone', successProbability: 0.6,
          successDescription: 'The stone hums faintly. You feel a brief surge of energy.',
          successEffects: { reputation: 2 },
          failureDescription: 'Nothing happens. It\'s just a stone.',
          failureEffects: {} },
      ],
    },
    // Combat-triggering events
    {
      id: `fb-wolves-${s}`,
      description: 'A pack of wolves emerges from the treeline, growling and circling you.',
      options: [
        { id: `fight-wolves-${s}`, text: 'Stand your ground and fight', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You ready yourself for battle!',
          successEffects: {}, failureDescription: 'You ready yourself for battle!', failureEffects: {} },
        { id: `scare-wolves-${s}`, text: 'Try to scare them off with fire', successProbability: 0.6,
          successDescription: 'You wave a torch and the wolves scatter.',
          successEffects: { reputation: 2 },
          failureDescription: 'The wolves aren\'t impressed, but they lose interest and slink away.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-bandits-${s}`,
      description: 'A band of thieves blocks the road ahead, demanding you hand over your gold.',
      options: [
        { id: `fight-bandits-${s}`, text: 'Draw your weapon and fight', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You prepare for battle!',
          successEffects: {}, failureDescription: 'You prepare for battle!', failureEffects: {} },
        { id: `negotiate-${s}`, text: 'Try to negotiate', successProbability: 0.5,
          successDescription: 'You talk them down. They let you pass with just a small toll.',
          successEffects: { gold: -3, reputation: 2 },
          failureDescription: 'They laugh at your words and take some gold.',
          failureEffects: { gold: -8 } },
        { id: `sneak-bandits-${s}`, text: 'Try to sneak around them', successProbability: 0.4,
          successDescription: 'You slip past unnoticed!',
          successEffects: { reputation: 1 },
          failureDescription: 'They spot you but you escape with just a scare.',
          failureEffects: { reputation: -1 } },
      ],
    },
    {
      id: `fb-bridge-${s}`,
      description: 'You reach a rickety bridge over a deep ravine. It looks unstable.',
      options: [
        { id: `cross-${s}`, text: 'Cross carefully', successProbability: 0.7,
          successDescription: 'You make it across safely!',
          successEffects: { reputation: 1 },
          failureDescription: 'A plank breaks but you catch yourself. Close call.',
          failureEffects: {} },
        { id: `find-way-${s}`, text: 'Look for another way around', successProbability: 0.8,
          successDescription: 'You find a safer path and a small cache of supplies.',
          successEffects: { gold: 4 },
          failureDescription: 'The detour takes a while but you make it.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-injured-animal-${s}`,
      description: 'You find an injured fox by the roadside, whimpering softly.',
      options: [
        { id: `tend-${s}`, text: 'Tend to its wounds', successProbability: 0.8,
          successDescription: 'The fox recovers and nuzzles your hand before bounding away. Word of your kindness spreads.',
          successEffects: { reputation: 4 },
          failureDescription: 'Despite your efforts, the fox limps away. At least you tried.',
          failureEffects: { reputation: 1 } },
        { id: `continue-${s}`, text: 'Continue on your way', successProbability: 1.0,
          successDescription: 'You move on.',
          successEffects: {},
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-old-well-${s}`,
      description: 'An old well stands in a clearing. You hear something jingling at the bottom.',
      options: [
        { id: `climb-${s}`, text: 'Climb down and investigate', successProbability: 0.5,
          successDescription: 'You find a pouch of coins someone dropped long ago!',
          successEffects: { gold: 15 },
          failureDescription: 'It was just the wind rattling an old bucket.',
          failureEffects: {} },
        { id: `toss-coin-${s}`, text: 'Toss a coin and make a wish', successProbability: 0.6,
          successDescription: 'You feel a strange sense of fortune.',
          successEffects: { gold: -1, reputation: 2 },
          failureDescription: 'Nothing happens, but it felt right.',
          failureEffects: { gold: -1 } },
      ],
    },
    {
      id: `fb-caravan-${s}`,
      description: 'A merchant caravan has stopped for repairs. The caravan master looks stressed.',
      options: [
        { id: `help-repair-${s}`, text: 'Offer to help with repairs', successProbability: 0.7,
          successDescription: 'You help fix a broken wheel. The merchant rewards you generously.',
          successEffects: { gold: 10, reputation: 3 },
          failureDescription: 'You try but lack the right tools. The merchant thanks you anyway.',
          failureEffects: { reputation: 1 } },
        { id: `trade-${s}`, text: 'Browse their wares while they work', successProbability: 1.0,
          successDescription: 'Nothing catches your eye, but you exchange pleasantries.',
          successEffects: { reputation: 1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
  ]

  // Randomly pick 3 events from the pool
  const shuffled = pool.sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 3)
}

function parseRawEvents(raw?: string) {
  if (!raw) throw new Error('No content from LLM')
  const parsed = JSON.parse(raw)
  let events
  if (Array.isArray(parsed)) {
    events = eventsArraySchema.parse(parsed)
  } else if (parsed && Array.isArray(parsed.events)) {
    events = eventsArraySchema.parse(parsed.events)
  } else {
    throw new Error('LLM response is not an array or object with events array')
  }
  // Ensure unique event ids
  const seenIds = new Set<string>()
  const uniqueEvents = events.map(event => {
    let newId = event.id
    if (seenIds.has(event.id)) {
      newId = `${event.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
    }
    seenIds.add(newId)
    return { ...event, id: newId }
  })
  return uniqueEvents
}
