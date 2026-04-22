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
                  heal: { type: 'number', description: 'Directly restores this amount of HP.' },
                  shield: { type: 'number', description: 'Grants damage-absorbing shield points.' },
                  manaRestore: { type: 'number', description: 'Restores mana points.' },
                  cleanse: { type: 'boolean', description: 'Removes all negative status effects (poison, burn, etc.).' },
                  damageBoost: { type: 'number', description: 'Temporary damage multiplier (e.g., 1.5 = +50% for 2 turns).' },
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
- Include 1-2 loot items. Vary the types: healing potions (heal: 15), shield potions (shield: 15), mana potions (manaRestore: 15), antidotes (cleanse: true), rage elixirs (damageBoost: 1.5), or stat-boosting items (strength/intelligence/luck). Don't always drop healing potions — tactical variety matters.
- Optionally include a special ability with cooldown of 2-4 turns
- Some enemies can inflict status effects (poison, burn, slow, curse, fear). Include a statusAbility field with type, value (damage per turn or effect strength), duration (2-4 turns), and chance (0-1 probability of inflicting)
- Assign an element to the enemy (fire, ice, lightning, shadow, nature, arcane, or none). Choose an element that fits the enemy's theme. For example: wolves = nature, fire elementals = fire, undead = shadow, golems = none.

Tactical variety guidelines:
- Give each enemy a distinct combat personality. Archetypes to vary between: tanky (high HP/defense, low attack), glass cannon (high attack, fragile), debuffer (relies on status effects), swift striker (balanced but with multi-hit or dodge abilities).
- For the special ability, choose ONE from: area attack (damages and has a secondary effect), self-heal (restores 20-30% HP, cooldown 3-4), counter-stance (next attack is reflected), multi-strike (hits 2-3 times for reduced damage each), enrage (temporarily boosts attack but lowers defense).
- Make the enemy feel tactically distinct — not every enemy should be a simple damage-dealer.

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

Boss tactical design:
- The boss MUST have a distinct combat phase pattern. Choose one:
  (a) Enrage at low HP — attack increases below 30% HP
  (b) Alternating phases — switches between aggressive and defensive stances
  (c) Summoning — conceptually powerful enough to feel like multiple threats
- The special ability should feel devastating and force the player to plan around its cooldown.
- Include a status ability: choose from poison, burn, slow, curse, or fear. The boss's status effect should synergize with its combat style.

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

export async function generateMiniBossEncounter(
  character: FantasyCharacter,
  context: string
): Promise<{ enemy: CombatEnemy; scenario: string }> {
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate a MINI-BOSS combat encounter for this fantasy character. This is a tough elite enemy — stronger than a regular foe but not a region guardian. It should feel dangerous and memorable without being the final challenge of the area.

Region context: Generate a mini-boss appropriate for the ${getRegion(character.currentRegion ?? 'green_meadows').name} region. Theme: ${getRegion(character.currentRegion ?? 'green_meadows').theme}. The dominant element is ${getRegion(character.currentRegion ?? 'green_meadows').element}. Common enemy types: ${getRegion(character.currentRegion ?? 'green_meadows').enemyTypes.join(', ') || 'none'}.

Reputation context: This character's reputation is ${character.reputation} (${getReputationTier(character.reputation)}).
${character.reputation >= 50 ? 'High reputation: the mini-boss might be a rival or challenger drawn by the character\'s fame.' : ''}${character.reputation <= -20 ? 'Low reputation: the mini-boss might be a bounty hunter or vengeful enforcer.' : ''}

This is a level ${character.level} character facing a mini-boss fight. The mini-boss should be notably stronger than normal enemies:
- Mini-boss HP: ${Math.round((35 + character.level * 15) * 1.2)} (1.2x normal)
- Mini-boss attack: ${Math.round((6 + character.level * 3) * 1.15)} (1.15x normal)
- Mini-boss defense: ${Math.round((2 + character.level) * 1.15)} (1.15x normal)
- Gold reward: ${Math.round((5 + character.level * 5) * 2)} (2x normal)
- Include 2 good-quality loot items (quality between regular drops and boss drops)
- MUST include a special ability with cooldown of 2-4 turns — this is a mini-boss!
- Should have a status ability (poison, burn, slow, curse, or fear)
- Give it an imposing name with a title like 'the Ravager' or 'Bane of X'

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
            description: 'Generate a mini-boss combat encounter.',
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
    console.error('Mini-boss generation failed, using fallback', err)
    return getDefaultMiniBossEncounter(character)
  }
}

function getDefaultMiniBossEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const region = getRegion(character.currentRegion ?? 'green_meadows')

  const miniBosses: Array<{ name: string; desc: string; special: string; specialDesc: string; element: 'none' | 'shadow' | 'nature' | 'fire' | 'ice' | 'lightning' }> = [
    { name: 'Goretusk the Ravager', desc: 'A hulking beast covered in battle scars, its tusks dripping with venom.', special: 'Tusked Charge', specialDesc: 'Charges forward with devastating force.', element: 'nature' },
    { name: 'Whisper, the Shadow Stalker', desc: 'A silent assassin wreathed in living darkness, striking from impossible angles.', special: 'Shadow Step', specialDesc: 'Teleports behind the target for a critical strike.', element: 'shadow' },
    { name: 'Cindermaw the Scorched', desc: 'A fire-scarred drake that breathes superheated ash and embers.', special: 'Ember Breath', specialDesc: 'Unleashes a cone of burning embers.', element: 'fire' },
    { name: 'Glacius, the Frozen Wrath', desc: 'An ice elemental that has consumed countless warriors, their frozen faces visible within its crystalline body.', special: 'Absolute Zero', specialDesc: 'Flash-freezes the area, dealing ice damage and slowing.', element: 'ice' },
    { name: 'Dreadweaver Azuul', desc: 'An arachnid horror whose webs are made of concentrated fear. Its many eyes see all possible futures.', special: 'Nightmare Web', specialDesc: 'Ensnares the target in webs that inflict terror.', element: 'shadow' },
    { name: 'Boltclaw the Thunderborn', desc: 'A lightning-charged beast crackling with raw electrical power. Thunder follows each step.', special: 'Chain Lightning', specialDesc: 'Unleashes arcing lightning that strikes multiple times.', element: 'lightning' },
  ]
  const miniBoss = miniBosses[level % miniBosses.length]

  return {
    scenario: `In the ${region.name}, a powerful elite enemy bars your way. ${miniBoss.name} steps forward — far stronger than the common rabble you've faced. A mini-boss encounter!`,
    enemy: {
      id: `mini-boss-${suffix}`,
      name: miniBoss.name,
      description: miniBoss.desc,
      hp: Math.round((35 + level * 15) * 1.2),
      maxHp: Math.round((35 + level * 15) * 1.2),
      attack: Math.round((6 + level * 3) * 1.15),
      defense: Math.round((2 + level) * 1.15),
      level: level + 1,
      goldReward: Math.round((5 + level * 5) * 2),
      lootTable: [
        inferItemTypeAndEffects({
          id: `mini-boss-loot-1-${suffix}`,
          name: 'Superior Healing Potion',
          description: 'A high-quality restorative brew.',
          quantity: 1,
        }),
        inferItemTypeAndEffects({
          id: `mini-boss-loot-2-${suffix}`,
          name: 'Elite Trophy',
          description: `A trophy taken from ${miniBoss.name}.`,
          quantity: 1,
        }),
      ],
      specialAbility: {
        name: miniBoss.special,
        description: miniBoss.specialDesc,
        damage: Math.round((5 + level * 2) * 1.4),
        cooldown: 3,
      },
      statusAbility: {
        type: 'poison' as const,
        value: 3 + level,
        duration: 3,
        chance: 0.4,
      },
      element: (region.element !== 'none' ? region.element : miniBoss.element) as CombatEnemy['element'],
    },
  }
}

