import express from 'express';
import http from 'http';
import { attachWebSocketServer } from './ws/server.js';
import { matchesRouter } from './routes/matches.js';
import { securityMiddleware } from './arcjet.js';
import { commentaryRouter } from './routes/commentary.js';
const app = express();
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
const server= http.createServer(app);


app.get('/', (req, res) => {
  res.send('Hello World!');
}
);
app.use(securityMiddleware());
app.use('/matches', matchesRouter);
app.use('/matches/:id/commentary', commentaryRouter);

const {broadcastMatchCreated, broadcastCommentary} = attachWebSocketServer(server);
app.locals.broadcastMatchCreated=broadcastMatchCreated;
app.locals.broadcastCommentary=broadcastCommentary;

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log(`app listening on port ${baseUrl}`);
  console.log(`WebSocket server is running on ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/ws`);
}
);