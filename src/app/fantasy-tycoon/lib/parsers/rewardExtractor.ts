import { extractRewardItemsWithRegex, fallbackExtractSimple } from './textParser';

export interface RewardItem {
  id: string;
  qty: number;
}

/**
 * Extracts reward items from a text string using OpenAI API if available, otherwise falls back to regex mock.
 * Requires process.env.OPENAI_API_KEY to be set for LLM extraction.
 */
export default async function extractRewardItemsFromText(text: string): Promise<RewardItem[]> {
  if (process.env.NODE_ENV !== 'production') {
    console.log('[rewardExtractor] input:', text);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return extractRewardItemsWithRegex(text);
  }

  const prompt = `Extract any items the player receives from the following text. Respond ONLY with a JSON object of the form { "items": [{ "id": string, "qty": number }] }. If there are no items, respond with { "items": [] } and nothing else.\n\nText: """${text}"""`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[rewardExtractor] prompt:', prompt);
  }

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
      if (parsed && Array.isArray(parsed.items) && parsed.items.every((i: RewardItem) => typeof i.id === 'string' && typeof i.qty === 'number')) {
        return parsed.items;
      }
    } catch {
      // fallback: try to extract array if model hallucinated
      const match = content.match(/\[[\s\S]*\]/);
      if (match) {
        const items: RewardItem[] = JSON.parse(match[0]);
        if (Array.isArray(items) && items.every(i => typeof i.id === 'string' && typeof i.qty === 'number')) {
          return items;
        }
      }
    }
    return [];
  } catch {
    // Fallback to simpler regex on error
    return fallbackExtractSimple(text);
  }
}
