export function parseEnvelope(data, isBinary) {
  if (isBinary) {
    return {
      valid: false,
      fatal: true,
      closeCode: 1003,
      reason: 'Unsupported data: binary frames are not supported',
    };
  }

  let text;
  if (typeof data === 'string') {
    text = data;
  } else if (Buffer.isBuffer(data)) {
    text = data.toString('utf8');
  } else {
    return {
      valid: false,
      fatal: true,
      closeCode: 1002,
      reason: 'Protocol error: payload must be text',
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return {
      valid: false,
      fatal: true,
      closeCode: 1002,
      reason: 'Protocol error: invalid JSON',
    };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      fatal: true,
      closeCode: 1002,
      reason: 'Protocol error: root must be an object',
    };
  }

  if (parsed.v !== 1) {
    return {
      valid: false,
      fatal: true,
      closeCode: 4001,
      reason: 'Unsupported protocol version',
    };
  }

  if (typeof parsed.type !== 'string' || !parsed.type.trim()) {
    return {
      valid: false,
      fatal: true,
      closeCode: 1002,
      reason: 'Protocol error: missing type',
    };
  }

  if (!parsed.payload || typeof parsed.payload !== 'object' || Array.isArray(parsed.payload)) {
    return {
      valid: false,
      fatal: true,
      closeCode: 1002,
      reason: 'Protocol error: payload must be an object',
    };
  }

  return {
    valid: true,
    data: parsed,
  };
}

export function validateUsername(username) {
  if (typeof username !== 'string') {
    return {
      valid: false,
      code: 'USERNAME_INVALID',
      message: "Le nom d'utilisateur doit être une chaîne.",
    };
  }

  const trimmed = username.trim();
  const pattern = /^[a-zA-Z0-9_-]{1,30}$/;
  if (!pattern.test(trimmed)) {
    return {
      valid: false,
      code: 'USERNAME_INVALID',
      message: "Nom d'utilisateur invalide (1 à 30 caractères alphanumériques, tirets et underscores).",
    };
  }

  return {
    valid: true,
    username: trimmed,
  };
}

export function validateTextMessage(text) {
  if (typeof text !== 'string') {
    return {
      valid: false,
      code: 'VALIDATION_ERROR',
      message: "Le champ 'text' est obligatoire.",
      details: { field: 'text' },
    };
  }

  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return {
      valid: false,
      code: 'VALIDATION_ERROR',
      message: "Le champ 'text' ne peut pas être vide.",
      details: { field: 'text' },
    };
  }

  if (trimmed.length > 2000) {
    return {
      valid: false,
      code: 'TEXT_TOO_LONG',
      message: 'Le message ne peut pas dépasser 2 000 caractères.',
      details: { field: 'text' },
    };
  }

  return {
    valid: true,
    text: trimmed,
  };
}
