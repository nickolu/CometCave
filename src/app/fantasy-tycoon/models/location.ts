export interface FantasyLocation {
  id: string;
  name: string;
  description: string;
  region: string;
  dangerLevel: number; // 0-10
  connectedLocationIds: string[];
  npcs: string[]; // FantasyNPC ids
}

export interface FantasyLocationChoice {
  locationId: string;
  label: string;
  description?: string;
  requirements?: string[];
}
