import { OpenAI } from 'openai'
import { z } from 'zod'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
import { WEATHER_TYPES, WeatherId } from '@/app/tap-tap-adventure/config/weather'
import { FantasyCharacter } from '@/app/tap-tap-adventure/models/character'
import { Item } from '@/app/tap-tap-adventure/models/item'
import { SpellSchema } from '@/app/tap-tap-adventure/models/spell'

import { getReputationTier } from './contextBuilder'
import { inferItemTypeAndEffects } from './itemPostProcessor'
import { generateSpellForLevel } from './spellGenerator'

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

const processFallbackLegendaryItems = (
  items?: { id: string; name?: string; description?: string; quantity: number; type?: string; effects?: Record<string, number> }[]
): Item[] | undefined =>
  (processFallbackRewardItems(items) ?? []).map(item => ({ ...item, rarity: 'legendary' as const }))

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
    mountDamage?: number
    mountDeath?: boolean
    revealLandmark?: boolean
    hpChange?: number
    mpChange?: number
  }
  failureDescription: string
  failureEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
    mountDamage?: number
    mountDeath?: boolean
    revealLandmark?: boolean
    hpChange?: number
    mpChange?: number
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
    mountDamage: z.number().optional(),
    mountDeath: z.boolean().optional(),
    revealLandmark: z.boolean().optional(),
    hpChange: z.number().optional(),
    mpChange: z.number().optional(),
  }),
  failureDescription: z.string(),
  failureEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
    mountDamage: z.number().optional(),
    mountDeath: z.boolean().optional(),
    revealLandmark: z.boolean().optional(),
    hpChange: z.number().optional(),
    mpChange: z.number().optional(),
  }),
  triggersCombat: z.boolean().optional(),
})

const eventSchema = z.object({
  id: z.string(),
  description: z.string(),
  options: z.array(eventOptionSchema).min(2),
})

const eventsArraySchema = z.array(eventSchema).length(3)

function getOpenAI() {
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
}

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
        mountDamage: { type: 'number', description: 'HP damage dealt to the character\'s mount (if they have one). Use 3-10 for minor damage, 10-20 for serious damage.' },
        mountDeath: { type: 'boolean', description: 'Set to true only if the mount is killed outright by the event outcome.' },
        revealLandmark: { type: 'boolean', description: 'Set to true if this event reveals a hidden landmark nearby. Only use when the narrative involves discovering a hidden location, receiving a treasure map, or learning about a secret place from an NPC.' },
        hpChange: { type: 'number', description: 'HP change for the character. Negative values deal damage (e.g., -10 for a trap), positive values heal (e.g., 15 for a healing spring). Do not reduce below 1 HP.' },
        mpChange: { type: 'number', description: 'Mana change for the character. Negative values drain mana (e.g., -10 for a curse), positive values restore mana (e.g., 15 for a mana spring).' },
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
        mountDamage: { type: 'number', description: 'HP damage dealt to the character\'s mount (if they have one). Use 3-10 for minor damage, 10-20 for serious damage.' },
        mountDeath: { type: 'boolean', description: 'Set to true only if the mount is killed outright by the event outcome.' },
        revealLandmark: { type: 'boolean', description: 'Set to true if this event reveals a hidden landmark nearby. Only use when the narrative involves discovering a hidden location, receiving a treasure map, or learning about a secret place from an NPC.' },
        hpChange: { type: 'number', description: 'HP change for the character. Negative values deal damage (e.g., -10 for a trap), positive values heal (e.g., 15 for a healing spring). Do not reduce below 1 HP.' },
        mpChange: { type: 'number', description: 'Mana change for the character. Negative values drain mana (e.g., -10 for a curse), positive values restore mana (e.g., 15 for a mana spring).' },
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
    const response = await getOpenAI().chat.completions.create({
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
    return getDefaultEvents(character.currentRegion)
  }
}

function getSeasonalContext(): string {
  const now = new Date()
  const month = now.getMonth() + 1 // 1-12
  const day = now.getDate()

  // Oct 25 – Nov 1: Samhain/Halloween
  if ((month === 10 && day >= 25) || (month === 11 && day === 1)) {
    return 'It is the season of Samhain/Halloween. The veil between worlds is thin. Ghosts, ghouls, jack-o-lanterns, and eerie fog pervade the land.'
  }
  // Dec 1 – Jan 6: Winter Solstice / Yuletide
  if (month === 12 || (month === 1 && day <= 6)) {
    return 'It is the Winter Solstice / Yuletide season. Snow blankets the land, hearths glow warm, and mysterious gift-givers roam.'
  }
  // Mar 20 – Jun 20: Spring
  if ((month === 3 && day >= 20) || month === 4 || month === 5 || (month === 6 && day <= 20)) {
    return 'Spring has arrived. Flowers bloom, rivers swell, fey creatures emerge, and the world awakens.'
  }
  // Jun 21 – Sep 22: High Summer
  if ((month === 6 && day >= 21) || month === 7 || month === 8 || (month === 9 && day <= 22)) {
    return 'It is High Summer. The sun blazes, festivals abound, and ancient powers stir in the heat.'
  }
  // Sep 23 – Oct 24: Harvest
  if ((month === 9 && day >= 23) || (month === 10 && day <= 24)) {
    return 'It is the Harvest season. Fields are golden, bonfires light the night, and the world prepares for winter.'
  }
  return ''
}

