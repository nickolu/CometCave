// Utility to extract reward items from a text string using an LLM (now using gpt-4o with strict JSON response)
// Updated to use OpenAI's gpt-4o model and enforce JSON structure for reliability

export { default } from './parsers/rewardExtractor';
export type { RewardItem } from './parsers/rewardExtractor';

