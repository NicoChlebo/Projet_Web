<script setup>
import { ref, computed, onMounted } from 'vue';
import { useWebSocket } from '../composables/useWebSocket';

const {
  status,
  closeCode,
  closeReason,
  messages,
  error,
  currentUser,
  connect,
  disconnect,
  sendMessage,
} = useWebSocket('/api/ws');

const username = ref('alice');
const messageText = ref('');

const isIdentified = computed(() => status.value === 'identified');

const statusLabel = computed(() => {
  if (status.value === 'identified') {
    return `Connecté (Identifié : ${currentUser.value})`;
  }
  if (status.value === 'connected') {
    return 'Connecté (Identification en cours...)';
  }
  if (status.value === 'connecting') {
    return 'Connexion en cours...';
  }
  if (status.value === 'error') {
    return 'Erreur de connexion';
  }
  if (closeCode.value !== null) {
    return `Déconnecté (code ${closeCode.value}${closeReason.value ? ' : ' + closeReason.value : ''})`;
  }
  return 'Déconnecté';
});

const statusClass = computed(() => {
  if (status.value === 'identified') return 'status-connected';
  if (status.value === 'connecting' || status.value === 'connected') return 'status-connecting';
  return 'status-disconnected';
});

function handleConnect() {
  if (username.value.trim()) {
    connect(username.value.trim());
  }
}

function handleSendMessage() {
  if (!messageText.value.trim() || !isIdentified.value) {
    return;
  }
  const sent = sendMessage(messageText.value.trim());
  if (sent) {
    messageText.value = '';
  }
}

onMounted(() => {
  handleConnect();
});
</script>

<template>
  <div class="chat-container">
    <header class="chat-header">
      <h1>Salon temps réel (v1 - WebSocket)</h1>
      <div class="status-badge" :class="statusClass">
        État : <strong>{{ statusLabel }}</strong>
      </div>
    </header>

    <div class="user-bar">
      <div class="user-form">
        <label for="username-input">Utilisateur :</label>
        <input
          id="username-input"
          v-model="username"
          type="text"
          placeholder="Nom d'utilisateur"
          :disabled="isIdentified"
        />
        <button
          v-if="!isIdentified"
          type="button"
          class="btn-connect"
          @click="handleConnect"
        >
          Se connecter
        </button>
        <button
          v-else
          type="button"
          class="btn-disconnect"
          @click="disconnect"
        >
          Se déconnecter
        </button>
      </div>
    </div>

    <div v-if="error" class="error-banner">
      {{ error }}
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

    <form class="message-form" @submit.prevent="handleSendMessage">
      <div class="form-row">
        <label for="message-input">Message :</label>
        <input
          id="message-input"
          v-model="messageText"
          type="text"
          placeholder="Tapez votre message..."
          required
          :disabled="!isIdentified"
        />
        <button type="submit" :disabled="!isIdentified || !messageText.trim()">
          Envoyer
        </button>
      </div>
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
  font-size: 0.85rem;
}

.status-connected {
  background-color: #d4edda;
  color: #155724;
}

.status-connecting {
  background-color: #fff3cd;
  color: #856404;
}

.status-disconnected {
  background-color: #f8d7da;
  color: #721c24;
}

.user-bar {
  margin-bottom: 1rem;
  padding: 0.5rem;
  background-color: #f0f0f0;
  border-radius: 4px;
}

.user-form {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.user-form label {
  font-weight: 500;
  font-size: 0.9rem;
}

.user-form input {
  padding: 0.4rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.btn-connect {
  padding: 0.4rem 0.8rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-disconnect {
  padding: 0.4rem 0.8rem;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
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
</style>
