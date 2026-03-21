import { Router } from 'express';
import { eq, desc } from 'drizzle-orm';

import { db } from '../db/db.js';
import { commentary } from '../db/schema.js';
import { createCommentarySchema, listCommentaryQuerySchema} from '../validation/commentary.js';
import {matchIdParamSchema} from '../validation/matches.js';


export const commentaryRouter = Router({ mergeParams: true }); //accept params
const MAX_LIMIT = 100;
commentaryRouter.get('/', async (req, res) => {
    const paramsResult = matchIdParamSchema.safeParse(req.params);

    if (!paramsResult.success) {
        return res.status(400).json({ error: 'Invalid match ID.', details: paramsResult.error.issues });
    }

    const queryResult = listCommentaryQuerySchema.safeParse(req.query);
    if (!queryResult.success) {
        return res.status(400).json({ error: 'Invalid query parameters.', details: queryResult.error.issues });
    }

    try {
        const { id: matchId } = paramsResult.data;
        const { limit = 10 } = queryResult.data;

        const safeLimit = Math.min(limit, MAX_LIMIT);

        const results = await db
            .select()
            .from(commentary)
            .where(eq(commentary.matchId, matchId))
            .orderBy(desc(commentary.createdAt))
            .limit(safeLimit);

        res.status(200).json({ data: results });
    } catch (error) {
        console.error('Failed to fetch commentary:',error);
        res.status(500).json({ error: 'Failed to fetch commentary.' });
    }
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

    if(req.app.locals.broadcastCommentary){
        req.app.locals.broadcastCommentary(event.matchId, event);
    }

    res.status(201).json({ message: "Commentary created", data: event });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
}); 

