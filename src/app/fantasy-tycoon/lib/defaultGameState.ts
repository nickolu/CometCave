"use client";
import { GameState } from '../models/types';

import { DEFAULT_PLAYER_ID } from '../config/gameDefaults';

export const defaultGameState: GameState = {
  player: {
    id: DEFAULT_PLAYER_ID,
    settings: {},
  },
  character: null, // Character must be created by user
  characters: [], // roster starts empty
  locations: [],
  storyEvents: [],
  decisionPoint: null,
  genericMessage: null,
  inventory: [],
};