function getCompletionsConfig(character: FantasyCharacter, context: string) {
  const model = 'gpt-4o'
  const reputationTier = getReputationTier(character.reputation)

  let reputationGuidance = ''
  if (character.reputation >= 150) {
    reputationGuidance = `This character is a ${reputationTier} (${character.reputation}). They are a mythic figure — kings seek their counsel, armies rally behind them, and merchants offer their finest wares at steep discounts. NPCs should be awestruck, reverent, or even intimidated by the character's sheer fame. Present world-shaping quests and legendary encounters.`
  } else if (character.reputation >= 100) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs revere the character. The best deals, exclusive quests, and powerful allies seek them out. Some NPCs may recognize the character by name and ask for help with critical tasks.`
  } else if (character.reputation >= 50) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be friendly and welcoming. Offer better deals, share secrets, and present important quests.`
  } else if (character.reputation >= 20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be generally positive and willing to help. Fair deals and occasional bonus opportunities.`
  } else if (character.reputation >= 0) {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are neutral — standard interactions and pricing.`
  } else if (character.reputation >= -20) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). NPCs should be suspicious and wary. Prices are higher, information is harder to obtain, and some may refuse to deal with the character.`
  } else if (character.reputation >= -50) {
    reputationGuidance = `This character has an ${reputationTier} reputation (${character.reputation}). NPCs are hostile or fearful. Bounty hunters or rival adventurers may appear. Prices are much higher. Very few friendly encounters — most NPCs want nothing to do with this character.`
  } else {
    reputationGuidance = `This character is a ${reputationTier} (${character.reputation}). They are actively hunted. NPCs flee or attack on sight. Guards may attempt arrest. Bounty hunters relentlessly pursue them. Prices are extortionate if anyone will even deal with them. The world has turned against this character — present desperate, dangerous situations with few allies.`
  }

  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const regionContext = `The character is currently in ${region.name}: ${region.description}. Setting/theme: ${region.theme}. Generate events that fit this setting. ${region.enemyTypes.length > 0 ? `Enemy types common here: ${region.enemyTypes.join(', ')}.` : 'This is a safe zone with no combat.'} The dominant element is ${region.element}.`

  const seasonalContext = getSeasonalContext()
  const seasonalInjection = seasonalContext
    ? `\n\nIMPORTANT — Seasonal context: ${seasonalContext}. Weave this theme subtly into the event's atmosphere and descriptions.`
    : ''

  const eventWeatherType = WEATHER_TYPES[(character.currentWeather ?? 'clear') as WeatherId] ?? WEATHER_TYPES.clear
  const weatherInjection = eventWeatherType.id !== 'clear'
    ? `\n\nWeather context: ${eventWeatherType.icon} ${eventWeatherType.name}. ${eventWeatherType.description} Weave the weather atmosphere subtly into events.`
    : ''

  // Build landmark context for potential revelation events
  let landmarkHint = ''
  const ls = character.landmarkState
  if (ls) {
    const hiddenLandmarks = ls.landmarks.filter(lm => lm.hidden)
    if (hiddenLandmarks.length > 0) {
      landmarkHint = `\n\nIMPORTANT — Hidden landmark opportunity:\nThere is a hidden landmark nearby: "${hiddenLandmarks[0].name}" (${hiddenLandmarks[0].type}). Occasionally (roughly 1 in 5 non-combat events), create an event where an NPC, old map, or mysterious sign reveals this hidden place. When this happens, set revealLandmark: true in the successEffects. Make the revelation feel natural — a traveler shares rumors, a map is found, or ancient markings are deciphered. Do NOT always reveal the landmark — only when narratively fitting.`
    }
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Generate 3 fantasy adventure events for this character. Reference their past adventures and current state when creating events. Events should feel like a continuation of their story, not random encounters.

IMPORTANT — Region context:
${regionContext}

IMPORTANT — Reputation guidance:
${reputationGuidance}
Tailor the tone, NPC attitudes, and available opportunities to reflect the character's reputation tier.

Sometimes include NPC encounters — named characters who offer services, quests, or trade based on the character's reputation. High-reputation characters should encounter friendly NPCs like healers offering free aid, royal messengers bearing gifts, and quest givers with important missions. Low-reputation characters may face bounty hunters demanding payment, shady dealers peddling stolen goods, or hostile NPCs who refuse to help.

When rewarding items, sometimes include consumable items (type: "consumable") with effects like stat boosts or gold. For healing items, use the 'heal' effect (e.g., heal: 15 restores 15 HP). The 'strength' effect permanently increases the strength stat. Examples: healing potions with heal: 10, scrolls that grant +2 intelligence, lucky coins that grant +1 luck, strength potions with +2 strength.
Sometimes include equipment items (type: "equipment") like weapons, armor, or accessories with stat-boosting effects. Examples: a steel sword with +2 strength, iron armor with +2 intelligence, or a lucky charm with +1 luck.
Sometimes reward spell scrolls — items with type "spell_scroll" containing a spell with a creative name, 2-3 effects, optional conditions, and tags. The spell field should have: id, name, description, school (arcane/nature/shadow/war), manaCost, cooldown, target (enemy/self), effects array, optional conditions array, and tags array.

IMPORTANT — Encounter effects:
Every encounter option MUST include meaningful successEffects and failureEffects with mechanical rewards or consequences. Do NOT create purely narrative encounters with empty effects. At minimum, include gold, reputation, or statusChange in each outcome path. Scale rewards by risk — dangerous options should offer higher gold (15-40) or item rewards but also include negative consequences on failure (gold loss, negative reputation, statusChange like "Wounded" or "Cursed"). Safe options should give smaller but guaranteed rewards (5-10 gold, +1 reputation). Example successEffects: { "gold": 15, "reputation": 1 }. Example failureEffects: { "gold": -5, "statusChange": "Bruised" }.

You can also use hpChange (negative for damage, positive for healing) and mpChange (negative for drain, positive for restore) to make encounters affect the character's health and mana. Examples: a poisoned trap with hpChange: -15, a healing spring with hpChange: 20 and mpChange: 10, a mana-draining curse with mpChange: -20. Use these to create more varied and impactful encounters.

IMPORTANT — Combat events:
Exactly 1 of the 3 events MUST be a combat encounter (bandits, monsters, aggressive creatures, rivals, etc.). That event MUST include at least one option with "triggersCombat": true — this represents the character choosing to fight. The other options on that event can be peaceful alternatives (negotiate, flee, pay a toll, sneak past). The remaining 2 events should be non-combat (exploration, social, discovery, etc.) with NO options that have triggersCombat. This ensures approximately 25% of events over time involve combat potential.

IMPORTANT — Mount events:
If the character has an active mount (check character.activeMount), occasionally include events where the mount can be harmed. Examples: a rock slide that injures the mount, a magical trap that wounds it, hostile wildlife attacking the mount, treacherous terrain causing injury. Use mountDamage (3–20) in failureEffects for partial damage, or mountDeath: true if the mount is killed outright. Only include mount-damaging outcomes when character.activeMount is not null/undefined.

Character:
${JSON.stringify(character, null, 2)}

Recent History & Context:
${context || 'No prior adventures yet — this is the beginning of their journey.'}${seasonalInjection}${weatherInjection}${landmarkHint}`,
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

function getRegionFallbackEvents(regionId: string): LLMGeneratedEvent[] {
  const s = `rfb-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const region = getRegion(regionId)

  const regionEvents: Record<string, LLMGeneratedEvent[]> = {
    dark_forest: [
      {
        id: `rfb-whisper-${s}`,
        description: 'Ancient trees whisper warnings as you venture deeper into the Dark Forest.',
        options: [
          { id: `listen-trees-${s}`, text: 'Listen carefully to the whispers', successProbability: 0.6,
            successDescription: 'The trees reveal a hidden path leading to a cache of shadow-infused crystals.',
            successEffects: { gold: 10, rewardItems: processFallbackRewardItems([{ id: `shadow-crystal-${s}`, name: 'Shadow Crystal', description: 'A dark crystal pulsing with shadow energy', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The whispers fade into silence, leaving you unsettled.',
            failureEffects: {} },
          { id: `press-on-${s}`, text: 'Ignore the whispers and press on', successProbability: 1.0,
            successDescription: 'You steel your nerves and continue deeper into the forest.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-spectral-${s}`,
        description: 'A spectral figure drifts between the trees, its ghostly light illuminating the fog.',
        options: [
          { id: `approach-spirit-${s}`, text: 'Approach the spirit', successProbability: 0.5,
            successDescription: 'The spirit is a lost guardian. It bestows a blessing upon you before vanishing.',
            successEffects: { reputation: 4 },
            failureDescription: 'The spirit turns hostile and lashes out with shadow energy before fading away.',
            failureEffects: { reputation: -2 } },
          { id: `fight-spirit-${s}`, text: 'Ready your weapon', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The spirit solidifies into a shadow beast!',
            successEffects: {}, failureDescription: 'The spirit solidifies into a shadow beast!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-shadow-wolves-${s}`,
        description: 'A pack of shadow wolves slinks through the dark undergrowth, their eyes glowing with an eerie violet light. The alpha pauses and locks eyes with you.',
        options: [
          { id: `tame-shadow-wolf-${s}`, text: 'Offer your hand to the alpha (taming attempt)', successProbability: 0.5,
            successDescription: 'The shadow wolf sniffs your hand, then nuzzles against it. The alpha accepts you as its pack leader! You have gained a new mount.',
            successEffects: { reputation: 3 },
            failureDescription: 'The wolf snarls and bolts into the shadows. It won\'t let you near.',
            failureEffects: {} },
          { id: `leave-wolves-${s}`, text: 'Back away slowly', successProbability: 1.0,
            successDescription: 'The pack watches you retreat before melting back into the darkness.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-treant-${s}`,
        description: 'A corrupted treant blocks the path, its bark oozing dark sap. It groans menacingly.',
        options: [
          { id: `purify-treant-${s}`, text: 'Try to purify the corruption', successProbability: 0.4,
            successDescription: 'Your efforts succeed! The treant calms and gifts you a branch of living wood.',
            successEffects: { reputation: 5, rewardItems: processFallbackRewardItems([{ id: `living-branch-${s}`, name: 'Living Branch', description: 'A branch that still pulses with nature magic', quantity: 1, type: 'equipment', effects: { strength: 1 } }]) },
            failureDescription: 'The corruption is too deep. The treant swings at you but you dodge away.',
            failureEffects: {} },
          { id: `fight-treant-${s}`, text: 'Cut it down', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The treant roars and attacks!',
            successEffects: {}, failureDescription: 'The treant roars and attacks!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-shadow-vines-${s}`,
        description: 'Shadow vines suddenly lash out from the undergrowth, writhing toward your mount.',
        options: [
          { id: `shield-mount-shadow-${s}`, text: 'Step in front to protect your mount', successProbability: 0.7,
            successDescription: 'You absorb the blow and your mount escapes unharmed.',
            successEffects: { reputation: 2 },
            failureDescription: 'The vines still manage to slash your mount before you can fully block them.',
            failureEffects: { mountDamage: 8 } },
          { id: `flee-shadow-vines-${s}`, text: 'Pull your mount away and flee', successProbability: 0.5,
            successDescription: 'You wrench your mount free and gallop clear of the writhing vines.',
            successEffects: {},
            failureDescription: 'The vines catch your mount before you escape, dealing a nasty gash.',
            failureEffects: { mountDamage: 8 } },
        ],
      },
      {
        id: `rfb-dark-hermit-${s}`,
        description: 'A cloaked hermit sits cross-legged in a clearing of dead trees, surrounded by floating shadow orbs. He opens one eye and addresses you without turning his head.',
        options: [
          { id: `dark-hermit-bargain-${s}`, text: 'Ask the hermit to share his knowledge', successProbability: 0.6,
            successDescription: 'The hermit nods. He inscribes a shadow incantation on bark and hands it to you, then dissolves into smoke.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `dark-hermit-${s}`)] },
            failureDescription: 'The hermit studies you in silence, then waves dismissively. He will not share his secrets with you today.',
            failureEffects: {} },
          { id: `dark-hermit-fight-${s}`, text: 'Demand his orbs by force', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The hermit rises, his orbs forming into shadow blades!',
            successEffects: {}, failureDescription: 'The hermit rises, his orbs forming into shadow blades!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-forest-shrine-${s}`,
        description: 'A crumbling shrine to a forgotten forest deity lies half-buried in roots and dark moss. Strange runes pulse faintly with residual power.',
        options: [
          { id: `offer-forest-shrine-${s}`, text: 'Leave an offering of 5 gold at the shrine', successProbability: 0.7,
            successDescription: 'The runes flare to life. A compartment opens in the base, revealing a preserved enchanted token.',
            successEffects: { gold: -5, reputation: 3, rewardItems: processFallbackRewardItems([{ id: `forest-token-${s}`, name: 'Forest Deity Token', description: 'A token blessed by an ancient forest deity, conferring luck', quantity: 1, type: 'consumable', effects: { luck: 2 } }]) },
            failureDescription: 'The runes flicker and dim. The shrine does not respond to your offering.',
            failureEffects: { gold: -5 } },
          { id: `study-forest-shrine-${s}`, text: 'Study the runes carefully', successProbability: 0.5,
            successDescription: 'Hours of study pay off — you decipher a prayer that fills you with renewed purpose.',
            successEffects: { reputation: 2 },
            failureDescription: 'The runes are too worn to interpret. You learn nothing.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-shadow-cat-${s}`,
        description: 'A sleek panther made entirely of living shadow stalks beside you, matching your pace. Its eyes glow like amber lanterns and it makes no sound whatsoever.',
        options: [
          { id: `tame-shadow-cat-${s}`, text: 'Offer your hand and speak softly (taming attempt)', successProbability: 0.45,
            successDescription: 'The shadow panther rubs against your leg, purring with a sound like distant thunder. It has chosen you! You have gained a new mount.',
            successEffects: { reputation: 4 },
            failureDescription: 'The panther hisses, bares its shadow-fangs, and vanishes into the dark.',
            failureEffects: {} },
          { id: `ignore-shadow-cat-${s}`, text: 'Ignore it and keep moving', successProbability: 1.0,
            successDescription: 'After a few minutes the panther loses interest and melts back into the shadows.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
    ],
    scorched_wastes: [
      {
        id: `rfb-fire-convergence-${s}`,
        description: 'Flames erupt from cracks in the scorched earth, spiraling upward into a vortex of pure fire magic. The heat is intense but the energy feels... learnable.',
        options: [
          { id: `channel-fire-${s}`, text: 'Channel the fire energy', successProbability: 0.5,
            successDescription: 'The fire energy condenses into a spell scroll in your hands! The vortex dissipates.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `fire-convergence-${s}`)] },
            failureDescription: 'The fire is too intense to control. It scorches the ground and fades.',
            failureEffects: {} },
          { id: `retreat-fire-${s}`, text: 'Keep your distance', successProbability: 1.0,
            successDescription: 'You watch the spectacular display from safety as it eventually burns out.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-phoenix-feather-${s}`,
        description: 'Among the scorched sands, you spot a single feather blazing with living flame. It hovers above the ground, radiating intense heat and pulsing with rebirth energy.',
        options: [
          { id: `claim-mount-phoenix-${s}`, text: 'Grasp the phoenix feather (taming attempt)', successProbability: 0.3,
            successDescription: 'The feather flares brilliantly and transforms into a majestic phoenix that bows before you. It has chosen you as its rider! You have gained a new mount.',
            successEffects: { reputation: 5 },
            failureDescription: 'The feather burns white-hot and disintegrates. The phoenix bolts skyward in a column of fire. It won\'t let you claim it.',
            failureEffects: {} },
          { id: `leave-feather-${s}`, text: 'Admire the feather from a safe distance', successProbability: 1.0,
            successDescription: 'The feather eventually burns out, leaving a small pile of warm ash.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-sandshift-${s}`,
        description: 'The sand shifts beneath your feet, revealing ancient ruins half-buried in the dunes.',
        options: [
          { id: `explore-ruins-${s}`, text: 'Explore the ruins', successProbability: 0.5,
            successDescription: 'You find an ancient fire-enchanted relic among the rubble!',
            successEffects: { gold: 12, rewardItems: processFallbackRewardItems([{ id: `fire-relic-${s}`, name: 'Ember Stone', description: 'A stone that radiates intense heat', quantity: 1, type: 'consumable', effects: { strength: 1 } }]) },
            failureDescription: 'The ruins crumble further. Nothing of value remains.',
            failureEffects: {} },
          { id: `avoid-ruins-${s}`, text: 'Move away carefully', successProbability: 1.0,
            successDescription: 'You skirt the unstable sands and continue safely.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-dunes-${s}`,
        description: 'Ancient ruins emerge from the dunes as the wind shifts, revealing a sealed chamber.',
        options: [
          { id: `break-seal-${s}`, text: 'Break the seal', successProbability: 0.4,
            successDescription: 'Inside you find scorched coins and a fire scroll!',
            successEffects: { gold: 15 },
            failureDescription: 'A fire trap triggers, singing your clothes. You escape unharmed but shaken.',
            failureEffects: { reputation: -1 } },
          { id: `fight-guardian-${s}`, text: 'Prepare for whatever guards it', triggersCombat: true,
            successProbability: 0.5, successDescription: 'A fire elemental bursts from the chamber!',
            successEffects: {}, failureDescription: 'A fire elemental bursts from the chamber!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-wyrm-${s}`,
        description: 'The ground trembles. A sand wyrm surfaces nearby, its scales glinting in the sun.',
        options: [
          { id: `fight-wyrm-${s}`, text: 'Face the sand wyrm', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The wyrm lunges at you!',
            successEffects: {}, failureDescription: 'The wyrm lunges at you!', failureEffects: {} },
          { id: `hide-wyrm-${s}`, text: 'Hide behind the dunes', successProbability: 0.6,
            successDescription: 'The wyrm passes by without noticing you.',
            successEffects: {}, failureDescription: 'It notices your movement but loses interest.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-fire-geyser-${s}`,
        description: 'Without warning, a fire geyser erupts from a crack in the earth directly beneath your mount.',
        options: [
          { id: `yank-mount-geyser-${s}`, text: 'Yank your mount aside at the last moment', successProbability: 0.6,
            successDescription: 'You pull your mount clear just in time — the geyser scorches the ground where it stood.',
            successEffects: { reputation: 2 },
            failureDescription: 'The geyser catches your mount in a burst of scalding flame before you can react.',
            failureEffects: { mountDamage: 12 } },
          { id: `endure-geyser-${s}`, text: 'Trust your mount to endure', successProbability: 0.4,
            successDescription: 'Your mount leaps clear instinctively, completely unharmed.',
            successEffects: {},
            failureDescription: 'The geyser hits full-force, seriously burning your mount.',
            failureEffects: { mountDamage: 12 } },
        ],
      },
      {
        id: `rfb-scorched-merchant-${s}`,
        description: 'A sun-scorched merchant hunches beside a cracked cart, fanning himself with a battered map. His wares are half-melted but he claims one item survived the heat perfectly.',
        options: [
          { id: `buy-scorched-goods-${s}`, text: 'Buy the surviving item (8 gold)', successProbability: 0.7,
            successDescription: 'The item is indeed pristine — a fire-tempered blade of surprising quality.',
            successEffects: { gold: -8, rewardItems: processFallbackRewardItems([{ id: `fire-blade-${s}`, name: 'Fire-Tempered Blade', description: 'A blade hardened in extreme volcanic heat, razor sharp', quantity: 1, type: 'equipment', effects: { strength: 2 } }]) },
            failureDescription: 'The item crumbles the moment you touch it. The merchant shrugs apologetically.',
            failureEffects: { gold: -8 } },
          { id: `help-merchant-${s}`, text: 'Help repair his cart', successProbability: 0.6,
            successDescription: 'You spend an hour patching the wheel. The grateful merchant gives you water and a pouch of coins.',
            successEffects: { gold: 8, reputation: 3 },
            failureDescription: 'You try but lack the right tools. At least the merchant appreciates the effort.',
            failureEffects: { reputation: 1 } },
        ],
      },
      {
        id: `rfb-oasis-${s}`,
        description: 'A shimmering oasis appears ahead — real or mirage? Crystal water surrounded by impossible green palms beckons through the wavering heat.',
        options: [
          { id: `approach-oasis-${s}`, text: 'Approach and investigate', successProbability: 0.6,
            successDescription: 'It is real! You drink deep and find a cache of fire-resistant armor buried under the palms.',
            successEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `heat-mantle-${s}`, name: 'Heat-Resistant Mantle', description: 'A cloak woven from ashsilk that insulates against extreme heat', quantity: 1, type: 'equipment', effects: { intelligence: 1, luck: 1 } }]) },
            failureDescription: 'It is a mirage. The disappointment is rough but you recover your bearings.',
            failureEffects: {} },
          { id: `ignore-oasis-${s}`, text: 'Press on without risking the detour', successProbability: 1.0,
            successDescription: 'You push through the heat. Discipline over temptation.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-fire-cultists-${s}`,
        description: 'Robed cultists dance around a bonfire in the wastes, chanting to a fire deity. Their leader spots you and calls out: "Stranger! Join our rite and be blessed, or move along!"',
        options: [
          { id: `join-cultist-rite-${s}`, text: 'Participate in the fire rite', successProbability: 0.5,
            successDescription: 'The flames embrace you and you emerge unburned. The cultists cheer and offer a fire-blessed item.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `fire-talisman-${s}`, name: 'Fire Talisman', description: 'A talisman blessed in the cultist fire rite, radiating warmth', quantity: 1, type: 'consumable', effects: { strength: 1 } }]) },
            failureDescription: 'The flames spit you out, scorching your cloak. The cultists mutter disappointedly.',
            failureEffects: { reputation: -1 } },
          { id: `attack-cultists-${s}`, text: 'Move to scatter the dangerous cult', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The cultists draw ritual blades and the leader shouts a war cry!',
            successEffects: {}, failureDescription: 'The cultists draw ritual blades and the leader shouts a war cry!', failureEffects: {} },
        ],
      },
    ],
    frozen_peaks: [
      {
        id: `rfb-ice-convergence-${s}`,
        description: 'Frost crystals spiral in mid-air, drawn together by an unseen force. The convergence of ice magic forms glowing runes that hang in the freezing air.',
        options: [
          { id: `grasp-ice-${s}`, text: 'Grasp the ice runes', successProbability: 0.5,
            successDescription: 'The runes solidify into a frost-covered spell scroll! The convergence shatters into snowflakes.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `ice-convergence-${s}`)] },
            failureDescription: 'The runes shatter before you can reach them, leaving only frost on your fingertips.',
            failureEffects: {} },
          { id: `wait-ice-${s}`, text: 'Observe the phenomenon', successProbability: 0.8,
            successDescription: 'You watch in awe as the magic plays out, learning something about the nature of ice magic.',
            successEffects: { reputation: 2 },
            failureDescription: 'The convergence fades quickly, leaving nothing behind.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-ice-griffin-${s}`,
        description: 'High on a frozen ledge, you spot an abandoned griffin nest. Inside, a lone griffin chick chirps weakly, its frost-blue feathers ruffled against the cold.',
        options: [
          { id: `tame-griffin-chick-${s}`, text: 'Wrap the chick in your cloak and raise it (taming attempt)', successProbability: 0.4,
            successDescription: 'The griffin chick bonds with you instantly, nuzzling into your warmth. As you care for it, it grows rapidly into a majestic ice griffin mount! You have gained a new mount.',
            successEffects: { reputation: 4 },
            failureDescription: 'The chick screeches in alarm and bolts away. It won\'t let you near.',
            failureEffects: {} },
          { id: `leave-nest-${s}`, text: 'Leave the nest undisturbed', successProbability: 1.0,
            successDescription: 'You leave the chick, hoping its parent will return.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-blizzard-${s}`,
        description: 'A blizzard closes in rapidly. Visibility drops to near zero.',
        options: [
          { id: `endure-blizzard-${s}`, text: 'Push through the blizzard', successProbability: 0.4,
            successDescription: 'You emerge stronger on the other side, finding a frozen cache of supplies.',
            successEffects: { gold: 8, reputation: 3 },
            failureDescription: 'You lose your way briefly but eventually find shelter.',
            failureEffects: {} },
          { id: `shelter-blizzard-${s}`, text: 'Find shelter in an ice cave', successProbability: 0.7,
            successDescription: 'The cave is cozy. You find some frozen herbs with healing properties.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `frost-herbs-${s}`, name: 'Frost Herbs', description: 'Frozen herbs with potent restorative properties', quantity: 1, type: 'consumable', effects: { heal: 15 } }]) },
            failureDescription: 'The cave is empty but at least you stay warm.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-icebridge-${s}`,
        description: 'An ice bridge spans a bottomless chasm. It groans under an unseen weight.',
        options: [
          { id: `cross-ice-${s}`, text: 'Cross the ice bridge carefully', successProbability: 0.5,
            successDescription: 'You make it across! On the other side, you find a frozen treasure chest.',
            successEffects: { gold: 12 },
            failureDescription: 'The bridge cracks but holds. You scramble to safety on the other side.',
            failureEffects: {} },
          { id: `climb-around-${s}`, text: 'Find another way around', successProbability: 0.8,
            successDescription: 'The detour reveals an ice wraith guarding a passage.',
            successEffects: { reputation: 1 },
            failureDescription: 'The detour is long and tiring.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-frostgiant-${s}`,
        description: 'A frost giant stands watch over a narrow mountain pass, its breath forming clouds of ice.',
        options: [
          { id: `fight-giant-${s}`, text: 'Challenge the frost giant', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The giant roars and swings its massive club!',
            successEffects: {}, failureDescription: 'The giant roars and swings its massive club!', failureEffects: {} },
          { id: `tribute-giant-${s}`, text: 'Offer tribute (5 gold)', successProbability: 0.7,
            successDescription: 'The giant grunts and steps aside, letting you pass.',
            successEffects: { gold: -5, reputation: 2 },
            failureDescription: 'The giant takes your gold and still looks angry, but lets you pass.',
            failureEffects: { gold: -5 } },
        ],
      },
      {
        id: `rfb-avalanche-${s}`,
        description: 'A distant rumble grows to a roar — an avalanche is sweeping down the mountain slope, straight toward you and your mount.',
        options: [
          { id: `shield-mount-avalanche-${s}`, text: 'Place yourself between the snow and your mount', successProbability: 0.5,
            successDescription: 'You take the brunt of the avalanche, keeping your mount safe. Bruised but alive.',
            successEffects: { reputation: 3 },
            failureDescription: 'Snow crashes into your mount despite your efforts, burying it briefly before you dig it free.',
            failureEffects: { mountDamage: 15 } },
          { id: `gallop-clear-${s}`, text: 'Ride hard to outrun the avalanche', successProbability: 0.6,
            successDescription: 'Your mount\'s speed carries you both clear of the cascading snow.',
            successEffects: {},
            failureDescription: 'The avalanche overtakes you; your mount takes a crushing blow from a snow-laden boulder.',
            failureEffects: { mountDamage: 15 } },
        ],
      },
      {
        id: `rfb-frozen-explorer-${s}`,
        description: 'Half-buried in a drift, you find a frozen explorer still gripping a leather satchel. He is well-preserved by the cold — perhaps there is still time to help him.',
        options: [
          { id: `thaw-explorer-${s}`, text: 'Build a fire to thaw him out', successProbability: 0.5,
            successDescription: 'Against the odds, the explorer sputters awake. Delirious but grateful, he presses his satchel on you before passing out again.',
            successEffects: { gold: 12, reputation: 5, rewardItems: processFallbackRewardItems([{ id: `explorer-map-${s}`, name: 'Mountaineer\'s Map', description: 'A detailed map of hidden mountain passes and caches', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The frost is too deep. He does not revive, but at least he rests in peace now.',
            failureEffects: { reputation: 2 } },
          { id: `take-satchel-${s}`, text: 'Take his satchel without stopping', successProbability: 0.8,
            successDescription: 'Inside you find coins and a crumpled map — useful, but you feel a pang of guilt.',
            successEffects: { gold: 10, reputation: -2 },
            failureDescription: 'The frozen clasps resist your fingers. You manage to free only a few coins.',
            failureEffects: { gold: 3, reputation: -1 } },
        ],
      },
      {
        id: `rfb-ice-cave-spirit-${s}`,
        description: 'Deep in an ice cave, a pale spirit manifests from mist. She was once a lost noblewoman. She speaks: "Retrieve my signet ring from the cave depths and I will share a secret."',
        options: [
          { id: `find-ring-${s}`, text: 'Venture deeper to find the signet ring', successProbability: 0.5,
            successDescription: 'You brave the cold and find the ring on a frozen pedestal. The spirit smiles and whispers the location of a hidden treasure cache.',
            successEffects: { gold: 15, reputation: 4 },
            failureDescription: 'The ring is buried too deep. You emerge empty-handed and the spirit sighs sadly.',
            failureEffects: {} },
          { id: `ignore-spirit-${s}`, text: 'Leave the spirit to her fate', successProbability: 1.0,
            successDescription: 'You walk on. The spirit\'s whispers fade behind you.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-yeti-ambush-${s}`,
        description: 'A massive yeti drops from a ledge above, blocking the narrow mountain trail. It roars, exposing fearsome teeth, then sniffs the air curiously.',
        options: [
          { id: `fight-yeti-${s}`, text: 'Stand and fight the yeti', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The yeti swings a boulder-like fist at you!',
            successEffects: {}, failureDescription: 'The yeti swings a boulder-like fist at you!', failureEffects: {} },
          { id: `offer-food-yeti-${s}`, text: 'Offer it some rations', successProbability: 0.7,
            successDescription: 'The yeti sniffs your rations, stuffs them in its mouth, then lumbers off the trail with a contented grunt.',
            successEffects: { reputation: 2 },
            failureDescription: 'The yeti ignores your offering but eventually loses interest and wanders off.',
            failureEffects: {} },
        ],
      },
    ],
    crystal_caves: [
      {
        id: `rfb-crystal-library-${s}`,
        description: 'Deep within the caves, crystalline shelves hold preserved spell tomes, their pages protected by arcane resonance.',
        options: [
          { id: `read-crystal-tome-${s}`, text: 'Study a glowing tome', successProbability: 0.6,
            successDescription: 'The crystal-preserved text reveals a powerful spell! You carefully transcribe it.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `crystal-tome-${s}`)] },
            failureDescription: 'The arcane resonance makes the text swim before your eyes. You cannot focus.',
            failureEffects: {} },
          { id: `harvest-crystals-${s}`, text: 'Harvest the crystal shelves', successProbability: 0.7,
            successDescription: 'You break off valuable crystal fragments.',
            successEffects: { gold: 10 },
            failureDescription: 'The crystals shatter into worthless dust.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-glowing-owl-${s}`,
        description: 'A luminous owl perches on a crystal stalactite above you, its feathers shimmering with arcane light. It tilts its head and hoots softly, studying you with intelligent eyes.',
        options: [
          { id: `tame-glowing-owl-${s}`, text: 'Extend your arm and whistle gently (taming attempt)', successProbability: 0.6,
            successDescription: 'The owl flutters down and lands on your arm, its warm glow enveloping you. It has chosen you as its companion! You have gained a new mount.',
            successEffects: { reputation: 3 },
            failureDescription: 'The owl hoots dismissively and bolts deeper into the caves. It won\'t let you near.',
            failureEffects: {} },
          { id: `watch-owl-${s}`, text: 'Watch the owl in wonder', successProbability: 1.0,
            successDescription: 'The owl takes flight, trailing sparkles through the dark cavern. A beautiful sight.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-crystalhum-${s}`,
        description: 'Crystals hum with magical energy, their light pulsing in rhythmic patterns.',
        options: [
          { id: `attune-crystal-${s}`, text: 'Attune to the crystal frequency', successProbability: 0.5,
            successDescription: 'The crystals resonate with your magic, granting you arcane insight.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `arcane-shard-${s}`, name: 'Arcane Shard', description: 'A crystal shard vibrating with arcane power', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The crystals dim. The resonance fades before you can grasp it.',
            failureEffects: {} },
          { id: `mine-crystal-${s}`, text: 'Mine the crystals for trade', successProbability: 0.6,
            successDescription: 'You chip off a few valuable crystal fragments.',
            successEffects: { gold: 10 },
            failureDescription: 'The crystals are too hard to break. Your tools are insufficient.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-underground-${s}`,
        description: 'An underground river blocks your path. Glowing crystals illuminate the dark water.',
        options: [
          { id: `swim-across-${s}`, text: 'Swim across', successProbability: 0.5,
            successDescription: 'You swim across safely and find a gem-encrusted alcove on the other side!',
            successEffects: { gold: 14 },
            failureDescription: 'The current is strong. You make it across but lose some supplies.',
            failureEffects: { gold: -3 } },
          { id: `follow-river-${s}`, text: 'Follow the river downstream', successProbability: 0.7,
            successDescription: 'The river leads to a cave opening with a gentle slope across.',
            successEffects: { reputation: 1 },
            failureDescription: 'A dead end. You have to backtrack.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-golem-${s}`,
        description: 'A crystal golem activates as you step too close, its body crackling with arcane energy.',
        options: [
          { id: `fight-golem-${s}`, text: 'Fight the crystal golem', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The golem charges with crystalline fists!',
            successEffects: {}, failureDescription: 'The golem charges with crystalline fists!', failureEffects: {} },
          { id: `deactivate-golem-${s}`, text: 'Try to find its off switch', successProbability: 0.3,
            successDescription: 'You find a rune on its back and deactivate it. A crystal core drops to the ground.',
            successEffects: { gold: 8, reputation: 3 },
            failureDescription: 'No luck. It swings at you but you dodge away as it powers down on its own.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-resonance-shockwave-${s}`,
        description: 'The crystals around you suddenly resonate at a dangerous frequency. A shockwave ripples outward — your mount shies and stumbles toward a jagged crystal wall.',
        options: [
          { id: `grab-mount-resonance-${s}`, text: 'Grab the reins and steer your mount away', successProbability: 0.6,
            successDescription: 'You wrestle control and guide your mount clear of the jagged crystals.',
            successEffects: { reputation: 1 },
            failureDescription: 'Your mount collides with the crystal wall, gashing its flank badly.',
            failureEffects: { mountDamage: 10 } },
          { id: `shatter-crystals-${s}`, text: 'Smash the resonating crystals to break the wave', successProbability: 0.5,
            successDescription: 'You shatter the source crystal and the shockwave collapses. Your mount is unharmed.',
            successEffects: { gold: 5 },
            failureDescription: 'You cannot reach the source in time — the shockwave slams your mount into the wall.',
            failureEffects: { mountDamage: 10 } },
        ],
      },
      {
        id: `rfb-crystal-elemental-${s}`,
        description: 'A crystal elemental crystallizes from the cave walls — sharp-edged and faceted, it gazes at you with gem-eyes. It does not attack but holds up a claw expectantly.',
        options: [
          { id: `give-crystal-${s}`, text: 'Offer it a coin as tribute', successProbability: 0.7,
            successDescription: 'It examines the coin, presses it to its chest, and extrudes a perfectly cut arcane gem in return.',
            successEffects: { gold: -1, rewardItems: processFallbackRewardItems([{ id: `arcane-gem-${s}`, name: 'Arcane Gem', description: 'A flawlessly cut gem pulsing with stored arcane energy', quantity: 1, type: 'consumable', effects: { intelligence: 2 } }]) },
            failureDescription: 'It examines the coin and flings it away. Too common for its tastes.',
            failureEffects: { gold: -1 } },
          { id: `fight-crystal-elem-${s}`, text: 'Attack the elemental before it can act', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The elemental bristles with sharp spines and charges!',
            successEffects: {}, failureDescription: 'The elemental bristles with sharp spines and charges!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-crystal-vision-${s}`,
        description: 'A giant central crystal emits a soft drone. When you touch it, visions flood your mind — glimpses of the caves, hidden paths, and buried wealth.',
        options: [
          { id: `follow-vision-${s}`, text: 'Follow the vision to the hidden cache', successProbability: 0.6,
            successDescription: 'The vision is accurate. You find a cache of gems and gold exactly where it showed.',
            successEffects: { gold: 16, reputation: 2 },
            failureDescription: 'The cache has already been looted by someone else, but the vision was real.',
            failureEffects: { reputation: 1 } },
          { id: `meditate-crystal-${s}`, text: 'Meditate on the vision for wisdom', successProbability: 0.7,
            successDescription: 'Hours of meditation crystallize into real insight. You feel more attuned to arcane forces.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `insight-shard-${s}`, name: 'Crystal Insight', description: 'Clarity distilled from crystal meditation', quantity: 1, type: 'consumable', effects: { intelligence: 1, luck: 1 } }]) },
            failureDescription: 'The vision dissipates too quickly to glean wisdom from it.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-crystal-colossus-${s}`,
        description: 'An enormous crystal colossus blocks the main tunnel, its slow gait rumbling the cave floor. Ancient and indifferent, it seems unbothered by your presence — for now.',
        options: [
          { id: `sneak-colossus-${s}`, text: 'Slip past while it\'s distracted', successProbability: 0.6,
            successDescription: 'You dart through its legs unnoticed. On the far side you find scattered crystal fragments worth good coin.',
            successEffects: { gold: 12 },
            failureDescription: 'It steps toward you and you scramble back. You must find another route.',
            failureEffects: {} },
          { id: `fight-colossus-${s}`, text: 'Challenge the crystal colossus', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The colossus swings a massive crystalline arm!',
            successEffects: {}, failureDescription: 'The colossus swings a massive crystalline arm!', failureEffects: {} },
        ],
      },
    ],
    shadow_realm: [
      {
        id: `rfb-warp-${s}`,
        description: 'Reality warps around you. The ground shifts between solid stone and void.',
        options: [
          { id: `navigate-warp-${s}`, text: 'Navigate by instinct', successProbability: 0.4,
            successDescription: 'Your instincts guide you through the distortion. You find a rift cache of shadow-gold.',
            successEffects: { gold: 20 },
            failureDescription: 'You stumble through but lose your bearings. Nothing gained, nothing lost.',
            failureEffects: {} },
          { id: `anchor-warp-${s}`, text: 'Anchor yourself with willpower', successProbability: 0.6,
            successDescription: 'You stabilize the area around you, earning respect from watchers in the void.',
            successEffects: { reputation: 4 },
            failureDescription: 'The distortion persists but eventually fades on its own.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-nightmare-${s}`,
        description: 'Nightmarish visions assail your mind — twisted versions of past battles and fallen friends.',
        options: [
          { id: `resist-nightmare-${s}`, text: 'Resist the visions with willpower', successProbability: 0.5,
            successDescription: 'You shatter the illusions and find clarity. A shadow gem materializes before you.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `shadow-gem-${s}`, name: 'Shadow Gem', description: 'A gem born from conquered nightmares', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The visions fade slowly, leaving you shaken but unharmed.',
            failureEffects: {} },
          { id: `fight-nightmare-${s}`, text: 'Fight the nightmare manifestation', triggersCombat: true,
            successProbability: 0.5, successDescription: 'A nightmare demon takes physical form!',
            successEffects: {}, failureDescription: 'A nightmare demon takes physical form!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-undead-${s}`,
        description: 'An undead knight kneels before a corrupted altar, its armor still bearing noble insignia.',
        options: [
          { id: `fight-undead-${s}`, text: 'Destroy the undead knight', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The knight rises, drawing a cursed blade!',
            successEffects: {}, failureDescription: 'The knight rises, drawing a cursed blade!', failureEffects: {} },
          { id: `purify-altar-${s}`, text: 'Try to purify the altar', successProbability: 0.3,
            successDescription: 'The altar cracks and the knight crumbles to peace. Its armor drops valuable gems.',
            successEffects: { gold: 18, reputation: 5 },
            failureDescription: 'The corruption is too strong. The knight stirs but ignores you.',
            failureEffects: { reputation: -1 } },
        ],
      },
      {
        id: `rfb-void-rift-${s}`,
        description: 'A void rift tears open beside you, and tendrils of shadow energy lash out toward your mount.',
        options: [
          { id: `pull-mount-rift-${s}`, text: 'Pull your mount away from the rift', successProbability: 0.6,
            successDescription: 'You drag your mount clear as the tendrils snap shut on empty air.',
            successEffects: { reputation: 1 },
            failureDescription: 'A shadow tendril wraps around your mount before you can react, draining its vitality.',
            failureEffects: { mountDamage: 10 } },
          { id: `attack-rift-${s}`, text: 'Strike at the rift to close it', successProbability: 0.4,
            successDescription: 'Your blow destabilizes the rift and it collapses harmlessly.',
            successEffects: { reputation: 3 },
            failureDescription: 'Your attack has no effect. The tendril strikes your mount hard.',
            failureEffects: { mountDamage: 10 } },
        ],
      },
      {
        id: `rfb-shadow-market-${s}`,
        description: 'At a crossroads of intersecting void-lanes, a pale vendor has set up a floating stall. His wares include objects that should not exist. He smiles with too many teeth: "Buy something."',
        options: [
          { id: `buy-shadow-item-${s}`, text: 'Browse and buy something (10 gold)', successProbability: 0.6,
            successDescription: 'The vendor produces a shadow-forged accessory that defies normal physics. It hums with dark power.',
            successEffects: { gold: -10, rewardItems: processFallbackRewardItems([{ id: `shadow-ring-${s}`, name: 'Shadow-Forged Ring', description: 'A ring forged in the shadow realm, bending light around it', quantity: 1, type: 'equipment', effects: { luck: 2, intelligence: 1 } }]) },
            failureDescription: 'The item crumbles into void-dust as you pay. The vendor shrugs apologetically and vanishes.',
            failureEffects: { gold: -10 } },
          { id: `ignore-shadow-market-${s}`, text: 'Keep walking — this feels like a trap', successProbability: 1.0,
            successDescription: 'The stall folds itself into shadow behind you. Good call.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-forgotten-soul-${s}`,
        description: 'A forgotten soul drifts before you — a scholar trapped in the shadow realm for centuries. He begs you to carry a message to the living world.',
        options: [
          { id: `carry-message-${s}`, text: 'Agree to carry his message', successProbability: 0.8,
            successDescription: 'The scholar weeps tears of light and presses an ancient scroll into your hands. "My thanks, traveler."',
            successEffects: { reputation: 5, rewardItems: [createSpellScrollRewardItem(5, `soul-message-${s}`)] },
            failureDescription: 'The scholar fades before he can finish telling you the message. Only a fragment of knowledge remains.',
            failureEffects: { reputation: 2 } },
          { id: `demand-payment-soul-${s}`, text: 'Demand payment upfront', successProbability: 0.5,
            successDescription: 'The soul nods and conjures shadow-gold from the void for you.',
            successEffects: { gold: 15, reputation: -2 },
            failureDescription: 'The scholar has nothing to offer. He drifts away in silence.',
            failureEffects: { reputation: -1 } },
        ],
      },
      {
        id: `rfb-shadow-doppelganger-${s}`,
        description: 'A perfect shadow copy of yourself steps from the darkness, matching your every move with an unsettling grin. It blocks your path and raises a shadowy weapon.',
        options: [
          { id: `fight-doppelganger-${s}`, text: 'Fight your shadow self', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The doppelganger attacks with your own fighting style!',
            successEffects: {}, failureDescription: 'The doppelganger attacks with your own fighting style!', failureEffects: {} },
          { id: `outwit-doppelganger-${s}`, text: 'Outwit it by doing the unexpected', successProbability: 0.5,
            successDescription: 'You do the last thing it expects. The doppelganger stutters and dissolves — leaving behind a residue of shadow essence.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `shadow-essence-${s}`, name: 'Shadow Essence', description: 'Condensed shadow energy crystallized from a defeated doppelganger', quantity: 1, type: 'consumable', effects: { strength: 1, luck: 1 } }]) },
            failureDescription: 'It mirrors your trick back at you. You both stand dumbfounded until it fades away.',
            failureEffects: {} },
        ],
      },
    ],
    sunken_ruins: [
      {
        id: `rfb-drowned-treasure-${s}`,
        description: 'You discover a flooded vault deep within the sunken temple. Air pockets shimmer above the waterline, and you can see the glint of gold beneath the murky surface.',
        options: [
          { id: `dive-vault-${s}`, text: 'Dive into the flooded vault', successProbability: 0.5,
            successDescription: 'You hold your breath and reach the treasure! Ancient coins and a waterproof scroll are yours.',
            successEffects: { gold: 15, rewardItems: processFallbackRewardItems([{ id: `waterproof-scroll-${s}`, name: 'Waterproof Scroll', description: 'An ancient scroll preserved by magical wax', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The current pulls you under and you barely escape, gasping for air.',
            failureEffects: {} },
          { id: `play-safe-vault-${s}`, text: 'Search the dry areas instead', successProbability: 0.8,
            successDescription: 'You find a few coins scattered on the dry ledges.',
            successEffects: { gold: 5 },
            failureDescription: 'Nothing of value in the dry sections.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-coral-guardian-${s}`,
        description: 'A massive coral golem blocks a narrow passage between flooded temple halls. Its crystalline eyes pulse with an ancient ward.',
        options: [
          { id: `fight-coral-${s}`, text: 'Fight the coral guardian', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The golem animates and swings its barnacle-encrusted fists!',
            successEffects: {}, failureDescription: 'The golem animates and swings its barnacle-encrusted fists!', failureEffects: {} },
          { id: `find-another-way-${s}`, text: 'Search for another passage', successProbability: 0.6,
            successDescription: 'You find a side passage that bypasses the guardian entirely.',
            successEffects: { reputation: 1 },
            failureDescription: 'All other passages are completely flooded. You must turn back.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-sea-map-${s}`,
        description: 'Wedged between two coral-encrusted pillars, you find a waterproof map case. Inside, a remarkably preserved chart shows mysterious markings and routes.',
        options: [
          { id: `study-map-${s}`, text: 'Study the ancient sea map carefully', successProbability: 0.6,
            successDescription: 'The map reveals hidden knowledge of the ruins. You feel wiser for studying it.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `sea-chart-${s}`, name: 'Ancient Sea Chart', description: 'A chart revealing hidden underwater passages', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The markings are too faded to decipher fully, but it was worth trying.',
            failureEffects: {} },
          { id: `sell-map-${s}`, text: 'Keep it to sell to a collector', successProbability: 0.9,
            successDescription: 'This antique map will fetch a fine price from the right buyer.',
            successEffects: { gold: 12 },
            failureDescription: 'On closer inspection, it is a common nautical chart. Worth a few coins at best.',
            failureEffects: { gold: 3 } },
        ],
      },
      {
        id: `rfb-collapsing-floor-${s}`,
        description: 'A section of the sunken temple floor collapses beneath your mount\'s weight, dropping it into a flooded chamber below.',
        options: [
          { id: `dive-rescue-mount-${s}`, text: 'Dive in to rescue your mount', successProbability: 0.7,
            successDescription: 'You plunge in and guide your mount to a shallow ledge. It is shaken but unharmed.',
            successEffects: { reputation: 3 },
            failureDescription: 'The current tosses your mount against the submerged stonework before you reach it.',
            failureEffects: { mountDamage: 8 } },
          { id: `guide-from-above-${s}`, text: 'Guide your mount from the edge', successProbability: 0.5,
            successDescription: 'Your mount finds its footing and climbs back up on its own.',
            successEffects: {},
            failureDescription: 'Your mount struggles in the water, bruised from the impact, before scrambling out.',
            failureEffects: { mountDamage: 8 } },
        ],
      },
      {
        id: `rfb-ancient-inscription-${s}`,
        description: 'A submerged wall bears an enormous inscription, still perfectly legible through the crystal-clear water. It describes the history of the sunken civilization in extraordinary detail.',
        options: [
          { id: `transcribe-inscription-${s}`, text: 'Carefully transcribe the inscription', successProbability: 0.7,
            successDescription: 'The transcription takes hours but yields extraordinary knowledge. Scholars would pay a fortune for this.',
            successEffects: { gold: 14, reputation: 4, rewardItems: processFallbackRewardItems([{ id: `sunken-chronicle-${s}`, name: 'Sunken Chronicle', description: 'A transcription of the sunken civilization\'s history, rich with lost knowledge', quantity: 1, type: 'consumable', effects: { intelligence: 2 } }]) },
            failureDescription: 'The water distorts the inscription too much. You capture only fragments.',
            failureEffects: { reputation: 1 } },
          { id: `look-for-exit-${s}`, text: 'Search for a secret door mentioned in the text', successProbability: 0.4,
            successDescription: 'You find a hidden passage behind a loose stone block. It leads to a dry treasure room!',
            successEffects: { gold: 20, reputation: 2 },
            failureDescription: 'You search every wall but find nothing. The door may have collapsed centuries ago.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-sea-witch-${s}`,
        description: 'A sea witch materializes from swirling brine, her hair flowing with living seaweed. "I sense power in you, wanderer. Shall we make a deal?"',
        options: [
          { id: `deal-sea-witch-${s}`, text: 'Negotiate with the sea witch', successProbability: 0.5,
            successDescription: 'The witch grins and trades a water-magic scroll for a lock of your hair.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(6, `sea-witch-${s}`)] },
            failureDescription: 'She cackles and demands too much. You decline and she vanishes with a disappointed splash.',
            failureEffects: {} },
          { id: `fight-sea-witch-${s}`, text: 'Attack before she can cast', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The witch shrieks and conjures tidal forces to fight you!',
            successEffects: {}, failureDescription: 'The witch shrieks and conjures tidal forces to fight you!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-sunken-armory-${s}`,
        description: 'You push open a barnacle-crusted door to find a perfectly preserved sunken armory. Racks of weapons and armor line the walls, maintained by ancient preservation enchantments.',
        options: [
          { id: `claim-armory-item-${s}`, text: 'Claim the finest piece you can find', successProbability: 0.7,
            successDescription: 'You select a beautifully preserved gauntlet. It still crackles with ancient enchantment.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `sunken-gauntlet-${s}`, name: 'Sunken Warlord\'s Gauntlet', description: 'An enchanted gauntlet from the drowned armory, granting tremendous grip strength', quantity: 1, type: 'equipment', effects: { strength: 2 } }]) },
            failureDescription: 'The preservation enchantment expires the moment you touch the items. They crumble to rust.',
            failureEffects: {} },
          { id: `loot-armory-${s}`, text: 'Strip as much as you can carry', successProbability: 0.5,
            successDescription: 'You haul out several pieces and sell them for a tidy sum.',
            successEffects: { gold: 18, reputation: -1 },
            failureDescription: 'The items are heavier than they look. You salvage only fragments.',
            failureEffects: { gold: 5 } },
        ],
      },
    ],
    volcanic_forge: [
      {
        id: `rfb-dwarven-forge-${s}`,
        description: 'You stumble upon an abandoned dwarven forge, its anvil still glowing faintly with residual heat. Ancient tools line the walls, and raw metal ore sits in a bin.',
        options: [
          { id: `use-forge-${s}`, text: 'Attempt to use the ancient forge', successProbability: 0.5,
            successDescription: 'The forge roars to life! You hammer out a reinforcement for your weapon, strengthening it.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `forged-plate-${s}`, name: 'Forged Plate', description: 'A masterwork metal plate that bolsters your strength', quantity: 1, type: 'equipment', effects: { strength: 1 } }]) },
            failureDescription: 'The forge sputters and dies. You lack the skill to operate it.',
            failureEffects: {} },
          { id: `take-materials-${s}`, text: 'Take the raw materials instead', successProbability: 0.9,
            successDescription: 'You pocket valuable ore and metal scraps worth a decent sum.',
            successEffects: { gold: 10 },
            failureDescription: 'Most of the materials have corroded beyond use. You salvage a little.',
            failureEffects: { gold: 3 } },
        ],
      },
      {
        id: `rfb-lava-bridge-${s}`,
        description: 'A narrow stone bridge spans a river of molten lava. The heat is overwhelming and the bridge looks unstable. A safer but much longer path winds around the caldera.',
        options: [
          { id: `rush-bridge-${s}`, text: 'Rush across the lava bridge', successProbability: 0.5,
            successDescription: 'You sprint across just as a section crumbles behind you! On the far side, you find an obsidian cache.',
            successEffects: { gold: 14 },
            failureDescription: 'The bridge cracks and you barely leap to safety, singed but alive.',
            failureEffects: {} },
          { id: `safe-path-${s}`, text: 'Take the longer safe path', successProbability: 1.0,
            successDescription: 'The longer route is uneventful but safe. You continue without incident.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-magma-beast-${s}`,
        description: 'The lava bubbles violently and a creature of living magma rises from the molten rock. Its eyes glow white-hot as it turns toward you.',
        options: [
          { id: `fight-magma-${s}`, text: 'Stand your ground and fight', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The magma beast lunges, spraying droplets of molten rock!',
            successEffects: {}, failureDescription: 'The magma beast lunges, spraying droplets of molten rock!', failureEffects: {} },
          { id: `flee-magma-${s}`, text: 'Flee before it fully forms', successProbability: 0.7,
            successDescription: 'You escape before it can give chase. It sinks back into the lava.',
            successEffects: {},
            failureDescription: 'It hurls a glob of lava after you but misses. You escape shaken.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-lava-splash-${s}`,
        description: 'A sudden eruption spews molten rock in a wide arc. Your mount rears in panic as lava droplets rain down.',
        options: [
          { id: `cover-mount-lava-${s}`, text: 'Shield your mount with your cloak', successProbability: 0.6,
            successDescription: 'Your cloak smolders but the lava misses your mount entirely.',
            successEffects: { reputation: 2 },
            failureDescription: 'A droplet of molten rock scorches your mount\'s flank despite your effort.',
            failureEffects: { mountDamage: 12 } },
          { id: `gallop-away-lava-${s}`, text: 'Spur your mount to gallop clear', successProbability: 0.5,
            successDescription: 'Your mount powers through, outrunning the rain of lava.',
            successEffects: {},
            failureDescription: 'Your mount is too slow — several burning droplets hit it as you flee.',
            failureEffects: { mountDamage: 12 } },
        ],
      },
      {
        id: `rfb-smith-spirit-${s}`,
        description: 'The ghost of a master smith materializes at an ancient anvil, hammering phantom metal. He notices you and pauses: "Been a while since someone living could see me. Want me to improve your equipment?"',
        options: [
          { id: `accept-ghost-smith-${s}`, text: 'Accept his offer', successProbability: 0.6,
            successDescription: 'The ghost smith works with supernatural precision. Your weapon glows with volcanic fire when he is done.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `volcanic-weapon-${s}`, name: 'Volcano-Tempered Weapon', description: 'A weapon reforged by a master smith\'s ghost, inlaid with volcanic metal', quantity: 1, type: 'equipment', effects: { strength: 2 } }]) },
            failureDescription: 'The ghost smith shakes his head — your equipment is beyond his ghostly reach. He fades.',
            failureEffects: {} },
          { id: `ask-smith-history-${s}`, text: 'Ask about the history of this forge', successProbability: 0.9,
            successDescription: 'He speaks for an hour of legendary battles and mighty weapons. His tales give you a deeper appreciation of craftsmanship.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `smith-token-${s}`, name: 'Smith\'s Memento', description: 'A token from the ghost smith commemorating the forge\'s history', quantity: 1, type: 'misc', effects: { luck: 1 } }]) },
            failureDescription: 'He begins but fades mid-sentence. The forge goes dark.',
            failureEffects: { reputation: 1 } },
        ],
      },
      {
        id: `rfb-obsidian-cache-${s}`,
        description: 'Beneath a solidified lava shelf you spot an obsidian chest, sealed with a heat-lock rune. The rune looks solvable, but the surrounding rock is razor-sharp.',
        options: [
          { id: `crack-heat-lock-${s}`, text: 'Solve the heat-lock rune', successProbability: 0.5,
            successDescription: 'The rune logic clicks. The chest pops open to reveal a cache of obsidian coins and a fire-magic scroll.',
            successEffects: { gold: 18, rewardItems: [createSpellScrollRewardItem(5, `obsidian-cache-${s}`)] },
            failureDescription: 'The rune triggers a flash of heat. You back away singed but unhurt.',
            failureEffects: {} },
          { id: `smash-chest-${s}`, text: 'Smash the chest open with brute force', successProbability: 0.4,
            successDescription: 'After exhausting effort you crack the chest. Inside: obsidian coins still warm from the earth.',
            successEffects: { gold: 14 },
            failureDescription: 'The obsidian chest is harder than it looks. Your weapon bounces off without a scratch.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-lava-golem-patrol-${s}`,
        description: 'A lava golem patrols a section of the forge, its molten body dripping onto the stone floor. It appears to be guarding a cluster of valuable volcanic ore.',
        options: [
          { id: `fight-lava-golem-${s}`, text: 'Engage the lava golem', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The golem turns and hurls a glob of molten rock!',
            successEffects: {}, failureDescription: 'The golem turns and hurls a glob of molten rock!', failureEffects: {} },
          { id: `wait-out-golem-${s}`, text: 'Wait patiently for it to move away', successProbability: 0.7,
            successDescription: 'Its patrol route eventually carries it around the corner. You swiftly claim the ore.',
            successEffects: { gold: 12, reputation: 1 },
            failureDescription: 'The golem\'s patrol overlaps the ore indefinitely. You eventually give up.',
            failureEffects: {} },
        ],
      },
    ],
    feywild_grove: [
      {
        id: `rfb-fairy-ring-${s}`,
        description: 'A perfect circle of glowing mushrooms pulses with fey energy. Tiny motes of light dance above the ring, and you feel a strange pull inviting you to step inside.',
        options: [
          { id: `step-into-ring-${s}`, text: 'Step into the fairy ring', successProbability: 0.5,
            successDescription: 'The fey magic washes over you, granting a blessing! You feel luckier and more attuned to magic.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `fey-blessing-${s}`, name: 'Fey Blessing Charm', description: 'A shimmering charm infused with fairy luck', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The ring curses you with a prickling chill. The fey giggle as you stumble out.',
            failureEffects: { reputation: -1 } },
          { id: `avoid-ring-${s}`, text: 'Walk around the ring carefully', successProbability: 1.0,
            successDescription: 'You wisely avoid the unpredictable fey magic and continue on your way.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-trickster-fey-${s}`,
        description: 'A mischievous fey creature with butterfly wings and a sly grin materializes before you. "Play a game with me, mortal! If you win, I reward you handsomely. If you lose... well..."',
        options: [
          { id: `play-game-${s}`, text: 'Accept the fey\'s game', successProbability: 0.5,
            successDescription: 'You win the game of riddles! The fey grudgingly hands over a pouch of gold and bows with respect.',
            successEffects: { gold: 15, reputation: 3 },
            failureDescription: 'The fey outsmarts you and snatches some of your gold with a cackle before vanishing.',
            failureEffects: { gold: -8 } },
          { id: `decline-game-${s}`, text: 'Politely decline', successProbability: 0.8,
            successDescription: 'The fey pouts but respects your caution and flutters away.',
            successEffects: {},
            failureDescription: 'The fey huffs and throws a pinecone at you before vanishing.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-enchanted-glade-${s}`,
        description: 'You enter a serene, sun-dappled clearing. Soft music seems to emanate from the flowers themselves, and a warm, healing energy fills the air.',
        options: [
          { id: `rest-glade-${s}`, text: 'Rest in the enchanted glade', successProbability: 0.8,
            successDescription: 'The glade\'s magic mends your wounds and refreshes your spirit. You feel renewed.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `glade-nectar-${s}`, name: 'Fey Nectar', description: 'A vial of healing nectar from the enchanted glade', quantity: 1, type: 'consumable', effects: { heal: 20 } }]) },
            failureDescription: 'The healing energy is faint today, but the rest is still welcome.',
            failureEffects: {} },
          { id: `press-on-glade-${s}`, text: 'Press on without stopping', successProbability: 1.0,
            successDescription: 'You continue through the grove, leaving the peaceful clearing behind.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-territorial-stag-${s}`,
        description: 'A massive territorial stag bursts from the undergrowth, antlers lowered. It charges directly at your mount.',
        options: [
          { id: `interpose-stag-${s}`, text: 'Step between the stag and your mount', successProbability: 0.6,
            successDescription: 'You stand your ground and the stag veers off at the last moment.',
            successEffects: { reputation: 2 },
            failureDescription: 'The stag catches your mount with a glancing blow from its antlers.',
            failureEffects: { mountDamage: 5 } },
          { id: `startle-stag-${s}`, text: 'Make noise to scare the stag away', successProbability: 0.7,
            successDescription: 'Your shouts startle the stag and it bolts back into the underbrush.',
            successEffects: {},
            failureDescription: 'The stag is undeterred by the noise and clips your mount before fleeing.',
            failureEffects: { mountDamage: 5 } },
        ],
      },
      {
        id: `rfb-fey-court-${s}`,
        description: 'Tiny fey courtiers line a mossy avenue, bowing as you approach. A herald announces: "The Summer Court grants audience! You may petition the fey nobility for one boon."',
        options: [
          { id: `petition-gold-${s}`, text: 'Ask for wealth', successProbability: 0.6,
            successDescription: 'The court erupts in laughter — then golden acorns rain down. Each is worth a coin.',
            successEffects: { gold: 15, reputation: 1 },
            failureDescription: 'The court sniffs disapprovingly. "Mortals and their gold. Ask for something interesting." You leave empty-handed.',
            failureEffects: { reputation: -1 } },
          { id: `petition-wisdom-${s}`, text: 'Ask for forbidden fey knowledge', successProbability: 0.5,
            successDescription: 'The court murmurs approvingly. A scroll bound with flowering vines materializes in your hands.',
            successEffects: { reputation: 4, rewardItems: [createSpellScrollRewardItem(6, `fey-court-${s}`)] },
            failureDescription: 'The court decides you are unworthy of their secrets. A cold wind shows you out.',
            failureEffects: { reputation: -2 } },
        ],
      },
      {
        id: `rfb-will-o-wisp-${s}`,
        description: 'A cluster of will-o-wisps bobs invitingly through the grove, leading you off the main path toward a soft glow between the trees.',
        options: [
          { id: `follow-wisps-${s}`, text: 'Follow the wisps', successProbability: 0.5,
            successDescription: 'The wisps lead you to a fairy treasure trove — a knot of roots filled with enchanted trinkets.',
            successEffects: { gold: 12, rewardItems: processFallbackRewardItems([{ id: `fairy-trinket-${s}`, name: 'Fairy Trinket', description: 'A glimmering trinket left by the fey, still warm with magic', quantity: 1, type: 'consumable', effects: { luck: 2 } }]) },
            failureDescription: 'The wisps lead you in circles and vanish, giggling invisibly. Just fey mischief.',
            failureEffects: {} },
          { id: `ignore-wisps-${s}`, text: 'Stay on the path', successProbability: 1.0,
            successDescription: 'You wisely ignore the wisps. Travelers who follow them often end up miles off course.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-fey-duel-${s}`,
        description: 'A fey knight in silver armor steps onto the path and challenges you to single combat, "for sport and glory." His eyes sparkle with excitement rather than malice.',
        options: [
          { id: `accept-fey-duel-${s}`, text: 'Accept the fey knight\'s duel', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The fey knight draws a shimmering blade and salutes!',
            successEffects: {}, failureDescription: 'The fey knight draws a shimmering blade and salutes!', failureEffects: {} },
          { id: `decline-fey-duel-${s}`, text: 'Decline graciously', successProbability: 0.8,
            successDescription: 'The knight bows. "Well-met, prudent one." He gifts you a fey blessing and steps aside.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `fey-blessing-vial-${s}`, name: 'Vial of Fey Blessing', description: 'A tiny vial of fey grace, conferring fortune', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The knight huffs but lets you pass.',
            failureEffects: {} },
        ],
      },
    ],
    bone_wastes: [
      {
        id: `rfb-necromancer-study-${s}`,
        description: 'Among the towering bones, you find an abandoned necromancer\'s study. Dark tomes and arcane instruments litter a makeshift desk. The books pulse with forbidden knowledge.',
        options: [
          { id: `study-tomes-${s}`, text: 'Study the necromantic tomes', successProbability: 0.4,
            successDescription: 'You carefully extract a powerful spell from the dark texts without succumbing to the curse.',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `necro-tome-${s}`)] },
            failureDescription: 'A curse lashes out from the pages! You slam the book shut, shaken but alive.',
            failureEffects: { reputation: -2 } },
          { id: `burn-tomes-${s}`, text: 'Burn the dark tomes', successProbability: 0.9,
            successDescription: 'The tomes burn with an eerie green flame. Nearby spirits seem to calm. You feel righteous.',
            successEffects: { reputation: 4 },
            failureDescription: 'The tomes resist the flame but eventually catch. The spirits notice your effort.',
            failureEffects: { reputation: 2 } },
        ],
      },
      {
        id: `rfb-restless-spirits-${s}`,
        description: 'Translucent ghosts drift among the leviathan bones, moaning in anguish. They turn toward you with hollow eyes, begging for release from their eternal torment.',
        options: [
          { id: `help-spirits-${s}`, text: 'Perform a release ritual', successProbability: 0.6,
            successDescription: 'The spirits sigh with relief as they finally find peace. Their gratitude empowers you.',
            successEffects: { reputation: 5 },
            failureDescription: 'The ritual partially works. Some spirits pass on, others remain.',
            failureEffects: { reputation: 2 } },
          { id: `bind-spirits-${s}`, text: 'Bind the spirits to your will', successProbability: 0.4,
            successDescription: 'The spirits submit to your command, granting you a surge of dark power.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `spirit-shard-${s}`, name: 'Spirit Shard', description: 'A crystallized fragment of bound spirit energy', quantity: 1, type: 'consumable', effects: { strength: 1 } }]), reputation: -3 },
            failureDescription: 'The spirits resist your binding and scatter into the wastes.',
            failureEffects: { reputation: -2 } },
        ],
      },
      {
        id: `rfb-bone-dragon-hoard-${s}`,
        description: 'A massive dragon skeleton lies curled around a mound of ancient treasure. The bones occasionally twitch with residual necromantic energy. The hoard gleams invitingly.',
        options: [
          { id: `fight-bone-dragon-${s}`, text: 'Disturb the hoard and face the guardian', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The bone dragon reassembles itself and attacks with a deafening roar!',
            successEffects: {}, failureDescription: 'The bone dragon reassembles itself and attacks with a deafening roar!', failureEffects: {} },
          { id: `sneak-past-${s}`, text: 'Try to sneak past without disturbing it', successProbability: 0.4,
            successDescription: 'You carefully creep past the skeleton and grab a handful of coins from the edge of the hoard.',
            successEffects: { gold: 18 },
            failureDescription: 'A bone shifts under your foot. The skeleton twitches but doesn\'t fully animate. You flee empty-handed.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-bone-curse-${s}`,
        description: 'A necromantic curse emanating from a buried ossuary triggers as your mount steps over it. Dark energy writhes around the beast.',
        options: [
          { id: `dispel-curse-mount-${s}`, text: 'Attempt to dispel the curse', successProbability: 0.5,
            successDescription: 'You channel your will and the dark energy dissipates before it can take hold.',
            successEffects: { reputation: 2 },
            failureDescription: 'The curse sinks into your mount before you can stop it, sapping its strength.',
            failureEffects: { mountDamage: 8 } },
          { id: `drag-mount-clear-${s}`, text: 'Drag your mount clear of the cursed ground', successProbability: 0.6,
            successDescription: 'You pull your mount free before the curse fully takes effect.',
            successEffects: {},
            failureDescription: 'Too slow — the curse flares and deals a painful blow before fading.',
            failureEffects: { mountDamage: 8 } },
        ],
      },
      {
        id: `rfb-lich-library-${s}`,
        description: 'A lich sits surrounded by floating tomes, completely absorbed in study. It raises one finger without looking up: "Mortal. Do not interrupt me, or barter knowledge. Choose quickly."',
        options: [
          { id: `barter-lich-${s}`, text: 'Offer to tell the lich something it doesn\'t know', successProbability: 0.4,
            successDescription: 'Your tale of the surface world surprises the lich. It nods and slides a glowing tome toward you.',
            successEffects: { reputation: 3, rewardItems: [createSpellScrollRewardItem(6, `lich-library-${s}`)] },
            failureDescription: 'The lich already knows what you say. "Boring." It returns to its studies.',
            failureEffects: {} },
          { id: `attack-lich-${s}`, text: 'Strike while its guard is down', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The lich closes its book and turns to face you with cold fury!',
            successEffects: {}, failureDescription: 'The lich closes its book and turns to face you with cold fury!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-bone-idol-${s}`,
        description: 'A towering idol constructed from interlocked bones dominates a clearing. Offerings of gold and skulls surround its base. It seems to glow faintly.',
        options: [
          { id: `leave-offering-idol-${s}`, text: 'Leave an offering at the idol (5 gold)', successProbability: 0.6,
            successDescription: 'The glow intensifies. You hear a whisper in an ancient tongue and feel a dark power fortify you.',
            successEffects: { gold: -5, reputation: -2, rewardItems: processFallbackRewardItems([{ id: `dark-blessing-${s}`, name: 'Dark Idol\'s Blessing', description: 'A fragment of dark power bestowed by the bone idol', quantity: 1, type: 'consumable', effects: { strength: 2 } }]) },
            failureDescription: 'Nothing happens. The idol does not acknowledge you.',
            failureEffects: { gold: -5 } },
          { id: `destroy-idol-${s}`, text: 'Destroy the dark idol', successProbability: 0.7,
            successDescription: 'The bones scatter as you smash the idol. Nearby spirits seem calmer. Your righteous act is noted.',
            successEffects: { reputation: 5 },
            failureDescription: 'The idol is too large to destroy alone. You knock a few bones loose and leave.',
            failureEffects: { reputation: 2 } },
        ],
      },
      {
        id: `rfb-wight-camp-${s}`,
        description: 'A camp of wights has set up around a large fire burning with green necromantic flame. They seem to be... cooking something. Their leader gestures you over.',
        options: [
          { id: `fight-wights-${s}`, text: 'Attack the wight camp', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The wights drop their meal and reach for rusty weapons!',
            successEffects: {}, failureDescription: 'The wights drop their meal and reach for rusty weapons!', failureEffects: {} },
          { id: `sneak-past-wights-${s}`, text: 'Sneak around the camp', successProbability: 0.6,
            successDescription: 'You circle wide through the bone-fields and bypass the camp entirely.',
            successEffects: { reputation: 1 },
            failureDescription: 'One wight turns its hollow gaze toward you, but seems uninterested. You quicken your pace.',
            failureEffects: {} },
        ],
      },
    ],
    dragons_spine: [
      {
        id: `rfb-dragons-bargain-${s}`,
        description: 'An ancient dragon, scales gleaming like molten gold, blocks the mountain pass. It speaks in a rumbling voice: "Mortal, I offer a trade. Your gold for my wisdom."',
        options: [
          { id: `accept-bargain-${s}`, text: 'Pay the dragon (15 gold)', successProbability: 0.7,
            successDescription: 'The dragon breathes ancient knowledge into your mind. You gain a powerful spell and feel transformed.',
            successEffects: { gold: -15, rewardItems: [createSpellScrollRewardItem(7, `dragon-wisdom-${s}`)] },
            failureDescription: 'The dragon takes your gold and imparts only a cryptic riddle. Unsatisfying, but memorable.',
            failureEffects: { gold: -15, reputation: 1 } },
          { id: `decline-bargain-${s}`, text: 'Decline respectfully', successProbability: 0.8,
            successDescription: 'The dragon snorts but respects your decision, letting you pass.',
            successEffects: {},
            failureDescription: 'The dragon growls but ultimately lets you pass.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-treasure-hoard-${s}`,
        description: 'You stumble upon an unguarded pile of treasure in a shallow cave — gold coins, gemstones, and ancient artifacts. It seems too easy...',
        options: [
          { id: `grab-treasure-${s}`, text: 'Grab the treasure', successProbability: 0.4,
            successDescription: 'It was genuinely unguarded! You fill your pockets with gold and gems.',
            successEffects: { gold: 25 },
            failureDescription: 'It was a trap! A young dragon drops from the cave ceiling!',
            failureEffects: {},
            triggersCombat: true },
          { id: `leave-treasure-${s}`, text: 'Leave it alone — too risky', successProbability: 1.0,
            successDescription: 'You wisely walk away. Better safe than sorry on the Dragon\'s Spine.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-dragonkin-camp-${s}`,
        description: 'A camp of dragonkin warriors blocks the mountain trail. Their leader steps forward, arms crossed: "Pay tribute to pass, or prove your worth in combat."',
        options: [
          { id: `pay-tribute-${s}`, text: 'Pay tribute (10 gold)', successProbability: 0.8,
            successDescription: 'The dragonkin accept your tribute and let you pass without trouble.',
            successEffects: { gold: -10, reputation: 1 },
            failureDescription: 'They demand more but eventually let you pass for the offered amount.',
            failureEffects: { gold: -10 } },
          { id: `fight-dragonkin-${s}`, text: 'Fight the dragonkin warriors', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The dragonkin draw their weapons and charge!',
            successEffects: {}, failureDescription: 'The dragonkin draw their weapons and charge!', failureEffects: {} },
          { id: `impress-dragonkin-${s}`, text: 'Try to impress them with your reputation', successProbability: 0.3,
            successDescription: 'The dragonkin recognize your deeds and bow respectfully, granting you passage and a gift.',
            successEffects: { reputation: 5, gold: 10 },
            failureDescription: 'They are unimpressed. "Gold or steel, mortal. Choose."',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-dragonfire-${s}`,
        description: 'A young dragon swoops low and lets loose a burst of dragonfire that streaks toward your mount.',
        options: [
          { id: `dive-off-mount-${s}`, text: 'Dive off your mount and pull it aside', successProbability: 0.5,
            successDescription: 'You and your mount hit the ground rolling, narrowly avoiding the dragonfire.',
            successEffects: { reputation: 2 },
            failureDescription: 'The dragonfire clips your mount despite your desperate dive.',
            failureEffects: { mountDamage: 14 } },
          { id: `use-terrain-dragon-${s}`, text: 'Duck behind a rock outcrop', successProbability: 0.7,
            successDescription: 'The stone absorbs the blast and you both emerge unscathed.',
            successEffects: {},
            failureDescription: 'The fire wraps around the rock and catches your mount on the flank.',
            failureEffects: { mountDamage: 14 } },
        ],
      },
      {
        id: `rfb-dragon-egg-${s}`,
        description: 'Tucked in a rocky alcove, you find a single dragon egg the size of a barrel, still warm. The parent is nowhere in sight. The egg pulses with magical heat.',
        options: [
          { id: `take-egg-${s}`, text: 'Take the dragon egg', successProbability: 0.4,
            successDescription: 'You wrap it carefully and carry it off. A fortune awaits — but so might an angry parent.',
            successEffects: { gold: 30, reputation: -3 },
            failureDescription: 'As you reach for it, a distant roar splits the air. You flee empty-handed.',
            failureEffects: {} },
          { id: `guard-egg-${s}`, text: 'Stand guard over the egg until the parent returns', successProbability: 0.6,
            successDescription: 'An enormous dragon lands before you. It regards you with ancient eyes, then nods once and drops a gem at your feet.',
            successEffects: { reputation: 8, rewardItems: processFallbackRewardItems([{ id: `dragon-gratitude-${s}`, name: 'Dragon\'s Gratitude Gem', description: 'A gem offered by a grateful dragon — carries a latent ward', quantity: 1, type: 'equipment', effects: { luck: 2 } }]) },
            failureDescription: 'You wait for hours. No dragon comes. The egg remains warm. You leave it undisturbed.',
            failureEffects: { reputation: 3 } },
        ],
      },
      {
        id: `rfb-petrified-hero-${s}`,
        description: 'A warrior stands petrified in stone in the middle of the path. His expression is one of pure defiance. Carved into his base: "Turned to stone by the dragon Verakath. May he be avenged."',
        options: [
          { id: `break-petrification-${s}`, text: 'Attempt to break the petrification curse', successProbability: 0.4,
            successDescription: 'The stone cracks. The warrior gasps and falls to his knees. Overwhelmed with gratitude, he gifts you his ancient sword.',
            successEffects: { reputation: 7, rewardItems: processFallbackRewardItems([{ id: `ancient-hero-sword-${s}`, name: 'Sword of the Petrified Hero', description: 'An ancient warrior\'s weapon, still sharp after decades in stone', quantity: 1, type: 'equipment', effects: { strength: 3 } }]) },
            failureDescription: 'The curse is too deep-rooted. The warrior remains stone. At least you tried.',
            failureEffects: { reputation: 2 } },
          { id: `leave-hero-${s}`, text: 'Leave the warrior and press on', successProbability: 1.0,
            successDescription: 'You continue. His defiant expression watches you go.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-scavenger-bandits-spine-${s}`,
        description: 'A pack of opportunistic bandits, daring enough to hunt in dragon territory, surround you with crossbows leveled. "Empty your pockets. Nice and slow."',
        options: [
          { id: `fight-spine-bandits-${s}`, text: 'Draw your weapon and fight back', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The bandits loose their crossbows as you charge!',
            successEffects: {}, failureDescription: 'The bandits loose their crossbows as you charge!', failureEffects: {} },
          { id: `lure-dragon-bandits-${s}`, text: 'Scream loudly to attract a dragon\'s attention', successProbability: 0.6,
            successDescription: 'The bandits look skyward in terror. They drop their weapons and scatter as a shadow passes overhead.',
            successEffects: { reputation: 3, gold: 5 },
            failureDescription: 'No dragon comes — but the bandits are rattled enough by the bluff to take less from you.',
            failureEffects: { gold: -5 } },
        ],
      },
    ],
    sky_citadel: [
      {
        id: `rfb-arcane-archive-${s}`,
        description: 'You discover an intact arcane archive, its floating bookshelves still maintained by ancient enchantments. Spell formulae shimmer on ethereal pages.',
        options: [
          { id: `study-archive-${s}`, text: 'Study the spell formulae', successProbability: 0.6,
            successDescription: 'You master one of the archived spells and record it on a scroll!',
            successEffects: { rewardItems: [createSpellScrollRewardItem(5, `archive-spell-${s}`)] },
            failureDescription: 'The formulae are too advanced for your current understanding.',
            failureEffects: {} },
          { id: `loot-archive-${s}`, text: 'Take the enchanted books to sell', successProbability: 0.7,
            successDescription: 'The enchanted tomes fetch a fine price.',
            successEffects: { gold: 15 },
            failureDescription: 'The books lose their enchantment once removed from the shelves.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-lightning-${s}`,
        description: 'Lightning crackles between floating platforms. The path ahead is electrified.',
        options: [
          { id: `time-jump-${s}`, text: 'Time your jumps between strikes', successProbability: 0.4,
            successDescription: 'You leap perfectly between bolts! On the far platform, you find arcane relics.',
            successEffects: { gold: 15, reputation: 3 },
            failureDescription: 'A near miss singes your cloak, but you make it across.',
            failureEffects: {} },
          { id: `find-path-${s}`, text: 'Look for a safer route', successProbability: 0.7,
            successDescription: 'You find a shielded walkway beneath the main platform.',
            successEffects: { reputation: 1 },
            failureDescription: 'No alternative route exists. You wait for the storm to pass.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-machinery-${s}`,
        description: 'Ancient arcane machinery whirs to life as you approach. Gears turn and runes glow.',
        options: [
          { id: `activate-machine-${s}`, text: 'Interact with the machinery', successProbability: 0.5,
            successDescription: 'The machine produces a powerful arcane component!',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `arcane-component-${s}`, name: 'Arcane Component', description: 'A precision-crafted magical component', quantity: 1, type: 'equipment', effects: { intelligence: 2 } }]) },
            failureDescription: 'The machine sputters and shuts down. Nothing useful comes out.',
            failureEffects: {} },
          { id: `fight-sentinel-${s}`, text: 'Prepare for the sentinel it summons', triggersCombat: true,
            successProbability: 0.5, successDescription: 'An arcane sentinel materializes from the machinery!',
            successEffects: {}, failureDescription: 'An arcane sentinel materializes from the machinery!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-skydragon-${s}`,
        description: 'An ancient dragon perches atop a crumbling tower, surveying the clouds below.',
        options: [
          { id: `challenge-dragon-${s}`, text: 'Challenge the dragon', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The dragon unleashes a torrent of arcane fire!',
            successEffects: {}, failureDescription: 'The dragon unleashes a torrent of arcane fire!', failureEffects: {} },
          { id: `parley-dragon-${s}`, text: 'Attempt to parley', successProbability: 0.3,
            successDescription: 'The dragon is impressed by your courage and shares ancient wisdom.',
            successEffects: { reputation: 6, gold: 20 },
            failureDescription: 'The dragon snorts dismissively but lets you pass.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-arcane-discharge-${s}`,
        description: 'An overloaded arcane generator discharges a bolt of lightning that arcs toward your mount.',
        options: [
          { id: `absorb-bolt-${s}`, text: 'Interpose yourself and absorb the bolt', successProbability: 0.5,
            successDescription: 'You ground the lightning through yourself. You feel the tingle but your mount is fine.',
            successEffects: { reputation: 3 },
            failureDescription: 'The bolt jumps past you and strikes your mount, coursing through its body.',
            failureEffects: { mountDamage: 10 } },
          { id: `redirect-bolt-${s}`, text: 'Redirect the bolt with a metal weapon', successProbability: 0.6,
            successDescription: 'You raise your blade and the bolt follows the metal harmlessly into the floor.',
            successEffects: {},
            failureDescription: 'The bolt forks — one arc hits your mount despite your attempt to redirect it.',
            failureEffects: { mountDamage: 10 } },
        ],
      },
      {
        id: `rfb-cloud-navigator-${s}`,
        description: 'An elderly cloud-navigator sits cross-legged on a floating platform, charts spread around him. He looks up. "Lost, are we? I can chart your course through the Citadel for a small fee."',
        options: [
          { id: `hire-navigator-${s}`, text: 'Pay for the navigator\'s guidance (8 gold)', successProbability: 0.8,
            successDescription: 'The navigator\'s route bypasses three dangerous zones entirely and shaves hours off your journey.',
            successEffects: { gold: -8, reputation: 2, rewardItems: processFallbackRewardItems([{ id: `sky-chart-${s}`, name: 'Sky Citadel Chart', description: 'A precise chart of the Citadel\'s platforms and safe routes', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The navigator\'s old charts are outdated. You end up in a dead end.',
            failureEffects: { gold: -8 } },
          { id: `find-own-way-${s}`, text: 'Trust your own judgment', successProbability: 0.5,
            successDescription: 'You navigate by intuition and find a shortcut the navigator would have missed.',
            successEffects: { reputation: 2, gold: 8 },
            failureDescription: 'You get briefly lost but eventually find your bearings.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-sky-pirates-${s}`,
        description: 'A sky pirate crew descends on tethered wingships, demanding a toll. Their captain grins through a bronze mask: "Pay the sky tax, or walk the plank. Quite a long drop from up here."',
        options: [
          { id: `fight-sky-pirates-${s}`, text: 'Fight the sky pirates', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The sky pirates draw cutlasses and charge!',
            successEffects: {}, failureDescription: 'The sky pirates draw cutlasses and charge!', failureEffects: {} },
          { id: `pay-sky-toll-${s}`, text: 'Pay the sky tax (12 gold)', successProbability: 0.9,
            successDescription: 'The captain tips his mask. "Pleasure doing business." The wingships peel away.',
            successEffects: { gold: -12, reputation: 1 },
            failureDescription: 'The captain is dissatisfied and takes extra. "Call it interest."',
            failureEffects: { gold: -18, reputation: -1 } },
        ],
      },
      {
        id: `rfb-crystal-observatory-${s}`,
        description: 'An intact crystal observatory floats serenely, its telescope pointed at the heavens. Constellation maps on the walls seem to indicate something hidden in the Citadel.',
        options: [
          { id: `study-constellations-${s}`, text: 'Study the constellation maps', successProbability: 0.6,
            successDescription: 'The maps reveal a hidden cache chamber. Following the directions, you locate it.',
            successEffects: { gold: 16, reputation: 2 },
            failureDescription: 'The maps use symbols you cannot decode. Fascinating but inscrutable.',
            failureEffects: {} },
          { id: `use-telescope-${s}`, text: 'Look through the telescope at the city below', successProbability: 0.8,
            successDescription: 'You spot a merchant caravan through the lens — and a glint that suggests dropped cargo worth retrieving.',
            successEffects: { gold: 10, reputation: 1 },
            failureDescription: 'The lens is too blurred to make anything out.',
            failureEffects: {} },
        ],
      },
    ],
    abyssal_depths: [
      {
        id: `rfb-tentacle-${s}`,
        description: 'A colossal tentacle erupts from the abyss below your feet, slamming against the obsidian floor where you stand.',
        options: [
          { id: `dodge-tentacle-${s}`, text: 'Dive and dodge the tentacle', successProbability: 0.7,
            successDescription: 'You roll clear as the tentacle crashes down. In the impact zone you spot scattered abyssal coins and a strange glowing shard.',
            successEffects: { gold: 20, reputation: 2, rewardItems: processFallbackRewardItems([{ id: `void-shard-${s}`, name: 'Void Shard', description: 'A fragment of solidified void energy', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The tentacle grazes you as you dodge, knocking you back. You scramble away unharmed but shaken.',
            failureEffects: { reputation: -1 } },
          { id: `fight-tentacle-${s}`, text: 'Draw your weapon and fight the creature', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The void creature drags itself fully from the depths, ready to fight!',
            successEffects: {}, failureDescription: 'The void creature drags itself fully from the depths, ready to fight!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-jellyfish-${s}`,
        description: 'Bioluminescent jellyfish drift around you, their soft glow revealing an ancient chest resting on the seafloor below a translucent membrane.',
        options: [
          { id: `dive-chest-${s}`, text: 'Dive through the membrane to reach the chest', successProbability: 0.6,
            successDescription: 'You breach the membrane and pry open the chest. Inside: ancient coins and an intact scroll of abyssal knowledge.',
            successEffects: { gold: 35, rewardItems: [createSpellScrollRewardItem(8, `abyssal-scroll-${s}`)] },
            failureDescription: 'The membrane resists your entry and the pressure forces you back. The chest remains out of reach.',
            failureEffects: {} },
          { id: `ignore-chest-${s}`, text: 'Admire the view and move on', successProbability: 1.0,
            successDescription: 'The jellyfish pulse gently as you pass, their bioluminescence lighting your way through the dark.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-titan-skull-${s}`,
        description: 'The skull of a drowned titan towers above you, its hollow eye sockets filled with pulsing shadow energy. Smaller void creatures nest within its jaw.',
        options: [
          { id: `search-skull-${s}`, text: 'Search the skull for treasure', successProbability: 0.5,
            successDescription: 'Wedged between massive teeth you find a cache of gold coins preserved for eons.',
            successEffects: { gold: 30, reputation: 2 },
            failureDescription: 'The shadow energy flares as you approach, driving you back empty-handed.',
            failureEffects: {} },
          { id: `channel-shadow-${s}`, text: 'Channel the shadow energy emanating from the eye sockets', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The shadow energy coalesces into a hostile void entity that lashes out!',
            successEffects: {}, failureDescription: 'The shadow energy coalesces into a hostile void entity that lashes out!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-abyssal-philosopher-${s}`,
        description: 'Floating in the abyss is a skeletal being in robes, apparently reading a book of void scripture. It looks up with empty eye sockets. "You seem lost. May I offer perspective?"',
        options: [
          { id: `discuss-void-${s}`, text: 'Engage in philosophical discussion', successProbability: 0.6,
            successDescription: 'The creature\'s insights reframe your entire understanding of the abyss. You feel wiser for it.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `void-insight-${s}`, name: 'Void Insight', description: 'A fragment of abyssal wisdom crystallized into usable form', quantity: 1, type: 'consumable', effects: { intelligence: 2 } }]) },
            failureDescription: 'Its perspective is too alien to parse. You nod politely and back away.',
            failureEffects: {} },
          { id: `demand-void-tome-${s}`, text: 'Demand its book by force', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The robed figure snaps its tome shut and conjures void tendrils!',
            successEffects: {}, failureDescription: 'The robed figure snaps its tome shut and conjures void tendrils!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-drowned-hoard-${s}`,
        description: 'Far below through the obsidian floor, you glimpse a vast treasure hoard sitting on a ledge over the infinite abyss. There appears to be a way down — but not necessarily back up.',
        options: [
          { id: `descend-to-hoard-${s}`, text: 'Risk the descent for the treasure', successProbability: 0.4,
            successDescription: 'You reach the ledge and fill your arms with ancient coins and gems before hauling yourself back up.',
            successEffects: { gold: 35, reputation: 3 },
            failureDescription: 'A handhold gives way. You barely catch yourself and climb back up empty-handed, heart pounding.',
            failureEffects: {} },
          { id: `observe-hoard-${s}`, text: 'Observe carefully for traps first', successProbability: 0.7,
            successDescription: 'You spot a safe route down and identify a magical tripwire. You avoid it and claim a portion of the hoard.',
            successEffects: { gold: 20, reputation: 2 },
            failureDescription: 'The route is too complex. Caution wins over greed today.',
            failureEffects: { reputation: 1 } },
        ],
      },
      {
        id: `rfb-echo-wraith-${s}`,
        description: 'An echo wraith — a creature made of spent screams — approaches slowly, its form flickering with captured sound. It opens its maw and a hundred voices cry out for release.',
        options: [
          { id: `fight-echo-wraith-${s}`, text: 'Banish the wraith with force', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The wraith shrieks and lunges, deafening sound crashing over you!',
            successEffects: {}, failureDescription: 'The wraith shrieks and lunges, deafening sound crashing over you!', failureEffects: {} },
          { id: `release-wraith-${s}`, text: 'Perform a release rite for the trapped souls', successProbability: 0.5,
            successDescription: 'The voices fade with sighs of relief. The wraith dissolves, leaving behind a void crystal as thanks.',
            successEffects: { reputation: 5, rewardItems: processFallbackRewardItems([{ id: `void-crystal-echo-${s}`, name: 'Echo Void Crystal', description: 'A crystal crystallized from released soul-energy, pulsing with abyssal power', quantity: 1, type: 'consumable', effects: { intelligence: 1, luck: 1 } }]) },
            failureDescription: 'The rite fails. The wraith moans and drifts away, still suffering.',
            failureEffects: {} },
        ],
      },
    ],
    green_meadows: [
      {
        id: `rfb-farmstead-${s}`,
        description: 'A cheerful farmstead sits amid rolling hills, its fields golden with grain. The farmer waves from the porch and calls out: "Hey, traveler! Could use an extra pair of hands for the morning!"',
        options: [
          { id: `help-farmer-${s}`, text: 'Lend a hand with the farm work', successProbability: 0.8,
            successDescription: 'You spend the morning helping with chores. The farmer rewards you generously with coin and fresh supplies.',
            successEffects: { gold: 12, reputation: 3, rewardItems: processFallbackRewardItems([{ id: `farm-bread-${s}`, name: 'Fresh Farmstead Loaf', description: 'Hearty bread baked fresh this morning — restores vigor', quantity: 1, type: 'consumable', effects: { heal: 10 } }]) },
            failureDescription: 'You do your best, but farm work is harder than it looks. The farmer thanks you with a small gift anyway.',
            failureEffects: { reputation: 1 } },
          { id: `decline-farmer-${s}`, text: 'Wish them well and continue on', successProbability: 1.0,
            successDescription: 'The farmer waves you off cheerfully. "Safe travels, then!" The wildflowers nod in the breeze as you pass.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-meadow-wildfire-${s}`,
        description: 'A spark from a nearby campfire catches the dry summer grass. Flames race across the meadow with alarming speed, and your mount shies as the smoke thickens.',
        options: [
          { id: `gallop-clear-fire-${s}`, text: 'Gallop your mount clear of the fire', successProbability: 0.6,
            successDescription: 'You spur your mount hard and clear the wall of flame with seconds to spare. You both emerge singed but safe.',
            successEffects: { reputation: 2 },
            failureDescription: 'The fire shifts with the wind and catches your mount on the flank before you can escape.',
            failureEffects: { mountDamage: 10 } },
          { id: `stamp-out-fire-${s}`, text: 'Try to stamp out the fire before it spreads', successProbability: 0.5,
            successDescription: 'You beat the fire back with your cloak and dirt. Nearby farmsteaders see your heroic effort.',
            successEffects: { reputation: 4 },
            failureDescription: 'The fire is too fast. You retreat, but not before it nips at your mount.',
            failureEffects: { mountDamage: 7 } },
        ],
      },
      {
        id: `rfb-wild-boar-${s}`,
        description: 'A large wild boar bursts from the hedgerow, tusks gleaming, charging across the meadow path directly toward you.',
        options: [
          { id: `fight-boar-${s}`, text: 'Draw your weapon and stand your ground', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The boar lowers its head and charges — this is going to be a fight!',
            successEffects: {}, failureDescription: 'The boar lowers its head and charges — this is going to be a fight!', failureEffects: {} },
          { id: `sidestep-boar-${s}`, text: 'Sidestep and let it pass', successProbability: 0.7,
            successDescription: 'You dodge deftly and the boar thunders past into the wildflowers. No harm done.',
            successEffects: { reputation: 1 },
            failureDescription: 'The boar clips you as it passes but you stay on your feet. It disappears into the meadow.',
            failureEffects: {} },
        ],
      },
      {
        id: `rfb-stream-treasure-${s}`,
        description: 'A gentle stream winds through the meadow, its clear water sparkling over smooth pebbles. One glint looks distinctly unnatural — something metallic under the surface.',
        options: [
          { id: `wade-stream-${s}`, text: 'Wade in and investigate the glint', successProbability: 0.6,
            successDescription: 'Your fingers close around a small iron box wedged between the rocks. Inside: gold coins and a traveler\'s lucky charm.',
            successEffects: { gold: 10, rewardItems: processFallbackRewardItems([{ id: `stream-charm-${s}`, name: 'Stream-Worn Lucky Stone', description: 'A smooth stone worn by the stream, cool and fortunate to the touch', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'It was just a piece of bright quartz. Pretty, but worthless. Your boots are wet now.',
            failureEffects: {} },
          { id: `drink-stream-${s}`, text: 'Enjoy a cool drink and move on', successProbability: 1.0,
            successDescription: 'The stream water is fresh and invigorating. You fill your waterskin and continue refreshed.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-traveling-merchant-meadow-${s}`,
        description: 'A colorful wagon sits parked by a wildflower hedgerow. A merchant in a bright coat calls out: "Exotic goods! Rare curiosities! Spices from the far east! Step right up!"',
        options: [
          { id: `browse-exotic-${s}`, text: 'Browse the exotic wares', successProbability: 0.7,
            successDescription: 'The merchant\'s wares are genuinely remarkable. You find a rare item at a fair price.',
            successEffects: { gold: -8, rewardItems: processFallbackRewardItems([{ id: `exotic-spice-${s}`, name: 'Exotic Spice Blend', description: 'A potent blend of rare spices said to sharpen the mind', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'Most of it is trinkets and overpriced junk. Nothing worth buying today.',
            failureEffects: {} },
          { id: `trade-info-${s}`, text: 'Trade news of the road for a free sample', successProbability: 0.8,
            successDescription: 'The merchant appreciates fresh road gossip and slips you a small vial of restorative tonic.',
            successEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `tonic-${s}`, name: 'Traveler\'s Tonic', description: 'A small restorative brew that soothes tired muscles', quantity: 1, type: 'consumable', effects: { heal: 8 } }]) },
            failureDescription: 'The merchant listens but waves you off without offering anything. "Old news," he sniffs.',
            failureEffects: {} },
        ],
      },
    ],
    celestial_throne: [
      {
        id: `rfb-divine-sentinel-${s}`,
        description: 'A divine sentinel in gleaming white armor bars your path, its celestial eyes boring into your soul. "Prove your worth, mortal, or turn back."',
        options: [
          { id: `challenge-sentinel-${s}`, text: 'Challenge the sentinel to single combat', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The sentinel raises its blade and lunges forward!',
            successEffects: {}, failureDescription: 'The sentinel raises its blade and lunges forward!', failureEffects: {} },
          { id: `diplomatic-pass-${s}`, text: 'Invoke your deeds and conquests to earn passage', successProbability: 0.3,
            successDescription: 'The sentinel considers your words, then steps aside. "Your legend precedes you. Pass, champion."',
            successEffects: { reputation: 8 },
            failureDescription: 'The sentinel shakes its head. "Words alone are not enough. Prove yourself with action."',
            failureEffects: { reputation: -2 } },
        ],
      },
      {
        id: `rfb-celestial-light-${s}`,
        description: 'A blinding pillar of celestial light descends before you, humming with divine energy. You feel it could grant great power — or destroy you.',
        options: [
          { id: `step-into-light-${s}`, text: 'Step into the celestial light', successProbability: 0.7,
            successDescription: 'The divine energy surges through you, filling you with clarity. A blessed scroll materializes in your hands.',
            successEffects: { reputation: 6, rewardItems: [createSpellScrollRewardItem(10, `celestial-scroll-${s}`)] },
            failureDescription: 'The light is too intense. You are blinded temporarily and stagger back, dazed but unharmed.',
            failureEffects: { reputation: -1 } },
          { id: `avoid-light-${s}`, text: 'Step around the pillar carefully', successProbability: 1.0,
            successDescription: 'You give the pillar wide berth. It eventually fades, leaving only a warm impression on the air.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-archangel-trial-${s}`,
        description: 'A corrupted archangel descends from the spires above, its once-white wings now streaked with void. It offers you a trial of strength.',
        options: [
          { id: `accept-trial-${s}`, text: 'Accept the archangel\'s trial', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The archangel spreads its massive wings and attacks!',
            successEffects: {}, failureDescription: 'The archangel spreads its massive wings and attacks!', failureEffects: {} },
          { id: `decline-trial-${s}`, text: 'Decline and move on', successProbability: 1.0,
            successDescription: 'The archangel watches you pass with cold, appraising eyes, then returns to the spires above.',
            successEffects: {}, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `rfb-celestial-oracle-${s}`,
        description: 'A veiled oracle sits in a beam of golden light, her eyes replaced by twin stars. "Ask one question, mortal. I will answer truly — if you can bear the truth."',
        options: [
          { id: `ask-oracle-future-${s}`, text: 'Ask about your destiny', successProbability: 0.7,
            successDescription: 'Her star-eyes bore into you. "Great deeds lie ahead, but greater trials first." She presses a celestial coin into your hands.',
            successEffects: { reputation: 5, rewardItems: processFallbackRewardItems([{ id: `celestial-coin-${s}`, name: 'Oracle\'s Celestial Coin', description: 'A coin touched by an oracle\'s prophecy, said to guide its bearer', quantity: 1, type: 'consumable', effects: { luck: 2 } }]) },
            failureDescription: 'The oracle shakes her head. "Some futures are not meant to be seen yet." She says nothing more.',
            failureEffects: {} },
          { id: `attack-oracle-${s}`, text: 'Strike before she can reveal something terrible', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The oracle rises, surrounded by divine fire!',
            successEffects: {}, failureDescription: 'The oracle rises, surrounded by divine fire!', failureEffects: {} },
        ],
      },
      {
        id: `rfb-divine-armory-${s}`,
        description: 'Floating above the clouds, an open armory displays divine weapons and armor suspended in beams of holy light. A golden plaque reads: "Only the worthy may claim one artifact."',
        options: [
          { id: `claim-divine-artifact-${s}`, text: 'Reach for an artifact', successProbability: 0.5,
            successDescription: 'The light accepts your worth. A gleaming piece descends into your hands.',
            successEffects: { reputation: 6, rewardItems: processFallbackRewardItems([{ id: `divine-artifact-${s}`, name: 'Divine Artifact', description: 'A weapon forged in celestial fires, radiating judgment and power', quantity: 1, type: 'equipment', effects: { strength: 3, intelligence: 1 } }]) },
            failureDescription: 'The light pushes your hand away. You are not yet worthy.',
            failureEffects: { reputation: -2 } },
          { id: `study-divine-armory-${s}`, text: 'Study the armory from a respectful distance', successProbability: 0.9,
            successDescription: 'Your restraint impresses a divine watcher. A small blessing descends upon you.',
            successEffects: { reputation: 4 },
            failureDescription: 'You observe but learn nothing actionable.',
            failureEffects: { reputation: 1 } },
        ],
      },
      {
        id: `rfb-fallen-paladin-${s}`,
        description: 'A paladin in tarnished divine armor kneels in the open air, weeping silently. His god has abandoned him and he cannot leave the Celestial Throne. He begs for help.',
        options: [
          { id: `help-fallen-paladin-${s}`, text: 'Help restore his faith', successProbability: 0.6,
            successDescription: 'Your words reach him. His armor gleams again as faith returns. Overcome with gratitude, he passes you his blessed shield.',
            successEffects: { reputation: 7, rewardItems: processFallbackRewardItems([{ id: `blessed-shield-${s}`, name: 'Shield of Renewed Faith', description: 'A paladin\'s shield restored to divine radiance, protective and pure', quantity: 1, type: 'equipment', effects: { intelligence: 2, luck: 1 } }]) },
            failureDescription: 'Your words cannot breach his grief. He thanks you for trying and returns to his silent vigil.',
            failureEffects: { reputation: 3 } },
          { id: `fight-paladin-${s}`, text: 'Challenge him to restore his fighting spirit', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The paladin rises to the challenge, divine energy surging back into his blade!',
            successEffects: {}, failureDescription: 'The paladin rises to the challenge, divine energy surging back into his blade!', failureEffects: {} },
        ],
      },
    ],
  }

  return regionEvents[regionId] ?? []
}

function createSpellScrollRewardItem(level: number, suffix: string): Item {
  const spell = generateSpellForLevel(level)
  return inferItemTypeAndEffects({
    id: `spell-scroll-${suffix}`,
    name: `Scroll of ${spell.name}`,
    description: `A magical scroll containing the spell ${spell.name}.`,
    quantity: 1,
    type: 'spell_scroll',
    spell,
  })
}

function createLegendarySpellScrollRewardItem(level: number, suffix: string): Item {
  return { ...createSpellScrollRewardItem(level, suffix), rarity: 'legendary' as const }
}

function getSeasonalFallbackEvents(): LLMGeneratedEvent[] {
  const s = `sfb-${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const now = new Date()
  const month = now.getMonth() + 1
  const day = now.getDate()

  // Oct 25 – Nov 1: Halloween
  if ((month === 10 && day >= 25) || (month === 11 && day === 1)) {
    return [
      {
        id: `sfb-jack-lantern-${s}`,
        description: 'A carved jack-o-lantern sits alone in the middle of the road, its candle burning with an eerie green flame. Its grin seems to shift as you approach.',
        options: [
          { id: `smash-lantern-${s}`, text: 'Smash the lantern', successProbability: 0.5,
            successDescription: 'A mischievous spirit bursts free with a cackle and drops a pouch of coins as thanks.',
            successEffects: { gold: 15, reputation: 2 },
            failureDescription: 'The smashed lantern releases a puff of foul smoke. Something unseen pinches you and cackles, then vanishes.',
            failureEffects: { reputation: -1 } },
          { id: `honor-lantern-${s}`, text: 'Leave an offering beside the lantern', successProbability: 0.9,
            successDescription: 'The flame flares warmly. You feel the blessing of the harvest spirits settle upon you.',
            successEffects: { reputation: 4, rewardItems: processFallbackRewardItems([{ id: `spirit-candy-${s}`, name: 'Ghost Pepper Candy', description: 'Spicy spirit-world candy that sharpens the senses', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The lantern flickers out. Nothing happens.',
            failureEffects: {} },
        ],
      },
      {
        id: `sfb-ghost-procession-${s}`,
        description: 'A silent procession of translucent figures drifts across the path. Their hollow eyes glow faintly as they pass — the restless dead walking on All Hallows\' Eve.',
        options: [
          { id: `join-procession-${s}`, text: 'Fall in step with the ghost procession', successProbability: 0.6,
            successDescription: 'The spirits accept your presence. They lead you to a hidden grave mound — inside: ancient burial gold.',
            successEffects: { gold: 18, reputation: 3 },
            failureDescription: 'The spirits turn and leer at you. You feel a chill pass through your bones but they move on without harming you.',
            failureEffects: {} },
          { id: `ward-off-ghosts-${s}`, text: 'Make a warding sign and step aside', successProbability: 1.0,
            successDescription: 'The ghosts pass without incident. One turns and nods — perhaps a grateful soul.',
            successEffects: { reputation: 1 }, failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `sfb-fog-wraith-${s}`,
        description: 'Thick, unnatural fog rolls across the meadow. Within it, a shape coalesces — the veil between worlds is thin tonight.',
        options: [
          { id: `fight-wraith-${s}`, text: 'Draw your weapon against the wraith', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The fog-wraith solidifies and shrieks — it means to fight!',
            successEffects: {}, failureDescription: 'The fog-wraith solidifies and shrieks — it means to fight!', failureEffects: {} },
          { id: `speak-wraith-${s}`, text: 'Call out to the wraith peacefully', successProbability: 0.6,
            successDescription: 'The wraith is a lost soul seeking remembrance. It gifts you a token from the other side before dissolving into the fog.',
            successEffects: { reputation: 4, rewardItems: processFallbackRewardItems([{ id: `wraith-token-${s}`, name: 'Wraith\'s Token', description: 'A cold coin from beyond the veil, radiating luck', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: 'The wraith moans and drifts away. The fog thickens, then slowly clears.',
            failureEffects: {} },
        ],
      },
    ]
  }

  // Dec 1 – Jan 6: Winter / Yuletide
  if (month === 12 || (month === 1 && day <= 6)) {
    return [
      {
        id: `sfb-gift-giver-${s}`,
        description: 'A mysterious figure in a heavy winter cloak trudges through the snow toward you, a large sack over one shoulder. They stop and study you with twinkling eyes. "I know what\'s in your heart, traveler."',
        options: [
          { id: `greet-gift-giver-${s}`, text: 'Greet them warmly', successProbability: 0.8,
            successDescription: 'The gift-giver reaches into the sack and produces something perfectly suited to your needs. "May your journey be bright."',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `yuletide-gift-${s}`, name: 'Yuletide Gift', description: 'A wrapped gift that radiates warmth and good fortune', quantity: 1, type: 'consumable', effects: { heal: 15, luck: 1 } }]) },
            failureDescription: 'The gift-giver shakes their head sadly. "Not yet ready, perhaps." They trudge on.',
            failureEffects: {} },
          { id: `follow-gift-giver-${s}`, text: 'Follow them out of curiosity', successProbability: 0.5,
            successDescription: 'They lead you to a cozy inn hidden in the snow. The innkeeper says your stay has been paid.',
            successEffects: { gold: 10, reputation: 2 },
            failureDescription: 'They disappear around a snow drift. No inn, no gift — just your footprints in the snow.',
            failureEffects: {} },
        ],
      },
      {
        id: `sfb-frozen-hearth-${s}`,
        description: 'A lone hearth fire burns in the ruins of a snow-covered cottage. Fresh bread sits on the windowsill, still steaming, as if left just moments ago.',
        options: [
          { id: `eat-bread-${s}`, text: 'Take the bread and warm yourself', successProbability: 0.9,
            successDescription: 'The bread is delicious and the fire warms you through. You feel restored.',
            successEffects: { rewardItems: processFallbackRewardItems([{ id: `winter-bread-${s}`, name: 'Yuletide Loaf', description: 'Warm bread infused with the magic of winter hearths', quantity: 1, type: 'consumable', effects: { heal: 20 } }]) },
            failureDescription: 'The bread is wonderful but no one appears. You leave a coin by the hearth as thanks.',
            failureEffects: {} },
          { id: `wait-by-hearth-${s}`, text: 'Wait to see who returns', successProbability: 0.6,
            successDescription: 'An old woman appears and thanks you for your patience. She shares her supply of healing salves.',
            successEffects: { reputation: 3, gold: 5 },
            failureDescription: 'No one comes. The fire dies and the snow closes in.',
            failureEffects: {} },
        ],
      },
      {
        id: `sfb-snow-giant-${s}`,
        description: 'A towering figure of packed snow shambles toward you — not a natural snowfall, but something animated by the winter spirits. Its eyes glow blue-white in the storm.',
        options: [
          { id: `fight-snow-giant-${s}`, text: 'Stand and fight the snow giant', triggersCombat: true,
            successProbability: 0.5, successDescription: 'The snow giant raises fists of packed ice and roars!',
            successEffects: {}, failureDescription: 'The snow giant raises fists of packed ice and roars!', failureEffects: {} },
          { id: `offer-snow-giant-${s}`, text: 'Offer it your warmest scarf', successProbability: 0.7,
            successDescription: 'The creature stops, tilts its head, then scoops up a mound of snow — inside is a frozen gem it drops at your feet.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `winter-gem-${s}`, name: 'Winter\'s Heart Gem', description: 'A gem frozen in the heart of a snowstorm, cold to the touch', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'The giant examines the scarf and shambles away, unimpressed but peaceful.',
            failureEffects: {} },
        ],
      },
    ]
  }

  // Mar 20 – Jun 20: Spring
  if ((month === 3 && day >= 20) || month === 4 || month === 5 || (month === 6 && day <= 20)) {
    return [
      {
        id: `sfb-spring-fey-${s}`,
        description: 'The air smells of fresh blossoms and new rain. A fey sprite emerges from a budding flower, wings dusted with pollen, and regards you with curious spring-bright eyes.',
        options: [
          { id: `play-sprite-${s}`, text: 'Play along with the sprite\'s games', successProbability: 0.7,
            successDescription: 'The sprite leads a dance through the blooming meadow and gifts you a vial of spring nectar.',
            successEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `spring-nectar-${s}`, name: 'Spring Fey Nectar', description: 'A vial of potent nectar from the first flowers of spring', quantity: 1, type: 'consumable', effects: { heal: 15, luck: 1 } }]) },
            failureDescription: 'You trip on a root mid-dance and the sprite dissolves into giggles and vanishes.',
            failureEffects: { reputation: -1 } },
          { id: `gift-flower-sprite-${s}`, text: 'Offer a wildflower in greeting', successProbability: 1.0,
            successDescription: 'The sprite beams and twirls the flower into a lucky charm for you.',
            successEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `spring-charm-${s}`, name: 'Bloom Charm', description: 'A spring bloom twisted into a lucky token by a fey sprite', quantity: 1, type: 'consumable', effects: { luck: 1 } }]) },
            failureDescription: '', failureEffects: {} },
        ],
      },
      {
        id: `sfb-swollen-river-${s}`,
        description: 'Spring snowmelt has swollen the river to bursting. The usual ford is impassable. A rickety rope bridge is the only crossing — but it strains loudly in the current.',
        options: [
          { id: `cross-rope-bridge-${s}`, text: 'Cross the rope bridge quickly', successProbability: 0.6,
            successDescription: 'The bridge holds! On the far bank you spot a waterproof satchel caught against the reeds.',
            successEffects: { gold: 8, rewardItems: processFallbackRewardItems([{ id: `waterproof-bag-${s}`, name: 'Waterproof Satchel', description: 'A sealed satchel containing dry herbs and a map fragment', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
            failureDescription: 'A rope snaps and you barely catch the far post, hauling yourself over. Soaked but alive.',
            failureEffects: {} },
          { id: `find-upstream-${s}`, text: 'Scout upstream for a safer crossing', successProbability: 0.8,
            successDescription: 'You find a natural rock ford upstream and cross safely. The detour was worth it.',
            successEffects: { reputation: 1 },
            failureDescription: 'The upstream crossing is worse. Eventually you backtrack and use the bridge anyway.',
            failureEffects: {} },
        ],
      },
      {
        id: `sfb-spring-festival-${s}`,
        description: 'A village is celebrating the spring festival — colorful ribbons, music, and laughter fill the square. A cheerful elder beckons you to join the festivities.',
        options: [
          { id: `join-festival-${s}`, text: 'Join the spring festival', successProbability: 0.9,
            successDescription: 'You dance, share food, and trade stories. The villagers are charmed and send you off with gifts.',
            successEffects: { reputation: 4, gold: 6 },
            failureDescription: 'You try to join but feel out of place. Still, a kind child offers you a piece of festival cake.',
            failureEffects: { reputation: 1 } },
          { id: `watch-festival-${s}`, text: 'Watch from the edge of the village', successProbability: 1.0,
            successDescription: 'The music lifts your spirits. A villager notices and brings you a cup of spring mead.',
            successEffects: { reputation: 1, rewardItems: processFallbackRewardItems([{ id: `spring-mead-${s}`, name: 'Spring Festival Mead', description: 'Sweet mead brewed from the first blossoms', quantity: 1, type: 'consumable', effects: { heal: 8 } }]) },
            failureDescription: '', failureEffects: {} },
        ],
      },
    ]
  }

  return []
}

function getDefaultEvents(regionId?: string): LLMGeneratedEvent[] {
  const s = `fallback-${Date.now()}-${Math.floor(Math.random() * 10000)}`

  // Add region-specific events to the pool if available
  const regionSpecificEvents = regionId ? getRegionFallbackEvents(regionId) : []

  const pool: LLMGeneratedEvent[] = [
    // Discovery events
    {
      id: `fb-chest-${s}`,
      description: 'You spot a weathered chest half-buried in the undergrowth.',
      options: [
        { id: `open-${s}`, text: 'Pry it open', successProbability: 0.6,
          successDescription: 'Inside you find a handful of coins and a small vial.',
          successEffects: { gold: 8, reputation: 1, rewardItems: processFallbackRewardItems([{ id: `vial-${s}`, name: 'Small Healing Vial', description: 'Restores a bit of vigor', quantity: 1, type: 'consumable', effects: { heal: 10 } }]) },
          failureDescription: 'The chest is empty save for dust and cobwebs.',
          failureEffects: { reputation: -1 } },
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
          successEffects: { reputation: -1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-stream-${s}`,
      description: 'A clear stream crosses the path. The water looks refreshing.',
      options: [
        { id: `drink-${s}`, text: 'Drink from the stream', successProbability: 0.8,
          successDescription: 'The water is cool and invigorating.',
          successEffects: { reputation: 1 },
          failureDescription: 'The water has a slightly off taste. You feel fine though.',
          failureEffects: {} },
        { id: `ford-${s}`, text: 'Search the streambed for valuables', successProbability: 0.4,
          successDescription: 'You spot a glinting gem among the pebbles!',
          successEffects: { gold: 10 },
          failureDescription: 'Just rocks and mud.',
          failureEffects: { reputation: -1 } },
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
          failureEffects: { reputation: -1 } },
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
          failureEffects: { reputation: -1 } },
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
          successEffects: { reputation: 1 },
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
    // Spell discovery events
    {
      id: `fb-dying-mage-${s}`,
      description: 'A wounded mage lies by the roadside, clutching a glowing tome. "Please... help me bandage this wound, and I will teach you a spell in return."',
      options: [
        { id: `help-mage-${s}`, text: 'Help the mage', successProbability: 0.8,
          successDescription: 'You tend to the mage\'s wounds. Grateful, they inscribe a spell onto a scroll and hand it to you.',
          successEffects: { reputation: 3, rewardItems: [createSpellScrollRewardItem(5, `mage-spell-${s}`)] },
          failureDescription: 'Despite your efforts, the mage\'s wounds are beyond your skill. They thank you for trying.',
          failureEffects: { reputation: 2 } },
        { id: `rob-mage-${s}`, text: 'Take the tome and leave', successProbability: 0.5,
          successDescription: 'You snatch the tome. Inside you find a spell inscribed on loose parchment.',
          successEffects: { reputation: -6, rewardItems: [createSpellScrollRewardItem(5, `stolen-spell-${s}`)] },
          failureDescription: 'The mage clings to the tome with surprising strength. You give up and walk away.',
          failureEffects: { reputation: -3 } },
        { id: `ignore-mage-${s}`, text: 'Walk past', successProbability: 1.0,
          successDescription: 'You continue on your way without stopping.',
          successEffects: { reputation: -1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-ancient-library-${s}`,
      description: 'Hidden behind a waterfall, you discover the entrance to an ancient library. Dusty tomes line the shelves, and magical light still flickers from enchanted sconces.',
      options: [
        { id: `search-tomes-${s}`, text: 'Search the tomes for spells', successProbability: 0.6,
          successDescription: 'After careful study, you find a tome containing a spell you can learn! You transcribe it onto a scroll.',
          successEffects: { reputation: 2, rewardItems: [createSpellScrollRewardItem(5, `library-spell-${s}`)] },
          failureDescription: 'The tomes are written in a language you cannot decipher. Perhaps with more experience...',
          failureEffects: { reputation: -1 } },
        { id: `take-books-${s}`, text: 'Gather books to sell', successProbability: 0.7,
          successDescription: 'You collect several valuable volumes that a scholar would pay well for.',
          successEffects: { gold: 12 },
          failureDescription: 'The books crumble to dust when you try to move them.',
          failureEffects: { reputation: -1 } },
      ],
    },
    {
      id: `fb-elemental-convergence-${s}`,
      description: 'The air crackles with raw magical energy. Elemental forces swirl together at a nexus point, forming brief shapes and symbols in the air.',
      options: [
        { id: `absorb-magic-${s}`, text: 'Reach into the convergence', successProbability: 0.5,
          successDescription: 'The magical energy coalesces into a spell scroll in your hand! The convergence fades.',
          successEffects: { reputation: 2, rewardItems: [createSpellScrollRewardItem(5, `convergence-spell-${s}`)] },
          failureDescription: 'The energy is too wild to contain. It disperses harmlessly.',
          failureEffects: {} },
        { id: `observe-magic-${s}`, text: 'Observe from a safe distance', successProbability: 0.9,
          successDescription: 'Watching the convergence teaches you something about the nature of magic.',
          successEffects: { reputation: 2 },
          failureDescription: 'The convergence fades before you can learn anything useful.',
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
    // Mount discovery events
    {
      id: `fb-wild-horse-${s}`,
      description: 'You spot a wild horse grazing peacefully in a sunlit meadow. It watches you with curious eyes.',
      options: [
        { id: `tame-horse-${s}`, text: 'Try to tame it (luck check)', successProbability: 0.5,
          successDescription: 'With patience and a gentle hand, the horse accepts you as its rider! You have gained a new mount.',
          successEffects: { reputation: 2 },
          failureDescription: 'The horse bolts at your approach. Perhaps next time.',
          failureEffects: {} },
        { id: `leave-horse-${s}`, text: 'Admire from afar and move on', successProbability: 1.0,
          successDescription: 'You enjoy the peaceful scene before continuing your journey.',
          successEffects: { reputation: 1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-abandoned-mount-${s}`,
      description: 'By the roadside, you find a mount tethered to a post with a note: "Free to a worthy adventurer."',
      options: [
        { id: `claim-mount-${s}`, text: 'Claim the mount', successProbability: 0.7,
          successDescription: 'The mount seems happy to have a new rider. A fine companion for your travels!',
          successEffects: { reputation: 1 },
          failureDescription: "The mount seems wary and won\'t let you near. It needs a more experienced handler.",
          failureEffects: {} },
        { id: `pass-mount-${s}`, text: 'Leave it for someone else', successProbability: 1.0,
          successDescription: 'You leave the mount behind, hoping another traveler will find it.',
          successEffects: { reputation: 2 },
          failureDescription: '', failureEffects: {} },
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
      id: `fb-skeleton-${s}`,
      description: 'Skeletal warriors rise from the cracked earth, their hollow eyes glowing with malice.',
      options: [
        { id: `fight-skeletons-${s}`, text: 'Smash them to pieces', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You raise your weapon against the undead!',
          successEffects: {}, failureDescription: 'You raise your weapon against the undead!', failureEffects: {} },
        { id: `flee-skeletons-${s}`, text: 'Run before they surround you', successProbability: 0.6,
          successDescription: 'You sprint away before the circle closes.',
          successEffects: {},
          failureDescription: 'You stumble but manage to escape, losing a few coins in the process.',
          failureEffects: { gold: -3, reputation: -1 } },
      ],
    },
    {
      id: `fb-ogre-${s}`,
      description: 'A hulking ogre lumbers out from behind a boulder, club raised and hungry.',
      options: [
        { id: `fight-ogre-${s}`, text: 'Fight the ogre', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You brace yourself for a brutal fight!',
          successEffects: {}, failureDescription: 'You brace yourself for a brutal fight!', failureEffects: {} },
        { id: `distract-ogre-${s}`, text: 'Throw rations to distract it', successProbability: 0.7,
          successDescription: 'The ogre drops its club and devours the food. You slip away.',
          successEffects: { reputation: 1 },
          failureDescription: 'The ogre ignores the food and glares at you, but loses interest.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-spider-nest-${s}`,
      description: 'Thick webs stretch between the trees. Giant spiders skitter in the shadows above.',
      options: [
        { id: `fight-spiders-${s}`, text: 'Burn the webs and fight', triggersCombat: true,
          successProbability: 0.5, successDescription: 'The spiders descend in a fury!',
          successEffects: {}, failureDescription: 'The spiders descend in a fury!', failureEffects: {} },
        { id: `sneak-spiders-${s}`, text: 'Creep through carefully', successProbability: 0.4,
          successDescription: 'You navigate the webs without disturbing anything.',
          successEffects: { reputation: 1 },
          failureDescription: 'You get tangled briefly but break free and escape.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-rival-${s}`,
      description: 'A rival adventurer steps into your path, blade drawn. "Only one of us moves forward."',
      options: [
        { id: `fight-rival-${s}`, text: 'Accept the challenge', triggersCombat: true,
          successProbability: 0.5, successDescription: 'Steel meets steel!',
          successEffects: {}, failureDescription: 'Steel meets steel!', failureEffects: {} },
        { id: `talk-rival-${s}`, text: 'Try to reason with them', successProbability: 0.5,
          successDescription: 'After tense words, the rival sheathes their blade and walks away.',
          successEffects: { reputation: 3 },
          failureDescription: 'They scoff at your words but decide you are not worth the trouble.',
          failureEffects: { reputation: -1 } },
      ],
    },
    {
      id: `fb-goblin-ambush-${s}`,
      description: 'Goblins leap from the bushes with shrill war cries, brandishing crude weapons.',
      options: [
        { id: `fight-goblins-${s}`, text: 'Stand and fight', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You swing at the nearest goblin!',
          successEffects: {}, failureDescription: 'You swing at the nearest goblin!', failureEffects: {} },
        { id: `intimidate-goblins-${s}`, text: 'Roar and try to scare them off', successProbability: 0.6,
          successDescription: 'The goblins scatter in terror!',
          successEffects: { reputation: 2 },
          failureDescription: 'They hesitate but hold their ground... then eventually slink away.',
          failureEffects: {} },
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
          successEffects: { reputation: -1 },
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
    // NPC encounter events — reputation-gated interactions
    {
      id: `fb-wandering-healer-${s}`,
      description: 'A kindly wandering healer approaches, her satchel full of remedies. "You look like you could use some tending to, traveler."',
      options: [
        { id: `pay-healer-${s}`, text: 'Pay 5 gold for healing', successProbability: 0.9,
          successDescription: 'The healer tends to your wounds with expert care. You feel much better.',
          successEffects: { gold: -5, rewardItems: processFallbackRewardItems([{ id: `healer-salve-${s}`, name: 'Healer\'s Salve', description: 'A soothing balm that restores health', quantity: 1, type: 'consumable', effects: { heal: 20 } }]) },
          failureDescription: 'The healer does her best, but your wounds are stubborn.',
          failureEffects: { gold: -5, rewardItems: processFallbackRewardItems([{ id: `weak-salve-${s}`, name: 'Weak Salve', description: 'A mild restorative', quantity: 1, type: 'consumable', effects: { heal: 8 } }]) } },
        { id: `free-heal-${s}`, text: 'Ask for free healing (requires good reputation)', successProbability: 0.85,
          successDescription: '"Your reputation precedes you, hero. It would be an honor to help." She heals you free of charge.',
          successEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `blessed-salve-${s}`, name: 'Blessed Salve', description: 'A potent remedy given freely to the worthy', quantity: 1, type: 'consumable', effects: { heal: 25 } }]) },
          failureDescription: '"I\'m sorry, but I don\'t know you well enough to offer my services for free." She shakes her head.',
          failureEffects: {} },
        { id: `rob-healer-${s}`, text: 'Rob the healer', successProbability: 0.5,
          successDescription: 'You snatch her satchel and run. You find gold and supplies inside.',
          successEffects: { gold: 12, reputation: -8, rewardItems: processFallbackRewardItems([{ id: `stolen-herbs-${s}`, name: 'Stolen Herbs', description: 'Herbs taken by force', quantity: 1, type: 'consumable', effects: { heal: 15 } }]) },
          failureDescription: 'She dodges your grab and calls for help. You flee empty-handed, your reputation tarnished.',
          failureEffects: { reputation: -5 } },
      ],
    },
    {
      id: `fb-mysterious-merchant-${s}`,
      description: 'A mysterious merchant in a hooded cloak has set up a small stall by the roadside. His wares glint with an unusual shimmer. "Only the reputable may browse my collection," he says with a knowing smile.',
      options: [
        { id: `buy-rare-${s}`, text: 'Buy a rare item (10 gold)', successProbability: 0.75,
          successDescription: 'The merchant nods approvingly and offers you a finely crafted item at a fair price.',
          successEffects: { gold: -10, reputation: 2, rewardItems: processFallbackRewardItems([{ id: `merchant-ring-${s}`, name: 'Ring of Fortune', description: 'A shimmering ring that brings luck to its wearer', quantity: 1, type: 'equipment', effects: { luck: 2 } }]) },
          failureDescription: '"Hmm, your reputation is not quite what I\'d hoped. Perhaps next time." He waves you away.',
          failureEffects: {} },
        { id: `browse-merchant-${s}`, text: 'Ask about his travels', successProbability: 0.8,
          successDescription: 'The merchant shares tales of distant lands and tips you off about hidden treasure nearby.',
          successEffects: { reputation: 1, gold: 5 },
          failureDescription: 'The merchant is tight-lipped. "Come back when you have earned more trust."',
          failureEffects: {} },
        { id: `pickpocket-merchant-${s}`, text: 'Try to steal from his stall', successProbability: 0.3,
          successDescription: 'You swipe a small trinket while he is distracted.',
          successEffects: { reputation: -6, rewardItems: processFallbackRewardItems([{ id: `stolen-gem-${s}`, name: 'Pilfered Gem', description: 'A stolen gemstone of modest value', quantity: 1, type: 'misc', effects: { gold: 8 } }]) },
          failureDescription: 'He catches your hand. "Thief!" he shouts. Nearby travelers give you dark looks.',
          failureEffects: { reputation: -4 } },
      ],
    },
    {
      id: `fb-quest-giver-${s}`,
      description: 'A weathered veteran sits at a crossroads, a map spread before him. "I have a task that requires someone with a solid reputation. Interested?"',
      options: [
        { id: `accept-quest-${s}`, text: 'Accept the quest', successProbability: 0.7,
          successDescription: '"Excellent! Deliver this sealed letter to the village elder. You\'ll be well compensated." He hands you the letter and a pouch of gold.',
          successEffects: { gold: 15, reputation: 5, rewardItems: processFallbackRewardItems([{ id: `quest-letter-${s}`, name: 'Sealed Letter', description: 'An important letter for the village elder', quantity: 1, type: 'quest' }]) },
          failureDescription: '"Hmm, I\'ve heard mixed things about you. I\'m not sure I can trust you with this." He folds up the map.',
          failureEffects: { reputation: -1 } },
        { id: `ask-details-${s}`, text: 'Ask for more details first', successProbability: 0.8,
          successDescription: 'The veteran explains the mission fully. Impressed by your caution, he offers a small advance.',
          successEffects: { gold: 5, reputation: 2 },
          failureDescription: '"Questions, questions... maybe you\'re not the right person for this."',
          failureEffects: {} },
        { id: `decline-quest-${s}`, text: 'Decline politely', successProbability: 1.0,
          successDescription: '"No worries, traveler. Safe journeys." He tips his hat.',
          successEffects: { reputation: 1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-royal-messenger-${s}`,
      description: 'A royal messenger in fine livery approaches on horseback. "I seek the one known for great deeds in these lands. Would that be you?"',
      options: [
        { id: `accept-gift-${s}`, text: 'Accept the royal gift', successProbability: 0.8,
          successDescription: '"The crown recognizes your service!" The messenger presents a chest of gold and a royal commendation.',
          successEffects: { gold: 25, reputation: 5, rewardItems: processFallbackRewardItems([{ id: `royal-medal-${s}`, name: 'Royal Commendation', description: 'A medal from the crown, proof of your renown', quantity: 1, type: 'equipment', effects: { reputation: 3 } }]) },
          failureDescription: 'The messenger looks uncertain. "I was told the hero here would be... more impressive. My apologies." He rides away.',
          failureEffects: {} },
        { id: `decline-gift-${s}`, text: 'Humbly decline the gift', successProbability: 1.0,
          successDescription: '"Your humility is noted. The crown will remember this." Your reputation grows even more.',
          successEffects: { reputation: 8 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-bounty-hunter-${s}`,
      description: 'A scarred bounty hunter steps out of the shadows, a wanted poster in hand. "You match a description I\'ve been given. We can settle this with coin... or steel."',
      options: [
        { id: `pay-bounty-${s}`, text: 'Pay the bounty (15 gold)', successProbability: 0.8,
          successDescription: 'The bounty hunter pockets the gold. "Consider your debt paid. For now." He disappears into the shadows.',
          successEffects: { gold: -15, reputation: 3 },
          failureDescription: '"Not enough. I\'ll be back for more." He takes what you have.',
          failureEffects: { gold: -10, reputation: -2 } },
        { id: `fight-bounty-${s}`, text: 'Fight the bounty hunter', triggersCombat: true,
          successProbability: 0.5, successDescription: 'You draw your weapon as the bounty hunter attacks!',
          successEffects: { reputation: -2 }, failureDescription: 'You draw your weapon as the bounty hunter attacks!', failureEffects: { reputation: -2 } },
        { id: `talk-bounty-${s}`, text: 'Try to convince them you\'re the wrong person', successProbability: 0.35,
          successDescription: 'You spin a convincing tale. The bounty hunter grunts and walks away.',
          successEffects: { reputation: 1 },
          failureDescription: '"Nice try." The bounty hunter cracks their knuckles. You barely escape.',
          failureEffects: { reputation: -3 } },
      ],
    },
    {
      id: `fb-shady-dealer-${s}`,
      description: 'A shady figure lurks in an alley, beckoning you over. "Psst! I\'ve got goods that fell off a cart, if you know what I mean. Cheap prices, no questions asked."',
      options: [
        { id: `buy-stolen-${s}`, text: 'Buy stolen goods (3 gold)', successProbability: 0.7,
          successDescription: 'You acquire some useful items at a steep discount. Best not to ask where they came from.',
          successEffects: { gold: -3, reputation: -4, rewardItems: processFallbackRewardItems([{ id: `stolen-blade-${s}`, name: 'Unmarked Blade', description: 'A suspiciously fine weapon with the markings filed off', quantity: 1, type: 'equipment', effects: { strength: 2 } }]) },
          failureDescription: 'The goods turn out to be junk wrapped in nice cloth. You\'ve been conned.',
          failureEffects: { gold: -3, reputation: -2 } },
        { id: `report-dealer-${s}`, text: 'Report them to the authorities', successProbability: 0.6,
          successDescription: 'Guards arrive and arrest the dealer. They reward you for your civic duty.',
          successEffects: { gold: 8, reputation: 5 },
          failureDescription: 'The dealer spots your intent and vanishes before the guards arrive.',
          failureEffects: { reputation: 1 } },
        { id: `ignore-dealer-${s}`, text: 'Walk away', successProbability: 1.0,
          successDescription: 'You keep your head down and move on.',
          successEffects: { reputation: -1 },
          failureDescription: '', failureEffects: {} },
      ],
    },
    // Moral choice events — reputation spectrum
    {
      id: `fb-lost-cargo-${s}`,
      description: 'You find a merchant\'s lost cargo scattered along the road. Crates of fine goods lie unguarded, their owner nowhere in sight.',
      options: [
        { id: `return-cargo-${s}`, text: 'Track down the merchant and return the cargo', successProbability: 0.8,
          successDescription: 'You find the grateful merchant a mile down the road. "Bless you, traveler! My livelihood was in those crates." Word of your honesty spreads.',
          successEffects: { reputation: 5 },
          failureDescription: 'You search but cannot find the owner. You leave the goods untouched.',
          failureEffects: { reputation: 2 } },
        { id: `keep-cargo-${s}`, text: 'Help yourself to the goods', successProbability: 0.9,
          successDescription: 'You pocket valuable items from the crates. Finders keepers.',
          successEffects: { gold: 15, reputation: -5 },
          failureDescription: 'Most of the goods are spoiled or broken. You salvage a little.',
          failureEffects: { gold: 5, reputation: -3 } },
      ],
    },
    {
      id: `fb-beggars-plea-${s}`,
      description: 'A ragged beggar sits by the roadside, hollow-eyed and trembling. "Please, traveler... just a few coins for bread."',
      options: [
        { id: `give-beggar-${s}`, text: 'Give them some gold', successProbability: 1.0,
          successDescription: 'The beggar\'s eyes fill with tears. "You have a kind heart." Nearby villagers notice your generosity.',
          successEffects: { gold: -5, reputation: 3 },
          failureDescription: '', failureEffects: {} },
        { id: `ignore-beggar-${s}`, text: 'Walk past without a word', successProbability: 1.0,
          successDescription: 'You continue on your way. The beggar says nothing.',
          successEffects: { reputation: -1 },
          failureDescription: '', failureEffects: {} },
        { id: `rob-beggar-${s}`, text: 'Rob what little they have', successProbability: 0.7,
          successDescription: 'You snatch a few coins from the beggar\'s cup. They cower in fear. Witnesses look on in disgust.',
          successEffects: { gold: 2, reputation: -3 },
          failureDescription: 'The beggar has nothing worth taking. You feel the weight of many disapproving stares.',
          failureEffects: { reputation: -2 } },
      ],
    },
    {
      id: `fb-wanted-poster-${s}`,
      description: 'A wanted poster flutters on a signpost. As you read it, a nervous figure steps from the bushes. "That\'s me on the poster. I swear I\'m innocent. Will you help me, or turn me in?"',
      options: [
        { id: `turn-in-fugitive-${s}`, text: 'Turn the fugitive in to the authorities', successProbability: 0.8,
          successDescription: 'The guards thank you and hand over the bounty. Justice is served — or so they say.',
          successEffects: { reputation: 5, gold: 10 },
          failureDescription: 'The fugitive escapes before the guards arrive. They note your attempt, at least.',
          failureEffects: { reputation: 2 } },
        { id: `help-fugitive-${s}`, text: 'Help the fugitive escape', successProbability: 0.7,
          successDescription: '"Thank you, friend. Take this — it\'s all I have." The fugitive presses gold into your hands before disappearing.',
          successEffects: { reputation: -5, gold: 20 },
          failureDescription: 'A patrol spots you helping and gives you a stern warning. The fugitive slips away in the confusion.',
          failureEffects: { reputation: -3 } },
      ],
    },
    {
      id: `fb-corrupt-guard-${s}`,
      description: 'A town guard pulls you aside. "Look, I know you saw what happened back there. Keep quiet about it, and this gold is yours. Report me, and... well, don\'t."',
      options: [
        { id: `report-guard-${s}`, text: 'Report the corrupt guard', successProbability: 0.7,
          successDescription: 'The captain listens carefully and arrests the corrupt guard. "The town owes you a debt." Your integrity earns respect.',
          successEffects: { reputation: 5 },
          failureDescription: 'Your report is noted but the guard has connections. Nothing happens immediately, but people remember your courage.',
          failureEffects: { reputation: 2 } },
        { id: `accept-bribe-${s}`, text: 'Accept the bribe and stay silent', successProbability: 0.9,
          successDescription: 'The guard nods and hands you a pouch of gold. "Smart choice." You feel the weight of compromise.',
          successEffects: { gold: 10, reputation: -3 },
          failureDescription: 'The guard shortchanges you. "Be glad I gave you anything."',
          failureEffects: { gold: 5, reputation: -2 } },
      ],
    },
    {
      id: `fb-village-attack-${s}`,
      description: 'Smoke rises from a village ahead. Raiders are pillaging homes while villagers flee in panic. You could help — or profit from the chaos.',
      options: [
        { id: `defend-village-${s}`, text: 'Rush to defend the village', triggersCombat: true,
          successProbability: 0.5,
          successDescription: 'You charge into the fray to protect the innocent! The raiders turn to face you.',
          successEffects: { reputation: 8 },
          failureDescription: 'You charge into the fray to protect the innocent! The raiders turn to face you.',
          failureEffects: { reputation: 8 } },
        { id: `loot-chaos-${s}`, text: 'Loot abandoned homes in the chaos', successProbability: 0.8,
          successDescription: 'While everyone is distracted, you fill your pockets. Survivors will remember your cowardice.',
          successEffects: { gold: 25, reputation: -10 },
          failureDescription: 'A fleeing villager catches you looting and screams "Thief!" You grab what you can and run.',
          failureEffects: { gold: 10, reputation: -8 } },
      ],
    },
    // HP/MP effect events
    {
      id: `fb-poison-trap-${s}`,
      description: 'A tripwire stretches across the path ahead, nearly invisible in the dim light. A faint hiss warns of a pressurized poison mechanism behind it.',
      options: [
        { id: `disarm-trap-${s}`, text: 'Carefully disarm the trap', successProbability: 0.6,
          successDescription: 'You deftly disarm the mechanism and find a hidden compartment with coins inside.',
          successEffects: { gold: 12, reputation: 2 },
          failureDescription: 'The trap triggers! Poisoned darts nick your skin before you can fully dodge.',
          failureEffects: { hpChange: -12, reputation: -1 } },
        { id: `leap-trap-${s}`, text: 'Leap over the tripwire', successProbability: 0.7,
          successDescription: 'You clear the wire cleanly and land safely on the other side.',
          successEffects: { reputation: 1 },
          failureDescription: 'Your foot catches the wire. Poison darts graze your arm as you stumble through.',
          failureEffects: { hpChange: -8 } },
      ],
    },
    {
      id: `fb-healing-spring-${s}`,
      description: 'You discover a hidden spring nestled among mossy rocks. The water glows faintly with a warm golden light and carries a scent of wildflowers and magic.',
      options: [
        { id: `drink-spring-${s}`, text: 'Drink deeply from the spring', successProbability: 0.9,
          successDescription: 'The blessed water flows through you, mending wounds and restoring your magical reserves.',
          successEffects: { hpChange: 20, mpChange: 10, reputation: 1 },
          failureDescription: 'The spring\'s magic is faint today. You feel mildly refreshed.',
          failureEffects: { hpChange: 5 } },
        { id: `fill-flask-spring-${s}`, text: 'Fill your flask and move on', successProbability: 1.0,
          successDescription: 'You carefully fill your flask with the glowing water for later use.',
          successEffects: { rewardItems: processFallbackRewardItems([{ id: `spring-water-${s}`, name: 'Blessed Spring Water', description: 'Softly glowing water that restores vitality', quantity: 1, type: 'consumable', effects: { heal: 15 } }]) },
          failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-mana-drain-crystal-${s}`,
      description: 'A pulsing violet crystal juts from the earth beside the path. It hums with an eerie resonance that makes your head swim and your magic feel sluggish.',
      options: [
        { id: `touch-crystal-${s}`, text: 'Touch the crystal and absorb its energy', successProbability: 0.5,
          successDescription: 'The crystal\'s energy transfers into you — mana drained but its gold veins crack free.',
          successEffects: { gold: 25, mpChange: -15 },
          failureDescription: 'The crystal flares and shatters, draining your mana without yielding anything valuable.',
          failureEffects: { mpChange: -15 } },
        { id: `avoid-crystal-${s}`, text: 'Give it a wide berth', successProbability: 1.0,
          successDescription: 'You sidestep the unsettling crystal and continue down the path.',
          successEffects: {}, failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-wandering-healer-hp-${s}`,
      description: 'A robed healer tends a small campfire at the roadside, her hands glowing faintly. "Sit, traveler. I can mend what ails you — for a price."',
      options: [
        { id: `pay-healer-hp-${s}`, text: 'Pay 10 gold to be healed', successProbability: 0.95,
          successDescription: 'The healer works her magic with practiced skill. Your wounds close and your body feels renewed.',
          successEffects: { gold: -10, hpChange: 30 },
          failureDescription: 'The healer tries her best but your wounds are stubborn. A partial recovery, at least.',
          failureEffects: { gold: -10, hpChange: 10 } },
        { id: `chat-healer-${s}`, text: 'Share news of the road in exchange', successProbability: 0.7,
          successDescription: 'The healer appreciates fresh gossip and offers a quick blessing in return.',
          successEffects: { reputation: 2, hpChange: 10 },
          failureDescription: 'She has already heard your news. She waves you off with a polite smile.',
          failureEffects: { reputation: 1 } },
      ],
    },
    {
      id: `fb-cursed-chest-${s}`,
      description: 'A gilded chest sits in the middle of the path, conspicuously unguarded. Faint dark runes line its edges — this smells of a curse.',
      options: [
        { id: `open-cursed-${s}`, text: 'Open the chest anyway', successProbability: 0.6,
          successDescription: 'The curse lashes out as the lid lifts, but you endure it. Inside: a fine haul of gold.',
          successEffects: { gold: 30, hpChange: -10 },
          failureDescription: 'The curse hits full force. You slam the lid shut and stagger away, hurt and empty-handed.',
          failureEffects: { hpChange: -15 } },
        { id: `dispel-runes-${s}`, text: 'Try to dispel the runes first', successProbability: 0.4,
          successDescription: 'The runes dissolve under your touch. You open the chest freely and claim the gold within.',
          successEffects: { gold: 30, reputation: 2 },
          failureDescription: 'The runes resist your effort. The chest remains sealed and the runes glow more angrily.',
          failureEffects: { reputation: -1 } },
      ],
    },
    {
      id: `fb-meditation-circle-${s}`,
      description: 'Ancient stones arranged in a perfect circle emanate a calm, blue radiance. The air within hums with latent arcane energy, soothing and inviting.',
      options: [
        { id: `meditate-circle-${s}`, text: 'Sit within the circle and meditate', successProbability: 0.8,
          successDescription: 'The circle\'s magic fills your mind. Your mana surges back as arcane energy flows into you.',
          successEffects: { mpChange: 25, reputation: 2 },
          failureDescription: 'The circle\'s energy is too subtle to fully absorb, but you feel calmer.',
          failureEffects: { mpChange: 5 } },
        { id: `study-circle-${s}`, text: 'Study the rune arrangement', successProbability: 0.6,
          successDescription: 'You sketch the rune pattern — a scholar would pay well for this knowledge.',
          successEffects: { gold: 8, reputation: 1 },
          failureDescription: 'The runes are too complex to decipher quickly. You move on.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-thorny-path-${s}`,
      description: 'A shortcut through a dense thorny thicket would cut hours from your journey. The thorns are cruel-looking, but the path beyond is clearly faster.',
      options: [
        { id: `push-thorns-${s}`, text: 'Push through the thorny shortcut', successProbability: 0.6,
          successDescription: 'You force your way through, clothes torn and skin scratched, but reach your destination much faster.',
          successEffects: { hpChange: -8, reputation: 1 },
          failureDescription: 'The thorns are worse than expected. You push through badly scratched and no better off for time.',
          failureEffects: { hpChange: -12 } },
        { id: `take-road-${s}`, text: 'Take the longer road', successProbability: 1.0,
          successDescription: 'The longer route is uneventful. Slow but steady.',
          successEffects: {}, failureDescription: '', failureEffects: {} },
      ],
    },
    {
      id: `fb-corrupted-fountain-${s}`,
      description: 'A stone fountain gurgles with dark, swirling water. Strange runes are carved into its basin. The water smells of ozone and old magic.',
      options: [
        { id: `drink-fountain-${s}`, text: 'Drink from the corrupted fountain', successProbability: 0.6,
          successDescription: 'The dark water burns slightly going down but fills you with crackling arcane power.',
          successEffects: { mpChange: 15, hpChange: -5 },
          failureDescription: 'The corruption overwhelms the benefit. You feel drained on both counts.',
          failureEffects: { hpChange: -10, mpChange: -5 } },
        { id: `study-fountain-${s}`, text: 'Study the runes instead', successProbability: 0.5,
          successDescription: 'The runes reveal an arcane formula. You transcribe it carefully.',
          successEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `rune-notes-${s}`, name: 'Rune Transcription', description: 'Notes on corrupted arcane script', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
          failureDescription: 'The runes shift and blur as you watch, impossible to copy.',
          failureEffects: {} },
      ],
    },
    {
      id: `fb-bandit-ambush-hp-${s}`,
      description: 'A band of cutthroats drops from the trees, surrounding you. The leader sneers: "Your coin or your life, traveler. We are not picky."',
      options: [
        { id: `fight-ambush-${s}`, text: 'Draw your weapon and fight', triggersCombat: true,
          successProbability: 0.5, successDescription: 'Steel rings as you engage the ambushers!',
          successEffects: {}, failureDescription: 'Steel rings as you engage the ambushers!', failureEffects: {} },
        { id: `pay-ambush-${s}`, text: 'Pay the toll (15 gold)', successProbability: 0.8,
          successDescription: 'They take the gold and melt back into the trees, satisfied.',
          successEffects: { gold: -15, reputation: -1 },
          failureDescription: 'They rough you up even after taking your gold. Petty cruelty.',
          failureEffects: { gold: -15, hpChange: -8, reputation: -2 } },
        { id: `bluff-ambush-${s}`, text: 'Bluff about powerful allies nearby', successProbability: 0.35,
          successDescription: 'They glance around nervously, then scatter. You walk away unscathed.',
          successEffects: { reputation: 2 },
          failureDescription: '"Nice try." They laugh and take a swing at you before demanding gold.',
          failureEffects: { hpChange: -10, gold: -8 } },
      ],
    },
    {
      id: `fb-mysterious-altar-${s}`,
      description: 'An ancient altar carved from black stone pulses with a deep crimson glow. Offerings of coin and bone surround it. The air feels heavy with divine expectation.',
      options: [
        { id: `offer-altar-${s}`, text: 'Offer gold at the altar (20 gold)', successProbability: 0.7,
          successDescription: 'The altar\'s glow intensifies and a warm light washes over you, mending wounds and blessing your journey.',
          successEffects: { gold: -20, reputation: 5, hpChange: 15 },
          failureDescription: 'The altar is silent. Your offering disappears but nothing is granted.',
          failureEffects: { gold: -20 } },
        { id: `deface-altar-${s}`, text: 'Deface the altar for its materials', successProbability: 0.5,
          successDescription: 'You pry loose several precious stones from the altar\'s surface.',
          successEffects: { gold: 15, reputation: -4 },
          failureDescription: 'The altar resists your tools. A shock of dark energy throws you back.',
          failureEffects: { hpChange: -10, reputation: -3 } },
      ],
    },
  ]

  // Add seasonal and region-specific events to the pool
  const seasonalEvents = getSeasonalFallbackEvents()
  const combinedPool = [...seasonalEvents, ...regionSpecificEvents, ...pool]

  // Randomly pick 3 events from the combined pool (region events are at front so they're more likely)
  const shuffled = combinedPool.sort(() => Math.random() - 0.5)
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

const legendaryToolSchema = {
  type: 'object',
  properties: {
    event: eventSchemaForOpenAI,
  },
  required: ['event'],
}

export async function generateLegendaryEvent(
  character: FantasyCharacter,
  context: string
): Promise<LLMGeneratedEvent> {
  const reputationTier = getReputationTier(character.reputation)
  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const regionContext = `The character is currently in ${region.name}: ${region.description}. Setting/theme: ${region.theme}. The dominant element is ${region.element}.`

  let reputationGuidance = ''
  if (character.reputation >= 150) {
    reputationGuidance = `This character is a ${reputationTier} (${character.reputation}). They are a mythic figure — the legendary encounter should reflect their world-shaking fame.`
  } else if (character.reputation >= 50) {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). The legendary encounter should reflect their growing renown.`
  } else {
    reputationGuidance = `This character has a ${reputationTier} reputation (${character.reputation}). Even unknown adventurers can stumble upon legendary moments of fate.`
  }

  const legendarySeasonalContext = getSeasonalContext()
  const legendarySeasonalInjection = legendarySeasonalContext
    ? `\n\nIMPORTANT — Seasonal context: ${legendarySeasonalContext}. Weave this theme subtly into the event's atmosphere and descriptions.`
    : ''

  const legendaryWeatherType = WEATHER_TYPES[(character.currentWeather ?? 'clear') as WeatherId] ?? WEATHER_TYPES.clear
  const legendaryWeatherInjection = legendaryWeatherType.id !== 'clear'
    ? `\n\nWeather context: ${legendaryWeatherType.icon} ${legendaryWeatherType.name}. ${legendaryWeatherType.description} Weave the weather atmosphere subtly into events.`
    : ''

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'user',
      content: `Generate a LEGENDARY encounter for this fantasy character. This is an extremely rare, once-in-a-lifetime event — it should be dramatic, memorable, and rewarding. Think: discovering an ancient dragon's hidden hoard, meeting a legendary hero who gifts their weapon, finding a portal to another realm, encountering a dying god who bestows a blessing, or discovering a mythical artifact.

IMPORTANT: This is NOT a combat encounter. This is a discovery/social/mystical event. Options should NOT have triggersCombat.

The rewards should be exceptional:
- Gold: ${30 + character.level * 10} to ${50 + character.level * 15}
- Reputation: +5 to +10
- Include 1-2 legendary-quality items with strong effects (equipment with +3 to +5 stat boosts, powerful consumables, or spell scrolls with unique spells)
- At least one option should have a guaranteed success (probability 1.0)
- Another option should be risky but with even greater rewards (probability 0.3-0.5)

IMPORTANT — Region context:
${regionContext}

IMPORTANT — Reputation guidance:
${reputationGuidance}

Character:
${JSON.stringify(character, null, 2)}

Recent History & Context:
${context || 'No prior adventures yet — this is the beginning of their journey.'}${legendarySeasonalInjection}${legendaryWeatherInjection}`,
    },
  ]

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'generate_legendary_event',
        description: 'Generate a single legendary fantasy adventure event object.',
        parameters: legendaryToolSchema,
      },
    },
  ]

  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: { type: 'function', function: { name: 'generate_legendary_event' } },
      temperature: 0.9,
      max_tokens: 1000,
    })

    const toolCall = response.choices[0]?.message?.tool_calls?.[0]
    if (toolCall && toolCall.function?.name === 'generate_legendary_event') {
      const toolArgs = JSON.parse(toolCall.function.arguments)
      const parsed = eventSchema.parse(toolArgs.event)
      const processedOptions: LLMEventOption[] = parsed.options.map(option => ({
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
      return { ...parsed, options: processedOptions }
    }

    throw new Error('No valid tool call in legendary event response')
  } catch (err) {
    console.error('Legendary event LLM generation failed, using fallback', err)
    return getDefaultLegendaryEvent(character)
  }
}

function getDefaultLegendaryEvent(character: FantasyCharacter): LLMGeneratedEvent {
  const s = `leg-${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const pool: LLMGeneratedEvent[] = [
    // 1. The Ancient Vault
    {
      id: `leg-vault-${s}`,
      description: 'Beneath the roots of an ancient tree, you discover a sealed vault from a forgotten civilization. Runes pulse with power across its stone surface, and a low hum vibrates the air around it.',
      options: [
        {
          id: `break-seal-vault-${s}`,
          text: 'Break the seal and enter the vault',
          successProbability: 0.5,
          successDescription: 'The seal shatters and you step into a chamber filled with treasure beyond imagining — ancient gold, gemstones, and a legendary artifact of immense power!',
          successEffects: {
            gold: 40 + character.level * 10,
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `vault-sword-${s}`, name: 'Blade of the Ancients', description: 'A legendary sword forged by a forgotten civilization, pulsing with ancient power', quantity: 1, type: 'equipment', effects: { strength: 4, luck: 2 } },
            ]),
          },
          failureDescription: 'A protective curse triggers as the seal breaks — you are flung back. The vault seals itself deeper underground. Nothing to show for it but singed hands.',
          failureEffects: {},
        },
        {
          id: `study-inscriptions-${s}`,
          text: 'Study the rune inscriptions carefully',
          successProbability: 1.0,
          successDescription: 'You spend time deciphering the runes. Their wisdom floods your mind, and a secret compartment opens revealing scrolls and coin.',
          successEffects: {
            gold: 20 + character.level * 5,
            reputation: 5,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 3, `vault-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `leave-sealed-${s}`,
          text: 'Leave it sealed — some things are better undisturbed',
          successProbability: 1.0,
          successDescription: 'You walk away. Later, travelers speak of a wandering hero who respected the old seals. Your reputation grows.',
          successEffects: { reputation: 5 },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 2. The Celestial Visitor
    {
      id: `leg-celestial-${s}`,
      description: 'The sky tears open and a being of pure starlight descends before you. Its voice resonates like distant bells: "Mortal. I have watched your journey. I come to offer a gift."',
      options: [
        {
          id: `accept-blessing-${s}`,
          text: 'Accept the celestial blessing',
          successProbability: 1.0,
          successDescription: 'Light pours through you. You feel every aspect of yourself elevated — strength, mind, and fortune all transformed by divine grace.',
          successEffects: {
            reputation: 8,
            rewardItems: processFallbackLegendaryItems([
              { id: `celestial-str-${s}`, name: 'Celestial Strength Essence', description: 'A vial of starlight that permanently strengthens the body', quantity: 1, type: 'consumable', effects: { strength: 3 } },
              { id: `celestial-int-${s}`, name: 'Celestial Wisdom Essence', description: 'A vial of starlight that expands the mind', quantity: 1, type: 'consumable', effects: { intelligence: 3 } },
              { id: `celestial-luck-${s}`, name: 'Celestial Fortune Essence', description: 'A vial of starlight that blesses with fortune', quantity: 1, type: 'consumable', effects: { luck: 3 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `ask-knowledge-${s}`,
          text: 'Ask for knowledge instead',
          successProbability: 0.7,
          successDescription: 'The being smiles and imparts arcane secrets. A scroll materializes, inscribed with a spell never before seen by mortal eyes.',
          successEffects: {
            reputation: 6,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 5, `celestial-scroll-${s}`)],
          },
          failureDescription: 'The being looks thoughtful, then fades: "You seek more than you are ready to receive." You are left with only the memory of starlight.',
          failureEffects: { reputation: 2 },
        },
        {
          id: `ask-riches-${s}`,
          text: 'Ask for material riches',
          successProbability: 0.6,
          successDescription: 'The being pauses, then rains golden coins from the stars. "So be it, mortal. Use it well."',
          successEffects: { gold: 50 + character.level * 15, reputation: 3 },
          failureDescription: 'The being shakes its luminous head. "Wealth was not what you needed." It vanishes without a gift.',
          failureEffects: {},
        },
      ],
    },
    // 3. The Dragon's Bargain
    {
      id: `leg-dragon-bargain-${s}`,
      description: 'An ancient dragon of impossible size lands before you, its scales gleaming like burnished copper. It regards you with intelligent amber eyes and rumbles: "Brave or foolish, little mortal — I cannot yet tell which. I offer a bargain."',
      options: [
        {
          id: `trade-gold-dragon-${s}`,
          text: 'Trade gold for a dragon scale weapon (costs 20 gold)',
          successProbability: 1.0,
          successDescription: 'The dragon breathes fire into a scale from its own body, forging it into a legendary weapon. You pay 20 gold and receive something priceless.',
          successEffects: {
            gold: -20,
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `dragon-scale-blade-${s}`, name: 'Dragon Scale Blade', description: 'A legendary weapon forged from a living dragon scale — nearly indestructible', quantity: 1, type: 'equipment', effects: { strength: 5 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `riddle-dragon-${s}`,
          text: 'Challenge the dragon to a riddle contest',
          successProbability: 0.4,
          successDescription: 'The dragon is delighted by the challenge. After three riddles, you stump it. It roars with laughter and presents you with an even greater gift.',
          successEffects: {
            reputation: 10,
            rewardItems: processFallbackLegendaryItems([
              { id: `dragon-heart-gem-${s}`, name: 'Dragon Heart Gem', description: 'A gem said to contain a fragment of the dragon\'s soul — its power is immense', quantity: 1, type: 'equipment', effects: { strength: 3, intelligence: 3, luck: 2 } },
            ]),
          },
          failureDescription: 'The dragon answers each riddle with ease and poses ones you cannot solve. It shakes its head: "Perhaps in a few more centuries, little one." It departs without a gift.',
          failureEffects: { reputation: 2 },
        },
        {
          id: `decline-dragon-${s}`,
          text: 'Decline respectfully and bow',
          successProbability: 1.0,
          successDescription: 'The dragon appraises you for a long moment. "Wisdom is knowing when not to bargain. You have earned my respect." It leaves a single scale on the ground.',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackLegendaryItems([
              { id: `dragon-scale-${s}`, name: 'Dragon Scale', description: 'A shed scale from an ancient dragon, still radiating power', quantity: 1, type: 'equipment', effects: { strength: 2, luck: 1 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 4. The Temporal Rift
    {
      id: `leg-temporal-${s}`,
      description: 'The air before you splits like torn fabric. A shimmering crack in time floats at eye level, and through it you glimpse a world of impossible treasures — artifacts from another era, glowing with power.',
      options: [
        {
          id: `reach-through-rift-${s}`,
          text: 'Reach through the temporal rift',
          successProbability: 0.5,
          successDescription: 'Your hands close around objects of immense power from another age. You pull two legendary items through before the rift snaps shut.',
          successEffects: {
            reputation: 6,
            rewardItems: processFallbackLegendaryItems([
              { id: `temporal-helm-${s}`, name: 'Helm of Lost Ages', description: 'Ancient armor from an age of heroes, its enchantments still potent', quantity: 1, type: 'equipment', effects: { intelligence: 3, luck: 2 } },
              { id: `temporal-ring-${s}`, name: 'Chrono Ring', description: 'A ring that bends time slightly in its wearer\'s favor', quantity: 1, type: 'equipment', effects: { luck: 3, strength: 1 } },
            ]),
          },
          failureDescription: 'The rift snaps shut before you can grasp anything. Your hands tingle with temporal energy but you walk away empty-handed.',
          failureEffects: {},
        },
        {
          id: `observe-rift-${s}`,
          text: 'Observe the rift safely',
          successProbability: 1.0,
          successDescription: 'You study the phenomenon carefully. Patterns within the rift resolve into arcane knowledge. A scroll materializes at your feet as the rift closes.',
          successEffects: {
            reputation: 5,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 4, `temporal-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `close-rift-${s}`,
          text: 'Heroically close the rift before it destabilizes reality',
          successProbability: 1.0,
          successDescription: 'You pour your will into sealing the temporal wound. With a thunderous crack it closes. Those nearby witnessed your heroic act — word spreads fast.',
          successEffects: { reputation: 8 },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 5. The Forgotten Shrine of Power
    {
      id: `leg-shrine-${s}`,
      description: 'Hidden in a clearing of impossibly ancient trees, you find a shrine of polished obsidian glowing with pulsing golden light. The inscription reads: "Power awaits those who approach with purpose."',
      options: [
        {
          id: `kneel-pray-shrine-${s}`,
          text: 'Kneel and pray at the shrine',
          successProbability: 1.0,
          successDescription: 'The shrine accepts your humility. Golden light washes over you, filling you with strength. Gold coins materialize at the shrine base.',
          successEffects: {
            gold: 25 + character.level * 5,
            reputation: 5,
            rewardItems: processFallbackLegendaryItems([
              { id: `shrine-str-essence-${s}`, name: 'Essence of the Shrine', description: 'A glowing essence that strengthens the body and sharpens the mind', quantity: 2, type: 'consumable', effects: { strength: 2, intelligence: 1 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `claim-shrine-power-${s}`,
          text: 'Claim the shrine\'s full power for yourself',
          successProbability: 0.4,
          successDescription: 'You channel the shrine\'s full might into yourself. The power is overwhelming but you hold on — and are transformed!',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `shrine-power-str-${s}`, name: 'Potion of Immense Strength', description: 'The distilled power of the shrine, imbuing tremendous strength', quantity: 1, type: 'consumable', effects: { strength: 3 } },
              { id: `shrine-power-int-${s}`, name: 'Potion of Ancient Wisdom', description: 'The distilled power of the shrine, sharpening the mind to a razor edge', quantity: 1, type: 'consumable', effects: { intelligence: 3 } },
            ]),
          },
          failureDescription: 'The power is too vast. It rejects you violently, hurling you back. You survive but gain nothing.',
          failureEffects: {},
        },
        {
          id: `make-offering-shrine-${s}`,
          text: 'Make an offering of 10 gold to the shrine',
          successProbability: 0.8,
          successDescription: 'The shrine accepts your offering and responds with tenfold generosity. A powerful spell scroll floats down from the golden light.',
          successEffects: {
            gold: -10,
            reputation: 6,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 4, `shrine-scroll-${s}`)],
          },
          failureDescription: 'The shrine absorbs your gold silently. Nothing else happens — perhaps it simply was not the right time.',
          failureEffects: { gold: -10 },
        },
      ],
    },
    // 6. The Time-Frozen Warrior
    {
      id: `leg-frozen-warrior-${s}`,
      description: 'In a remote canyon, time itself has crystallized around a legendary warrior mid-battle-cry. Her weapon is raised, her armor gleaming as the day she was frozen. A temporal crack runs along the crystal — it is weakening.',
      options: [
        {
          id: `shatter-crystal-warrior-${s}`,
          text: 'Shatter the temporal crystal and free the warrior',
          successProbability: 0.5,
          successDescription: 'The crystal explodes in a shower of time-fragments. The warrior gasps — then looks at you with ancient warrior\'s eyes. "I owe you everything." She removes her legendary armor and presses it into your hands.',
          successEffects: {
            reputation: 8,
            rewardItems: processFallbackLegendaryItems([
              { id: `frozen-warrior-armor-${s}`, name: 'Armor of the Time-Frozen Warrior', description: 'Legendary armor from a warrior preserved across ages, forged in techniques lost to history', quantity: 1, type: 'equipment', effects: { strength: 3, intelligence: 2 } },
            ]),
          },
          failureDescription: 'The crystal resists your blow and reforms. The warrior remains frozen in time.',
          failureEffects: {},
        },
        {
          id: `study-frozen-warrior-${s}`,
          text: 'Study the warrior\'s fighting stance for technique',
          successProbability: 1.0,
          successDescription: 'Locked in battle-perfect form, the warrior is the finest tutor you have ever had. Hours of study unlock techniques you never thought possible.',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackLegendaryItems([
              { id: `warrior-technique-${s}`, name: 'Warrior\'s Technique Codex', description: 'Notes compiled from studying the time-frozen warrior, distilling lost combat techniques', quantity: 1, type: 'consumable', effects: { strength: 4 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `take-frozen-weapon-${s}`,
          text: 'Carefully extract the weapon from the crystal',
          successProbability: 0.4,
          successDescription: 'The weapon slides free, still sharp after all this time. In your hands it feels destined.',
          successEffects: {
            gold: 20 + character.level * 5,
            reputation: 4,
            rewardItems: processFallbackLegendaryItems([
              { id: `frozen-blade-${s}`, name: 'Blade of the Frozen Age', description: 'A legendary weapon extracted from a temporal crystal, perfectly preserved and devastatingly sharp', quantity: 1, type: 'equipment', effects: { strength: 5 } },
            ]),
          },
          failureDescription: 'The crystal fuses tighter around the weapon. It will not be moved.',
          failureEffects: {},
        },
      ],
    },
    // 7. The Ancient Library
    {
      id: `leg-ancient-library-${s}`,
      description: 'A mountain trembles and a great stone door grinds open, revealing an untouched library older than any civilization you know. Thousands of intact tomes glow with preserved magic. The air smells of ancient knowledge.',
      options: [
        {
          id: `read-library-forbidden-${s}`,
          text: 'Seek out the most forbidden tome in the collection',
          successProbability: 0.4,
          successDescription: 'You find a tome of impossible complexity. Hours later you emerge fundamentally changed, your mind expanded far beyond its former limits.',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `forbidden-tome-${s}`, name: 'Tome of Forbidden Wisdom', description: 'A legendary tome containing knowledge no mortal was meant to possess', quantity: 1, type: 'consumable', effects: { intelligence: 5 } },
            ]),
          },
          failureDescription: 'The tome\'s words shift and resist comprehension. Some knowledge refuses to be read.',
          failureEffects: { reputation: 2 },
        },
        {
          id: `copy-library-spell-${s}`,
          text: 'Copy the most powerful spell you can find',
          successProbability: 1.0,
          successDescription: 'You spend hours transcribing a legendary spell. When finished, the scroll in your hands practically thrums with power.',
          successEffects: {
            reputation: 5,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 6, `library-legendary-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `take-library-artifacts-${s}`,
          text: 'Gather the most valuable artifacts and sell them',
          successProbability: 0.7,
          successDescription: 'You identify several unique artifacts. Scholars and merchants will pay extraordinary sums.',
          successEffects: {
            gold: 50 + character.level * 12,
            reputation: -2,
          },
          failureDescription: 'Most artifacts are too fragile to move. You salvage a fraction of their value.',
          failureEffects: { gold: 15 + character.level * 3 },
        },
      ],
    },
    // 8. Phoenix Rebirth
    {
      id: `leg-phoenix-${s}`,
      description: 'A dying phoenix lands before you in an explosion of golden embers. With her last breath she speaks: "Champion. I choose you to carry my rebirth fire. Will you bear it?" The air shimmers with impossible heat.',
      options: [
        {
          id: `accept-phoenix-fire-${s}`,
          text: 'Accept the phoenix rebirth fire',
          successProbability: 1.0,
          successDescription: 'The phoenix fire pours into you. You feel reborn — not just restored, but transformed. Three vials of living flame materialize in your pack, each containing a fragment of phoenix essence.',
          successEffects: {
            reputation: 8,
            rewardItems: processFallbackLegendaryItems([
              { id: `phoenix-essence-${s}`, name: 'Phoenix Rebirth Essence', description: 'A vial of living phoenix flame that permanently strengthens the bearer', quantity: 3, type: 'consumable', effects: { strength: 2, luck: 2 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `guide-phoenix-rebirth-${s}`,
          text: 'Help guide the phoenix\'s rebirth',
          successProbability: 0.7,
          successDescription: 'With your help, the phoenix completes her rebirth perfectly. She rises fully — then gifts you a feather from her new plumage.',
          successEffects: {
            reputation: 10,
            rewardItems: processFallbackLegendaryItems([
              { id: `phoenix-feather-item-${s}`, name: 'Phoenix Feather', description: 'A feather from a reborn phoenix, radiating warmth and fortune in equal measure', quantity: 1, type: 'equipment', effects: { luck: 4, intelligence: 1 } },
            ]),
          },
          failureDescription: 'The rebirth goes imperfectly. The phoenix still rises, but limping. She nods her thanks and takes wing.',
          failureEffects: { reputation: 5 },
        },
        {
          id: `collect-phoenix-embers-${s}`,
          text: 'Collect the embers for later use',
          successProbability: 1.0,
          successDescription: 'You carefully gather the cooling embers. Each one is worth a small fortune and carries the phoenix\'s blessing.',
          successEffects: {
            gold: 30 + character.level * 8,
            reputation: 4,
          },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 9. The Shadow Merchant
    {
      id: `leg-shadow-merchant-${s}`,
      description: 'From the darkness steps a figure who should not exist: the legendary Shadow Merchant. He trades in things that cannot be bought — memories, possibilities, futures. His prices are steep but his goods are unparalleled.',
      options: [
        {
          id: `buy-possibility-${s}`,
          text: 'Buy a "possibility" — an alternate path forward',
          successProbability: 1.0,
          successDescription: 'The merchant names his price: five years of mundane luck. You agree. A key appears — it opens something you don\'t yet know about, but fate shifts in your favor.',
          successEffects: {
            reputation: 6,
            rewardItems: processFallbackLegendaryItems([
              { id: `shadow-key-${s}`, name: 'Shadow Merchant\'s Key', description: 'A key of pure shadow that opens a door not yet known — but certain to appear', quantity: 1, type: 'quest' },
              { id: `luck-amplifier-${s}`, name: 'Amplifier of Fortune', description: 'A distillation of traded luck, repurposed into a usable surge of fortune', quantity: 1, type: 'consumable', effects: { luck: 5 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `buy-strength-shadow-${s}`,
          text: 'Buy raw power at any cost',
          successProbability: 0.6,
          successDescription: 'The merchant nods and names a price — a painful memory. You pay. Power like you have never felt floods through you.',
          successEffects: {
            reputation: 4,
            rewardItems: processFallbackLegendaryItems([
              { id: `shadow-power-${s}`, name: 'Shadow-Bought Power', description: 'Power purchased from the Shadow Merchant at a personal price — immense and slightly uncomfortable', quantity: 1, type: 'consumable', effects: { strength: 4, intelligence: 2 } },
            ]),
          },
          failureDescription: 'The merchant examines you carefully. "Nothing worth trading in you today." He vanishes.',
          failureEffects: {},
        },
        {
          id: `rob-shadow-merchant-${s}`,
          text: 'Attempt to steal from the Shadow Merchant',
          successProbability: 0.3,
          successDescription: 'By some miracle you succeed. The merchant\'s laughter follows you as you flee. "Well done, mortal. Perhaps I let you."',
          successEffects: {
            gold: 40 + character.level * 10,
            reputation: -5,
            rewardItems: processFallbackLegendaryItems([
              { id: `stolen-shadow-goods-${s}`, name: 'Stolen Shadow Goods', description: 'Items taken from the Shadow Merchant — valuable beyond reason, cursed with his amusement', quantity: 1, type: 'consumable', effects: { luck: 3, intelligence: 3 } },
            ]),
          },
          failureDescription: 'The merchant sighs and your hands pass through his wares like smoke. "Nice try." He vanishes.',
          failureEffects: { reputation: -2 },
        },
      ],
    },
    // 10. The Celestial Forge
    {
      id: `leg-celestial-forge-${s}`,
      description: 'High in the clouds, suspended by nothing, a forge of pure starfire burns. An absent smith\'s tools hang in the air, still moving on their own, crafting something magnificent. The forge responds to intention alone.',
      options: [
        {
          id: `forge-legendary-weapon-${s}`,
          text: 'Command the forge to craft you a weapon',
          successProbability: 0.7,
          successDescription: 'The celestial tools respond to your will. Hours later, a weapon unlike anything forged by mortal hands completes itself in the starfire.',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `celestial-forge-weapon-${s}`, name: 'Blade of Celestial Fire', description: 'A weapon forged in pure starfire — it cuts through anything with absolute clarity', quantity: 1, type: 'equipment', effects: { strength: 4, intelligence: 2 } },
            ]),
          },
          failureDescription: 'The forge crafts something, but it crumbles before completion. The materials were not aligned.',
          failureEffects: { reputation: 2 },
        },
        {
          id: `forge-armor-celestial-${s}`,
          text: 'Command the forge to craft you armor',
          successProbability: 0.7,
          successDescription: 'The starfire shapes itself into plates of celestial alloy. The resulting armor fits perfectly and radiates divine protection.',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackLegendaryItems([
              { id: `celestial-forge-armor-${s}`, name: 'Celestial Forge Armor', description: 'Armor forged in starfire — impossibly light and impossibly strong', quantity: 1, type: 'equipment', effects: { intelligence: 3, luck: 3 } },
            ]),
          },
          failureDescription: 'The forge tries but the mold collapses. The starfire scatters harmlessly.',
          failureEffects: { reputation: 2 },
        },
        {
          id: `learn-celestial-forge-${s}`,
          text: 'Study the forge\'s techniques',
          successProbability: 1.0,
          successDescription: 'The celestial tools teach you methods beyond any mortal smith. A scroll manifests recording the most powerful forge-spell the starfire can teach.',
          successEffects: {
            reputation: 5,
            rewardItems: [createLegendarySpellScrollRewardItem(character.level + 5, `celestial-forge-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 11. The Wandering Sage
    {
      id: `leg-sage-${s}`,
      description: 'An ancient scholar in travel-worn robes sits on a milestone, surrounded by floating tomes and scrolls. Their eyes hold the depth of centuries. "I have wandered all the world\'s roads. Sit with me, and I will share what I have found."',
      options: [
        {
          id: `learn-sage-${s}`,
          text: 'Ask the sage to teach you',
          successProbability: 1.0,
          successDescription: 'The sage speaks for an hour, imparting knowledge that shifts your understanding of the world. A powerful spell crystallizes from the lesson.',
          successEffects: {
            reputation: 6,
            rewardItems: [createSpellScrollRewardItem(character.level + 4, `sage-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `ask-sage-map-${s}`,
          text: 'Ask for a map to a legendary dungeon',
          successProbability: 0.5,
          successDescription: 'The sage smiles and produces a hand-drawn map to a legendary site. "The dungeon is real. Whether you are ready is another matter."',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackRewardItems([
              { id: `sage-dungeon-map-${s}`, name: 'Scholar\'s Dungeon Map', description: 'A precisely drawn map to a legendary dungeon, annotated in the sage\'s own hand', quantity: 1, type: 'quest' },
            ]),
          },
          failureDescription: 'The sage searches their scrolls but shakes their head. "I once knew that place, but the map has been lost. What I can give you is wisdom instead."',
          failureEffects: { reputation: 3, rewardItems: [createSpellScrollRewardItem(character.level + 2, `sage-fallback-${s}`)] },
        },
        {
          id: `ask-sage-stat-${s}`,
          text: 'Ask for training to improve your abilities',
          successProbability: 0.8,
          successDescription: 'The sage puts you through a demanding mental and physical regimen. By sunset, you feel genuinely transformed.',
          successEffects: {
            reputation: 4,
            rewardItems: processFallbackRewardItems([
              { id: `sage-training-${s}`, name: 'Essence of Mastery', description: 'A concentrated essence produced by the sage\'s training regimen, permanently improving the mind', quantity: 1, type: 'consumable', effects: { intelligence: 3 } },
            ]),
          },
          failureDescription: 'The training is exhausting and you struggle to keep up. Still, the sage gives you a small token of encouragement.',
          failureEffects: { reputation: 2, rewardItems: processFallbackRewardItems([{ id: `sage-token-${s}`, name: 'Sage\'s Token', description: 'A small carved stone given to students of promise', quantity: 1, type: 'consumable', effects: { intelligence: 1 } }]) },
        },
      ],
    },
    // 12. The Cursed Heirloom
    {
      id: `leg-heirloom-${s}`,
      description: 'A dying knight slumps against a waystone, their legendary sword planted in the earth before them. They look up with fading eyes: "I was tasked to find a worthy heir for this blade... It seems fate has brought you here."',
      options: [
        {
          id: `accept-cursed-sword-${s}`,
          text: 'Accept the legendary blade',
          successProbability: 1.0,
          successDescription: 'The knight releases the hilt and you grasp the weapon. Power surges through you — this sword has seen a hundred battles and carries their strength.',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackRewardItems([
              { id: `heirloom-blade-${s}`, name: 'Knight\'s Legacy Blade', description: 'A legendary sword passed down through generations of champions — its edge never dulls', quantity: 1, type: 'equipment', effects: { strength: 5, luck: 1 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `refuse-heirloom-${s}`,
          text: 'Respectfully decline — the sword deserves a better heir',
          successProbability: 1.0,
          successDescription: 'The knight\'s eyes clear momentarily. "Your humility honors me, adventurer." They press a pouch of ancient gold into your hand instead. "For your kindness."',
          successEffects: {
            gold: 30 + character.level * 8,
            reputation: 8,
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `learn-history-heirloom-${s}`,
          text: 'Ask the knight to share the sword\'s history before they pass',
          successProbability: 0.7,
          successDescription: 'The knight speaks for an hour — tales of legendary battles. Their story, told fully, draws power into a scroll. Then they press the blade on you as well.',
          successEffects: {
            reputation: 7,
            rewardItems: [
              createSpellScrollRewardItem(character.level + 3, `heirloom-scroll-${s}`),
              ...(processFallbackRewardItems([{ id: `heirloom-blade2-${s}`, name: 'Knight\'s Legacy Blade', description: 'A legendary sword passed down through generations of champions', quantity: 1, type: 'equipment', effects: { strength: 4 } }]) ?? []),
            ],
          },
          failureDescription: 'The knight fades before finishing their tale. You are left with the sword and an unfinished story.',
          failureEffects: { reputation: 3, rewardItems: processFallbackRewardItems([{ id: `heirloom-blade3-${s}`, name: 'Knight\'s Legacy Blade', description: 'A legendary sword — its full history untold', quantity: 1, type: 'equipment', effects: { strength: 3 } }]) },
        },
      ],
    },
    // 13. The Living Constellation
    {
      id: `leg-constellation-${s}`,
      description: 'Stars descend from the night sky, forming a shimmering humanoid figure of pure light above the road. It speaks in a voice like the turning of celestial spheres: "We have observed you, small one. We offer a trial. Pass, and we will grant you power beyond the ordinary."',
      options: [
        {
          id: `accept-trial-str-${s}`,
          text: 'Accept the Trial of Strength',
          successProbability: 0.6,
          successDescription: 'You endure the constellation\'s trial — tests of endurance and will beyond mortal expectation. Stars shower down as a reward.',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackRewardItems([
              { id: `star-strength-${s}`, name: 'Fallen Star — Strength', description: 'A crystallized star fragment that surges with martial power', quantity: 1, type: 'consumable', effects: { strength: 4 } },
            ]),
          },
          failureDescription: 'The trial breaks you before you finish. The constellation watches without judgment as you fall. "Try again in another life, small one."',
          failureEffects: { reputation: 2 },
        },
        {
          id: `accept-trial-int-${s}`,
          text: 'Accept the Trial of the Mind',
          successProbability: 0.6,
          successDescription: 'The constellation poses riddles drawn from the fabric of the universe. You answer the last — barely — and the stars rain arcane knowledge.',
          successEffects: {
            reputation: 7,
            rewardItems: processFallbackRewardItems([
              { id: `star-intelligence-${s}`, name: 'Fallen Star — Wisdom', description: 'A crystallized star fragment radiating arcane insight', quantity: 1, type: 'consumable', effects: { intelligence: 4 } },
            ]),
          },
          failureDescription: 'The riddles exceed your understanding. The constellation fades: "The stars will wait."',
          failureEffects: { reputation: 2 },
        },
        {
          id: `contemplate-constellation-${s}`,
          text: 'Simply stand in awe and ask for nothing',
          successProbability: 1.0,
          successDescription: 'The constellation is moved by your humility. It reaches down and leaves a blessing of luck — a gentle hand of starlight on your brow.',
          successEffects: {
            reputation: 6,
            rewardItems: processFallbackRewardItems([
              { id: `star-luck-${s}`, name: 'Fallen Star — Fortune', description: 'A crystallized star fragment brimming with cosmic luck', quantity: 1, type: 'consumable', effects: { luck: 4 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 14. The World Tree Sapling
    {
      id: `leg-world-tree-${s}`,
      description: 'In a clearing bathed in golden light, a sapling glows with the unmistakable life-force of the World Tree itself. Its roots have barely touched the earth, yet it hums with ancient power. A voice emanates from its bark: "Take me, or plant me — the choice is yours."',
      options: [
        {
          id: `take-branch-${s}`,
          text: 'Take a branch from the sapling',
          successProbability: 1.0,
          successDescription: 'The sapling yields a branch willingly. It immediately shapes itself into a legendary staff radiating nature magic.',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackRewardItems([
              { id: `world-tree-staff-${s}`, name: 'World Tree Branch', description: 'A living branch from the World Tree itself, still pulsing with ancient nature power', quantity: 1, type: 'equipment', effects: { intelligence: 4, strength: 2 } },
            ]),
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `plant-sapling-${s}`,
          text: 'Plant the sapling in sacred ground',
          successProbability: 0.8,
          successDescription: 'You carefully plant the sapling at the clearing\'s heart. As it roots, a burst of golden light rewards your selflessness — coins rain from its first leaves, and your name will be remembered.',
          successEffects: {
            gold: 25 + character.level * 6,
            reputation: 10,
          },
          failureDescription: 'You search for the right spot but the sapling\'s glow dims — it must be planted here. You do, and feel at peace, though no material reward follows.',
          failureEffects: { reputation: 6 },
        },
        {
          id: `commune-world-tree-${s}`,
          text: 'Commune with the sapling and listen to what it says',
          successProbability: 1.0,
          successDescription: 'You press your hands to its bark. In a rush of vision you see the whole world, its roots, its future. Knowledge crystallizes — a scroll unlike any other.',
          successEffects: {
            reputation: 7,
            rewardItems: [createSpellScrollRewardItem(character.level + 5, `world-tree-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
      ],
    },
    // 15. The Ancient Automaton
    {
      id: `leg-automaton-${s}`,
      description: 'Standing in the rubble of a pre-civilization ruin is a construct of impossible complexity — gears within gears, runes etched on brass skin. Its eyes flicker on as you approach. "Unit... online. You are the first organic lifeform detected in... 4,217 years. Query: what do you require?"',
      options: [
        {
          id: `request-knowledge-${s}`,
          text: 'Ask the automaton for knowledge of lost civilizations',
          successProbability: 1.0,
          successDescription: 'The automaton downloads eons of archived knowledge into your mind. The sheer volume is dizzying — but a crystallized scroll forms from the overflow.',
          successEffects: {
            reputation: 6,
            rewardItems: [createSpellScrollRewardItem(character.level + 5, `automaton-scroll-${s}`)],
          },
          failureDescription: '',
          failureEffects: {},
        },
        {
          id: `request-combat-aid-${s}`,
          text: 'Request the automaton\'s combat protocols',
          successProbability: 0.7,
          successDescription: 'The automaton performs a weapons analysis and forges a combat enhancement from its own chassis — a legendary piece of equipment calibrated perfectly to you.',
          successEffects: {
            reputation: 5,
            rewardItems: processFallbackRewardItems([
              { id: `automaton-module-${s}`, name: 'Automaton Combat Module', description: 'A precision-crafted module from a pre-civilization construct, enhancing combat performance', quantity: 1, type: 'equipment', effects: { strength: 3, intelligence: 2, luck: 1 } },
            ]),
          },
          failureDescription: 'The automaton\'s combat database is corrupted. "Combat protocols unavailable. Offering archived treasure coordinates instead."',
          failureEffects: { gold: 20 + character.level * 5, reputation: 3 },
        },
        {
          id: `reactivate-automaton-${s}`,
          text: 'Offer to help restore the automaton to full function',
          successProbability: 0.5,
          successDescription: 'With great effort you locate a power source nearby and restore the automaton. Its gratitude is immense — it transfers its remaining treasury to you.',
          successEffects: {
            gold: 40 + character.level * 10,
            reputation: 8,
            rewardItems: processFallbackRewardItems([
              { id: `automaton-core-${s}`, name: 'Automaton Power Core', description: 'The restored power core of an ancient construct, radiating enormous energy', quantity: 1, type: 'equipment', effects: { intelligence: 3, strength: 2 } },
            ]),
          },
          failureDescription: 'The power source proves incompatible. The automaton\'s eyes dim. "Attempt appreciated. Transferring emergency cache." A small but valuable reward materializes.',
          failureEffects: { gold: 15, reputation: 4 },
        },
      ],
    },
  ]

  const randomIndex = Math.floor(Math.random() * pool.length)
  return pool[randomIndex]
}
