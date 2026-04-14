// Central re-export for all Tap Tap Adventure models and schemas (Zod-first, single source of truth)

import { PlayerAchievement } from './achievement'
import { FantasyCharacter } from './character'
import { CombatState } from './combat'
import { Item } from './item'
import { FantasyLocation } from './location'
import { MetaProgressionState } from './metaProgression'
import { Mount } from './mount'
import { TimedQuest } from './quest'
import { FantasyDecisionPoint, FantasyStoryEvent } from './story'

export type ShopMountData = {
  mount: Mount
  price: number
}

export type ShopState = {
  items: Item[]
  isOpen: boolean
  shopMount?: ShopMountData | null
}

export type {
  FantasyAbility,
  FantasyAbilitySchema,
  FantasyCharacter,
  FantasyCharacterSchema,
  FantasyNPC,
  FantasyNPCSchema,
} from './character'
export type {
  FantasyLocation,
  FantasyLocationSchema,
  FantasyLocationChoice,
  FantasyLocationChoiceSchema,
} from './location'
export type { FantasyPlayer, FantasyPlayerSchema } from './player'
export type {
  FantasyStoryEvent,
  FantasyStoryEventSchema,
  FantasyDecisionOption,
  FantasyDecisionOptionSchema,
  FantasyDecisionPoint,
  FantasyDecisionPointSchema,
} from './story'
export type { Item, ItemSchema, ItemEffects, ItemEffectsSchema } from './item'
export type {
  Spell,
  SpellSchema,
  SpellEffect,
  SpellEffectSchema,
  SpellElement,
  SpellElementSchema,
  SpellSchool,
  SpellSchoolSchema,
  SpellEffectType,
  SpellEffectTypeSchema,
  SpellCondition,
  SpellConditionSchema,
} from './spell'
export type { Mount, MountSchema, MountBonuses, MountBonusesSchema, MountRarity, MountRaritySchema } from './mount'
export type { TimedQuest, TimedQuestSchema } from './quest'
export type {
  CombatState,
  CombatEnemy,
  CombatPlayerState,
  CombatAction,
  CombatActionRequest,
  CombatLogEntry,
  CombatBuff,
  CombatStatus,
  ActiveSpellEffect,
  CombatStateSchema,
  CombatEnemySchema,
  CombatPlayerStateSchema,
  CombatActionSchema,
  CombatActionRequestSchema,
  CombatLogEntrySchema,
  CombatBuffSchema,
  CombatStatusSchema,
  ActiveSpellEffectSchema,
} from './combat'

type DailyRewardState = {
  lastClaimedDate: string | null // ISO date string (YYYY-MM-DD)
  streak: number // consecutive days claimed
  totalDaysClaimed: number
}

type RunSummaryData = {
  character: FantasyCharacter
  reason: 'death' | 'permadeath' | 'retirement'
  essenceEarned: number
  heirloom: Item | null
}

type GameState = {
  player: {
    id: string
    settings: Record<string, unknown>
  }
  selectedCharacterId: string | null
  characters: FantasyCharacter[]
  locations: FantasyLocation[]
  storyEvents: FantasyStoryEvent[]
  decisionPoint: FantasyDecisionPoint | null
  combatState: CombatState | null
  shopState: ShopState | null
  activeQuest: TimedQuest | null
  genericMessage: string | null
  achievements: PlayerAchievement[]
  legacyHeirlooms: Item[]
  dailyReward: DailyRewardState | null
  metaProgression: MetaProgressionState | null
  runSummary: RunSummaryData | null
}
export type { GameState, DailyRewardState, RunSummaryData }
export type { PlayerAchievement, Achievement, AchievementCategory } from './achievement'
export type {
  EternalUpgrade,
  EternalUpgradeSchema,
  EternalUpgradeEffects,
  EternalUpgradeEffectsSchema,
  MetaProgressionState,
  MetaProgressionStateSchema,
} from './metaProgression'
