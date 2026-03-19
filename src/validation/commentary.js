import { z } from 'zod';

export const listCommentaryQuerySchema = z.object({
  limit: z.coerce.number().positive().max(100).optional(),
});

export const createCommentarySchema = z.object({
  minute: z.number().int().nonnegative(),
  sequence: z.number().int().positive(), // Assuming sequence is a positive integer
  period: z.string(),
  eventType: z.string(),
  actor: z.string(),
  team: z.string(),
  message: z.string(),
  metadata: z.unknown(), // Accept arbitrary JSON for metadata
  tags: z.array(z.string()),
});