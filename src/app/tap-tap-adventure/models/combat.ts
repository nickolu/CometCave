import { z } from 'zod'

import { ItemSchema } from './item'

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
})
export type CombatEnemy = z.infer<typeof CombatEnemySchema>

export const CombatBuffSchema = z.object({
  stat: z.string(),
  value: z.number(),
  turnsRemaining: z.number(),
})
export type CombatBuff = z.infer<typeof CombatBuffSchema>

export const CombatPlayerStateSchema = z.object({
  hp: z.number(),
  maxHp: z.number(),
  attack: z.number(),
  defense: z.number(),
  isDefending: z.boolean(),
  activeBuffs: z.array(CombatBuffSchema).optional(),
})
export type CombatPlayerState = z.infer<typeof CombatPlayerStateSchema>

export const CombatActionSchema = z.enum(['attack', 'defend', 'use_item', 'flee'])
export type CombatAction = z.infer<typeof CombatActionSchema>

export const CombatActionRequestSchema = z.object({
  action: CombatActionSchema,
  itemId: z.string().optional(),
})
export type CombatActionRequest = z.infer<typeof CombatActionRequestSchema>

export const CombatLogEntrySchema = z.object({
  turn: z.number(),
  actor: z.enum(['player', 'enemy']),
  action: z.string(),
  damage: z.number().optional(),
  description: z.string(),
})
export type CombatLogEntry = z.infer<typeof CombatLogEntrySchema>

export const CombatStatusSchema = z.enum(['active', 'victory', 'defeat', 'fled'])
export type CombatStatus = z.infer<typeof CombatStatusSchema>

export const CombatStateSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  enemy: CombatEnemySchema,
  playerState: CombatPlayerStateSchema,
  turnNumber: z.number(),
  combatLog: z.array(CombatLogEntrySchema),
  status: CombatStatusSchema,
  scenario: z.string(),
})
export type CombatState = z.infer<typeof CombatStateSchema>
