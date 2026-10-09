import express from 'express';

const app = express();
const PORT = 3000;

app.use(express.json());

// Stockage en mémoire
const messages = [];
let nextId = 1;

// Étape 2 — Réception d'un message
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

  return res.status(201).json(message);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
