# Scholomance V10 - AI Collaboration Architecture Improvement Plan

## Executive Summary

This plan outlines architectural improvements to make the Scholomance codebase more AI-friendly for collaborative development. The goal is to enhance code clarity, add type safety, improve testing coverage, and establish consistent patterns that enable AI assistants to quickly understand, navigate, and contribute to the codebase effectively.

---

## Current Architecture Analysis

### Strengths (Preserve & Enhance)

| Area | Current State | AI Collaboration Score |
|------|---------------|------------------------|
| **Project Structure** | Clean page-based organization | ⭐⭐⭐⭐ |
| **Component Pattern** | Functional components with hooks | ⭐⭐⭐⭐⭐ |
| **State Management** | React Context + custom hooks | ⭐⭐⭐⭐ |
| **Thematic CSS** | Well-structured design system | ⭐⭐⭐⭐⭐ |
| **Routing** | React Router v6 patterns | ⭐⭐⭐⭐ |

### Areas for AI Collaboration Improvement

| Area | Current State | Issue | Improvement Priority |
|------|---------------|-------|---------------------|
| **Type Safety** | Pure JavaScript | No type inference for AI | 🔴 HIGH |
| **Documentation** | Minimal JSDoc | AI lacks context on functions | 🔴 HIGH |
| **Testing** | Visual E2E only | No unit tests for logic | 🔴 HIGH |
| **Code Patterns** | Inconsistent naming | Hard to predict structure | 🟡 MEDIUM |
| **Error Handling** | Basic try/catch | No error boundaries | 🔴 HIGH |
| **Directory Structure** | Flat hooks/lib | Hard to navigate relationships | 🟡 MEDIUM |
| **Configuration Scattering** | Mixed in code | Hard to find settings | 🟢 LOW |

---

## Phase 1: Type Safety & Documentation Foundation

### 1.1 Add JSDoc Documentation to All Public APIs

Create a documentation pattern that AI can easily parse:

```javascript
/**
 * Analyzes a word for its phonetic properties using the ST-XPD Vowel Family System.
 * 
 * @param {string} word - The word to analyze (case-insensitive)
 * @returns {Object|null} Analysis result containing:
 *   - vowelFamily {string} - The vowel family classification (e.g., "AY", "IY")
 *   - phonemes {string[]} - Array of phoneme components
 *   - coda {string|null} - Consonant cluster at end of word
 *   - rhymeKey {string} - Composite key for rhyming: "{vowelFamily}-{coda}"
 * @example
 *   analyzeWord("night")
 *   // Returns: { vowelFamily: "AY", phonemes: ["N", "AY1", "T"], coda: "T", rhymeKey: "AY-T" }
 * @see PhonemeEngine
 */
analyzeWord(word) {
  // ...
}

/**
 * Provider component that initializes and manages the PhonemeEngine.
 * Must wrap all components using phoneme analysis features.
 * 
 * @param {ReactNode} children - Child components requiring phoneme access
 * @returns {ReactNode} Provider-wrapped children
 * @throws {Error} If used outside of PhonemeEngineProvider context
 * @example
 *   <PhonemeEngineProvider>
 *     <ReadPage />
 *   </PhonemeEngineProvider>
 */
export function PhonemeEngineProvider({ children }) {
  // ...
}
```

### 1.2 Add PropTypes for Component Clarity

```javascript
import PropTypes from 'prop-types';

/**
 * Interactive scroll component that displays text with click-to-analyze functionality.
 * Words are rendered as interactive buttons that trigger phoneme analysis.
 * 
 * @component
 * @param {Object} props
 * @param {string} props.text - The scroll content to display
 * @param {function} [props.onWordClick] - Callback when a word is clicked, receives cleaned word
 * @param {boolean} [props.disabled=false] - Disable word interactions
 * @param {function} [props.onAnalyzeEthereal] - Callback for "analyze all" button
 * @param {boolean} [props.isEngineReady=false] - Engine initialization status
 */
export default function GrimoireScroll({
  text,
  onWordClick,
  disabled = false,
  onAnalyzeEthereal,
  isEngineReady = false,
}) {
  // ...
}

GrimoireScroll.propTypes = {
  text: PropTypes.string.isRequired,
  onWordClick: PropTypes.func,
  disabled: PropTypes.bool,
  onAnalyzeEthereal: PropTypes.func,
  isEngineReady: PropTypes.bool,
};
```

