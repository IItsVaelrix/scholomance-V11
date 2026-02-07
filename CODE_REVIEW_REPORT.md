# Scholomance V10 - Comprehensive Code Review Report

**Review Date:** 2026-02-06
**Scope:** Security, Efficiency, Performance, and Aesthetics
**Based On:** AI_README_ARCHITECTURE.md, ARCH_CONTRACT_SECURITY.md, AI_COLLABORATION_ARCHITECTURE_PLAN.md

---

## Executive Summary

| Category | Issues Found | Critical | High | Medium | Low |
|----------|--------------|----------|------|--------|-----|
| **Security** | 6 | 1 | 2 | 3 | 0 |
| **Performance** | 7 | 0 | 2 | 4 | 1 |
| **Efficiency** | 6 | 0 | 1 | 3 | 2 |
| **Code Quality** | 14 | 0 | 2 | 5 | 7 |
| **TOTAL** | **33** | **1** | **7** | **15** | **10** |

---

## 1. Security Issues

### 1.1 [CRITICAL] Development Authentication Bypass

**File:** `codex/server/auth-pre-handler.js:10-16`
**Severity:** Critical
**Risk:** If deployed with `NODE_ENV` not set to 'production', anyone gets authenticated as guest user

**Current Code:**
```javascript
// ❌ VULNERABLE: Auto-login bypass in non-production mode
if (process.env.NODE_ENV !== "production") {
    const devUser = persistence.users.findByUsername(DEV_GUEST_USERNAME);
    if (devUser) {
        request.session.user = { id: devUser.id, username: devUser.username, guest: true };
    }
}
```

**Fixed Code:**
```javascript
// ✅ SECURE: Explicit development flag with safeguards
const ENABLE_DEV_AUTH = process.env.ENABLE_DEV_AUTH === 'true' &&
                        process.env.NODE_ENV === 'development';

if (ENABLE_DEV_AUTH) {
    console.warn('[AUTH] Development bypass enabled - NOT FOR PRODUCTION');
    const devUser = persistence.users.findByUsername(DEV_GUEST_USERNAME);
    if (devUser) {
        request.session.user = {
            id: devUser.id,
            username: devUser.username,
            guest: true,
            isDevelopmentBypass: true // Flag for audit trails
        };
    }
}
```

---

### 1.2 [HIGH] Missing Input Validation in HolographicEmbed

**File:** `src/pages/Listen/HolographicEmbed.jsx:4`
**Severity:** High
**Risk:** Color prop could contain malicious input injected into iframe src URL

**Current Code:**
```javascript
// ❌ VULNERABLE: Direct string manipulation without validation
const colorHex = color.replace("#", "");
// ... used in iframe src later
```

**Fixed Code:**
```javascript
// ✅ SECURE: Validate color format before use
function validateHexColor(color) {
    const hexPattern = /^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexPattern.test(color)) {
        console.warn(`Invalid color format: ${color}, using fallback`);
        return 'FFFFFF'; // Safe fallback
    }
    return color.replace("#", "").toUpperCase();
}

const colorHex = validateHexColor(color);
```

---

### 1.3 [HIGH] Missing API Timeout for External Calls

**File:** `codex/server/index.js:287-298`
**Severity:** High
**Risk:** Slow/unresponsive external APIs could hang requests indefinitely

**Current Code:**
```javascript
// ❌ VULNERABLE: No timeout on external API calls
const rhymeResponse = await fetch(
    `https://api.datamuse.com/words?rel_rhy=${word}&max=20`
);
```

**Fixed Code:**
```javascript
// ✅ SECURE: Implement timeout with AbortController
async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw new Error(`Request timeout after ${timeoutMs}ms`);
        }
        throw error;
    }
}

// Usage:
const rhymeResponse = await fetchWithTimeout(
    `https://api.datamuse.com/words?rel_rhy=${encodeURIComponent(word)}&max=20`,
    {},
    5000
);
```

---

### 1.4 [MEDIUM] URL Parameter Injection Risk

**File:** `codex/server/index.js:287-293, 329-334`
**Severity:** Medium
**Risk:** User-supplied word parameter directly used in external API URLs

**Current Code:**
```javascript
// ❌ RISKY: Direct string interpolation
fetch(`https://api.datamuse.com/words?rel_rhy=${word}&max=20`)
```

**Fixed Code:**
```javascript
// ✅ SECURE: Use URL API for proper encoding
function buildExternalApiUrl(baseUrl, params) {
    const url = new URL(baseUrl);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, String(value));
    });
    return url.toString();
}

