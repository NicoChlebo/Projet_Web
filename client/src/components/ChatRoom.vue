<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const connectionStatus = ref('Connexion en cours...');
const connectionClass = ref('status-connecting');
const messages = ref([]);
const author = ref('alice');
const text = ref('');
const isSending = ref(false);
const errorMessage = ref('');

let eventSource = null;

function connectStream() {
  eventSource = new EventSource('/api/stream');

  eventSource.onopen = () => {
    connectionStatus.value = 'Connecté';
    connectionClass.value = 'status-connected';
  };

  eventSource.addEventListener('message', (event) => {
    try {
      const data = JSON.parse(event.data);
      // Éviter les doublons par identifiant
      if (!messages.value.some((m) => m.id === data.id)) {
        messages.value.push(data);
      }
    } catch (e) {
      console.error('Erreur de parsing SSE:', e);
    }
  });

  eventSource.onerror = () => {
    if (eventSource.readyState === EventSource.CONNECTING) {
      connectionStatus.value = 'Connexion interrompue, tentative de reconnexion...';
      connectionClass.value = 'status-reconnecting';
    } else {
      connectionStatus.value = 'Déconnecté';
      connectionClass.value = 'status-disconnected';
    }
  };
}

async function sendMessage() {
  if (!author.value.trim() || !text.value.trim() || isSending.value) {
    return;
  }

  isSending.value = true;
  errorMessage.value = '';

  const payload = {
    author: author.value.trim(),
    text: text.value.trim(),
  };

  try {
    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erreur serveur HTTP ${res.status}`);
    }

    // Le message sera reçu et affiché via le flux SSE pour éviter tout doublon
    text.value = '';
  } catch (err) {
    errorMessage.value = `Échec de l'envoi : ${err.message}`;
    // Le texte saisi reste dans text.value pour ne pas être perdu
  } finally {
    isSending.value = false;
  }
}

onMounted(() => {
  connectStream();
});

onUnmounted(() => {
  if (eventSource) {
    eventSource.close();
  }
});
</script>

<template>
  <div class="chat-container">
    <header class="chat-header">
      <h1>Salon temps réel (v0)</h1>
      <div class="status-badge" :class="connectionClass">
        État : <strong>{{ connectionStatus }}</strong>
      </div>
    </header>

    <div v-if="errorMessage" class="error-banner">
      {{ errorMessage }}
    </div>

    <section class="messages-list">
      <div v-if="messages.length === 0" class="empty-state">
        Aucun message pour le moment.
      </div>
      <div
        v-for="msg in messages"
        :key="msg.id"
        class="message-item"
      >
        <span class="message-meta">
          <strong>#{{ msg.id }}</strong> [{{ new Date(msg.at).toLocaleTimeString() }}] <em>{{ msg.author }}</em> :
        </span>
        <span class="message-text">{{ msg.text }}</span>
      </div>
    </section>

    <form class="message-form" @submit.prevent="sendMessage">
      <div class="form-row">
        <label for="author-input">Auteur :</label>
        <input
          id="author-input"
          v-model="author"
          type="text"
          placeholder="Votre nom"
          required
        />
      </div>

      <div class="form-row">
        <label for="message-input">Message :</label>
        <input
          id="message-input"
          v-model="text"
          type="text"
          placeholder="Tapez votre message..."
          required
          :disabled="isSending"
        />
        <button type="submit" :disabled="isSending || !text.trim()">
          {{ isSending ? 'Envoi en cours...' : 'Envoyer' }}
        </button>
      </div>
      <span v-if="isSending" class="sending-indicator">Envoi en cours…</span>
    </form>
  </div>
</template>

<style scoped>
.chat-container {
  max-width: 700px;
  margin: 2rem auto;
  font-family: system-ui, -apple-system, sans-serif;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 1.5rem;
  background-color: #fafafa;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 2px solid #ddd;
  padding-bottom: 1rem;
  margin-bottom: 1rem;
}

.chat-header h1 {
  font-size: 1.3rem;
  margin: 0;
}

.status-badge {
  padding: 0.3rem 0.6rem;
  border-radius: 4px;
  font-size: 0.9rem;
}

.status-connected {
  background-color: #d4edda;
  color: #155724;
}

.status-connecting,
.status-reconnecting {
  background-color: #fff3cd;
  color: #856404;
}

.status-disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.error-banner {
  background-color: #f8d7da;
  color: #721c24;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.messages-list {
  min-height: 250px;
  max-height: 400px;
  overflow-y: auto;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 1rem;
  margin-bottom: 1rem;
}

.empty-state {
  color: #888;
  font-style: italic;
  text-align: center;
  margin-top: 2rem;
}

.message-item {
  margin-bottom: 0.5rem;
  padding: 0.25rem 0;
  border-bottom: 1px solid #f0f0f0;
}

.message-meta {
  color: #555;
  margin-right: 0.5rem;
}

.message-text {
  word-break: break-word;
}

.message-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.form-row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.form-row label {
  min-width: 70px;
  font-weight: 500;
}

.form-row input {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.form-row button {
  padding: 0.5rem 1.2rem;
  background-color: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.form-row button:disabled {
  background-color: #99c2ff;
  cursor: not-allowed;
}

.sending-indicator {
  font-size: 0.85rem;
  color: #666;
  font-style: italic;
}
</style>
