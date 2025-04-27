import { GameState, Item } from '../models/types';

export function addItem(state: GameState, item: Item): GameState {
  if (!item || typeof item.id !== 'string' || typeof item.quantity !== 'number') {
    throw new Error('Invalid item');
  }
  const existing = state.inventory.find((i: Item) => i.id === item.id);
  let newInventory: Item[];
  if (existing) {
    newInventory = state.inventory.map((i: Item) =>
      i.id === item.id ? { ...i, quantity: i.quantity + item.quantity } : i
    );
  } else {
    newInventory = [...state.inventory, item];
  }
  return { ...state, inventory: newInventory };
}

export function removeItem(state: GameState, itemId: string): GameState {
  if (typeof itemId !== 'string') throw new Error('Invalid itemId');
  const newInventory = state.inventory.filter((i: Item) => i.id !== itemId);
  return { ...state, inventory: newInventory };
}

export function updateQuantity(state: GameState, itemId: string, quantity: number): GameState {
  if (typeof itemId !== 'string') throw new Error('Invalid itemId');
  let newInventory: Item[];
  if (quantity <= 0) {
    // Remove item if quantity is zero or negative
    newInventory = state.inventory.filter((i: Item) => i.id !== itemId);
  } else {
    newInventory = state.inventory.map((i: Item) =>
      i.id === itemId ? { ...i, quantity } : i
    );
  }
  return { ...state, inventory: newInventory };
}