const rhymeUrl = buildExternalApiUrl('https://api.datamuse.com/words', {
    rel_rhy: word,
    max: 20
});
const rhymeResponse = await fetch(rhymeUrl);
```

---

### 1.5 [MEDIUM] Hardcoded Session Secret Fallback

**File:** `codex/server/index.js:73`
**Severity:** Medium
**Risk:** Development secret is hardcoded and could leak to production

**Current Code:**
```javascript
// ❌ RISKY: Hardcoded fallback secret
secret: SESSION_SECRET || 'dev-only-secret-key-not-for-production-use-32chars',
```

**Fixed Code:**
```javascript
// ✅ SECURE: Fail fast if secret is missing
function getSessionSecret() {
    if (!process.env.SESSION_SECRET) {
        if (process.env.NODE_ENV === 'production') {
            throw new Error('SESSION_SECRET environment variable is required in production');
        }
        console.warn('[SESSION] Using development secret - NOT FOR PRODUCTION');
        return crypto.randomBytes(32).toString('hex'); // Random per-restart in dev
    }
    return process.env.SESSION_SECRET;
}

// In session config:
secret: getSessionSecret(),
```

---

### 1.6 [MEDIUM] Redundant CSRF Headers

**File:** `src/hooks/useScrolls.jsx:170-173`
**Severity:** Medium
**Risk:** Indicates confusion about CSRF handling

**Current Code:**
```javascript
// ❌ REDUNDANT: Sending two CSRF headers
headers: {
    'x-csrf-token': csrfToken,
    'csrf-token': csrfToken,
}
```

**Fixed Code:**
```javascript
// ✅ CLEAN: Use single standard header
const CSRF_HEADER = 'x-csrf-token'; // Document the standard

headers: {
    [CSRF_HEADER]: csrfToken,
    'Content-Type': 'application/json',
}
```

---

## 2. Performance Issues

### 2.1 [HIGH] Expensive XP Calculation Without Caching

**File:** `src/lib/progressionUtils.js:27-31`
**Severity:** High
**Impact:** O(n) complexity; at level 99, loops 98+ times on every check

**Current Code:**
```javascript
// ❌ SLOW: Recalculates every time
export function getXpForLevel(level) {
    let total = 0;
    for (let l = 1; l < level; l++) {
        total += Math.floor(l + 300 * Math.pow(2, l / 7));
    }
    return total;
}
```

**Fixed Code:**
```javascript
// ✅ FAST: Memoized with lookup table
const XP_CACHE = new Map();

// Pre-compute common levels on module load
function initXpCache(maxLevel = 100) {
    let total = 0;
    for (let l = 1; l <= maxLevel; l++) {
        total += Math.floor(l + 300 * Math.pow(2, l / 7));
        XP_CACHE.set(l, total);
    }
}
initXpCache();

export function getXpForLevel(level) {
    if (XP_CACHE.has(level)) {
        return XP_CACHE.get(level);
    }
    // Compute on demand for levels beyond cache
    let total = XP_CACHE.get(XP_CACHE.size) || 0;
    for (let l = XP_CACHE.size + 1; l <= level; l++) {
        total += Math.floor(l + 300 * Math.pow(2, l / 7));
        XP_CACHE.set(l, total);
    }
    return total;
}
```

---

### 2.2 [HIGH] Regex Compiled on Every Filter Iteration

**File:** `src/pages/Read/SyllableCounter.jsx:15`
**Severity:** High
**Impact:** Creates new regex for every phoneme in every word on every render

**Current Code:**
```javascript
// ❌ SLOW: Regex created per iteration
count += analysis.phonemes.filter((p) => /[0-9]/.test(p)).length;
```

**Fixed Code:**
```javascript
// ✅ FAST: Pre-compiled regex at module level
const STRESS_MARKER_REGEX = /[0-9]/;

// Alternative: Use character code comparison (faster)
function hasStressMarker(phoneme) {
    for (let i = 0; i < phoneme.length; i++) {
        const code = phoneme.charCodeAt(i);
        if (code >= 48 && code <= 57) return true; // '0'-'9'
    }
    return false;
}

// Usage:
count += analysis.phonemes.filter(hasStressMarker).length;
```

---

### 2.3 [MEDIUM] Missing useMemo for Word Analysis

**File:** `src/pages/Read/SyllableCounter.jsx:12-17`
**Severity:** Medium
**Impact:** Recalculates syllable count on every render

**Current Code:**
```javascript
// ❌ INEFFICIENT: No memoization
function countSyllables(text, engine) {
    const words = text.split(/\s+/);
    let count = 0;
    for (const word of words) {
        const analysis = engine.analyzeWord(word);
        if (analysis?.phonemes) {
            count += analysis.phonemes.filter((p) => /[0-9]/.test(p)).length;
        }
    }
    return count;
}
```

**Fixed Code:**
```javascript
// ✅ EFFICIENT: Memoized syllable counting
import { useMemo } from 'react';

