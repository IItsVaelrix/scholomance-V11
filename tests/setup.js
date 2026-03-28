import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock framer-motion to prevent infinite requestAnimationFrame loops in tests.
// motion.div/span/etc render as plain HTML elements; AnimatePresence passes children through.
const motionComponentCache = {};
const motionHandler = {
  get(_target, prop) {
    if (!motionComponentCache[prop]) {
      const Comp = React.forwardRef(function MotionStub(props, ref) {
        const { initial: _i, animate: _a, exit: _e, transition: _t, variants: _v,
          whileHover: _wh, whileTap: _wt, whileFocus: _wf, whileInView: _wiv,
          whileDrag: _wd, layout: _l, layoutId: _lid, onAnimationStart: _oas,
          onAnimationComplete: _oac, drag: _d, dragConstraints: _dc,
          dragElastic: _de, dragMomentum: _dm, ...rest } = props;
        return React.createElement(prop, { ...rest, ref });
      });
      Comp.displayName = `motion.${String(prop)}`;
      motionComponentCache[prop] = Comp;
    }
    return motionComponentCache[prop];
  },
};

vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    AnimatePresence: ({ children }) => children,
    motion: new Proxy({}, motionHandler),
  };
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock scrollIntoView
if (typeof window !== 'undefined' && window.HTMLElement) {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
}

// Mock matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// Mock requestAnimationFrame
global.requestAnimationFrame = vi.fn().mockImplementation((cb) => {
  return setTimeout(() => cb(Date.now()), 0);
});
global.cancelAnimationFrame = vi.fn().mockImplementation((id) => {
  clearTimeout(id);
});

// Mock Canvas for getCursorCoordsFromTextarea
if (typeof document !== 'undefined') {
  const mockCanvas = {
    getContext: vi.fn().mockReturnValue({
      measureText: vi.fn().mockReturnValue({ width: 10 }),
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
    }),
  };
  global.HTMLCanvasElement.prototype.getContext = mockCanvas.getContext;
}

// Robust Fetch Mock
const _originalFetch = global.fetch;
global.fetch = vi.fn().mockImplementation((url) => {
  const href = String(url);
  
  // Default responses for common initialization calls
  if (href.endsWith('corpus.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({
        version: 2,
        dictionary: ['ritual', 'magic', 'scroll', 'ancient'],
        sequences: [
          ['ancient', 'ritual', 4],
          ['ritual', 'magic', 3],
          ['magic', 'scroll', 2],
        ],
      }),
    });
  }
  
  if (href.endsWith('phoneme_dictionary_v2.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ vowel_families: [] }),
    });
  }

  if (href.endsWith('rhyme_matching_rules_v2.json')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({}),
    });
  }

  if (href.includes('/api/progression')) {
    return Promise.resolve({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ xp: 0, unlockedSchools: ['SONIC'] }),
    });
  }

  if (href.includes('/auth/me')) {
    return Promise.resolve({
      ok: false,
      status: 401,
      json: () => Promise.resolve({ message: 'Not authenticated' }),
    });
  }

  if (href.includes('/auth/csrf-token')) {
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ token: 'mock-csrf-token' }),
    });
  }

  // Generic fallback
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  });
});
