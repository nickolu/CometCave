import { Item } from '../../models/types';
import { extractRewardItemsWithRegex, fallbackExtractSimple } from './textParser';

/**
 * Extracts reward items from a text string using OpenAI API if available, otherwise falls back to regex mock.
 * Requires process.env.OPENAI_API_KEY to be set for LLM extraction.
 */
export default async function extractRewardItemsFromText(text: string): Promise<Item[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return extractRewardItemsWithRegex(text);
  }

  const prompt = `Extract any items the player receives from the following text. Respond ONLY with a JSON object of the form { "items": [{ "id": string, "qty": number, "name": string, "description": string }] }. Each item must have a unique id (snake_case), a quantity, a fantasy-appropriate name, and a vivid description. If there are no items, respond with { "items": [] } and nothing else.\n\nText: """${text}"""`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100,
        temperature: 0,
        response_format: { type: 'json_object' },
      }),
    });
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return [];
    try {
      const parsed = JSON.parse(content);
      if (parsed && Array.isArray(parsed.items)) {
        parsed.items.forEach((item: Item) => {
          if (!item.name || !item.description) {
            console.warn('[rewardExtractor] Missing name/description for item:', item);
          }
        });
        return parsed.items;
      }
    } catch {
      // fallback: try to extract array if model hallucinated
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const items: Item[] = JSON.parse(match[0]);
        if (Array.isArray(items)) {
          items.forEach((item: Item) => {
            if (!item.name || !item.description) {
              console.warn('[rewardExtractor] Missing name/description for item:', item);
            }
          });
          return items;
        }
      }
    }
    return [];
  } catch {
    // Fallback to simpler regex on error
    // fallback: just return what we get, with logging
    const items = fallbackExtractSimple(text);
    items.forEach((item) => {
      console.warn('[rewardExtractor] Missing name/description for item (regex fallback):', item);
    });
    return items;

  }
}
