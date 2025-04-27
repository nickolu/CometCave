// Utility for item display data fallback
import { Item } from '../models/item';

// Add more items as needed
const ITEM_DB: Record<string, { name: string; description: string }> = {
  potion: {
    name: 'Potion',
    description: 'A mysterious healing potion.',
  },
  gold: {
    name: 'Gold Coin',
    description: 'Currency of the realm.',
  },
  // fallback/default
  default: {
    name: 'Unknown Item',
    description: 'An unrecognized item.',
  },
};

export function getItemDisplayData(id: string): Pick<Item, 'name' | 'description'> {
  return ITEM_DB[id] || ITEM_DB['default'];
}
