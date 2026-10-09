import express from 'express';
import http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { parseEnvelope, validateUsername, validateTextMessage } from './validation.js';

const app = express();
const server = http.createServer(app);
const PORT = 3000;

app.use(express.json());

const messages = [];
let nextId = 1;

const sseClients = new Set();

function broadcastSse(message) {
  const frame = `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;
  for (const clientRes of sseClients) {
    clientRes.write(frame);
  }
}

app.post('/api/messages', (req, res) => {
  const { author, text } = req.body || {};

  if (
    !author ||
    typeof author !== 'string' ||
    !author.trim() ||
    !text ||
    typeof text !== 'string' ||
    !text.trim()
  ) {
    return res.status(400).json({
      error: "Les champs 'author' et 'text' sont obligatoires et ne doivent pas être vides.",
    });
  }

  const message = {
    id: nextId++,
    author: author.trim(),
    text: text.trim(),
    at: new Date().toISOString(),
  };

  messages.push(message);
  broadcastSse(message);

  return res.status(201).json(message);
});

app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('retry: 3000\n\n');

  const rawLastId = req.headers['last-event-id'];
  if (rawLastId !== undefined) {
    const lastId = Number(rawLastId);
    if (!isNaN(lastId)) {
      const missedMessages = messages.filter((m) => m.id > lastId);
      for (const m of missedMessages) {
        res.write(`id: ${m.id}\nevent: message\ndata: ${JSON.stringify(m)}\n\n`);
      }
    }
  }

  sseClients.add(res);

  res.on('close', () => {
    sseClients.delete(res);
  });
});

const wss = new WebSocketServer({
  server,
  path: '/api/ws',
  maxPayload: 16384,
});

function sendJson(ws, obj) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
}

function sendError(ws, code, message, details) {
  const payload = { code, message };
  if (details) {
    payload.details = details;
  }
  sendJson(ws, { v: 1, type: 'server:error', payload });
}

function broadcastWs(msgObj) {
  const data = JSON.stringify(msgObj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN && client.user) {
      client.send(data);
    }
  }
}

wss.on('connection', (ws) => {
  ws.user = null;
  ws.isAlive = true;

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw, isBinary) => {
    const envelope = parseEnvelope(raw, isBinary);
    if (!envelope.valid) {
      if (envelope.fatal) {
        ws.close(envelope.closeCode, envelope.reason);
      }
      return;
    }

    const { type, payload } = envelope.data;

    if (type === 'user:identify') {
      if (ws.user) {
        sendError(ws, 'ALREADY_IDENTIFIED', 'Client déjà identifié.');
        return;
      }
      const res = validateUsername(payload?.username);
      if (!res.valid) {
        sendError(ws, res.code, res.message);
        return;
      }
      ws.user = res.username;
      sendJson(ws, {
        v: 1,
        type: 'user:welcome',
        payload: {
          username: ws.user,
          serverTime: new Date().toISOString(),
        },
      });
      return;
    }

    if (type === 'message:send') {
      if (!ws.user) {
        sendError(ws, 'UNIDENTIFIED', "Vous devez vous identifier avec user:identify avant d'envoyer un message.");
        return;
      }
      const res = validateTextMessage(payload?.text);
      if (!res.valid) {
        sendError(ws, res.code, res.message, res.details);
        return;
      }
      const message = {
        id: nextId++,
        author: ws.user,
        text: res.text,
        at: new Date().toISOString(),
      };
      messages.push(message);
      broadcastWs({
        v: 1,
        type: 'message:broadcast',
        payload: message,
      });
      return;
    }

    sendError(ws, 'UNKNOWN_TYPE', `Type de message inconnu : '${type}'.`);
  });
});

const heartbeatInterval = setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      ws.terminate();
    } else {
      ws.isAlive = false;
      ws.ping();
    }
  }
}, 30000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
