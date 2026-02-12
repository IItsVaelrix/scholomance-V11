const COUNTER_KEYS = [
  'authFailures',
  'rateLimitHits',
  'wordLookupRequests',
  'wordLookupCacheHits',
  'uploadFailures',
];

function nowMs() {
  return Date.now();
}

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createOpsMetrics() {
  const startedAtMs = nowMs();
  const counters = Object.fromEntries(COUNTER_KEYS.map((key) => [key, 0]));

  function increment(counter, amount = 1) {
    if (!Object.prototype.hasOwnProperty.call(counters, counter)) return;
    counters[counter] += Math.max(0, toFiniteNumber(amount, 1));
  }

  function recordWordLookup(source) {
    increment('wordLookupRequests', 1);
    if (source === 'redis-cache') {
      increment('wordLookupCacheHits', 1);
    }
  }

  function snapshot() {
    const lookupRequests = counters.wordLookupRequests;
    const lookupCacheHits = counters.wordLookupCacheHits;
    const wordLookupCacheHitRatio = lookupRequests > 0
      ? Number((lookupCacheHits / lookupRequests).toFixed(4))
      : 0;
    return {
      ...counters,
      wordLookupCacheHitRatio,
      startedAt: new Date(startedAtMs).toISOString(),
      uptimeSeconds: Math.floor((nowMs() - startedAtMs) / 1000),
    };
  }

  return {
    increment,
    recordWordLookup,
    snapshot,
  };
}
