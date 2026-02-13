# Client-Server Analysis Engine Duplication - Architectural Fix Plan

## Problem Statement

The Scholomance codebase has **significant duplication** of analysis engines between client and server:

### Duplicated Analysis Engines

1. **phoneme.engine.js** (623 lines) - Client-side phoneme analysis
2. **deepRhyme.engine.js** (540 lines) - Client-side deep rhyme analysis
3. **Server-side imports** - Backend imports and re-uses these same client files
4. **analysis.worker.js** - Web Worker wrapper for client-side analysis

### Current Architecture Issues

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────┐      ┌──────────────────┐            │
│  │ phoneme.engine   │      │ deepRhyme.engine │            │
│  │   (623 lines)    │      │   (540 lines)    │            │
│  └────────┬─────────┘      └────────┬─────────┘            │
│           │                         │                       │
│           └─────────┬───────────────┘                       │
│                     │                                       │
│           ┌─────────▼──────────┐                            │
│           │ analysis.worker.js │                            │
│           │  (Web Worker)      │                            │
│           └────────────────────┘                            │
│                                                              │
│  Used by: useDeepRhymeAnalysis hook                         │
│           (for real-time editor analysis)                   │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  codex/server/services/panelAnalysis.service.js      │   │
│  │                                                       │   │
│  │  Imports:                                            │   │
│  │  - DeepRhymeEngine (from src/lib/deepRhyme.engine)  │   │
│  │  - detectScheme (from src/lib/rhymeScheme.detector) │   │
│  │  - analyzeMeter (from src/lib/rhymeScheme.detector) │   │
│  │  - analyzeLiteraryDevices                           │   │
│  │  - detectEmotion                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Exposed via: POST /api/panel-analysis                      │
│                                                              │
└─────────────────────────────────────────────────────────────┘

                    ⚠️ DUPLICATION ISSUES ⚠️
┌─────────────────────────────────────────────────────────────┐
│ 1. Same code runs in 3 places (client, worker, server)      │
│ 2. Maintenance burden: fix bugs in multiple locations       │
│ 3. Bundle size: ~1200 lines shipped to client unnecessarily │
│ 4. Inconsistent results: client/server may diverge          │
│ 5. Testing complexity: must test 3 execution contexts       │
└─────────────────────────────────────────────────────────────┘
```

---

## Root Cause Analysis

### Why This Happened

1. **Historical Evolution**: Client-side analysis was built first for real-time feedback
2. **Performance Requirements**: Web Worker added to prevent UI blocking
3. **Backend Addition**: Server-side analysis added later for authoritative results
4. **Import Convenience**: Server imports client code directly (works but creates coupling)

### Current Usage Patterns

#### Client-Side Usage
```javascript
// src/hooks/useDeepRhymeAnalysis.jsx
const worker = new Worker(new URL('../lib/analysis.worker.js', import.meta.url), {
  type: 'module'
});

worker.postMessage({
  type: 'ANALYZE',
  payload: { text, analysisId }
});
```

#### Server-Side Usage
```javascript
// codex/server/services/panelAnalysis.service.js
import { DeepRhymeEngine } from '../../../src/lib/deepRhyme.engine.js';
import { detectScheme, analyzeMeter } from '../../../src/lib/rhymeScheme.detector.js';

