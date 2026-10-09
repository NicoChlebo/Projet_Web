import { ref, onUnmounted } from 'vue';

export function useWebSocket(url = '/api/ws') {
  const status = ref('disconnected');
  const closeCode = ref(null);
  const closeReason = ref('');
  const messages = ref([]);
  const error = ref(null);
  const currentUser = ref('');

  let socket = null;

  function getWsUrl() {
    if (url.startsWith('ws://') || url.startsWith('wss://')) {
      return url;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}${url}`;
  }

  function connect(username) {
    if (socket) {
      disconnect();
    }

    error.value = null;
    closeCode.value = null;
    closeReason.value = '';
    status.value = 'connecting';

    const wsUrl = getWsUrl();
    socket = new WebSocket(wsUrl);

    socket.onopen = () => {
      status.value = 'connected';
      if (username) {
        sendJson({
          v: 1,
          type: 'user:identify',
          payload: { username },
        });
      }
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { type, payload } = message;

        if (type === 'user:welcome') {
          status.value = 'identified';
          currentUser.value = payload.username;
        } else if (type === 'message:broadcast') {
          if (!messages.value.some((m) => m.id === payload.id)) {
            messages.value.push(payload);
          }
        } else if (type === 'server:error') {
          error.value = payload.message || payload.code;
        }
      } catch (e) {
        error.value = 'Erreur lors du traitement du message serveur.';
      }
    };

    socket.onerror = () => {
      status.value = 'error';
    };

    socket.onclose = (event) => {
      status.value = 'disconnected';
      closeCode.value = event.code;
      closeReason.value = event.reason || '';
      socket = null;
    };
  }

  function sendJson(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  function sendMessage(text) {
    if (status.value !== 'identified') {
      return false;
    }
    return sendJson({
      v: 1,
      type: 'message:send',
      payload: { text },
    });
  }

  function disconnect() {
    if (socket) {
      socket.onopen = null;
      socket.onmessage = null;
      socket.onerror = null;
      socket.onclose = null;
      socket.close();
      socket = null;
      status.value = 'disconnected';
    }
  }

  onUnmounted(() => {
    disconnect();
  });

  return {
    status,
    closeCode,
    closeReason,
    messages,
    error,
    currentUser,
    connect,
    disconnect,
    sendMessage,
  };
}
