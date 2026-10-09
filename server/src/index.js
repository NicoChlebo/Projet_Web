import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Stockage en mémoire
const messages = [];
let nextId = 1;

// Clients connectés au flux SSE
const clients = new Set();

/**
 * Diffuse un message à tous les clients connectés au flux SSE.
 */
function broadcast(message) {
  const frame = `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;
  for (const clientRes of clients) {
    clientRes.write(frame);
  }
}

// Étape 2 & 4 — Réception et diffusion d'un message
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
  broadcast(message);

  return res.status(201).json(message);
});

// Étape 3 — Flux SSE
app.get('/api/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  res.write('retry: 3000\n\n');

  clients.add(res);

  res.on('close', () => {
    clients.delete(res);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