### 1.3 Create TypeScript Definitions (Priority)

For enhanced AI understanding, create declaration files for core data structures and public APIs first:

```typescript
// src/types/index.d.ts

declare module 'scholome-type-system' {
  
  // Phoneme Analysis Types
  interface PhonemeAnalysis {
    vowelFamily: VowelFamily;
    phonemes: string[];
    coda: string | null;
    rhymeKey: string;
  }

  type VowelFamily = 
    | 'A' | 'AE' | 'AO' | 'AW' | 'AY'
    | 'EH' | 'ER' | 'EY'
    | 'IH' | 'IY'
    | 'OH' | 'OW' | 'OY'
    | 'UH' | 'UW';

  // Scroll Data Types
  interface Scroll {
    id: string;
    title: string;
    content: string;
    createdAt: number;
    updatedAt: number;
  }

  // Library Types
  interface SongEntry {
    title: string;
    yt: string;
    sc: string;
    school: School;
  }

  type School = 'SONIC' | 'PSYCHIC' | 'VOID' | 'ALCHEMY' | 'WILL';

  // Context Types
  interface PhonemeEngineContextValue {
    isReady: boolean;
    error: Error | null;
    engine: PhonemeEngine;
  }

  interface SongContextValue {
    currentKey: string;
    currentSong: SongEntry;
    setCurrentKey: (key: string) => void;
    library: Record<string, SongEntry>;
  }

  interface ScrollsContextValue {
    scrolls: Scroll[];
    createScroll: (title: string, content: string) => Scroll;
    updateScroll: (id: string, updates: Partial<Scroll>) => void;
    deleteScroll: (id: string) => void;
    getScrollById: (id: string) => Scroll | null;
    scrollCount: number;
  }
}
```

---

## Phase 2: Testing Infrastructure

### 2.1 Unit Testing Framework Setup

```javascript
// tests/setup.js
import { configure } from '@testing-library/react';
import '@testing-library/jest-dom';

// Configure testing library
configure({
  testIdAttribute: 'data-testid',
});

// Global test utilities for AI reference
global.testUtils = {
  /**
   * Creates a mock scroll object for testing
   * @param {Object} overrides - Properties to override
   * @returns {Scroll} Mock scroll with required fields
   */
  createMockScroll: (overrides = {}) => ({
    id: `scroll-${Date.now()}`,
    title: 'Test Scroll',
    content: 'The quick brown fox',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  }),

  /**
   * Creates a mock phoneme analysis result
   * @param {Object} overrides - Properties to override
   * @returns {PhonemeAnalysis} Mock analysis result
   */
  createMockAnalysis: (overrides = {}) => ({
    vowelFamily: 'AY',
    phonemes: ['N', 'AY1', 'T'],
    coda: 'T',
    rhymeKey: 'AY-T',
    ...overrides,
  }),
};
```

### 2.2 Core Logic Tests

