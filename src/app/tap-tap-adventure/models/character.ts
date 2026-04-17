import { z } from 'zod'

import { ClassSkillTreeSchema } from './classSkillTree'
import { CampStateSchema } from './camp'
import { GeneratedClassSchema } from './generatedClass'
import { ItemSchema } from './item'
import { MountSchema } from './mount'
import { MercenarySchema } from './mercenary'
import { MainQuestSchema } from './quest'
import { SpellSchema } from './spell'

/** All schemas in this file are the single source of truth for both runtime validation and static typing. */

export const FantasyAbilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  power: z.number(),
  cooldown: z.number(),
})
export type FantasyAbility = z.infer<typeof FantasyAbilitySchema>

export const FantasyCharacterSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  name: z.string(),
  race: z.string(),
  class: z.string(),
  level: z.number(),
  abilities: z.array(FantasyAbilitySchema),
  locationId: z.string(),
  gold: z.number(),
  reputation: z.number(),
  distance: z.number(),
  status: z.enum(['active', 'retired', 'dead']),
  strength: z.number(),
  intelligence: z.number(),
  luck: z.number(),
  hp: z.number().optional(),
  maxHp: z.number().optional(),
  inventory: z.array(ItemSchema),
  equipment: z.object({
    weapon: ItemSchema.nullable(),
    armor: ItemSchema.nullable(),
    accessory: ItemSchema.nullable(),
  }).optional(),
  deathCount: z.number().default(0),
  pendingStatPoints: z.number().default(0),
  mana: z.number().optional(),
  maxMana: z.number().optional(),
  spellbook: z.array(SpellSchema).optional(),
  classData: GeneratedClassSchema.optional(),
  activeMount: MountSchema.nullable().optional(),
  activeMercenary: MercenarySchema.nullable().optional(),
  mercenaryRoster: z.array(MercenarySchema).optional(),
  unlockedSkills: z.array(z.string()).optional(),
  classSkillTree: ClassSkillTreeSchema.optional(),
  unlockedTreeSkillIds: z.array(z.string()).optional(),
  difficultyMode: z.string().optional().default('normal'),
  currentRegion: z.string().optional().default('green_meadows'),
  visitedRegions: z.array(z.string()).optional(),
  mainQuest: MainQuestSchema.optional(),
  campState: CampStateSchema.optional(),
})
export type FantasyCharacter = z.infer<typeof FantasyCharacterSchema>

export const FantasyNPCSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  description: z.string(),
  locationId: z.string(),
  disposition: z.number(), // -100 (hostile) to 100 (friendly)
})
export type FantasyNPC = z.infer<typeof FantasyNPCSchema>
