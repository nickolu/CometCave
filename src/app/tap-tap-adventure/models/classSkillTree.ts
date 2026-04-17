import { z } from 'zod'

export const SkillEffectSchema = z.object({
  type: z.enum(['stat_bonus', 'percentage_bonus', 'flat_bonus', 'special']),
  target: z.string(),
  value: z.number(),
})
export type SkillEffect = z.infer<typeof SkillEffectSchema>

export const SkillTreeNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  tier: z.number().min(1).max(4),
  prerequisiteIds: z.array(z.string()),
  effect: SkillEffectSchema,
  requiredLevel: z.number(),
})
export type SkillTreeNode = z.infer<typeof SkillTreeNodeSchema>

export const ClassSkillTreeSchema = z.object({
  classId: z.string(),
  className: z.string(),
  nodes: z.array(SkillTreeNodeSchema),
})
export type ClassSkillTree = z.infer<typeof ClassSkillTreeSchema>
