import { z } from 'zod'

import { ItemSchema } from './item'
import { SpellElementSchema } from './spell'

export const StatusEffectTypeSchema = z.enum([
  'poison',
  'burn',
  'slow',
  'curse',
  'thorns',
  'berserk',
  'fear',
  'reflect',
])
export type StatusEffectType = z.infer<typeof StatusEffectTypeSchema>

export const StatusEffectSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: StatusEffectTypeSchema,
  value: z.number(),
  turnsRemaining: z.number(),
  source: z.enum(['player', 'enemy']),
})
export type StatusEffect = z.infer<typeof StatusEffectSchema>

export const StatusAbilitySchema = z.object({
  type: StatusEffectTypeSchema,
  value: z.number(),
  duration: z.number(),
  chance: z.number(),
})
export type StatusAbility = z.infer<typeof StatusAbilitySchema>

export const CombatEnemySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  hp: z.number(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  level: z.number(),
  goldReward: z.number(),
  lootTable: z.array(ItemSchema).optional(),
  specialAbility: z
    .object({
      name: z.string(),
      description: z.string(),
      damage: z.number(),
      cooldown: z.number(),
    })
    .optional(),
  statusEffects: z.array(StatusEffectSchema).optional(),
  statusAbility: StatusAbilitySchema.optional(),
  element: SpellElementSchema.optional(),
  range: z.enum(['melee', 'ranged']).optional(),
})
export type CombatEnemy = z.infer<typeof CombatEnemySchema>

export const CombatBuffSchema = z.object({
  stat: z.string(),
  value: z.number(),
  turnsRemaining: z.number(),
})
export type CombatBuff = z.infer<typeof CombatBuffSchema>

export const ActiveSpellEffectSchema = z.object({
  spellId: z.string(),
  effectType: z.string(),
  value: z.number(),
  turnsRemaining: z.number(),
  percentage: z.number().optional(),
})
export type ActiveSpellEffect = z.infer<typeof ActiveSpellEffectSchema>

export const CombatPlayerStateSchema = z.object({
  hp: z.number(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  isDefending: z.boolean(),
  activeBuffs: z.array(CombatBuffSchema).optional(),
  comboCount: z.number().default(0),
  abilityCooldown: z.number().default(0),
  enemyStunned: z.boolean().default(false),
  mana: z.number().default(0),
  maxMana: z.number().default(0),
  spellCooldowns: z.record(z.string(), z.number()).optional(),
  activeSpellEffects: z.array(ActiveSpellEffectSchema).optional(),
  spellTagsUsed: z.array(z.string()).optional(),
  shield: z.number().default(0),
  statusEffects: z.array(StatusEffectSchema).optional(),
  ap: z.number().default(3),
  maxAp: z.number().default(3),
  turnActions: z.array(z.string()).optional(),
  luck: z.number().default(0),
  mountMovesRemaining: z.number().optional(),
  mountHp: z.number().optional(),
  mountMaxHp: z.number().optional(),
})
export type CombatPlayerState = z.infer<typeof CombatPlayerStateSchema>

export const CombatActionSchema = z.enum(['attack', 'defend', 'heavy_attack', 'use_item', 'flee', 'class_ability', 'cast_spell', 'end_turn', 'move_closer', 'move_away'])
export type CombatAction = z.infer<typeof CombatActionSchema>

export const CombatActionRequestSchema = z.object({
  action: CombatActionSchema,
  itemId: z.string().optional(),
  spellId: z.string().optional(),
})
export type CombatActionRequest = z.infer<typeof CombatActionRequestSchema>

export const CombatLogEntrySchema = z.object({
  turn: z.number(),
  actor: z.enum(['player', 'enemy']),
  action: z.string(),
  damage: z.number().optional(),
  description: z.string(),
  isCritical: z.boolean().optional(),
})
export type CombatLogEntry = z.infer<typeof CombatLogEntrySchema>

export const CombatStatusSchema = z.enum(['active', 'victory', 'defeat', 'fled'])
export type CombatStatus = z.infer<typeof CombatStatusSchema>

export const EnemyTelegraphSchema = z.object({
  action: z.enum(['heavy_attack', 'special', 'defend', 'normal_attack']),
  description: z.string(),
})
export type EnemyTelegraph = z.infer<typeof EnemyTelegraphSchema>

export const TurnPhaseSchema = z.enum(['player', 'enemy_done']).default('player')
export type TurnPhase = z.infer<typeof TurnPhaseSchema>

export const CombatDistanceSchema = z.enum(['close', 'mid', 'far']).default('mid')
export type CombatDistance = z.infer<typeof CombatDistanceSchema>

export const CombatStateSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  enemy: CombatEnemySchema,
  playerState: CombatPlayerStateSchema,
  turnNumber: z.number(),
  combatLog: z.array(CombatLogEntrySchema),
  status: CombatStatusSchema,
  scenario: z.string(),
  enemyTelegraph: EnemyTelegraphSchema.optional().nullable(),
  isBoss: z.boolean().optional(),
  isMiniBoss: z.boolean().optional(),
  combatDistance: CombatDistanceSchema.optional(),
  turnPhase: TurnPhaseSchema.optional(),
  pendingRegionId: z.string().optional(),
})
export type CombatState = z.infer<typeof CombatStateSchema>