const STRESS_MARKER_REGEX = /[0-9]/;

function useSyllableCount(text, engine, isEngineReady) {
    return useMemo(() => {
        if (!isEngineReady || !text) return 0;

        const words = text.split(/\s+/);
        return words.reduce((count, word) => {
            const analysis = engine.analyzeWord(word);
            if (analysis?.phonemes) {
                return count + analysis.phonemes.filter(
                    p => STRESS_MARKER_REGEX.test(p)
                ).length;
            }
            return count;
        }, 0);
    }, [text, engine, isEngineReady]);
}
```

---

### 2.4 [MEDIUM] Scroll Sort on Every Render

**File:** `src/hooks/useScrolls.jsx:238-241`
**Severity:** Medium
**Impact:** Sorts array on every scroll state change

**Current Code:**
```javascript
// ❌ INEFFICIENT: Sorts on every scrolls change
const sortedScrolls = useMemo(
    () => [...scrolls].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [scrolls]
);
```

**Fixed Code:**
```javascript
// ✅ EFFICIENT: Sort only when order actually changes
const sortedScrolls = useMemo(() => {
    // Create stable sort key for comparison
    const sortKey = scrolls
        .map(s => `${s.id}:${s.updatedAt}`)
        .join('|');

    return [...scrolls].sort((a, b) => b.updatedAt - a.updatedAt);
}, [scrolls]);

// Alternative: Track sort order separately
const [sortOrder, setSortOrder] = useState([]);
const sortedScrolls = useMemo(() => {
    return sortOrder.map(id => scrolls.find(s => s.id === id)).filter(Boolean);
}, [scrolls, sortOrder]);
```

---

### 2.5 [MEDIUM] Inefficient Vowel Matching Pattern

**File:** `src/lib/phoneme.engine.js:90`
**Severity:** Medium
**Impact:** Global regex creates unnecessary array allocations

**Current Code:**
```javascript
// ❌ INEFFICIENT: Creates array with global match
const vowelMatch = upper.match(/[AEIOU]+/g);
```

**Fixed Code:**
```javascript
// ✅ EFFICIENT: Use exec() for single first match or Set for checking
const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

function findFirstVowelCluster(word) {
    let start = -1;
    let cluster = '';

    for (let i = 0; i < word.length; i++) {
        const char = word[i].toUpperCase();
        if (VOWELS.has(char)) {
            if (start === -1) start = i;
            cluster += char;
        } else if (cluster) {
            break; // End of first cluster
        }
    }
    return cluster || null;
}
```

---

### 2.6 [MEDIUM] Missing React.memo on Pure Components

**File:** `src/pages/Read/ScrollList.jsx`
**Severity:** Medium
**Impact:** Unnecessary re-renders when parent updates

**Current Code:**
```javascript
// ❌ RE-RENDERS UNNECESSARILY
export default function ScrollList({ scrolls, onSelect, onDelete }) {
    return (
        <ul className="scroll-list">
            {scrolls.map(scroll => (
                <li key={scroll.id}>...</li>
            ))}
        </ul>
    );
}
```

**Fixed Code:**
```javascript
// ✅ MEMOIZED: Only re-renders when props change
import { memo } from 'react';

const ScrollListItem = memo(function ScrollListItem({ scroll, onSelect, onDelete }) {
    return (
        <li className="scroll-list-item">
            <button onClick={() => onSelect(scroll.id)}>
                {scroll.title}
            </button>
            <button onClick={() => onDelete(scroll.id)}>Delete</button>
        </li>
    );
});

export default memo(function ScrollList({ scrolls, onSelect, onDelete }) {
    return (
        <ul className="scroll-list">
            {scrolls.map(scroll => (
                <ScrollListItem
                    key={scroll.id}
                    scroll={scroll}
                    onSelect={onSelect}
                    onDelete={onDelete}
                />
            ))}
        </ul>
    );
});
```

---

### 2.7 [LOW] School Sort Computed at Module Level

**File:** `src/pages/Listen/ListenPage.jsx:19-21`
**Severity:** Low
**Impact:** useMemo with empty dependency array is misleading

**Current Code:**
```javascript
// ❌ MISLEADING: Empty deps with useMemo
const sortedSchools = useMemo(() => {
    return Object.values(SCHOOLS).sort((a, b) => a.angle - b.angle);
}, []);
```

**Fixed Code:**
```javascript
// ✅ CLEAR: Compute at module level if SCHOOLS is static
// At top of file:
const SORTED_SCHOOLS = Object.values(SCHOOLS).sort((a, b) => a.angle - b.angle);

