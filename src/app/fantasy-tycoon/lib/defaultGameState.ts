'use client'
import { DEFAULT_PLAYER_ID } from '../config/gameDefaults'
import { GameState } from '../models/types'


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
  genericMessage: null,
}
