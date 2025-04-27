export interface FantasyAbility {
  id: string;
  name: string;
  description: string;
  power: number;
  cooldown: number;
}

export interface FantasyCharacter {
  id: string;
  playerId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  abilities: FantasyAbility[];
  locationId: string;
  gold: number;
  reputation: number;
  distance: number;
  status: 'active' | 'retired' | 'dead';
  strength: number;
  intelligence: number;
  luck: number;
}

export interface FantasyNPC {
  id: string;
  name: string;
  role: string;
  description: string;
  locationId: string;
  disposition: number; // -100 (hostile) to 100 (friendly)
}