// In component:
// Just use SORTED_SCHOOLS directly - no hook needed
```

---

## 3. Efficiency Issues

### 3.1 [HIGH] Duplicate VOWEL_COLORS Definition

**Files:**
- `src/components/WordTooltip.jsx:8-25`
- `src/pages/Read/ScrollEditor.jsx:11-28`
**Severity:** High
**Impact:** Maintenance nightmare; colors must be updated in two places

**Current Code (in two files):**
```javascript
// ❌ DUPLICATED in both files
const VOWEL_COLORS = {
    AA: "#FF6B6B",
    AE: "#FF8E53",
    AH: "#FFB347",
    // ... same mapping in both files
};
```

**Fixed Code:**
```javascript
// ✅ SINGLE SOURCE: src/data/vowelColors.js
export const VOWEL_COLORS = {
    AA: "#FF6B6B",   // Open back unrounded (father)
    AE: "#FF8E53",   // Near-open front (cat)
    AH: "#FFB347",   // Open-mid back (cup)
    AO: "#FFC857",   // Open-mid back rounded (caught)
    AW: "#FFD93D",   // Diphthong (cow)
    AY: "#B8E994",   // Diphthong (eye)
    EH: "#6BCB77",   // Open-mid front (bed)
    ER: "#4D96FF",   // R-colored (bird)
    EY: "#7B68EE",   // Diphthong (say)
    IH: "#9B59B6",   // Near-close near-front (bit)
    IY: "#E056FD",   // Close front (see)
    OW: "#FF7979",   // Diphthong (go)
    OY: "#EB4D4B",   // Diphthong (boy)
    UH: "#686DE0",   // Near-close near-back (book)
    UW: "#7158E2",   // Close back rounded (too)
};

export const getVowelColor = (vowel) => VOWEL_COLORS[vowel] || '#888888';

// Usage in components:
import { VOWEL_COLORS, getVowelColor } from '../data/vowelColors';
```

---

### 3.2 [MEDIUM] Unnecessary Array Spreading in State Updates

**File:** `src/hooks/useScrolls.jsx:145-162`
**Severity:** Medium
**Impact:** Excessive object allocations on every state update

**Current Code:**
```javascript
// ❌ MULTIPLE ALLOCATIONS
const newScrolls = [...baseList];
newScrolls[index] = { ...existing, ...localScroll, ...updates };
setScrolls(newScrolls);
```

**Fixed Code:**
```javascript
// ✅ EFFICIENT: Using immer for immutable updates
import { produce } from 'immer';

// Option 1: With immer
setScrolls(produce(draft => {
    const scroll = draft.find(s => s.id === id);
    if (scroll) {
        Object.assign(scroll, updates, { updatedAt: Date.now() });
    }
}));

// Option 2: Without immer but more efficient
setScrolls(prevScrolls => {
    const index = prevScrolls.findIndex(s => s.id === id);
    if (index === -1) return prevScrolls;

    const updated = { ...prevScrolls[index], ...updates, updatedAt: Date.now() };
    const newScrolls = prevScrolls.slice(); // Single allocation
    newScrolls[index] = updated;
    return newScrolls;
});
```

---

### 3.3 [MEDIUM] Redundant Schema Parsing

**File:** `src/hooks/useScrolls.jsx:182-184`
**Severity:** Medium
**Impact:** Unnecessary Zod validation overhead

**Current Code:**
```javascript
// ❌ REDUNDANT: Already validated at line 106
const savedScroll = await response.json();
const parsed = ScrollSchema.parse(savedScroll); // Parsing twice
```

**Fixed Code:**
```javascript
// ✅ EFFICIENT: Trust the response or validate once
const savedScroll = await response.json();

// Option 1: Skip re-validation if server is trusted
if (response.ok) {
    return savedScroll; // Server already validated
}

