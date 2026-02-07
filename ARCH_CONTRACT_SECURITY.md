# ARCH_CONTRACT_SECURITY.md

## Code Sanitization & Security Practices

This document establishes mandatory security practices for the Scholomance V10 codebase. All code must comply with these sanitization standards.

---

## 1. Input Validation

### 1.1 Allow-List Principle

**Rule**: Define what is allowed, not what is forbidden.

```javascript
// ❌ BAD: Deny-list approach (vulnerable to bypass)
function validateInput(input) {
  const forbidden = ['<script>', 'javascript:', 'onerror=', 'onload='];
  return !forbidden.some(char => input.toLowerCase().includes(char));
}

// ✅ GOOD: Allow-list approach
function validateWordInput(input) {
  // Only allow letters, apostrophes, and spaces
  const allowed = /^[A-Za-z\s']+$/;
  return allowed.test(input.trim());
}

function validateScrollTitle(input) {
  // Allow alphanumeric, spaces, basic punctuation
  const allowed = /^[A-Za-z0-9\s\-_.:,!?'"()]+$/;
  return allowed.test(input) && input.length <= 100;
}
```

### 1.2 Type Validation

```javascript
// src/lib/validation.js

/**
 * Validates that a value is a non-empty string
 * @param {unknown} value - Value to validate
 * @returns {string} Validated string or throws
 */
export function validateString(value) {
  if (typeof value !== 'string') {
    throw new TypeError(`Expected string, got ${typeof value}`);
  }
  return value.trim();
}

/**
 * Validates string length constraints
 * @param {string} value - String to validate
 * @param {number} min - Minimum length
 * @param {number} max - Maximum length
 * @returns {string} Validated string
 */
export function validateLength(value, min = 0, max = 10000) {
  const trimmed = validateString(value);
  if (trimmed.length < min) {
    throw new RangeError(`String must be at least ${min} characters`);
  }
  if (trimmed.length > max) {
    throw new RangeError(`String must not exceed ${max} characters`);
  }
  return trimmed;
}

/**
 * Validates scroll data structure
 * @param {unknown} data - Data to validate
 * @returns {Scroll} Validated scroll object
 */
export function validateScrollData(data) {
  if (typeof data !== 'object' || data === null) {
    throw new TypeError('Scroll must be an object');
  }
  
  const scroll = data;
  
  if (typeof scroll.id !== 'string') {
    throw new TypeError('Scroll id must be a string');
  }
  
  if (!scroll.id.match(/^scroll-\d+-[\w]{7}$/)) {
    throw new RangeError('Invalid scroll id format');
  }
  
  scroll.title = validateLength(scroll.title, 0, 100);
  scroll.content = validateLength(scroll.content, 0, 50000);
  
  if (typeof scroll.createdAt !== 'number') {
    throw new TypeError('Scroll createdAt must be a number');
  }
  
  if (typeof scroll.updatedAt !== 'number') {
    throw new TypeError('Scroll updatedAt must be a number');
  }
  
  return scroll;
}
```

### 1.3 Numeric Validation

```javascript
/**
 * Validates and sanitizes numeric input
 * @param {unknown} value - Value to validate
 * @param {number} min - Minimum allowed value
 * @param {number} max - Maximum allowed value
 * @returns {number} Sanitized numeric value
 */
export function validateNumber(value, min = 0, max = Infinity) {
  const num = Number(value);
  
  if (!Number.isFinite(num)) {
    throw new RangeError('Value must be a finite number');
  }
  
  if (num < min || num > max) {
    throw new RangeError(`Value must be between ${min} and ${max}`);
  }
  
  return num;
}

/**
 * Validates XP values (0 to reasonable maximum)
 */
export function validateXP(value) {
  return validateNumber(value, 0, 1000000000);
}

/**
 * Validates array with element validation
 * @param {unknown} array - Array to validate
 * @param {Function} validator - Function to validate each element
 * @param {number} maxLength - Maximum array length
 * @returns {Array} Validated array
 */
export function validateArray(array, validator, maxLength = 1000) {
  if (!Array.isArray(array)) {
    throw new TypeError('Expected an array');
  }
  
  if (array.length > maxLength) {
    throw new RangeError(`Array exceeds maximum length of ${maxLength}`);
  }
  
  return array.map((item, index) => {
    try {
      return validator(item);
    } catch (error) {
      throw new Error(`Invalid item at index ${index}: ${error.message}`);
    }
  });
}
```

