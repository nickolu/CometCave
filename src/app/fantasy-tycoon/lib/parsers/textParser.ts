// Regex/text utilities for reward extraction

export function extractRewardItemsWithRegex(text: string): { id: string; qty: number }[] {
  const regex = /(?:receive|received|obtain|obtained|gain|gained|find|found|grant|granted|grants?)\s+(\d+)\s+([a-zA-Z][a-zA-Z0-9 _-]*)/gi;
  const items: { id: string; qty: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
    if (!isNaN(qty) && id) {
      items.push({ id, qty });
    }
  }
  return items;
}

export function fallbackExtractSimple(text: string): { id: string; qty: number }[] {
  const regex = /(?:receive|received) (\d+) ([a-zA-Z ]+)/gi;
  const items: { id: string; qty: number }[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const qty = parseInt(match[1], 10);
    const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
    if (!isNaN(qty) && id) {
      items.push({ id, qty });
    }
  }
  return items;
}