```javascript
// tests/lib/phoneme.engine.test.js
/**
 * PhonemeEngine Test Suite
 * 
 * These tests document the expected behavior of the phoneme analysis system.
 * AI developers can reference these tests to understand edge cases and patterns.
 */

describe('PhonemeEngine', () => {
  describe('analyzeWord', () => {
    /**
     * Test: Simple word analysis
     * Expected: Returns vowel family, phonemes, coda, and rhyme key
     */
    it('analyzes simple words correctly', () => {
      const result = PhonemeEngine.analyzeWord('night');
      expect(result.vowelFamily).toBe('AY');
      expect(result.phonemes).toContain('AY1');
      expect(result.coda).toBe('T');
      expect(result.rhymeKey).toBe('AY-T');
    });

    /**
     * Test: Words without vowels
     * Expected: Returns fallback family 'UH'
     */
    it('handles words without vowels', () => {
      const result = PhonemeEngine.analyzeWord('brr');
      expect(result.vowelFamily).toBe('UH');
      expect(result.coda).toBeNull();
    });

    /**
     * Test: Empty or null input
     * Expected: Returns null
     */
    it('returns null for empty input', () => {
      expect(PhonemeEngine.analyzeWord('')).toBeNull();
      expect(PhonemeEngine.analyzeWord(null)).toBeNull();
      expect(PhonemeEngine.analyzeWord(undefined)).toBeNull();
    });

    /**
     * Test: Case insensitivity
     * Expected: Handles uppercase and lowercase identically
     */
    it('is case-insensitive', () => {
      const upper = PhonemeEngine.analyzeWord('HELLO');
      const lower = PhonemeEngine.analyzeWord('hello');
      expect(upper.rhymeKey).toBe(lower.rhymeKey);
    });

    /**
     * Test: Caching behavior
     * Expected: Repeated calls return cached result
     */
    it('caches analyzed words', () => {
      const first = PhonemeEngine.analyzeWord('test');
      const second = PhonemeEngine.analyzeWord('test');
      expect(first).toBe(second); // Same reference
    });
  });

  describe('guessVowelFamily', () => {
    /**
     * Test: Digraph handling
     * Expected: Recognizes common vowel digraphs
     */
    it('recognizes vowel digraphs', () => {
      expect(PhonemeEngine.guessVowelFamily('AI')).toBe('AY');
      expect(PhonemeEngine.guessVowelFamily('EE')).toBe('IY');
      expect(PhonemeEngine.guessVowelFamily('OO')).toBe('UW');
    });
  });
});
```

### 2.3 Hook Tests

```javascript
// tests/hooks/useScrolls.test.js
/**
 * useScrolls Hook Test Suite
 * 
 * Documents the expected behavior of scroll CRUD operations.
 * Key patterns: localStorage persistence, sorting, ID generation.
 */

import { renderHook, act } from '@testing-library/react';
import { useScrolls } from '../../src/hooks/useScrolls';

describe('useScrolls', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  /**
   * Test: Initial state
   * Expected: Returns empty array when no scrolls exist
   */
  it('returns empty array initially', () => {
    const { result } = renderHook(() => useScrolls());
    expect(result.current.scrolls).toEqual([]);
    expect(result.current.scrollCount).toBe(0);
  });

  /**
   * Test: Create scroll
   * Expected: Adds new scroll with generated ID and timestamp
   */
  it('creates a new scroll', () => {
    const { result } = renderHook(() => useScrolls());
    
    act(() => {
      result.current.createScroll('Test Title', 'Test Content');
    });

    expect(result.current.scrolls).toHaveLength(1);
    expect(result.current.scrolls[0].title).toBe('Test Title');
    expect(result.current.scrolls[0].id).toMatch(/^scroll-\d+-[\w]{7}$/);
  });

  /**
   * Test: Sorting by updatedAt
   * Expected: Scrolls are sorted with most recently updated first
   */
  it('sorts scrolls by updated timestamp', () => {
    const { result } = renderHook(() => useScrolls());
    
    act(() => {
      result.current.createScroll('First', 'content1');
    });
    
    // Force timestamp difference
    jest.advanceTimersByTime(100);
    
    act(() => {
      result.current.createScroll('Second', 'content2');
    });

    expect(result.current.scrolls[0].title).toBe('Second');
    expect(result.current.scrolls[1].title).toBe('First');
  });

  /**
   * Test: Delete scroll
   * Expected: Removes scroll by ID
   */
  it('deletes a scroll by ID', () => {
    const { result } = renderHook(() => useScrolls());
    
    const newScroll = act(() => {
      return result.current.createScroll('To Delete', 'content');
    });

    act(() => {
      result.current.deleteScroll(newScroll.id);
    });

    expect(result.current.getScrollById(newScroll.id)).toBeNull();
  });
});
```

