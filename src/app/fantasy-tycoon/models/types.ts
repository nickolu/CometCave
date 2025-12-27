// Central re-export for all Fantasy Tycoon models and schemas (Zod-first, single source of truth)

import { FantasyCharacter } from './character'
import { FantasyLocation } from './location'
import { FantasyDecisionPoint, FantasyStoryEvent } from './story'

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
export type { Item, ItemSchema } from './item'

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
  genericMessage: string | null
}
export type { GameState }
