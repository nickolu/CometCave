// Shared types for Fantasy Tycoon
// All interfaces used by both client and server should be defined here

export type { Item } from '../models/item';
export interface GameState {
  player: {
    id: string;
    settings: Record<string, unknown>;
  };
  character: FantasyCharacter | null;
  locations: FantasyLocation[];
  storyEvents: FantasyStoryEvent[];
  decisionPoint: FantasyDecisionPoint | null;
  genericMessage: string | null;
  inventory: import('../models/item').Item[];
}

// Forward declarations for types imported from other files
export type FantasyCharacter = import('../models/character').FantasyCharacter;
export type FantasyLocation = import('../models/location').FantasyLocation;
export type FantasyStoryEvent = import('../models/story').FantasyStoryEvent;
export type FantasyDecisionPoint = import('../models/story').FantasyDecisionPoint;
