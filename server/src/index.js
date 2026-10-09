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
