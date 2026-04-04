/**
 * PixelBrain QA — Discovery Engine
 *
 * Builds a symbol graph across the codebase:
 *   - exports / imports
 *   - call sites
 *   - runtime registrations (extension registry, hooks, etc.)
 *   - test references
 *   - config references
 */

import { readdirSync, statSync, readFileSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

// ─── File Discovery ──────────────────────────────────────────────────────────

const SOURCE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs']);

const IGNORE_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage',
  '.tmp', 'tmp', 'archive', 'ARCHIVE',
  'tests/visual', '.qwen', '.codex', '.claude',
]);

function* walkDir(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      yield* walkDir(full);
    } else if (SOURCE_EXTENSIONS.has(extname(entry.name))) {
      yield full;
    }
  }
}

function discoverSourceFiles(rootDir) {
  return [...walkDir(rootDir)];
}

// ─── Source Parsing ──────────────────────────────────────────────────────────

const IMPORT_RE = /(?:import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"])|(?:require\(\s*['"]([^'"]+)['"]\s*\))/g;
const EXPORT_NAMED_RE = /export\s+(?:async\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
const EXPORT_DEFAULT_RE = /export\s+default\s+(?:(?:async\s+)?(?:function|class)\s+(\w+)|(\w+))/g;
const EXPORT_CONST_OBJ_RE = /export\s+(?:const|let|var)\s+(\w+)\s*=\s*(?:\{|Object\.freeze)/g;
const CALL_SITE_RE = /(?:^|[^\w.])(\w+)\s*\((?:[^)]*)\)/gm;
const REGISTRY_REGISTER_RE = /(?:register|add|attach|subscribe|define|use|plugin)\s*\(\s*['"]?(\w+)['"]?\s*[,)]/g;

function stripComments(code) {
  return code
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

function resolveImportPath(importerPath, importSpecifier, rootDir) {
  if (importSpecifier.startsWith('.') || importSpecifier.startsWith('/')) {
    let resolved = importSpecifier.startsWith('.')
      ? join(importerPath, '..', importSpecifier)
      : join(rootDir, importSpecifier);
    for (const ext of ['.js', '.ts', '.jsx', '.tsx', '.mjs', '/index.js', '/index.ts']) {
      if (existsSync(resolved + ext) || (ext.startsWith('/') && existsSync(resolved + ext))) {
        return relative(rootDir, resolved + ext).replace(/\\/g, '/');
      }
    }
    // Maybe already has extension
    if (existsSync(resolved)) return relative(rootDir, resolved).replace(/\\/g, '/');
    return relative(rootDir, resolved).replace(/\\/g, '/');
  }
  // bare specifier (npm package)
  return importSpecifier;
}

function extractSymbols(filePath, code, rootDir) {
  const stripped = stripComments(code);
  const relPath = relative(rootDir, filePath).replace(/\\/g, '/');
  const symbols = {};
  const imports = [];
  const callSites = new Set();
  const registrations = [];

  // Imports
  let m;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(stripped)) !== null) {
    const specifier = m[1] || m[2];
    if (specifier) {
      const resolved = resolveImportPath(filePath, specifier, rootDir);
      imports.push({ specifier, resolved });
    }
  }

  // Exported functions
  EXPORT_NAMED_RE.lastIndex = 0;
  while ((m = EXPORT_NAMED_RE.exec(stripped)) !== null) {
    symbols[m[1]] = {
      name: m[1],
      type: inferSymbolType(stripped, m.index),
      exported: true,
      calls: [],
      calledBy: [],
      importedBy: [],
      registeredIn: [],
      testedIn: [],
      configRefs: [],
    };
  }

  // Export default
  EXPORT_DEFAULT_RE.lastIndex = 0;
  while ((m = EXPORT_DEFAULT_RE.exec(stripped)) !== null) {
    const name = m[1] || m[2] || 'default';
    symbols[name] = {
      name,
      type: 'function',
      exported: true,
      defaultExport: true,
      calls: [],
      calledBy: [],
      importedBy: [],
      registeredIn: [],
      testedIn: [],
      configRefs: [],
    };
  }

  // Const/let/var exports that are objects or frozen (modules, configs, APIs)
  EXPORT_CONST_OBJ_RE.lastIndex = 0;
  while ((m = EXPORT_CONST_OBJ_RE.exec(stripped)) !== null) {
    if (!symbols[m[1]]) {
      symbols[m[1]] = {
        name: m[1],
        type: 'const',
        exported: true,
        calls: [],
        calledBy: [],
        importedBy: [],
        registeredIn: [],
        testedIn: [],
        configRefs: [],
      };
    }
  }

  // Call sites (all function calls in the file)
  CALL_SITE_RE.lastIndex = 0;
  while ((m = CALL_SITE_RE.exec(stripped)) !== null) {
    const name = m[1];
    if (name && !isBuiltin(name)) {
      callSites.add(name);
    }
  }

  // Registry registrations
  REGISTRY_REGISTER_RE.lastIndex = 0;
  while ((m = REGISTRY_REGISTER_RE.exec(stripped)) !== null) {
    registrations.push(m[1]);
  }

  return { relPath, symbols, imports, callSites: [...callSites], registrations };
}

function inferSymbolType(code, index) {
  // Look at what follows the export keyword
  const snippet = code.substring(index, index + 80);
  if (snippet.includes('class ')) return 'class';
  if (snippet.includes('interface ')) return 'interface';
  if (snippet.includes('type ')) return 'type';
  if (snippet.includes('enum ')) return 'enum';
  if (snippet.includes('function')) return 'function';
  return 'const';
}

const BUILTINS = new Set([
  'console', 'require', 'process', 'Buffer', 'globalThis',
  'Object', 'Array', 'String', 'Number', 'Boolean', 'Map', 'Set',
  'Promise', 'Error', 'TypeError', 'SyntaxError', 'Math', 'Date',
  'JSON', 'parseInt', 'parseFloat', 'setTimeout', 'clearTimeout',
  'setInterval', 'clearInterval', 'fetch', 'AbortController',
  'describe', 'it', 'test', 'expect', 'beforeEach', 'afterEach',
  'beforeAll', 'afterAll', 'vi', 'jest',
  'log', 'warn', 'error', 'info', 'debug', 'trace',
  'push', 'pop', 'shift', 'unshift', 'map', 'filter', 'reduce',
  'forEach', 'find', 'findIndex', 'some', 'every', 'includes',
  'slice', 'splice', 'join', 'split', 'replace', 'match', 'test',
  'toString', 'valueOf', 'hasOwnProperty', 'keys', 'values', 'entries',
  'freeze', 'seal', 'assign', 'create', 'defineProperty',
  'then', 'catch', 'finally', 'resolve', 'reject',
  'useEffect', 'useState', 'useMemo', 'useCallback', 'useRef', 'useContext',
  'useReducer', 'useLayoutEffect', 'useImperativeHandle', 'useDebugValue',
  'createElement', 'Fragment', 'createContext', 'forwardRef', 'memo',
  'defineProperty', 'getOwnPropertyDescriptor',
  'addEventListener', 'removeEventListener',
  'getElementById', 'querySelector', 'querySelectorAll',
  'preventDefault', 'stopPropagation',
]);

function isBuiltin(name) {
  return BUILTINS.has(name) || /^[a-z]$/.test(name);
}

// ─── Graph Assembly ──────────────────────────────────────────────────────────

export function buildSymbolGraph(rootDir) {
  const files = discoverSourceFiles(rootDir);
  const fileData = new Map(); // relPath → { symbols, imports, callSites, registrations }
  const allExports = new Map(); // "relPath::symbolName" → symbol info

  // Pass 1: Extract symbols from every file
  for (const filePath of files) {
    try {
      const code = readFileSync(filePath, 'utf-8');
      const { relPath, symbols, imports, callSites, registrations } = extractSymbols(filePath, code, rootDir);
      fileData.set(relPath, { symbols, imports, callSites, registrations });
      for (const [name, info] of Object.entries(symbols)) {
        allExports.set(`${relPath}::${name}`, { ...info, file: relPath });
      }
    } catch {
      // skip unreadable files
    }
  }

  // Pass 2: Wire up cross-references
  for (const [relPath, data] of fileData) {
    // For each call site in this file, mark the called symbol as "calledBy" this file
    for (const callName of data.callSites) {
      for (const [exportKey, symbol] of allExports) {
        if (symbol.name === callName && symbol.file !== relPath) {
          if (!symbol.calledBy.includes(relPath)) {
            symbol.calledBy.push(relPath);
          }
        }
      }
    }

    // For each import, mark the imported symbol as "importedBy" this file
    for (const imp of data.imports) {
      for (const [exportKey, symbol] of allExports) {
        if (exportKey.startsWith(imp.resolved + '::') || exportKey.startsWith(imp.resolved.replace(/\.js$/, '') + '::')) {
          if (!symbol.importedBy.includes(relPath)) {
            symbol.importedBy.push(relPath);
          }
        }
      }
    }

    // For each registration, mark the registered symbol
    for (const regName of data.registrations) {
      for (const [exportKey, symbol] of allExports) {
        if (symbol.name === regName) {
          if (!symbol.registeredIn.includes(relPath)) {
            symbol.registeredIn.push(relPath);
          }
        }
      }
    }
  }

  // Pass 3: Find test references
  const testFiles = [...fileData.keys()].filter(p =>
    p.includes('.test.') || p.includes('.spec.') || p.startsWith('tests/')
  );
  for (const testPath of testFiles) {
    const testData = fileData.get(testPath);
    if (!testData) continue;
    for (const callName of testData.callSites) {
      for (const [exportKey, symbol] of allExports) {
        if (symbol.name === callName && !symbol.testedIn.includes(testPath)) {
          symbol.testedIn.push(testPath);
        }
      }
    }
  }

  return { allExports, fileData };
}
