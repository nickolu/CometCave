"use client";
import { FantasyCharacter } from '../models/character';
import { FantasyLocation } from '../models/location';
import { FantasyStoryEvent } from '../models/story';

import { FantasyDecisionPoint } from '../models/story';

import { Item } from '../models/item';

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
  inventory: Item[];
}

const STORAGE_KEY = 'fantasy-tycoon-save';

export function saveGame(state: GameState): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch {}
}

export function loadGame(): GameState | null {
  try {
    if (typeof window === 'undefined') {
      return null;
    }
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as GameState;
  } catch {
    return null;
  }
}

export function clearGame(): void {
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {}
}