### 2.4 Component Tests

```javascript
// tests/components/AnnotationPanel.test.js
/**
 * AnnotationPanel Component Test Suite
 * 
 * Documents the behavior of the word analysis side panel.
 * Tests: rendering, styling, interaction callbacks.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import AnnotationPanel from '../../src/pages/Read/AnnotationPanel';
import { motion } from 'framer-motion';

// Mock framer-motion for testing
jest.mock('framer-motion', () => ({
  motion: {
    aside: ({ children, ...props }) => <aside {...props}>{children}</aside>,
  },
}));

describe('AnnotationPanel', () => {
  const mockAnnotation = {
    word: 'NIGHT',
    vowelFamily: 'AY',
    phonemes: ['N', 'AY1', 'T'],
    coda: 'T',
    rhymeKey: 'AY-T',
  };

  const defaultProps = {
    annotation: mockAnnotation,
    onClose: jest.fn(),
  };

  /**
   * Test: Renders annotation data
   * Expected: Displays word, vowel family, phonemes, and rhyme key
   */
  it('displays all annotation data', () => {
    render(<AnnotationPanel {...defaultProps} />);
    
    expect(screen.getByText('NIGHT')).toBeInTheDocument();
    expect(screen.getByText('AY')).toBeInTheDocument();
    expect(screen.getByText('AY-T')).toBeInTheDocument();
    expect(screen.getByText('T')).toBeInTheDocument(); // coda
  });

  /**
   * Test: Phoneme chips
   * Expected: Each phoneme rendered as a chip element
   */
  it('renders phonemes as individual chips', () => {
    render(<AnnotationPanel {...defaultProps} />);
    
    const chips = screen.getAllByTestId('phoneme-chip');
    expect(chips).toHaveLength(3);
    expect(chips[0]).toHaveTextContent('N');
    expect(chips[1]).toHaveTextContent('AY1');
    expect(chips[2]).toHaveTextContent('T');
  });

  /**
   * Test: Close button
   * Expected: Calls onClose when clicked
   */
  it('calls onClose when close button is clicked', () => {
    render(<AnnotationPanel {...defaultProps} />);
    
    const closeButton = screen.getByRole('button', { name: /close/i });
    fireEvent.click(closeButton);
    
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  /**
   * Test: Null coda handling
   * Expected: Does not render coda section if coda is null
   */
  it('handles null coda gracefully', () => {
    const noCodaAnnotation = { ...mockAnnotation, coda: null, rhymeKey: 'AY-open' };
    render(<AnnotationPanel annotation={noCodaAnnotation} onClose={jest.fn()} />);
    
    // Should not show coda in stats
    const stats = screen.queryByText('Coda');
    expect(stats).not.toBeInTheDocument();
  });
});
```

---

### 1.4 Standardized Error Handling Pattern

Define a consistent error strategy across UI, hooks, and async utilities. Keep it lightweight but predictable:

```javascript
// src/lib/errors.js
/**
 * Normalize unknown errors into a consistent shape.
 * @param {unknown} err
 * @param {string} [context]
 * @returns {{ message: string, code: string, context?: string, cause?: unknown }}
 */
export function normalizeError(err, context) {
  if (err instanceof Error) {
    return {
      message: err.message,
      code: err.name || "ERROR",
      context,
      cause: err,
    };
  }
  if (typeof err === "string") {
    return { message: err, code: "ERROR", context };
  }
  return { message: "Unknown error", code: "UNKNOWN", context, cause: err };
}
```

```javascript
// Example in hooks/async flows
import { normalizeError } from "../lib/errors";

try {
  const data = await apiCall();
  setState({ status: "success", data, error: null });
} catch (err) {
  const normalized = normalizeError(err, "useScrolls.createScroll");
  setState({ status: "error", data: null, error: normalized });
  console.error(normalized);
}
```

