import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

const messages = [];
let nextId = 1;

const clients = new Set();

function broadcast(message) {
  const frame = `id: ${message.id}\nevent: message\ndata: ${JSON.stringify(message)}\n\n`;
  for (const clientRes of clients) {
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
  broadcast(message);

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

  clients.add(res);

  res.on('close', () => {
    clients.delete(res);
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
