import { z } from "zod";

/** ItemSchema is the single source of truth for both runtime validation and static typing. */
export const ItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  quantity: z.number(),
});

export type Item = z.infer<typeof ItemSchema>;
