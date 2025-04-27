import { GameState } from '../lib/storage';
import { FantasyCharacter } from '../models/character';
import { FantasyLocation } from '../models/location';
import { FantasyStoryEvent } from '../models/story';

// Placeholder IDs for new game
const DEFAULT_PLAYER_ID = 'player-1';
const DEFAULT_CHARACTER_ID = 'char-1';
const DEFAULT_START_LOCATION_ID = 'village-1';

const defaultCharacter: FantasyCharacter = {
  id: DEFAULT_CHARACTER_ID,
  playerId: DEFAULT_PLAYER_ID,
  name: 'Unnamed Adventurer',
  race: 'Human',
  class: 'Commoner',
  level: 1,
  abilities: [],
  locationId: DEFAULT_START_LOCATION_ID,
  gold: 0,
  reputation: 0,
  distance: 0,
  status: 'active',
};

const defaultLocations: FantasyLocation[] = [];
const defaultStoryEvents: FantasyStoryEvent[] = [];

export const defaultGameState: GameState = {
  character: defaultCharacter,
  locations: defaultLocations,
  storyEvents: defaultStoryEvents,
};