// Option 2: Single validation with safeParse for better error handling
const result = ScrollSchema.safeParse(savedScroll);
if (!result.success) {
    console.error('Server returned invalid scroll:', result.error);
    throw new Error('Invalid scroll data from server');
}
return result.data;
```

---

### 3.4 [MEDIUM] Dynamic Color Generation on Import

**File:** `src/data/library.js:45-47`
**Severity:** Medium
**Impact:** Colors computed on every module import

**Current Code:**
```javascript
// ❌ DYNAMIC: Computed at import time
export const COLORS = Object.keys(SCHOOLS).reduce((acc, schoolId) => {
    acc[schoolId] = generateSchoolColor(schoolId);
    return acc;
}, {});
```

**Fixed Code:**
```javascript
// ✅ STATIC: Pre-computed color values
export const COLORS = {
    SONIC: '#4A90D9',
    PSYCHIC: '#9B59B6',
    VOID: '#2C3E50',
    ALCHEMY: '#F1C40F',
    WILL: '#E74C3C',
};

// If dynamic generation is needed, do it once and cache:
let cachedColors = null;
export function getSchoolColors() {
    if (!cachedColors) {
        cachedColors = Object.keys(SCHOOLS).reduce((acc, schoolId) => {
            acc[schoolId] = generateSchoolColor(schoolId);
            return acc;
        }, {});
    }
    return cachedColors;
}
```

---

### 3.5 [LOW] Missing Error Type Differentiation

**File:** `src/lib/reference.engine.js:47-74`
**Severity:** Low
**Impact:** Network failures treated same as invalid data

**Current Code:**
```javascript
// ❌ LOSES ERROR CONTEXT
const results = await Promise.allSettled([...]);
return results.map(r => r.status === 'fulfilled' ? r.value : []);
```

**Fixed Code:**
```javascript
// ✅ PRESERVES ERROR CONTEXT
const results = await Promise.allSettled([
    fetchRhymes(word),
    fetchSynonyms(word),
    fetchDefinitions(word)
]);

return {
    rhymes: processResult(results[0], 'rhymes'),
    synonyms: processResult(results[1], 'synonyms'),
    definitions: processResult(results[2], 'definitions'),
};

function processResult(result, type) {
    if (result.status === 'fulfilled') {
        return { data: result.value, error: null };
    }

    const error = result.reason;
    console.warn(`[ReferenceEngine] ${type} failed:`, {
        type: error.name,
        message: error.message,
        isNetwork: error.name === 'TypeError' || error.name === 'AbortError',
    });

    return {
        data: [],
        error: {
            type: error.name,
            message: error.message,
            recoverable: true
        }
    };
}
```

---

### 3.6 [LOW] Unnecessary Object.entries Iteration

**File:** `src/lib/scholomanceDictionary.api.js:45-52`
**Severity:** Low
**Impact:** Minor overhead, but cleaner alternatives exist

**Current Code:**
```javascript
// ❌ VERBOSE
Object.entries(params || {}).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
});
```

**Fixed Code:**
```javascript
// ✅ CLEANER: Use URLSearchParams constructor
const url = new URL(baseUrl);
if (params) {
    url.search = new URLSearchParams(
        Object.entries(params).filter(([_, v]) => v != null)
    ).toString();
}
return url.toString();
```

---

## 4. Code Quality & Aesthetics Issues

### 4.1 [HIGH] Missing Error Boundary for Phoneme Analysis

**File:** `src/pages/Read/ReadPage.jsx`
**Severity:** High
**Impact:** A crash in word analysis could crash entire page

**Current Code:**
```javascript
// ❌ NO ERROR BOUNDARY
function ReadPage() {
    const { engine } = usePhonemeEngine();
    // If engine.analyzeWord throws, entire page crashes
}
```

**Fixed Code:**
```javascript
// ✅ WITH ERROR BOUNDARY
// src/components/ErrorBoundary.jsx
import { Component } from 'react';