---

## 2. Output Encoding & Escaping

### 2.1 HTML Entity Encoding

```javascript
// src/lib/escape.js

/**
 * HTML entity encoding for XSS prevention
 * Must be used when rendering user-provided content in HTML context
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  const htmlEscapes = {
    '&': '&amp;',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
  };
  
  return str.replace(/[&<>"'`=/]/g, (char) => htmlEscapes[char]);
}

/**
 * Escapes HTML but preserves line breaks
 * @param {string} str - String to escape
 * @returns {string} Escaped string with <br> for newlines
 */
export function escapeHTMLPreserveBreaks(str) {
  const escaped = escapeHTML(str);
  return escaped.replace(/\n/g, '<br>');
}

/**
 * Escapes attribute values
 * @param {string} str - String to escape
 * @returns {string} Escaped for HTML attribute context
 */
export function escapeAttribute(str) {
  if (typeof str !== 'string') {
    return '';
  }
  
  // Attribute context requires stricter escaping
  const attrEscapes = {
    '&': '&amp;',
    '<': '<',
    '>': '>',
    '"': '"',
    "'": '&#x27;',
    '/': '&#x2F;',
    '`': '&#x60;',
    '=': '&#x3D;',
    '\n': '&#10;',
    '\r': '&#13;',
    '\t': '&#9;',
  };
  
  return str.replace(/[&<>"'`=/\n\r\t]/g, (char) => attrEscapes[char]);
}

/**
 * Escapes for JavaScript context (JSON-like)
 * @param {unknown} value - Value to escape
 * @returns {string} JavaScript-safe string
 */
export function escapeJS(value) {
  if (value === null || value === undefined) {
    return 'null';
  }
  
  if (typeof value === 'string') {
    return JSON.stringify(value); // Properly escapes
  }
  
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  
  if (Array.isArray(value)) {
    return `[${value.map(escapeJS).join(',')}]`;
  }
  
  if (typeof value === 'object') {
    const pairs = Object.entries(value).map(
      ([k, v]) => `${escapeJS(k)}:${escapeJS(v)}`
    );
    return `{${pairs.join(',')}}`;
  }
  
  return 'undefined';
}
```

### 2.2 CSS Escaping

```javascript
/**
 * Escapes user input for use in CSS selectors
 * @param {string} input - User input
 * @returns {string} Escaped for CSS context
 */
export function escapeCSSSelector(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // CSS identifier characters that need escaping
  const cssEscapes = {
    '\\': '\\\\',
    '"': '\\"',
    "'": "\\'",
    '\n': '\\A ',
    '\r': '\\D ',
    '\f': '\\C ',
    '\t': '\\9 ',
    '>': '\\3E ',
    '<': '\\3C ',
    '&': '\\26 ',
    '|': '\\7C ',
    '^': '\\5E ',
    '~': '\\7E ',
    '*': '\\2A ',
    '!': '\\21 ',
    '+': '\\2B ',
    '(': '\\28 ',
    ')': '\\29 ',
    '{': '\\7B ',
    '}': '\\7D ',
    '[': '\\5B ',
    ']': '\\5D ',
    '?': '\\3F ',
    '/': '\\2F ',
    ';': '\\3B ',
    ':': '\\3A ',
    '@': '\\40 ',
    '#': '\\23 ',
  };
  
  return input.replace(/["'\n\r\f\t><&|^*!+(){}[\]?/;:@#]/g, (char) => cssEscapes[char]);
}

/**
 * Escapes user input for inline style values
 * @param {string} input - User input
 * @returns {string} Sanitized for CSS style context
 */
export function escapeStyleValue(input) {
  if (typeof input !== 'string') {
    return '';
  }
  
  // Remove potentially dangerous characters and patterns
  const sanitized = input
    .replace(/[<>{}]/g, '') // Remove brackets and braces
    .replace(/expression\s*\(/gi, '') // Remove expression()
    .replace(/url\s*\(/gi, '') // Remove url(
    .replace(/@import/gi, '') // Remove @import
    .replace(/javascript:/gi, '') // Remove javascript:
    .replace(/behavior\s*:/gi, '') // Remove behavior
    .replace(/-moz-binding/gi, ''); // Remove -moz-binding
  
  return sanitized;
}
```

### 2.3 URL Encoding

```javascript
/**
 * Sanitizes URL components
 * @param {string} url - URL to sanitize
 * @returns {string} Sanitized URL or empty string
 */
export function sanitizeURL(url) {
  if (typeof url !== 'string') {
    return '';
  }
  
  // Remove dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'about:',
  ];
  
  const normalized = url.toLowerCase().trim();
  
  for (const protocol of dangerousProtocols) {
    if (normalized.startsWith(protocol)) {
      console.warn(`Blocked dangerous URL protocol: ${protocol}`);
      return '';
    }
  }
  
  try {
    // Validate URL structure
    const urlObj = new URL(url, window.location.origin);
    
    // Only allow http and https
    if (!['http:', 'https:'].includes(urlObj.protocol)) {
      return '';
    }
    
    return urlObj.toString();
  } catch {
    return '';
  }
}

/**
 * Sanitizes query parameter values
 * @param {string} value - Parameter value
 * @returns {string} URL-encoded value
 */
export function sanitizeQueryParam(value) {
  if (typeof value !== 'string') {
    return '';
  }
  
  // Allow alphanumeric and limited special characters
  const sanitized = value.replace(/[^a-zA-Z0-9\-_.~]/g, (char) => {
    return encodeURIComponent(char);
  });
  
  return encodeURIComponent(sanitized);
}
```

---

## 3. HTML Sanitization

### 3.1 Component-Level Sanitization

```javascript
// src/lib/sanitize.js

/**
 * Sanitizes HTML content for safe rendering
 * Uses DOMPurify if available, otherwise basic sanitization
 */
export function sanitizeHTML(html) {
  if (typeof html !== 'string') {
    return '';
  }
  
  // If DOMPurify is available, use it
  if (typeof DOMPurify !== 'undefined') {
    return DOMPurify.sanitize(html, {
      ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span'],
      ALLOWED_ATTR: ['class', 'style'],
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover'],
    });
  }
  
  // Fallback: Basic sanitization without DOMPurify
  return basicSanitize(html);
}

/**
 * Basic HTML sanitization without external dependencies
 * @param {string} html - HTML to sanitize
 * @returns {string} Sanitized HTML
 */
function basicSanitize(html) {
  // Remove script tags and their contents
  let sanitized = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: URIs (potential XSS vector)
  sanitized = sanitized.replace(/data:/gi, 'data-blocked:');
  
  // Remove <style> tags
  sanitized = sanitized.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Remove <iframe>, <object>, <embed>
  sanitized = sanitized.replace(/<(iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');
  
  // Allow only safe tags
  const allowedTags = ['b', 'i', 'em', 'strong', 'u', 'br', 'p', 'span', 'div'];
  const tagPattern = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  
  sanitized = sanitized.replace(tagPattern, (match, tagName) => {
    if (allowedTags.includes(tagName.toLowerCase())) {
      // Remove all attributes except class and style
      return match.replace(/\s+(?!class|style)[a-z-]+\s*=\s*(['"])[^'"]*\1/gi, '');
    }
    return '';
  });
  
  return sanitized;
}

/**
 * Sanitizes text for React rendering
 * React automatically escapes content, but this provides extra safety
 * @param {string} text - Text to sanitize
 * @returns {string} Safe text for rendering
 */
export function sanitizeText(text) {
  if (typeof text !== 'string') {
    return '';
  }
  
  // React handles most escaping, but we strip control characters
  return text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}
```

### 3.2 Safe Component Patterns

```javascript
// src/components/SafeContent.jsx

import { sanitizeHTML, sanitizeText } from '../lib/sanitize';

/**
 * Renders sanitized HTML content
 * Use only when HTML rendering is required
 */
export function SafeHTML({ html, className }) {
  const sanitized = sanitizeHTML(html);
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  );
}

/**
 * Renders sanitized text content
 * React automatically escapes, this is extra safety
 */
export function SafeText({ children }) {
  const sanitized = sanitizeText(String(children || ''));
  return <span>{sanitized}</span>;
}

/**
 * Renders user-provided scroll content safely
 */
export function ScrollContent({ content }) {
  // Content is already validated by useScrolls hook
  // Additional sanitization for display
  const sanitized = sanitizeText(content);
  
  return (
    <div className="scroll-content">
      {sanitized.split('\n').map((paragraph, i) => (
        <p key={i}>{paragraph}</p>
      ))}
    </div>
  );
}
```

---

## 4. Compiler Sanitizers & Testing

### 4.1 ESLint Security Rules

```javascript
// .eslintrc.json - Security-focused configuration

{
  "extends": [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
    "plugin:react-hooks/recommended",
    "plugin:security/recommended"
  ],
  "plugins": ["security"],
  "rules": {
    // Security rules
    "security/detect-buffer-noassert": "error",
    "security/detect-child-process": "error",
    "security/detect-disc_literals": "error",
    "security/detect-html-no-unsanitized": "error",
    "security/detect-newline": "error",
    "security/detect-no-csrf-before-method-override": "error",
    "security/detect-non-literal-fs-filename": "error",
    "security/detect-non-literal-regexp": "error",
    "security/detect-object-injection": "warn",
    "security/detect-possible-timing-attacks": "error",
    "security/detect-pseudoRandomBytes": "error",
    "security/detect-unsafe-regex": "error",
    
    // React security
    "react/no-danger": "warn",
    "react/no-danger-with-children": "error",
    
    // No dangerous patterns
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-setInterval": "warn",
    "no-setTimeout": "warn",
    "no-unsafe-innerhtml": "error"
  }
}
```

### 4.2 Vite Security Configuration

```javascript
// vite.config.js - Security-focused build

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  
  build: {
    // Enable source map generation for debugging
    sourcemap: true,
    
    // Minification options
    minify: 'esbuild',
    esbuild: {
      // Remove console.log in production
      drop: ['console', 'debugger'],
      // Enable tree shaking
      treeShaking: true,
    },
    
    // Security headers
    rollupOptions: {
      output: {
        // Prevent code injection via entry point naming
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  
  // Security headers via vite-plugin-security-headers or similar
  server: {
    headers: {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';",
    },
  },
});
```

### 4.3 Runtime Security Checks

```javascript
// src/lib/security-checks.js

/**
 * Validates environment is secure
 * @returns {boolean} True if running in secure context
 */
export function isSecureContext() {
  // HTTPS required for secure contexts
  if (typeof window !== 'undefined') {
    return window.isSecureContext === true;
  }
  return false;
}

/**
 * Checks for debugging/development tools
 * Useful for logging security-relevant information
 */
export function detectDevelopmentTools() {
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check common dev tool patterns
  const devToolsPatterns = [
    /DevTools/,
    /console/,
    /__REACT_DEVTOOLS_GLOBAL_HOOK__/,
    /__REDUX_DEVTOOLS_EXTENSION__/,
  ];
  
  // This is for informational purposes only
  // Not a security mechanism (easily bypassed)
  if (process.env.NODE_ENV === 'development') {
    console.info('Running in development mode');
  }
  
  return false;
}

/**
 * Content Security Policy violation reporter
 */
export function setupCSPReporter() {
  if (typeof window === 'undefined') {
    return;
  }
  
  document.addEventListener('securitypolicyviolation', (event) => {
    console.error('CSP Violation:', {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy,
    });
    
    // In production, send to logging service
    if (process.env.NODE_ENV === 'production') {
      // logToService('csp-violation', { ... });
    }
  });
}
```

---

## 5. Data Flow Security

### 5.1 Hook-Level Sanitization

```javascript
// src/hooks/useScrolls.js - With sanitization

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "react-use";
import { validateScrollData } from "../lib/validation";
import { escapeHTML } from "../lib/escape";

const STORAGE_KEY = "scholomance-scrolls";

export function useScrolls() {
  const [scrolls, setScrolls] = useLocalStorage(STORAGE_KEY, []);

  const createScroll = useCallback((title, content) => {
    // Validate input
    const sanitizedTitle = escapeHTML(title.trim());
    const sanitizedContent = escapeHTML(content.trim());
    
    const newScroll = {
      id: `scroll-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      title: sanitizedTitle || "Untitled Scroll",
      content: sanitizedContent,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setScrolls((prev) => [newScroll, ...(prev || [])]);
    return newScroll;
  }, [setScrolls]);

  const updateScroll = useCallback((id, updates) => {
    setScrolls((prev) =>
      (prev || []).map((scroll) => {
        if (scroll.id !== id) {
          return scroll;
        }
        
        // Sanitize updates
        const sanitized = {
          ...updates,
          title: updates.title ? escapeHTML(updates.title.trim()) : scroll.title,
          content: updates.content ? escapeHTML(updates.content.trim()) : scroll.content,
          updatedAt: Date.now(),
        };
        
        return { ...scroll, ...sanitized };
      })
    );
  }, [setScrolls]);

  // ... rest of hook
}
```

### 5.2 LocalStorage Security

```javascript
// src/lib/storage.js

import { validateScrollData } from './validation';

/**
 * Securely stores data in localStorage with validation
 */
export function secureSetItem(key, data) {
  try {
    // Validate before storing
    if (Array.isArray(data)) {
      data.forEach(item => validateScrollData(item));
    } else {
      validateScrollData(data);
    }
    
    const serialized = JSON.stringify(data);
    localStorage.setItem(key, serialized);
  } catch (error) {
    console.error('Failed to store data:', error.message);
    throw new Error('Invalid data format');
  }
}

/**
 * Securely retrieves and validates data from localStorage
 */
export function secureGetItem(key, validator) {
  try {
    const serialized = localStorage.getItem(key);
    
    if (serialized === null) {
      return null;
    }
    
    const data = JSON.parse(serialized);
    
    // Validate after retrieval
    if (validator) {
      return validator(data);
    }
    
    return data;
  } catch (error) {
    console.error('Failed to retrieve data:', error.message);
    // On error, clear potentially corrupted data
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * Sanitizes all stored scrolls
 * Call this on app initialization to clean any corrupted data
 */
export function sanitizeStoredScrolls() {
  const scrolls = secureGetItem('scholomance-scrolls');
  
  if (!Array.isArray(scrolls)) {
    localStorage.removeItem('scholomance-scrolls');
    return [];
  }
  
  const validScrolls = scrolls.filter(scroll => {
    try {
      validateScrollData(scroll);
      return true;
    } catch {
      console.warn(`Removing corrupted scroll: ${scroll.id}`);
      return false;
    }
  });
  
  if (validScrolls.length !== scrolls.length) {
    localStorage.setItem('scholomance-scrolls', JSON.stringify(validScrolls));
  }
  
  return validScrolls;
}
```

---

## 6. Security Checklist

### Pre-Commit Validation

- [ ] ESLint passes with no security warnings
- [ ] All user inputs validated with allow-list
- [ ] All outputs escaped for context (HTML/JS/CSS/URL)
- [ ] No `dangerouslySetInnerHTML` without sanitization
- [ ] No `eval()`, `new Function()`, or similar
- [ ] No inline event handlers in JSX
- [ ] No hardcoded secrets in code
- [ ] Environment variables properly prefixed (`VITE_*`)

### Testing Requirements

- [ ] Unit tests for all validation functions
- [ ] Unit tests for all escape functions
- [ ] XSS attack vectors tested
- [ ] Input boundary conditions tested
- [ ] Browser console checked for CSP violations

### Production Readiness

- [ ] Content Security Policy headers configured
- [ ] X-Content-Type-Options: nosniff
- [ ] X-Frame-Options: DENY
- [ ] Referrer-Policy set
- [ ] No development warnings in console
- [ ] Source maps disabled in production

---

## 7. Security Incident Response

If a security issue is discovered:

1. **Report**: Document the issue with reproduction steps
2. **Assess**: Determine severity (CVSS scale)
3. **Contain**: Apply immediate mitigations
4. **Remediate**: Implement fix following this document
5. **Verify**: Test fix and related code paths
6. **Document**: Update this document if needed

---

## References

- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html)
- [MDN Security Guidelines](https://developer.mozilla.org/en-US/docs/Web/Security)
- [React Security Best Practices](https://reactjs.org/docs/security.html)

