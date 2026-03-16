import express from 'express';
import http from 'http';
import { attachWebSocketServer } from './ws/server.js';
import { matchesRouter } from './routes/matches.js';

const app = express();
const PORT = Number(process.env.PORT) || 8080;
const HOST = process.env.HOST || '0.0.0.0';

app.use(express.json());
const server= http.createServer(app);


app.get('/', (req, res) => {
  res.send('Hello World!');
}
);

app.use('/matches', matchesRouter);
const {broadcastMatchCreated}=attachWebSocketServer(server);
app.locals.broadcastMatchCreated=broadcastMatchCreated;

server.listen(PORT, HOST, () => {
  const baseUrl = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
  console.log(`app listening on port ${baseUrl}`);
  console.log(`WebSocket server is running on ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/ws`);
}
);