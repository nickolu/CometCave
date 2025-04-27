// Regex/text utilities for reward extraction

import { Item } from "../../models/item";

export function extractRewardItemsWithRegex(text: string): Item[] {
  console.log('[extractRewardItemsWithRegex] input:', text);
  const regex = /(?:receive|received|obtain|obtained|gain|gained|find|found|grant|granted|grants?)\s+(\d+)\s+([a-zA-Z][a-zA-Z0-9 _-]*)/gi;
  const items: Item[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
    if (!isNaN(qty) && id) {
      items.push({ id, name: id, description: id, quantity: qty });
    }
  }
  return items;
}

export function fallbackExtractSimple(text: string): Item[] {
  console.log('[fallbackExtractSimple] input:', text);
  const regex = /(?:receive|received) (\d+) ([a-zA-Z ]+)/gi;
  const items: Item[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
    if (!isNaN(qty) && id) {
      items.push({ id, name: id, description: id, quantity: qty });
    }
  }
  return items;
}