```javascript
// Example error boundary
class AppErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error(normalizeError(error, "AppErrorBoundary"), info);
  }
  render() {
    if (this.state.error) return <FallbackUI />;
    return this.props.children;
  }
}
```

---

## Phase 3: Code Organization & Patterns

### 3.1 Standardized Component Template

```javascript
// templates/component.jsx
/**
 * [ComponentName] - Brief description of component purpose
 * 
 * [Thematic context: how this fits the Scholomance theme]
 * 
 * @component
 * @example
 * <[ComponentName]
 *   prop1={value1}
 *   prop2={value2}
 * />
 */

// External dependencies
import { useState, useCallback } from 'react';
import PropTypes from 'prop-types';
import { motion } from 'framer-motion';

// Internal dependencies
import { useContext } from '../hooks/useContext';
import { helper } from '../lib/helpers';

/**
 * [ComponentName] - Main component function
 * 
 * @param {Object} props - Component props
 * @param {Type} props.requiredProp - Description of required prop
 * @param {Type} [props.optionalProp=default] - Description of optional prop
 * @returns {JSX.Element} Rendered component
 */
export default function ComponentName({ requiredProp, optionalProp = 'default' }) {
  // State
  const [state, setState] = useState(initialValue);

  // Callbacks
  const handleAction = useCallback(() => {
    // Implementation
  }, [dependencies]);

  // Derived values
  const derivedValue = useMemo(() => {
    // Computation
  }, [dependencies]);

  // Render
  return (
    <motion.div
      className="component-classname"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Content */}
    </motion.div>
  );
}

ComponentName.propTypes = {
  requiredProp: PropTypes.string.isRequired,
  optionalProp: PropTypes.bool,
};

ComponentName.defaultProps = {
  optionalProp: true,
};

// Named exports for testing
export { ComponentName };
```

### 3.2 Standardized Hook Template

```javascript
// templates/hook.jsx
/**
 * use[HookName] - Brief description of hook purpose
 * 
 * Manages [specific functionality] in a reusable way.
 * 
 * @hook
 * @returns {Object} Hook interface containing:
 *   - state: Current state value
 *   - setState: Function to update state
 *   - helper: Additional utility function
 * @example
 * const { state, setState, helper } = useMyHook(initialValue);
 */

// External dependencies
import { useState, useCallback, useMemo } from 'react';

/**
 * Main hook function
 * 
 * @param {Type} initialValue - Initial state value
 * @returns {Object} Hook interface
 */
export function useHookName(initialValue) {
  // State initialization
  const [state, setState] = useState(initialValue);

  // Computed values
  const derived = useMemo(() => {
    // Computation based on state
    return state.transformed;
  }, [state]);

  // Callback with dependencies
  const action = useCallback((param) => {
    // Implementation
    setState(newState);
  }, [dependencies]);

  // Return public interface
  return {
    state,
    setState,
    derived,
    action,
  };
}
```

### 3.3 Consistent Naming Conventions

```markdown
## Naming Conventions for AI Reference

### Components
- PascalCase: `GrimoireScroll`, `AnnotationPanel`
- CSS class prefix: `.grimoire-*`, `.scroll-*`
- File name: `ComponentName.jsx`

### Hooks
- camelCase with "use" prefix: `useScrolls`, `usePhonemeEngine`
- File name: `useHookName.jsx`

### Utilities
- camelCase: `analyzeWord`, `schoolToBadgeClass`
- File name: `utilityName.js`

### Context Providers
- PascalCase with "Provider" suffix: `SongProvider`
- Hook same name without suffix: `useSong()`

### CSS Classes
- BEM-like with theme prefix:
  - `.componentName`
  - `.componentName--modifier`
  - `.componentName__element`
  - `.theme-specific-class`

### Constants
- SCREAMING_SNAKE_CASE for config: `VOWEL_FAMILIES`, `LINKS`
- camelCase for data objects: `currentSong`, `scrolls`

### File Organization
```
src/
├── components/     # UI components
├── hooks/          # Custom React hooks
├── lib/            # Pure utility functions
├── pages/          # Route components
├── data/           # Static data
├── types/          # TypeScript definitions
└── templates/      # Code templates
```

### State Variable Patterns
```
const [entity, setEntity]        // Single item
const [entities, setEntities]    // Array of items
const [isValid, setValid]        // Boolean state
const [hasLoaded, setLoaded]     // Async state flags
```

### Callback Patterns
```
const handleX       // User action handler
const onX           // Prop callback receiver
const processX      // Data processing function
const getX          // Value retrieval function
const setX          // Value setter (state)
```
```

