import { z } from 'zod';

export const CharacterDetailsSchema = z.object({
  description: z.string().describe('The description of the character'),
  backstory: z.string().describe('The backstory of the character'),
  powers: z.array(z.string()).describe('The powers of the character'),
  elements: z.array(z.string()).describe('The elements of the character'),
  durability: z.number().describe('The durability of the character'),
  speed: z.number().describe('The speed of the character'),
  weaponsAndEquipment: z.array(z.string()).describe('The weapons and equipment of the character'),
});

export const CharacterPowersSchema = z.object({
  powers: z.array(z.string()).describe("List of the character's powers and abilities"),
});

export const CharacterStatsSchema = z.object({
  strength: z.number().min(1).max(10).describe('Physical strength (1-10 scale)'),
  speed: z.number().min(1).max(10).describe('Speed and agility (1-10 scale)'),
  durability: z.number().min(1).max(10).describe('Durability and toughness (1-10 scale)'),
  intelligence: z.number().min(1).max(10).describe('Intelligence and strategy (1-10 scale)'),
  energy: z.number().min(1).max(10).describe('Energy projection and magical power (1-10 scale)'),
  fighting: z
    .number()
    .min(1)
    .max(10)
    .describe('Fighting skills and combat experience (1-10 scale)'),
});

export const CharacterFeatsSchema = z.object({
  feats: z.array(z.string()).describe('List of notable feats and accomplishments'),
});

export const CharacterPortraitSchema = z.object({
  imageUrl: z.string().describe('URL of the generated character portrait'),
  altText: z.string().describe('Alt text description of the image'),
  prompt: z.string().describe('The prompt used to generate the image'),
});
