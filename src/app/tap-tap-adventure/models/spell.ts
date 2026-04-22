import { z } from 'zod'

export const SpellEffectTypeSchema = z.enum([
  'damage',
  'damage_over_time',
  'true_damage',
  'lifesteal',
  'heal',
  'heal_over_time',
  'shield',
  'damage_reduction',
  'buff',
  'debuff',
  'stun',
  'bleed',
  'cleanse',
  'mana_restore',
  'combo_boost',
  'apply_poison',
  'apply_burn',
  'apply_slow',
  'apply_thorns',
  'apply_berserk',
])
export type SpellEffectType = z.infer<typeof SpellEffectTypeSchema>

export const SpellElementSchema = z.enum([
  'fire',
  'ice',
  'lightning',
  'shadow',
  'nature',
  'arcane',
  'none',
])
export type SpellElement = z.infer<typeof SpellElementSchema>

export const SpellSchoolSchema = z.enum(['arcane', 'nature', 'shadow', 'war'])
export type SpellSchool = z.infer<typeof SpellSchoolSchema>

export const SpellEffectSchema = z.object({
  type: SpellEffectTypeSchema,
  value: z.number(),
  element: SpellElementSchema.optional(),
  stat: z.string().optional(),
  duration: z.number().optional(),
  percentage: z.number().optional(),
})
export type SpellEffect = z.infer<typeof SpellEffectSchema>

export const SpellConditionWhenSchema = z.enum([
  'target_hp_below_50',
  'caster_hp_below_30',
  'caster_combo_3_plus',
  'caster_defending',
  'target_debuffed',
  'after_class_ability',
])
export type SpellConditionWhen = z.infer<typeof SpellConditionWhenSchema>

export const SpellConditionBonusSchema = z.enum([
  'double_damage',
  'free_cast',
  'double_heal',
  'true_damage',
  'extend_duration',
])
export type SpellConditionBonus = z.infer<typeof SpellConditionBonusSchema>

export const SpellConditionSchema = z.object({
  when: SpellConditionWhenSchema,
  bonus: SpellConditionBonusSchema,
})
export type SpellCondition = z.infer<typeof SpellConditionSchema>

export const ExplorationEffectTypeSchema = z.enum([
  'heal',
  'mana_restore',
  'speed_boost',
])
export type ExplorationEffectType = z.infer<typeof ExplorationEffectTypeSchema>

export const ExplorationEffectSchema = z.object({
  type: ExplorationEffectTypeSchema,
  value: z.number(),
  description: z.string(),
})
export type ExplorationEffect = z.infer<typeof ExplorationEffectSchema>

export const SpellSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  school: SpellSchoolSchema,
  manaCost: z.number(),
  cooldown: z.number(),
  target: z.enum(['enemy', 'self']),
  effects: z.array(SpellEffectSchema),
  conditions: z.array(SpellConditionSchema).optional(),
  tags: z.array(z.string()),
  explorationEffect: ExplorationEffectSchema.optional(),
  explorationManaCost: z.number().optional(),
})
export type Spell = z.infer<typeof SpellSchema>
