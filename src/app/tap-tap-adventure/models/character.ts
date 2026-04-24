import { z } from 'zod'

import { ClassSkillTreeSchema } from './classSkillTree'
import { CampStateSchema } from './camp'
import { GeneratedClassSchema } from './generatedClass'
import { ItemSchema } from './item'
import { MountSchema } from './mount'
import { MercenarySchema } from './mercenary'
import { PartyMemberSchema } from './partyMember'
import { MainQuestSchema } from './quest'
import { SpellSchema, ActiveExplorationSpellSchema } from './spell'
import { BestiaryEntrySchema } from './bestiary'

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
  gold: z.number().min(0),
  reputation: z.number(),
  bounty: z.number().min(0).optional().default(0),
  distance: z.number(),
  status: z.enum(['active', 'retired', 'dead']),
  strength: z.number(),
  intelligence: z.number(),
  luck: z.number(),
  charisma: z.number(),
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
  explorationShield: z.number().optional(),
  spellbook: z.array(SpellSchema).optional(),
  activeExplorationSpells: z.array(ActiveExplorationSpellSchema).optional(),
  classData: GeneratedClassSchema.optional(),
  activeMount: MountSchema.nullable().optional(),
  activeMercenary: MercenarySchema.nullable().optional(),
  mercenaryRoster: z.array(MercenarySchema).optional(),
  party: z.array(PartyMemberSchema).default([]),
  unlockedSkills: z.array(z.string()).optional(),
  classSkillTree: ClassSkillTreeSchema.optional(),
  unlockedTreeSkillIds: z.array(z.string()).optional(),
  difficultyMode: z.string().optional().default('normal'),
  currentRegion: z.string().optional().default('green_meadows'),
  currentWeather: z.string().optional().default('clear'),
  visitedRegions: z.array(z.string()).optional(),
  mainQuest: MainQuestSchema.optional(),
  campState: CampStateSchema.optional(),
  factionReputations: z.record(z.string(), z.number()).optional().default({}),
  bestiary: z.array(BestiaryEntrySchema).optional(),
  discoveredCombos: z.array(z.string()).optional(),
  npcEncounters: z.record(z.string(), z.object({ timesSpoken: z.number(), disposition: z.number(), lastTier: z.string().optional(), recruited: z.boolean().optional() })).optional(),
  landmarkState: z.object({
    regionId: z.string(),
    landmarks: z.array(z.object({
      templateId: z.string(),
      name: z.string(),
      type: z.string(),
      description: z.string(),
      icon: z.string(),
      hasShop: z.boolean(),
      encounterPrompt: z.string(),
      distanceFromEntry: z.number(),
      hidden: z.boolean().default(false),
      isSecret: z.boolean().optional(),
      explored: z.boolean().default(false),
      position: z.object({ x: z.number(), y: z.number() }).optional(),
    })),
    entryDistance: z.number(),
    nextLandmarkIndex: z.number(),
    exploring: z.boolean(),
    explorationDepth: z.number().default(0),
    exploringLandmarkName: z.string().optional(),
    positionInRegion: z.number().default(0),
    activeTargetIndex: z.number().default(0),
    regionLength: z.number().default(200),
    position: z.object({ x: z.number(), y: z.number() }).optional(),
    exitPosition: z.object({ x: z.number(), y: z.number() }).optional(),
    exitPositions: z.array(z.object({
      regionId: z.string(),
      name: z.string(),
      icon: z.string(),
      position: z.object({ x: z.number(), y: z.number() }),
    })).optional(),
    regionBounds: z.object({ width: z.number(), height: z.number() }).optional(),
  }).optional(),
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
