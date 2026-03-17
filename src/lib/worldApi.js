import { DEFAULT_WORLD_ROOM_ID } from '../../codex/core/world.entity.js';

function getApiUrl(path) {
  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : (import.meta.env.VITE_API_BASE_URL || 'http://localhost');

  try {
    return new URL(path, origin).toString();
  } catch {
    return path;
  }
}

const CSRF_HEADER = 'x-csrf-token';
let cachedCsrfToken = null;
let csrfPromise = null;

async function getCsrfToken() {
  if (cachedCsrfToken) return cachedCsrfToken;
  if (csrfPromise) return csrfPromise;

  csrfPromise = fetch(getApiUrl('/auth/csrf-token'), { credentials: 'include' })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch CSRF token: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      cachedCsrfToken = data?.token || null;
      return cachedCsrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function buildWorldError(status, payload) {
  const message = payload?.message || payload?.error || `World request failed (${status})`;
  return new Error(message);
}

export async function fetchWorldRoom(roomId = DEFAULT_WORLD_ROOM_ID) {
  await getCsrfToken();
  const response = await fetch(getApiUrl(`/api/world/rooms/${encodeURIComponent(roomId)}`), {
    credentials: 'include',
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw buildWorldError(response.status, payload);
  }
  return payload;
}

export async function fetchWorldEntity(entityId) {
  await getCsrfToken();
  const response = await fetch(getApiUrl(`/api/world/entities/${encodeURIComponent(entityId)}`), {
    credentials: 'include',
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw buildWorldError(response.status, payload);
  }
  return payload;
}

export async function inspectWorldEntity(entityId, options = {}) {
  const csrfToken = await getCsrfToken();
  const response = await fetch(getApiUrl(`/api/world/entities/${encodeURIComponent(entityId)}/actions/inspect`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      [CSRF_HEADER]: csrfToken,
    },
    body: JSON.stringify({
      ...(options.roomId ? { roomId: options.roomId } : {}),
    }),
  });
  const payload = await parseJson(response);
  if (!response.ok) {
    throw buildWorldError(response.status, payload);
  }
  return payload;
}