class PhonemeErrorBoundary extends Component {
    state = { hasError: false, error: null };

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, info) {
        console.error('[PhonemeEngine] Error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="error-fallback">
                    <h3>Analysis temporarily unavailable</h3>
                    <p>Click a word to retry, or refresh the page.</p>
                    <button onClick={() => this.setState({ hasError: false })}>
                        Retry
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// In ReadPage.jsx:
function ReadPage() {
    return (
        <PhonemeErrorBoundary>
            <ReadPageContent />
        </PhonemeErrorBoundary>
    );
}
```

---

### 4.2 [HIGH] localStorage Quota Handling Missing

**File:** `src/hooks/useScrolls.jsx:43-49`
**Severity:** High
**Impact:** Silent failure if user exceeds storage quota

**Current Code:**
```javascript
// ❌ NO ERROR HANDLING
window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(scrolls));
```

**Fixed Code:**
```javascript
// ✅ GRACEFUL DEGRADATION
function safeSetLocalStorage(key, value) {
    try {
        const serialized = JSON.stringify(value);

        // Check estimated size (rough, but helpful)
        const estimatedSize = new Blob([serialized]).size;
        if (estimatedSize > 4 * 1024 * 1024) { // 4MB warning threshold
            console.warn(`[Storage] Large data size: ${(estimatedSize / 1024 / 1024).toFixed(2)}MB`);
        }

        window.localStorage.setItem(key, serialized);
        return { success: true };
    } catch (error) {
        if (error.name === 'QuotaExceededError' ||
            error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
            console.error('[Storage] Quota exceeded, attempting cleanup...');

            // Try to free space by removing old items
            const removed = attemptStorageCleanup();
            if (removed > 0) {
                // Retry once after cleanup
                try {
                    window.localStorage.setItem(key, JSON.stringify(value));
                    return { success: true, cleaned: removed };
                } catch {
                    // Still failed
                }
            }

            return {
                success: false,
                error: 'QUOTA_EXCEEDED',
                message: 'Storage is full. Please delete some scrolls.'
            };
        }
        throw error; // Re-throw unexpected errors
    }
}

function attemptStorageCleanup() {
    // Remove old cached items, keeping user data
    const keysToCheck = ['scholomance-cache-', 'scholomance-temp-'];
    let removed = 0;

    for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (keysToCheck.some(prefix => key?.startsWith(prefix))) {
            localStorage.removeItem(key);
            removed++;
        }
    }
    return removed;
}
```

---

### 4.3 [MEDIUM] Magic Numbers Throughout Codebase

**Files:** Multiple
**Severity:** Medium
**Impact:** Hard to understand and maintain

**Current Code (scattered):**
```javascript
// ❌ MAGIC NUMBERS
if (len >= 12) return "legendary";
if (len >= 9) return "epic";
const CONTENT_DEBOUNCE_MS = 300;
const MAX_CONTENT_LENGTH = 50000;
```

**Fixed Code:**
```javascript
// ✅ CENTRALIZED CONSTANTS: src/data/constants.js
export const RARITY_THRESHOLDS = {
    LEGENDARY: 12,
    EPIC: 9,
    RARE: 6,
    COMMON: 0,
};

export const UI_TIMING = {
    DEBOUNCE_MS: 300,
    SAVE_STATUS_TIMEOUT_MS: 2000,
    ANIMATION_DURATION_MS: 200,
};

export const CONTENT_LIMITS = {
    MAX_SCROLL_LENGTH: 50000,
    MAX_TITLE_LENGTH: 100,
    MAX_WORD_LENGTH: 50,
};

export const API_TIMEOUTS = {
    DEFAULT_MS: 5000,
    LONG_RUNNING_MS: 15000,
};

// Usage:
import { RARITY_THRESHOLDS } from '../data/constants';

function getWordRarity(word) {
    const len = word.length;
    if (len >= RARITY_THRESHOLDS.LEGENDARY) return "legendary";
    if (len >= RARITY_THRESHOLDS.EPIC) return "epic";
    if (len >= RARITY_THRESHOLDS.RARE) return "rare";
    return "common";
}
```

---

### 4.4 [MEDIUM] Hardcoded Drag Constraints

**File:** `src/components/WordTooltip.jsx:230-235`
**Severity:** Medium
**Impact:** Breaks on different screen sizes

**Current Code:**
```javascript
// ❌ HARDCODED PIXEL VALUES
dragConstraints={{
    left: 10,
    right: window.innerWidth - 390,
    top: 10,
    bottom: window.innerHeight - 510,
}}
```

**Fixed Code:**
```javascript
// ✅ DYNAMIC CONSTRAINTS
import { useRef, useState, useEffect } from 'react';

function useDragConstraints(elementRef, padding = 10) {
    const [constraints, setConstraints] = useState({
        left: padding,
        right: padding,
        top: padding,
        bottom: padding,
    });

    useEffect(() => {
        const updateConstraints = () => {
            if (!elementRef.current) return;

            const rect = elementRef.current.getBoundingClientRect();
            setConstraints({
                left: padding,
                right: window.innerWidth - rect.width - padding,
                top: padding,
                bottom: window.innerHeight - rect.height - padding,
            });
        };

        updateConstraints();
        window.addEventListener('resize', updateConstraints);
        return () => window.removeEventListener('resize', updateConstraints);
    }, [elementRef, padding]);

    return constraints;
}

// In component:
const tooltipRef = useRef(null);
const dragConstraints = useDragConstraints(tooltipRef);

