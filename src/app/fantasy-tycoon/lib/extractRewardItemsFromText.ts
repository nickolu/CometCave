// Utility to extract reward items from a text string using an LLM (now using gpt-4o with strict JSON response)
// Updated to use OpenAI's gpt-4o model and enforce JSON structure for reliability

export interface RewardItem {
  id: string;
  qty: number;
}

/**
 * Extracts reward items from a text string. In production, this should call an LLM API.
 * For now, uses a simple regex mock for demo purposes.
 * @param text The text to parse for item rewards
 * @returns Array of RewardItem
 */
/**
 * Extracts reward items from a text string using OpenAI API if available, otherwise falls back to regex mock.
 * Requires process.env.OPENAI_API_KEY to be set for LLM extraction.
 */
export default async function extractRewardItemsFromText(text: string): Promise<RewardItem[]> {
  console.log('[extractRewardItemsFromText] called with text:', text);
  // Debug: log input
  if (process.env.NODE_ENV !== 'production') {
    console.log('[extractRewardItemsFromText] input:', text);
  }
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Fallback to regex mock if no API key
    const regex = /(?:receive|received|obtain|obtained|gain|gained|find|found|grant|granted|grants?)\s+(\d+)\s+([a-zA-Z][a-zA-Z0-9 _-]*)/gi;
    const items: RewardItem[] = [];
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      const qty = parseInt(match[1], 10);
      const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
      if (!isNaN(qty) && id) {
        items.push({ id, qty });
      }
    }
    if (process.env.NODE_ENV !== 'production') {
      console.log('[extractRewardItemsFromText] fallback regex items:', items);
    }
    return items;
  }

  const prompt = `Extract any items the player receives from the following text. Respond ONLY with a JSON object of the form { "items": [{ "id": string, "qty": number }] }. If there are no items, respond with { "items": [] } and nothing else.\n\nText: """${text}"""`;

  if (process.env.NODE_ENV !== 'production') {
    console.log('[extractRewardItemsFromText] prompt:', prompt);
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
    console.log('[extractRewardItemsFromText] response:', content);
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
    // Fallback to regex mock on error
    const regex = /(?:receive|received) (\d+) ([a-zA-Z ]+)/gi;
    const items: RewardItem[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      const qty = parseInt(match[1], 10);
      const id = match[2].trim().replace(/\s+/g, '_').toLowerCase();
      if (!isNaN(qty) && id) {
        items.push({ id, qty });
      }
    }
    return items;
  }
}
