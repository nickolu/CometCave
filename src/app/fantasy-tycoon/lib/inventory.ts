import { GameState } from './storage';
import { Item } from '../models/item';

export function addItem(state: GameState, item: Item): GameState {
  const existing = state.inventory.find(i => i.id === item.id);
  let newInventory: Item[];
  if (existing) {
    newInventory = state.inventory.map(i =>
      i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
    );
  } else {
    newInventory = [...state.inventory, item];
  }
  return { ...state, inventory: newInventory };
}

export function removeItem(state: GameState, itemId: string): GameState {
  const newInventory = state.inventory.filter(i => i.id !== itemId);
  return { ...state, inventory: newInventory };
}

export function updateQuantity(state: GameState, itemId: string, quantity: number): GameState {
  let newInventory: Item[];
  if (quantity <= 0) {
    newInventory = state.inventory.filter(i => i.id !== itemId);
  } else {
    newInventory = state.inventory.map(i =>
      i.id === itemId ? { ...i, quantity } : i
    );
  }
  return { ...state, inventory: newInventory };
}
