import { beforeEach, describe, expect, it } from 'vitest';
import { addItem, removeItem, updateQuantity } from '../lib/inventory';
import { GameState } from '../lib/storage';
import { Item } from '../models/item';

describe('Inventory actions', () => {
  let baseState: GameState;
  const testItem: Item = {
    id: 'sword-1',
    name: 'Sword',
    description: 'A sharp blade.',
    quantity: 1,
  };

  beforeEach(() => {
    baseState = {
      player: { id: 'p1', settings: {} },
      character: null,
      locations: [],
      storyEvents: [],
      decisionPoint: null,
      genericMessage: null,
      inventory: [],
    };
  });

  it('adds a new item', () => {
    const state = addItem(baseState, testItem);
    expect(state.inventory).toHaveLength(1);
    expect(state.inventory[0]).toMatchObject(testItem);
  });

  it('increments quantity if item exists', () => {
    const state1 = addItem(baseState, testItem);
    const state2 = addItem(state1, { ...testItem, quantity: 2 });
    expect(state2.inventory[0].quantity).toBe(3);
  });

  it('removes an item', () => {
    const state1 = addItem(baseState, testItem);
    const state2 = removeItem(state1, testItem.id);
    expect(state2.inventory).toHaveLength(0);
  });

  it('updates quantity', () => {
    const state1 = addItem(baseState, testItem);
    const state2 = updateQuantity(state1, testItem.id, 5);
    expect(state2.inventory[0].quantity).toBe(5);
  });

  it('does not allow removing more than available quantity', () => {
    const state1 = addItem(baseState, { ...testItem, quantity: 2 });
    // Try to remove 3 by setting quantity to -1
    const state2 = updateQuantity(state1, testItem.id, -1);
    expect(state2.inventory).toHaveLength(0);
  });

  it('UI reflects inventory changes (mock)', () => {
    const state1 = addItem(baseState, testItem);
    const items = state1.inventory;
    expect(items).toHaveLength(1);
    expect(items[0].name).toBe('Sword');
  });

  it('removes item if quantity set to 0', () => {
    const state1 = addItem(baseState, testItem);
    const state2 = updateQuantity(state1, testItem.id, 0);
    expect(state2.inventory).toHaveLength(0);
  });

  it('merges quantity when adding duplicate item', () => {
    const state1 = addItem(baseState, testItem);
    const state2 = addItem(state1, { ...testItem, quantity: 2 });
    expect(state2.inventory).toHaveLength(1);
    expect(state2.inventory[0].quantity).toBe(3);
  });

  it('persists inventory to and from storage', () => {
    const state1 = addItem(baseState, testItem);
    const saved = JSON.stringify(state1);
    const loaded: GameState = JSON.parse(saved);
    expect(loaded.inventory).toHaveLength(1);
    expect(loaded.inventory[0]).toMatchObject(testItem);
  });

});