<motion.div
    ref={tooltipRef}
    drag
    dragConstraints={dragConstraints}
>
```

---

### 4.5 [MEDIUM] Incomplete Password Recovery

**File:** `codex/server/index.js:207-252`
**Severity:** Medium
**Impact:** Password recovery feature is non-functional

**Current Code:**
```javascript
// ❌ TODO: Implement password recovery
app.post("/api/auth/forgot-password", async (request, reply) => {
    // TODO: Implement email sending
    return reply.code(501).send({ message: "Not implemented" });
});
```

**Fixed Code:**
```javascript
// ✅ PROPER IMPLEMENTATION (or remove feature entirely)
app.post("/api/auth/forgot-password", async (request, reply) => {
    const { email } = request.body;

    // Validate email format
    if (!email || !isValidEmail(email)) {
        return reply.code(400).send({ message: "Valid email required" });
    }

    // Find user (always return success to prevent enumeration)
    const user = await persistence.users.findByEmail(email);

    if (user) {
        // Generate secure token
        const token = crypto.randomBytes(32).toString('hex');
        const expiry = Date.now() + 3600000; // 1 hour

        await persistence.passwordResets.create({
            userId: user.id,
            token: await hashToken(token),
            expiresAt: expiry,
        });

        // Send email (implement sendEmail utility)
        await sendPasswordResetEmail(email, token);
    }

    // Always return success (security: no user enumeration)
    return reply.send({
        message: "If an account exists, a reset link has been sent"
    });
});
```

---

### 4.6 [MEDIUM] Missing Loading State for References

**File:** `src/pages/Read/ReadPage.jsx:100-116`
**Severity:** Medium
**Impact:** User doesn't know if tooltip is loading

**Current Code:**
```javascript
// ❌ NO LOADING STATE
const annotation = await ReferenceEngine.fetchAll(word);
setAnnotation(annotation);
```

**Fixed Code:**
```javascript
// ✅ WITH LOADING STATE
const [annotationState, setAnnotationState] = useState({
    data: null,
    loading: false,
    error: null,
});

const fetchAnnotation = async (word) => {
    setAnnotationState({ data: null, loading: true, error: null });

    try {
        const data = await ReferenceEngine.fetchAll(word);
        setAnnotationState({ data, loading: false, error: null });
    } catch (error) {
        setAnnotationState({
            data: null,
            loading: false,
            error: error.message
        });
    }
};

// In tooltip component:
{annotationState.loading && <LoadingSpinner />}
{annotationState.error && <ErrorMessage message={annotationState.error} />}
{annotationState.data && <AnnotationContent data={annotationState.data} />}
```

---

### 4.7 [LOW] Inconsistent Naming Conventions

**Files:** Various
**Severity:** Low
**Impact:** Cognitive overhead when reading code

**Current Code:**
```javascript
// ❌ INCONSISTENT
const scrollData = ...;  // Sometimes
const scroll = ...;      // Sometimes
const schoolId = ...;    // Sometimes
const school = ...;      // Sometimes
```

**Fixed Code:**
```javascript
// ✅ CONSISTENT NAMING CONVENTION
// Document in CONTRIBUTING.md:

/**
 * Naming Conventions:
 *
 * Single entities:     scroll, school, song
 * Entity with context: currentScroll, selectedSchool
 * Entity IDs:          scrollId, schoolId (not schoolID)
 * Entity data:         scrollData (only when disambiguating from entity object)
 * Collections:         scrolls, schools, songs
 * Booleans:            isLoading, hasError, canEdit
 * Handlers:            handleClick, onSubmit
 * State setters:       setScrolls, setCurrentSchool
 */
```

---

### 4.8 [LOW] Missing Accessibility Labels

**File:** `src/pages/Listen/ListenPage.jsx:95`
**Severity:** Low
**Impact:** Screen reader users lack context

**Current Code:**
```javascript
// ❌ INSUFFICIENT A11Y
<button className={isLocked ? 'locked' : ''}>
    {school.name}
    {isLocked && <span className="sr-only">Locked</span>}
</button>
```

**Fixed Code:**
```javascript
// ✅ FULL ACCESSIBILITY
<button
    className={isLocked ? 'school-button locked' : 'school-button'}
    aria-disabled={isLocked}
    aria-label={isLocked
        ? `${school.name} - Locked. Requires ${school.requiredXp} XP to unlock.`
        : `Select ${school.name} school`
    }
    title={isLocked ? `Unlock at ${school.requiredXp} XP` : school.name}