---

## Phase 4: Documentation & AI Context

### 4.1 Comprehensive README

```markdown
# Scholomance V10

A thematic React application for phoneme analysis and music/school frequency management.

## Quick Start

```bash
npm install
npm run dev
```

## Architecture Overview

```
src/
├── App.jsx              # Root component, providers wrapper
├── main.jsx             # Entry point
├── index.css            # Global styles & CSS variables
├── components/          # Reusable UI components
│   └── Navigation/     # Main navigation
├── hooks/               # Custom React hooks
│   ├── useCurrentSong.jsx  # Current song/state management
│   ├── usePhonemeEngine.jsx # Phoneme analysis engine provider
│   └── useScrolls.jsx      # Scroll CRUD operations
├── lib/                 # Pure utility functions
│   └── phoneme.engine.js  # Phoneme analysis logic
├── pages/               # Route components
│   ├── Watch/          # YouTube embed & CRT interface
│   ├── Listen/         # Radio frequency tuner
│   └── Read/           # Scroll editor & analyzer
└── data/               # Static data
    └── library.js      # Song library & school data
```

## Key Concepts

### Phoneme Analysis (ST-XPD System)
- **Vowel Families**: AY, IY, OW, etc. (16 total)
- **Rhyme Key**: `{vowelFamily}-{coda}` format
- **Flow**: User clicks word → `analyzeWord()` → Display in `AnnotationPanel`

### Schools & Frequencies
- SONIC (288°), PSYCHIC (72°), ALCHEMY (144°), WILL (216°), VOID (0°)
- Each school has a color, badge style, and frequency display

### Scroll Management
- LocalStorage persistence via `useScrolls` hook
- CRUD operations: create, read, update, delete
- Auto-sorted by `updatedAt` timestamp

## Adding New Features

### New Page
1. Create `src/pages/NewPage/NewPage.jsx`
2. Add route in `App.jsx`
3. Add navigation link in `src/data/library.js`
4. Add styles in `src/pages/NewPage/NewPage.css`

### New Hook
1. Create `src/hooks/useNewFeature.jsx`
2. Follow pattern: `useX()` returns `{ data, actions }`
3. Add provider if global state needed
4. Document with JSDoc

### New Component
1. Create `src/components/Name/Name.jsx`
2. Add PropTypes for AI clarity
3. Use `motion.div` for animations
4. Follow BEM naming: `.component-name__element`

## Testing

```bash
npm run test          # Run all tests
npm run test:unit     # Unit tests only
npm run test:e2e      # End-to-end tests
npm run test:visual   # Visual regression tests
```

## Environment Variables

```env
VITE_SCHOOL_DEFAULT=SONIC
VITE_ANIMATION_DURATION=0.3
```

## See Also
- [ARCH_CONTRACT.md](ARCH_CONTRACT.md) - Architectural principles
- [CONTRIBUTING.md](CONTRIBUTING.md) - Development guidelines
```

### 4.2 Contributing Guide

