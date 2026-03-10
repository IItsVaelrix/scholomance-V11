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

function buildCombatError(status, payload) {
  const message = payload?.message || payload?.error || `Combat scoring failed (${status})`;
  return new Error(message);
}

export async function scoreCombatScroll({ scrollText, playerId, arenaSchool, opponentSchool } = {}) {
  const response = await fetch(getApiUrl('/api/combat/score'), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      scrollText: typeof scrollText === 'string' ? scrollText : String(scrollText || ''),
      ...(playerId ? { playerId } : {}),
      ...(arenaSchool ? { arenaSchool } : {}),
      ...(opponentSchool ? { opponentSchool } : {}),
    }),
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw buildCombatError(response.status, payload);
  }

  return payload;
}