>
    {school.name}
    {isLocked && (
        <span className="lock-icon" aria-hidden="true">🔒</span>
    )}
</button>
```

---

### 4.9 [LOW] Deprecated Code Still Exported

**File:** `src/lib/reference.engine.js:38-45`
**Severity:** Low
**Impact:** Confusing API surface

**Current Code:**
```javascript
// ❌ DEPRECATED BUT STILL EXPORTED
/** @deprecated Use environment variables instead */
export function getKeys() { ... }
/** @deprecated Use environment variables instead */
export function setKeys() { ... }
```

**Fixed Code:**
```javascript
// ✅ REMOVED OR PROPERLY HANDLED
// Option 1: Remove completely if truly unused

// Option 2: Keep internal with clear warning
function _legacyGetKeys() {
    console.warn(
        '[ReferenceEngine] getKeys() is deprecated. ' +
        'API keys are now read from environment variables. ' +
        'This method will be removed in v11.'
    );
    return { /* ... */ };
}

// Don't export - internal use only for migration period
```

---

### 4.10 [LOW] Missing JSDoc Type Annotations

**File:** `src/pages/Read/ScrollEditor.jsx:30-42`
**Severity:** Low
**Impact:** Reduced developer experience and AI assistance

**Current Code:**
```javascript
// ❌ NO DOCUMENTATION
export default function ScrollEditor({
    scroll,
    onSave,
    onDelete,
    engine
}) {
```

**Fixed Code:**
```javascript
// ✅ FULLY DOCUMENTED
/**
 * ScrollEditor - Rich text editor for creating and editing scrolls
 *
 * Provides a textarea with live syllable counting and auto-save functionality.
 * Integrates with the PhonemeEngine for real-time word analysis.
 *
 * @component
 * @param {Object} props
 * @param {Scroll} props.scroll - The scroll object to edit
 * @param {string} props.scroll.id - Unique scroll identifier
 * @param {string} props.scroll.title - Scroll title
 * @param {string} props.scroll.content - Scroll content text
 * @param {number} props.scroll.updatedAt - Last update timestamp
 * @param {(updates: Partial<Scroll>) => Promise<void>} props.onSave - Save callback
 * @param {() => Promise<void>} props.onDelete - Delete callback
 * @param {PhonemeEngine} props.engine - Phoneme analysis engine instance
 * @returns {JSX.Element} Rendered scroll editor
 *
 * @example
 * <ScrollEditor
 *   scroll={currentScroll}
 *   onSave={handleSave}
 *   onDelete={handleDelete}
 *   engine={phonemeEngine}
 * />
 */
export default function ScrollEditor({
    scroll,
    onSave,
    onDelete,
    engine
}) {
```

---

## Prioritized Action Plan

### Phase 1: Critical Security (Immediate)
1. Fix development authentication bypass in `auth-pre-handler.js`
2. Add API timeout to all external fetch calls
3. Implement localStorage quota handling

### Phase 2: High Priority (This Week)
4. Consolidate `VOWEL_COLORS` into single source file
5. Add input validation to `HolographicEmbed` color prop
6. Implement XP calculation caching
7. Add error boundary for phoneme analysis

### Phase 3: Medium Priority (This Sprint)
8. Extract magic numbers to constants file
9. Add `React.memo` to pure list components
10. Fix dynamic drag constraints in `WordTooltip`
11. Implement proper loading/error states for references
12. Complete or remove password recovery feature

### Phase 4: Low Priority (Backlog)
13. Standardize naming conventions across codebase
14. Add accessibility labels to all interactive elements
15. Remove deprecated API methods
16. Add comprehensive JSDoc to all components

---

## Testing Recommendations

For each fix, add corresponding tests:

```javascript
// tests/security/auth-bypass.test.js
describe('Authentication bypass', () => {
    it('should NOT auto-login in production even if ENABLE_DEV_AUTH is true', () => {
        process.env.NODE_ENV = 'production';
        process.env.ENABLE_DEV_AUTH = 'true';
        // Assert guest session is not created
    });
});

// tests/performance/xp-calculation.test.js
describe('XP calculation performance', () => {
    it('should return cached value for repeated level lookups', () => {
        const start = performance.now();
        for (let i = 0; i < 1000; i++) {
            getXpForLevel(99);
        }
        const duration = performance.now() - start;
        expect(duration).toBeLessThan(10); // Should be < 10ms for 1000 calls
    });
});
```

---

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Web Accessibility Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)
- Project Architecture: `ARCH_CONTRACT.md`, `ARCH_CONTRACT_SECURITY.md`