```markdown
# Contributing to Scholomance

## Development Philosophy

### Code Style
- **Functional components only** - No class components
- **Hooks for state** - `useState`, `useEffect`, `useCallback`
- **Context for global state** - Providers wrap App
- **Pure functions in lib/** - No side effects

### AI-Friendly Code
1. **Document functions** with JSDoc
2. **Type props** with PropTypes
3. **Test edge cases** - AI uses tests to understand behavior
4. **Use consistent naming** - Predictable patterns help AI

### What to Avoid
- ❌ Undocumented "magic" values
- ❌ Inline styles (use CSS classes)
- ❌ Complex nested conditionals
- ❌ State in components without hooks

## Common Tasks

### Adding a New School
1. Add to `LIBRARY` in `src/data/library.js`
2. Add color in `src/index.css` (`--school-name`)
3. Add angle in `SCHOOL_ANGLES`
4. Add badge style in `schoolToBadgeClass()`

### Modifying Phoneme Analysis
1. Edit `src/lib/phoneme.engine.js`
2. Update dictionary in `public/phoneme_dictionary_v2.json`
3. Update tests in `tests/lib/phoneme.engine.test.js`
4. Update JSDoc comments

### Theming Changes
1. Update CSS variables in `src/index.css`
2. Update component CSS files
3. Update `ARCH_CONTRACT.md` if patterns change

## Review Checklist

- [ ] JSDoc on all exported functions
- [ ] PropTypes on all components
- [ ] Unit tests for new logic
- [ ] Consistent naming conventions
- [ ] No inline styles
- [ ] Pure functions in lib/
- [ ] Documentation updated
```

### 4.3 Architecture Contract (Enhanced)

```markdown
# ARCH_CONTRACT.md (Enhanced)

## Core Principles

### 1. Semantic Surfaces + Data-Role Hooks
Components expose semantic props. Hooks provide data-role interface.

```javascript
// ✅ Good - Semantic props
<ScrollList onSelect={handleSelect} scrolls={scrolls} />

// ❌ Bad - Implementation details leaking
<ScrollList internalState={state} callbackA={fn} />
```

### 2. State is Classes + Event Bus
Complex state uses classes. Simple state uses hooks.

```javascript
// ✅ Good - Hook for simple state
const { scrolls, createScroll } = useScrolls();

// ✅ Good - Class for complex state
class AudioController {
  play() { /* ... */ }
  pause() { /* ... */ }
}
```

### 3. No Cross-Calling UI Modules
UI modules don't import each other. Data flows through hooks/context.

```javascript
// ❌ Bad - UI module calling UI module
import { RadioPlayer } from './Radio';
import { ScrollViewer } from './Scroll';
// Don't do this
```

### 4. Pure Analysis vs Effects
Analysis never touches DOM/GSAP/Audio.

```javascript
// ✅ Good - Pure analysis
const result = analyzeWord(word);

// ❌ Bad - Analysis touching UI
const result = analyzeWord(word);
document.getElementById('output').innerHTML = result;
```

## AI Collaboration Standards

### Documentation Requirements
1. Every exported function has JSDoc
2. Every component has PropTypes
3. Every hook has documented return shape
4. Complex logic has inline comments

### Testing Requirements
1. Pure functions tested in `tests/lib/`
2. Hooks tested in `tests/hooks/`
3. Components tested in `tests/components/`
4. Edge cases documented in tests

### Pattern Consistency
1. Components: `PascalCase` files, default exports
2. Hooks: `useCamelCase` files, named exports
3. Utilities: `camelCase` files, named exports
4. Constants: `SCREAMING_SNAKE_CASE`

## Directory Structure

```
src/
├── App.jsx              # Root (providers only)
├── main.jsx             # Entry (no logic)
├── index.css            # Variables (no selectors)
├── components/          # UI modules only
│   └── [Module]/
│       ├── [Module].jsx
│       └── [Module].css
├── hooks/               # State/logic only
│   └── use[Feature].jsx
├── lib/                 # Pure functions only
│   └── [utility].js
├── pages/               # Routes (combines components)
│   └── [Page]/
│       ├── [Page]Page.jsx
│       └── [Page]Page.css
└── data/                # Static data only
    └── library.js
