import { Router } from 'express';

import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { createCommentarySchema} from '../validation/commentary.js';
import {matchIdParamSchema} from '../validation/matches.js';

// Ensure we can access params from the parent route (e.g. /matches/:id/commentary)
export const commentaryRouter = Router({ mergeParams: true });

commentaryRouter.get('/', (req, res) => {
    res.status(200).json({ message: 'Commentary list' });
});

commentaryRouter.post('/', async (req, res) => {
  const parsedParams = matchIdParamSchema.safeParse(req.params);
  if (!parsedParams.success) {
    return res.status(400).json({ error: 'invalid match ID', details: parsedParams.error.errors });
  }

  const parsedBody = createCommentarySchema.safeParse(req.body);
  if (!parsedBody.success) {
    return res.status(400).json({ error: 'invalid input', details: parsedBody.error.errors });
  }

  try {
    const [event] = await db.insert(commentary).values({
      matchId: parsedParams.data.id,
      minute: parsedBody.data.minute,
      sequence: parsedBody.data.sequence,
      period: parsedBody.data.period,
      eventType: parsedBody.data.eventType,
      actor: parsedBody.data.actor,
      team: parsedBody.data.team,
      message: parsedBody.data.message,
      metadata: parsedBody.data.metadata,
      tags: JSON.stringify(parsedBody.data.tags), // Store tags as JSON string since schema uses text
    }).returning();

    res.status(201).json({ message: "Commentary created", data: event });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}); 

