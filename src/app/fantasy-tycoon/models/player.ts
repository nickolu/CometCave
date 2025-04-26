export interface FantasyPlayer {
  id: string;
  username: string;
  createdAt: string;
  lastActive: string;
  characters: string[]; // FantasyCharacter ids
  gold: number;
  reputation: number;
  distance: number;
  currentCharacterId?: string;
}
