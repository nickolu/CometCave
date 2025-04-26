import { FantasyCharacter } from '../models/character';
import { FantasyLocation } from '../models/location';
import { FantasyStoryEvent } from '../models/story';

export interface GameState {
  character: FantasyCharacter;
  locations: FantasyLocation[];
  storyEvents: FantasyStoryEvent[];
}

const STORAGE_KEY = 'fantasy-tycoon-save';

export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}