const deepRhymeEngine = new DeepRhymeEngine();
const deepAnalysis = deepRhymeEngine.analyzeDocument(text);
const scheme = detectScheme(deepAnalysis.schemePattern, deepAnalysis.rhymeGroups);
```

---

## Proposed Solution: Server-First Architecture

### Strategy: Eliminate Client-Side Analysis Engines

**Core Principle**: Server is the single source of truth for all analysis.

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT SIDE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  useDeepRhymeAnalysis (REFACTORED)                   │   │
│  │                                                       │   │
│  │  - Debounced API calls to server                     │   │
│  │  - Local caching of results                          │   │
│  │  - Optimistic UI updates                             │   │
│  │  - AbortController for request cancellation          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ❌ REMOVED: phoneme.engine.js (623 lines)                  │
│  ❌ REMOVED: deepRhyme.engine.js (540 lines)                │
│  ❌ REMOVED: analysis.worker.js                             │
│                                                              │
│  ✅ KEPT: Lightweight UI components and hooks               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ HTTP POST
                              │ /api/panel-analysis
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        SERVER SIDE                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  codex/server/services/panelAnalysis.service.js      │   │
│  │                                                       │   │
│  │  ✅ Single source of truth for analysis              │   │
│  │  ✅ Consistent results across all clients            │   │
│  │  ✅ Easier to maintain and test                      │   │
│  │  ✅ Can leverage server-side optimizations           │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Optional: Redis caching for frequently analyzed texts      │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Refactor Client Hook (2-3 hours)

**File**: `src/hooks/useDeepRhymeAnalysis.jsx`

#### Current Implementation (Web Worker)
```javascript
export function useDeepRhymeAnalysis() {
  const workerRef = useRef(null);
  
  useEffect(() => {
    const worker = new Worker(new URL('../lib/analysis.worker.js', import.meta.url), {
      type: 'module'
    });
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  const analyzeDocument = useCallback((text) => {
    workerRef.current.postMessage({
      type: 'ANALYZE',
      payload: { text, analysisId }
    });
  }, []);
}
```

#### New Implementation (Server API)
```javascript
export function useDeepRhymeAnalysis() {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const abortControllerRef = useRef(null);
  const cacheRef = useRef(new Map());
  const debounceTimerRef = useRef(null);

  const analyzeDocument = useCallback(async (text) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Clear debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!text || !text.trim()) {
      setAnalysis(null);
      return;
    }

    // Check cache
    const cacheKey = text.trim();
    if (cacheRef.current.has(cacheKey)) {
      setAnalysis(cacheRef.current.get(cacheKey));
      return;
    }

    // Debounce API call (500ms)
    debounceTimerRef.current = setTimeout(async () => {
      setIsAnalyzing(true);
      setError(null);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const response = await fetch('/api/panel-analysis', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Analysis failed: ${response.status}`);
        }

        const result = await response.json();
        
        // Cache result
        cacheRef.current.set(cacheKey, result);
        
        // Limit cache size (keep last 50 analyses)
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          cacheRef.current.delete(firstKey);
        }

        setAnalysis(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
          console.error('[useDeepRhymeAnalysis] Analysis failed:', err);
        }
      } finally {
        setIsAnalyzing(false);
        abortControllerRef.current = null;
      }
    }, 500);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  return {
    analysis,
    isAnalyzing,
    error,
    analyzeDocument,
  };
}
```

### Phase 2: Remove Client-Side Engines (1 hour)

**Files to Delete**:
1. ❌ `src/lib/analysis.worker.js`
2. ❌ `src/lib/phoneme.engine.js` (if not used elsewhere)
3. ❌ `src/lib/deepRhyme.engine.js` (if not used elsewhere)

**Files to Check for Dependencies**:
```bash
# Search for imports of these files
grep -r "phoneme.engine" src/
grep -r "deepRhyme.engine" src/
grep -r "analysis.worker" src/
```

**Keep if Used Elsewhere**:
- If `phoneme.engine.js` is used for lightweight client-side operations (e.g., vowel family display), keep it but mark as "display only"
- If `deepRhyme.engine.js` is imported by other client components, refactor those to use the API

### Phase 3: Optimize Server Endpoint (2-3 hours)

**File**: `codex/server/routes/panelAnalysis.routes.js`

#### Add Response Caching
```javascript
import { createHash } from 'crypto';

const analysisCache = new Map();
const CACHE_MAX_SIZE = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCacheKey(text) {
  return createHash('sha256').update(text.trim()).digest('hex');
}

fastify.post('/api/panel-analysis', {
  preValidation: [csrfPreValidation],
  schema: {
    body: {
      type: 'object',
      required: ['text'],
      properties: {
        text: { type: 'string', maxLength: 500000 }
      }
    }
  },
  handler: async (request, reply) => {
    const { text } = request.body;
    
    // Check cache
    const cacheKey = getCacheKey(text);
    const cached = analysisCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      reply.header('X-Cache', 'HIT');
      return cached.data;
    }

    // Perform analysis
    const service = createPanelAnalysisService({ log: fastify.log });
    const result = service.analyzePanels(text);

    // Cache result
    analysisCache.set(cacheKey, {
      data: result,
      timestamp: Date.now()
    });

    // Limit cache size
    if (analysisCache.size > CACHE_MAX_SIZE) {
      const firstKey = analysisCache.keys().next().value;
      analysisCache.delete(firstKey);
    }

    reply.header('X-Cache', 'MISS');
    return result;
  }
});
```

#### Add Redis Caching (Optional)
```javascript
// If Redis is available
fastify.post('/api/panel-analysis', {
  handler: async (request, reply) => {
    const { text } = request.body;
    const cacheKey = `analysis:${getCacheKey(text)}`;

    // Try Redis first
    if (fastify.redis?.isReady) {
      try {
        const cached = await fastify.redis.get(cacheKey);
        if (cached) {
          reply.header('X-Cache', 'HIT-REDIS');
          return JSON.parse(cached);
        }
      } catch (err) {
        fastify.log.warn({ err }, 'Redis cache read failed');
      }
    }

    // Perform analysis
    const service = createPanelAnalysisService({ log: fastify.log });
    const result = service.analyzePanels(text);

    // Cache in Redis
    if (fastify.redis?.isReady) {
      try {
        await fastify.redis.setex(
          cacheKey,
          300, // 5 minutes TTL
          JSON.stringify(result)
        );
      } catch (err) {
        fastify.log.warn({ err }, 'Redis cache write failed');
      }
    }

    reply.header('X-Cache', 'MISS');
    return result;
  }
});
```

### Phase 4: Update Tests (2-3 hours)

#### Remove Worker Tests
```bash
# Delete or update these test files
rm tests/lib/analysis.worker.test.js
```

#### Add API Integration Tests
```javascript
// tests/server/panelAnalysis.routes.test.js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { fastify } from '../../codex/server/index.js';

describe('Panel Analysis API', () => {
  beforeAll(async () => {
    await fastify.ready();
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should analyze text and return results', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/panel-analysis',
      payload: {
        text: 'The cat sat on the mat\nThe dog ran in the fog'
      }
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result).toHaveProperty('analysis');
    expect(result).toHaveProperty('scheme');
    expect(result).toHaveProperty('meter');
    expect(result).toHaveProperty('scoreData');
  });

  it('should cache repeated requests', async () => {
    const text = 'Roses are red, violets are blue';
    
    // First request
    const response1 = await fastify.inject({
      method: 'POST',
      url: '/api/panel-analysis',
      payload: { text }
    });
    expect(response1.headers['x-cache']).toBe('MISS');

    // Second request (should hit cache)
    const response2 = await fastify.inject({
      method: 'POST',
      url: '/api/panel-analysis',
      payload: { text }
    });
    expect(response2.headers['x-cache']).toBe('HIT');
    expect(response2.body).toBe(response1.body);
  });

  it('should handle empty text', async () => {
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/panel-analysis',
      payload: { text: '' }
    });

    expect(response.statusCode).toBe(200);
    const result = JSON.parse(response.body);
    expect(result.analysis).toBeNull();
  });

  it('should handle very long text', async () => {
    const longText = 'word '.repeat(10000);
    const response = await fastify.inject({
      method: 'POST',
      url: '/api/panel-analysis',
      payload: { text: longText }
    });

    expect(response.statusCode).toBe(200);
  });
});
```

---

## Migration Checklist

### Pre-Migration
- [ ] Audit all imports of `phoneme.engine.js`
- [ ] Audit all imports of `deepRhyme.engine.js`
- [ ] Audit all imports of `analysis.worker.js`
- [ ] Document current performance metrics (analysis time, bundle size)
- [x] Create feature flag for gradual rollout

### Migration Steps
- [ ] Implement new `useDeepRhymeAnalysis` hook with API calls
- [x] Add server-side caching (in-memory first, Redis optional)
- [x] Add comprehensive error handling
- [ ] Update all components using the old hook
- [ ] Add loading states and optimistic UI updates
- [ ] Test with slow network conditions
- [x] Test with server errors
- [ ] Test cache invalidation

### Post-Migration
- [ ] Remove old client-side engines (if not used elsewhere)
- [x] Remove web worker code
- [x] Update documentation
- [ ] Measure new performance metrics
- [x] Monitor server load and response times
- [ ] Adjust cache TTL based on usage patterns

---

## Performance Considerations

### Network Latency Trade-offs

**Before (Web Worker)**:
- ✅ Instant analysis (no network)
- ✅ Works offline
- ❌ Blocks main thread during initialization
- ❌ Large bundle size (~1200 lines)
- ❌ Inconsistent with server results

**After (Server API)**:
- ✅ Smaller bundle size (save ~1200 lines)
- ✅ Consistent results
- ✅ Easier maintenance
- ✅ Can leverage server optimizations
- ❌ Network latency (mitigated by caching)
- ❌ Requires server connection

### Mitigation Strategies

1. **Aggressive Caching**: Cache results client-side and server-side
2. **Debouncing**: Wait 500ms before sending request (user still typing)
3. **Request Cancellation**: Cancel in-flight requests when new text arrives
4. **Optimistic UI**: Show previous results while loading new ones
5. **Progressive Enhancement**: Show partial results as they arrive
6. **Compression**: Enable gzip/brotli for API responses

### Expected Performance

| Metric | Before (Worker) | After (API) | Change |
|--------|----------------|-------------|--------|
| Initial Bundle Size | ~1.2MB | ~200KB | -83% |
| First Analysis | 50-200ms | 100-500ms | +2-3x |
| Cached Analysis | 50-200ms | 5-10ms | -90% |
| Consistency | Variable | 100% | ✅ |
| Offline Support | Yes | No | ❌ |

---

## Rollback Plan

### Feature Flag Implementation

```javascript
// src/hooks/useDeepRhymeAnalysis.jsx
const USE_SERVER_ANALYSIS = parseBooleanEnvFlag(
  import.meta.env.VITE_USE_SERVER_ANALYSIS,
  true
);

export function useDeepRhymeAnalysis() {
  if (USE_SERVER_ANALYSIS) {
    return useServerAnalysis();
  } else {
    return useWorkerAnalysis(); // Keep old implementation
  }
}
```

### Rollback Steps
1. Set `VITE_USE_SERVER_ANALYSIS=false` in environment
2. Redeploy frontend
3. Monitor for issues
4. If stable, remove old code in next release

---

## Alternative Approaches Considered

### Option 1: Hybrid Approach (Not Recommended)
- Keep client-side engines for offline support
- Use server for authoritative results
- **Rejected**: Maintains duplication, doesn't solve core problem

### Option 2: Move Server Code to Shared Package (Not Recommended)
- Extract engines to `@scholomance/analysis` package
- Import in both client and server
- **Rejected**: Still ships large code to client, doesn't reduce bundle

### Option 3: Server-Side Rendering (Future Enhancement)
- Pre-render analysis results during SSR
- Send HTML with embedded results
- **Deferred**: Requires larger architectural changes

---

## Success Metrics

### Technical Metrics
- [ ] Bundle size reduced by >80%
- [ ] Server response time <500ms (p95)
- [ ] Cache hit rate >70%
- [ ] Zero client-server result inconsistencies

### User Experience Metrics
- [ ] No perceived performance degradation
- [ ] Analysis completes within 1 second (p95)
- [ ] Error rate <0.1%
- [ ] User satisfaction maintained or improved

### Maintenance Metrics
- [ ] Single source of truth for analysis logic
- [ ] Test coverage >90%
- [ ] Bug fix time reduced by 50%
- [ ] Deployment complexity reduced

---

## Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Refactor Hook | 2-3 hours | None |
| Phase 2: Remove Engines | 1 hour | Phase 1 complete |
| Phase 3: Optimize Server | 2-3 hours | Phase 1 complete |
| Phase 4: Update Tests | 2-3 hours | Phases 1-3 complete |
| **Total** | **7-10 hours** | - |

**Recommended Schedule**: 2 days with testing and validation

---

## Conclusion

This architectural change will:

1. ✅ **Eliminate duplication** - Single source of truth for analysis
2. ✅ **Reduce bundle size** - Save ~1200 lines from client bundle
3. ✅ **Improve consistency** - Server is authoritative
4. ✅ **Simplify maintenance** - Fix bugs in one place
5. ✅ **Enable optimizations** - Server-side caching, Redis, etc.

The trade-off is network latency, but this is mitigated through aggressive caching, debouncing, and optimistic UI updates. The benefits far outweigh the costs for a web application that requires server connectivity anyway.

**Recommendation**: Proceed with implementation using the phased approach with feature flags for safe rollback.
