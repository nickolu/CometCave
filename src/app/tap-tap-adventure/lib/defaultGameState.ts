'use client'
import { DEFAULT_PLAYER_ID } from '@/app/tap-tap-adventure/config/gameDefaults'
import { GameState } from '@/app/tap-tap-adventure/models/types'

export const defaultGameState: GameState = {
  player: {
    id: DEFAULT_PLAYER_ID,
    settings: {},
  },
  selectedCharacterId: null,
  characters: [],
  locations: [],
  storyEvents: [],
  decisionPoint: null,
  combatState: null,
  shopState: null,
  activeQuest: null,
  genericMessage: null,
  achievements: [],
  legacyHeirlooms: [],
  dailyReward: null,
  metaProgression: null,
}
