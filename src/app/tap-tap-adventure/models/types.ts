// Central re-export for all Tap Tap Adventure models and schemas (Zod-first, single source of truth)

import { FantasyCharacter } from './character'
import { CombatState } from './combat'
import { Item } from './item'
import { FantasyLocation } from './location'
import { FantasyDecisionPoint, FantasyStoryEvent } from './story'

export type ShopState = {
  items: Item[]
  isOpen: boolean
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
export type { FantasyQuest, FantasyQuestSchema } from './quest'
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
  CombatState,
  CombatEnemy,
  CombatPlayerState,
  CombatAction,
  CombatActionRequest,
  CombatLogEntry,
  CombatBuff,
  CombatStatus,
  CombatStateSchema,
  CombatEnemySchema,
  CombatPlayerStateSchema,
  CombatActionSchema,
  CombatActionRequestSchema,
  CombatLogEntrySchema,
  CombatBuffSchema,
  CombatStatusSchema,
} from './combat'

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
  genericMessage: string | null
}
export type { GameState }
