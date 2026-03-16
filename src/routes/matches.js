import { Router } from "express";
import { createMatchSchema, listMatchesQuerySchema } from "../validation/matches.js";
import { db } from "../db/db.js";
import { matches } from "../db/schema.js";
export const matchesRouter = Router();
import { getMatchStatus } from "../utils/match-status.js";
import { desc } from "drizzle-orm";

matchesRouter.get("/", async(req, res) => {
  const parsed=listMatchesQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error:'invalid query parameters', details: parsed.error.errors });
  }
  const limit=Math.min(parsed.data.limit ?? 50, 100);

try {    
    const data = await db.select().from(matches).orderBy((desc(matches.createdAt))).limit(limit);
    res.json({ data: data });
  } catch (error) { 
    res.status(500).json({ error: 'Internal server error',error: error.message });  
  }
     
});

matchesRouter.post("/", async(req, res) => {
  const parsed= createMatchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error:'invalid input', details: parsed.error.errors });
  } 
  try {
    const [event]=await db.insert(matches).values({
      ...parsed.data,
      startTime: new Date(parsed.data.startTime),
      endTime: new Date(parsed.data.endTime),
      homeScore: parsed.data.homeScore ?? 0,
      awayScore: parsed.data.awayScore ?? 0,
      status:getMatchStatus(parsed.data.startTime, parsed.data.endTime),
    }).returning();

    if(res.app.locals.broadcastMatchCreated){
      res.app.locals.broadcastMatchCreated(event);
    }
    res.status(201).json({ message: "Match created",data: event });
  }
  catch (error) {
    res.status(500).json({ error: 'Internal server error',error: error.message });
  }
});