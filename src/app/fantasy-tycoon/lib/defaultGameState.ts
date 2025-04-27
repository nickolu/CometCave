"use client";
import { GameState } from '../lib/storage';

const DEFAULT_PLAYER_ID = 'player-1';

export const defaultGameState: GameState = {
  player: {
    id: DEFAULT_PLAYER_ID,
    settings: {},
  },
  character: null, // Character must be created by user
  locations: [],
  storyEvents: [],
};
