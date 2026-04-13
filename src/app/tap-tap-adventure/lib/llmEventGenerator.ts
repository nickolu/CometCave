import { OpenAI } from 'openai'
import { z } from 'zod'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
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

  const region = getRegion(character.currentRegion ?? 'green_meadows')
  const regionContext = `The character is currently in ${region.name}: ${region.description}. Setting/theme: ${region.theme}. Generate events that fit this setting. ${region.enemyTypes.length > 0 ? `Enemy types common here: ${region.enemyTypes.join(', ')}.` : 'This is a safe zone with no combat.'} The dominant element is ${region.element}.`

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

IMPORTANT: About half of all events should involve a potential confrontation (bandits, monsters, rivals, etc.). For these events, include at least one option with "triggersCombat": true — this represents the character choosing to fight. Other options can be peaceful alternatives (negotiate, flee, pay a toll, sneak past). This gives the player agency over whether to fight.

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
    ],
    scorched_wastes: [
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
    ],
    frozen_peaks: [
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
    ],
    crystal_caves: [
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
    ],
    sky_citadel: [
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
    ],
  }

  return regionEvents[regionId] ?? []
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
          failureEffects: { gold: -3 } },
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
          successEffects: {},
          failureDescription: '', failureEffects: {} },
      ],
    },
  ]

  // Add region-specific events to the pool for non-generic regions
  const combinedPool = [...regionSpecificEvents, ...pool]

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
