export const DEFAULT_PLAYER_ID = 'player-1';
export const DEFAULT_CHARACTER_NAME = 'Adventurer';
export const DEFAULT_CHARACTER_RACE = 'Human';
export const DEFAULT_CHARACTER_CLASS = 'Warrior';
export const DEFAULT_CHARACTER_LEVEL = 1;
export const DEFAULT_CHARACTER_LOCATION_ID = 'starting-village';
export const DEFAULT_CHARACTER_GOLD = 10;
export const DEFAULT_CHARACTER_REPUTATION = 0;
export const DEFAULT_CHARACTER_DISTANCE = 0;
export const DEFAULT_CHARACTER_STATUS = 'active';
export const DEFAULT_ABILITY_NAME = 'Basic Attack';
export const DEFAULT_ABILITY_DESCRIPTION = 'A simple attack with your weapon';
export const DEFAULT_ABILITY_POWER = 1;
export const DEFAULT_ABILITY_COOLDOWN = 0;
export const DEFAULT_STAT_MIN = 5;
export const DEFAULT_STAT_MAX = 10;
export const DEFAULT_ABILITY = {
  id: DEFAULT_PLAYER_ID,
  name: DEFAULT_ABILITY_NAME,
  description: DEFAULT_ABILITY_DESCRIPTION,
  power: DEFAULT_ABILITY_POWER,
  cooldown: DEFAULT_ABILITY_COOLDOWN
};

export const DEFAULT_CHARACTER = {
  id: DEFAULT_PLAYER_ID,
  name: DEFAULT_CHARACTER_NAME,
  race: DEFAULT_CHARACTER_RACE,
  class: DEFAULT_CHARACTER_CLASS,
  level: DEFAULT_CHARACTER_LEVEL,
  abilities: [DEFAULT_ABILITY],
  locationId: DEFAULT_CHARACTER_LOCATION_ID,
  gold: DEFAULT_CHARACTER_GOLD,
  reputation: DEFAULT_CHARACTER_REPUTATION,
  distance: DEFAULT_CHARACTER_DISTANCE,
  status: DEFAULT_CHARACTER_STATUS,
  strength: DEFAULT_STAT_MIN,
  intelligence: DEFAULT_STAT_MIN,
  luck: DEFAULT_STAT_MIN
};
  