```

## Anti-Patterns to Avoid

| Anti-Pattern | Instead |
|--------------|---------|
| Inline styles | CSS classes with theme vars |
| Magic numbers | Named constants |
| Deep conditionals | Early returns + guard clauses |
| State in render | useMemo / useCallback |
| Missing PropTypes | PropTypes or TypeScript |
| Undocumented APIs | JSDoc comments |
| Direct DOM manipulation | React refs |
| Side effects in pure code | Separate effects from logic |
```

---

## Phase 5: Configuration & Tooling

### 5.1 Enhanced ESLint Config

```javascript
// .eslintrc.json (enhanced)
{
  "root": true,
  "env": {
    "browser": true,
    "es2020": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended"
  ],
  "ignorePatterns": ["dist", "node_modules", "*.min.js"],
  "parserOptions": {
    "ecmaVersion": "latest",
    "sourceType": "module"
  },
  "settings": {
    "react": {
      "version": "18.2"
    }
  },
  "rules": {
    "react/prop-types": "warn",
    "no-unused-vars": ["warn", { 
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    // AI-friendly rules
    "jsdoc/require-jsdoc": ["warn", {
      "require": {
        "FunctionDeclaration": true,
        "FunctionExpression": true,
        "ArrowFunctionExpression": true,
        "MethodDefinition": true
      }
    }],
    "react/display-name": ["warn"],
    "react/no-unknown-property": ["error"]
  },
  "plugins": ["jsdoc"]
}
```

### 5.2 VSCode Settings for AI

```json
// .vscode/settings.json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "eslint.validate": ["javascript", "javascriptreact"],
  "files.associations": {
    "*.jsx": "javascriptreact",
    "*.js": "javascript"
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true
  },
  "editor.guides.indentation": true,
  "editor.bracketPairColorization.enabled": true
}
```

### 5.3 Git Ignore for AI Context

```gitignore
# Dependencies
node_modules/

# Build
dist/
build/
*.打包

# IDE
.vscode/settings.json
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/
test-results/
playwright-report/

# Env (don't commit keys!)
.env
.env.local
.env.*.local

# Logs
*.log
npm-debug.log*

# Temporary
*.tmp
*.temp
.cache/
```

---

## Implementation Roadmap

### Week 1: Foundation
- [ ] Add JSDoc to all exported functions
- [ ] Add PropTypes to all components
- [ ] Setup testing library (Jest + React Testing Library)
- [ ] Create component templates

### Week 2: Testing
- [ ] Write unit tests for `phoneme.engine.js`
- [ ] Write unit tests for `useScrolls` hook
- [ ] Write unit tests for `usePhonemeEngine` hook
- [ ] Write component tests for key components

### Week 3: Documentation
- [ ] Update README with architecture overview
- [ ] Create CONTRIBUTING.md
- [ ] Enhance ARCH_CONTRACT.md with AI standards
- [ ] Add type definitions file

### Week 4: Polish
- [ ] Enhanced ESLint config with jsdoc plugin
- [ ] VSCode settings for consistency
- [ ] Code organization review
- [ ] Pattern audit and consistency fixes

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| JSDoc Coverage | >95% of functions | ESLint jsdoc plugin |
| PropTypes Coverage | 100% of components | Custom script |
| Unit Test Coverage | >80% of lib/ and hooks/ | Jest coverage |
| Naming Consistency | 0 violations | Custom ESLint rule |
| Documentation Age | <30 days | Last updated metadata |

---

## Conclusion

This architecture improvement plan focuses on making the Scholomance codebase more AI-collaboration-friendly through:

1. **Type Safety** - PropTypes and type definitions
2. **Documentation** - Comprehensive JSDoc on all public APIs
3. **Testing** - Unit tests documenting expected behavior
4. **Consistency** - Standardized patterns and naming
5. **Structure** - Clear directory organization

These changes enable AI assistants to:
- Understand function purpose and behavior
- Navigate the codebase efficiently
- Make predictions about code structure
- Write consistent, compliant code
- Identify edge cases from tests

The improvements are backward-compatible and follow incremental implementation.
