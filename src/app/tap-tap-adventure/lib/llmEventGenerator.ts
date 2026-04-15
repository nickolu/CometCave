import { OpenAI } from 'openai'
import { z } from 'zod'

import { getRegion } from '@/app/tap-tap-adventure/config/regions'
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
  }
  failureDescription: string
  failureEffects: {
    gold?: number
    reputation?: number
    statusChange?: string
    rewardItems?: Item[]
    mountDamage?: number
    mountDeath?: boolean
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
  }),
  failureDescription: z.string(),
  failureEffects: z.object({
    gold: z.number().optional(),
    reputation: z.number().optional(),
    statusChange: z.string().optional(),
    rewardItems: z.array(rewardItemSchema).optional(),
    mountDamage: z.number().optional(),
    mountDeath: z.boolean().optional(),
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

IMPORTANT — Combat events:
Exactly 1 of the 3 events MUST be a combat encounter (bandits, monsters, aggressive creatures, rivals, etc.). That event MUST include at least one option with "triggersCombat": true — this represents the character choosing to fight. The other options on that event can be peaceful alternatives (negotiate, flee, pay a toll, sneak past). The remaining 2 events should be non-combat (exploration, social, discovery, etc.) with NO options that have triggersCombat. This ensures approximately 25% of events over time involve combat potential.

IMPORTANT — Mount events:
If the character has an active mount (check character.activeMount), occasionally include events where the mount can be harmed. Examples: a rock slide that injures the mount, a magical trap that wounds it, hostile wildlife attacking the mount, treacherous terrain causing injury. Use mountDamage (3–20) in failureEffects for partial damage, or mountDeath: true if the mount is killed outright. Only include mount-damaging outcomes when character.activeMount is not null/undefined.

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
${context || 'No prior adventures yet — this is the beginning of their journey.'}`,
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: [createSpellScrollRewardItem(character.level + 3, `vault-scroll-${s}`)],
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: [createSpellScrollRewardItem(character.level + 5, `celestial-scroll-${s}`)],
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: [createSpellScrollRewardItem(character.level + 4, `temporal-scroll-${s}`)],
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: processFallbackRewardItems([
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
            rewardItems: [createSpellScrollRewardItem(character.level + 4, `shrine-scroll-${s}`)],
          },
          failureDescription: 'The shrine absorbs your gold silently. Nothing else happens — perhaps it simply was not the right time.',
          failureEffects: { gold: -10 },
        },
      ],
    },
  ]

  const randomIndex = Math.floor(Math.random() * pool.length)
  return pool[randomIndex]
}
