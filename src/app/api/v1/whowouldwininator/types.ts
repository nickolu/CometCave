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