export async function generateFinalBossEncounter(
  character: FantasyCharacter,
  context: string
): Promise<{ enemy: CombatEnemy; scenario: string }> {
  const level = character.level
  try {
    const response = await getOpenAI().chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: `Generate the SUPREME FINAL BOSS combat encounter for this fantasy character. This is the ultimate confrontation — the guardian of the Celestial Throne, the last obstacle to complete world conquest. The boss should be awe-inspiring, devastating, and legendary. It guards the realm of the gods and has never been defeated.

This is the FINAL BOSS of the entire game. It must feel truly supreme and nearly unstoppable:
- Final Boss HP: ${Math.round((35 + level * 15) * 4)} (4x normal — overwhelming)
- Final Boss attack: ${Math.round((6 + level * 3) * 3.5)} (3.5x normal)
- Final Boss defense: ${Math.round((2 + level) * 3)} (3x normal)
- Gold reward: ${Math.round((5 + level * 5) * 10)} (10x normal — legendary haul)
- Include 3-4 legendary loot items including a spell scroll
- MUST include a devastating special ability with cooldown of 2 turns — maximum lethality
- Give the boss a name that conveys absolute power and divine authority
- The element MUST be arcane

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
            description: 'Generate the final boss combat encounter.',
            parameters: enemySchemaForOpenAI,
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generate_combat' } },
      temperature: 0.8,
      max_tokens: 1000,
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
    console.error('Final boss generation failed, using fallback', err)
    return getDefaultFinalBossEncounter(character)
  }
}

function getDefaultFinalBossEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`

  const spell = generateSpellForLevel(Math.max(level, 8))

  return {
    scenario: `You stand before the Celestial Throne itself. The air shimmers with divine power as The Eternal Sovereign materializes from blinding light — a being of immeasurable power that has guarded the realm of the gods since the dawn of creation. This is the ultimate test. Win this battle and you will have conquered the entire world.`,
    enemy: {
      id: `final-boss-${suffix}`,
      name: 'The Eternal Sovereign',
      description: 'A supreme divine being of incomprehensible power, wreathed in celestial fire and ancient authority. Its presence alone bends reality.',
      hp: Math.round((35 + level * 15) * 4),
      maxHp: Math.round((35 + level * 15) * 4),
      attack: Math.round((6 + level * 3) * 3.5),
      defense: Math.round((2 + level) * 3),
      level: level + 5,
      goldReward: Math.round((5 + level * 5) * 10),
      lootTable: [
        inferItemTypeAndEffects({
          id: `final-boss-loot-1-${suffix}`,
          name: 'Elixir of Eternal Life',
          description: 'A legendary elixir radiating pure divine energy.',
          quantity: 1,
        }),
        inferItemTypeAndEffects({
          id: `final-boss-loot-2-${suffix}`,
          name: 'Crown of the Sovereign',
          description: 'The crown of a defeated god, still pulsing with immense power.',
          quantity: 1,
        }),
        inferItemTypeAndEffects({
          id: `final-boss-loot-3-${suffix}`,
          name: 'Celestial Shard',
          description: 'A fragment of divine power broken from the Celestial Throne.',
          quantity: 1,
        }),
        {
          id: `final-boss-loot-spell-${suffix}`,
          name: `Scroll of ${spell.name}`,
          description: `A supreme spell scroll containing divine knowledge.`,
          quantity: 1,
          type: 'spell_scroll' as const,
          spell,
        },
      ],
      specialAbility: {
        name: 'Celestial Judgment',
        description: 'Calls down a pillar of divine light that obliterates everything in its path.',
        damage: Math.round((5 + level * 2) * 4),
        cooldown: 2,
      },
      element: 'arcane',
    },
  }
}

function getDefaultBossEncounter(
  character: FantasyCharacter
): { enemy: CombatEnemy; scenario: string } {
  const level = character.level
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 10000)}`
  const region = getRegion(character.currentRegion ?? 'green_meadows')

  const bosses: Array<{ name: string; desc: string; special: string; specialDesc: string; element: 'none' | 'shadow' | 'nature' | 'fire' | 'arcane' }> = [
    { name: 'The Iron Warden', desc: 'A colossal animated suit of armor, its eyes burning with ancient fury.', special: 'Crushing Blow', specialDesc: 'Slams the ground, sending shockwaves.', element: 'none' },
    { name: 'Vexara the Cursed', desc: 'A spectral sorceress wreathed in dark flame, whispering words of ruin.', special: 'Soul Drain', specialDesc: 'Drains life force from her victims.', element: 'shadow' },
    { name: 'Grimfang the Devourer', desc: 'A massive beast with razor teeth and impenetrable scales.', special: 'Rending Fury', specialDesc: 'Unleashes a devastating multi-strike attack.', element: 'nature' },
    { name: 'Pyraxis the Undying', desc: 'A phoenix-like entity that regenerates from each wound, its body wreathed in undying flame.', special: 'Phoenix Rebirth', specialDesc: 'Erupts in flame, dealing massive damage and restoring its own health.', element: 'fire' },
    { name: 'The Hollow King', desc: 'An ancient monarch whose hollow armor houses a devouring void. Reality warps around its crown.', special: 'Void Collapse', specialDesc: 'Creates a gravity well that pulls and crushes everything nearby.', element: 'shadow' },
    { name: 'Crystalweave Titan', desc: 'A towering construct of living crystal, refracting light into devastating beams.', special: 'Prismatic Barrage', specialDesc: 'Fires a cascade of crystal shards in all directions.', element: 'arcane' },
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

  const normalEnemies: Array<{
    name: string; desc: string; element: CombatEnemy['element']
    archetype: 'balanced' | 'tank' | 'glass_cannon' | 'debuffer' | 'swift'
    special?: { name: string; desc: string; dmgMult: number; cd: number }
    status?: { type: 'poison' | 'burn' | 'slow' | 'curse' | 'fear'; value: number; dur: number; chance: number }
  }> = [
    { name: 'Ironhide Brute', desc: 'A hulking creature with thick armor plating.', element: 'none', archetype: 'tank', status: { type: 'slow', value: 0, dur: 2, chance: 0.3 } },
    { name: 'Venom Stalker', desc: 'A lean predator dripping with toxic venom.', element: 'nature', archetype: 'glass_cannon', special: { name: 'Venomous Lunge', desc: 'A poison-tipped strike.', dmgMult: 1.5, cd: 3 }, status: { type: 'poison', value: 3, dur: 3, chance: 0.5 } },
    { name: 'Hex Weaver', desc: 'A cloaked figure that whispers curses.', element: 'shadow', archetype: 'debuffer', special: { name: 'Hex Bolt', desc: 'Fires a bolt of cursed energy.', dmgMult: 0.8, cd: 2 }, status: { type: 'curse', value: 0, dur: 4, chance: 0.6 } },
    { name: 'Blaze Runner', desc: 'A swift creature wreathed in crackling flames.', element: 'fire', archetype: 'swift', special: { name: 'Flame Dash', desc: 'Blazes past defenses with scorching speed.', dmgMult: 1.3, cd: 2 }, status: { type: 'burn', value: 4, dur: 2, chance: 0.4 } },
    { name: 'Frost Sentinel', desc: 'An icy guardian that slows all who approach.', element: 'ice', archetype: 'tank', special: { name: 'Glacial Slam', desc: 'Slams the ground, sending frost waves.', dmgMult: 1.2, cd: 3 }, status: { type: 'slow', value: 0, dur: 3, chance: 0.5 } },
    { name: 'Shadow Wraith', desc: 'A spectral horror that feeds on fear.', element: 'shadow', archetype: 'debuffer', special: { name: 'Terror Pulse', desc: 'Emits a wave of overwhelming dread.', dmgMult: 0.6, cd: 2 }, status: { type: 'fear', value: 0, dur: 3, chance: 0.5 } },
    { name: 'Arcane Golem', desc: 'A construct of pure magical energy.', element: 'arcane', archetype: 'balanced', special: { name: 'Mana Burst', desc: 'Releases stored arcane energy.', dmgMult: 1.4, cd: 3 } },
    { name: 'Thornback Beast', desc: 'A creature bristling with razor-sharp thorns.', element: 'nature', archetype: 'balanced', status: { type: 'poison', value: 2, dur: 2, chance: 0.3 } },
  ]

  // Prefer region-matching elements: 60% chance to pick from matching templates, else random
  const matchingTemplates = normalEnemies.filter(t => t.element === region.element)
  let template: typeof normalEnemies[0]
  if (matchingTemplates.length > 0 && Math.random() < 0.6) {
    template = matchingTemplates[Math.floor(Math.random() * matchingTemplates.length)]
  } else {
    template = normalEnemies[Math.floor(Math.random() * normalEnemies.length)]
  }

  // Apply archetype stat modifiers
  const baseHp = 35 + level * 15
  const baseAtk = 6 + level * 3
  const baseDef = 2 + level
  let hpMult = 1.0, atkMult = 1.0, defMult = 1.0
  if (template.archetype === 'tank') { hpMult = 1.3; defMult = 1.3; atkMult = 0.85 }
  else if (template.archetype === 'glass_cannon') { hpMult = 0.75; defMult = 0.7; atkMult = 1.4 }
  else if (template.archetype === 'swift') { hpMult = 0.9; defMult = 0.9; atkMult = 1.15 }
  else if (template.archetype === 'debuffer') { atkMult = 0.9 }

  const hp = Math.round(baseHp * hpMult)
  const atk = Math.round(baseAtk * atkMult)
  const def = Math.round(baseDef * defMult)

  // Override name with region enemyType if available
  const regionEnemyName = region.enemyTypes.length > 0
    ? region.enemyTypes[Math.floor(Math.random() * region.enemyTypes.length)]
    : null
  const enemyName = regionEnemyName
    ? regionEnemyName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : template.name
  const enemyDescription = regionEnemyName
    ? `A dangerous ${regionEnemyName} native to the ${region.name}.`
    : template.desc

  return {
    scenario: `In the ${region.name}, a hostile creature emerges from the shadows, blocking your path. You must fight or flee!`,
    enemy: {
      id: `enemy-${suffix}`,
      name: enemyName,
      description: enemyDescription,
      hp,
      maxHp: hp,
      attack: atk,
      defense: def,
      level,
      goldReward: 5 + level * 5,
      lootTable: [
        inferItemTypeAndEffects((() => {
          const potionTypes = [
            { name: 'Healing Potion', description: 'A small vial of restorative liquid.' },
            { name: 'Shield Potion', description: 'A shimmering brew that grants a protective barrier.' },
            { name: 'Mana Elixir', description: 'A glowing blue elixir that restores magical energy.' },
            ...(level >= 3 ? [{ name: 'Rage Elixir', description: 'A fiery red brew that temporarily boosts damage.' }] : []),
            ...(level >= 2 ? [{ name: 'Antidote', description: 'A herbal remedy that purges toxins and curses.' }] : []),
          ]
          const pick = potionTypes[Math.floor(Math.random() * potionTypes.length)]
          return { id: `loot-potion-${suffix}`, name: pick.name, description: pick.description, quantity: 1 }
        })()),
        ...(level >= 2 ? [inferItemTypeAndEffects({
          id: `loot-equipment-${suffix}`,
          name: level <= 3 ? 'Rusty Dagger' : level <= 5 ? 'Iron Sword' : 'Steel Blade',
          description: level <= 3 ? 'A worn but still sharp dagger.' : level <= 5 ? 'A reliable iron sword.' : 'A finely crafted steel blade.',
          quantity: 1,
        })] : []),
      ],
      specialAbility: template.special && level >= 3
        ? {
            name: template.special.name,
            description: template.special.desc,
            damage: Math.round((5 + level * 2) * template.special.dmgMult),
            cooldown: template.special.cd,
          }
        : level >= 3
          ? {
              name: level <= 5 ? 'Savage Bite' : 'Shadow Strike',
              description: level <= 5 ? 'A vicious lunging bite.' : 'A devastating blow from the shadows.',
              damage: 5 + level * 2,
              cooldown: 3,
            }
          : undefined,
      statusAbility: template.status
        ? { type: template.status.type, value: template.status.value, duration: template.status.dur, chance: template.status.chance }
        : level >= 3
          ? level <= 5
            ? { type: 'poison' as const, value: 3 + level, duration: 3, chance: 0.4 }
            : { type: 'curse' as const, value: 0, duration: 3, chance: 0.3 }
          : undefined,
      element: template.element,
    },
  }
}
