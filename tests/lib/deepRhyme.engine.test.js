import { describe, it, expect } from 'vitest';
import { DeepRhymeEngine } from '../../src/lib/deepRhyme.engine.js';
import { PhonemeEngine } from '../../src/lib/phoneme.engine.js';

function createMockPhonemeEngine() {
  return {
    analyzeDeep(word) {
      const normalized = String(word || '').toLowerCase();
      const rhymeKey = normalized.endsWith('a') ? 'A-OPEN' : 'B-OPEN';
      return {
        rhymeKey,
        syllableCount: 1,
        stressPattern: '1',
        syllables: [{ stress: 1, vowelFamily: 'A', coda: '' }],
      };
    },
    scoreMultiSyllableMatch(analysisA, analysisB) {
      const isMatch = analysisA?.rhymeKey === analysisB?.rhymeKey;
      return {
        score: isMatch ? 1 : 0,
        syllablesMatched: isMatch ? 1 : 0,
        type: 'masculine',
      };
    },
  };
}

function createAssonanceMockPhonemeEngine(assonanceScore = 0.65) {
  const lexicon = {
    box: { rhymeKey: 'A-KS', vowelFamily: 'A', coda: 'KS' },
    chops: { rhymeKey: 'A-PS', vowelFamily: 'A', coda: 'PS' },
  };

  return {
    analyzeDeep(word) {
      const normalized = String(word || '').toLowerCase();
      const entry = lexicon[normalized] || { rhymeKey: 'E-T', vowelFamily: 'EH', coda: 'T' };
      return {
        rhymeKey: entry.rhymeKey,
        syllableCount: 1,
        stressPattern: '1',
        syllables: [{ stress: 1, vowelFamily: entry.vowelFamily, coda: entry.coda }],
      };
    },
    scoreMultiSyllableMatch(analysisA, analysisB) {
      const sylA = analysisA?.syllables?.[analysisA.syllables.length - 1];
      const sylB = analysisB?.syllables?.[analysisB.syllables.length - 1];
      if (!sylA || !sylB) {
        return { score: 0, syllablesMatched: 0, type: 'none' };
      }

      // Assonance: same vowel family, different coda.
      if (sylA.vowelFamily === sylB.vowelFamily && sylA.coda !== sylB.coda) {
        return { score: assonanceScore, syllablesMatched: 1, type: 'masculine' };
      }

      if (analysisA?.rhymeKey === analysisB?.rhymeKey) {
        return { score: 1, syllablesMatched: 1, type: 'masculine' };
      }

      return { score: 0, syllablesMatched: 0, type: 'none' };
    },
  };
}

function createStressedAssonanceFallbackMockPhonemeEngine() {
  const lexicon = {
    rhythm: {
      rhymeKey: 'AH-M',
      syllables: [
        { stress: 1, vowelFamily: 'IH', coda: 'DH' },
        { stress: 0, vowelFamily: 'AH', coda: 'M' },
      ],
    },
    timid: {
      rhymeKey: 'IH-D',
      syllables: [
        { stress: 1, vowelFamily: 'IH', coda: 'M' },
        { stress: 0, vowelFamily: 'IH', coda: 'D' },
      ],
    },
  };

  return {
    analyzeDeep(word) {
      const normalized = String(word || '').toLowerCase();
      const entry = lexicon[normalized];
      if (!entry) return null;
      return {
        rhymeKey: entry.rhymeKey,
        syllableCount: entry.syllables.length,
        stressPattern: entry.syllables.map((s) => (s.stress > 0 ? '1' : '0')).join(''),
        syllables: entry.syllables,
      };
    },
    scoreMultiSyllableMatch(analysisA, analysisB) {
      // Simulate terminal-rhyme scoring only; these words intentionally do not match.
      if (analysisA?.rhymeKey === analysisB?.rhymeKey) {
        return { score: 1, syllablesMatched: 1, type: 'masculine' };
      }
      return { score: 0, syllablesMatched: 0, type: 'none' };
    },
  };
}

function createUniformScoreMockPhonemeEngine(score = 1) {
  return {
    analyzeDeep(word) {
      return {
        rhymeKey: 'A-OPEN',
        syllableCount: 1,
        stressPattern: '1',
        syllables: [{ stress: 1, vowelFamily: 'A', coda: '' }],
        word: String(word || '').toLowerCase(),
      };
    },
    scoreMultiSyllableMatch() {
      return {
        score,
        syllablesMatched: 1,
        type: 'masculine',
      };
    },
  };
}

function createSyntaxLayer(tokens) {
  const tokenByIdentity = new Map();
  const tokenByCharStart = new Map();
  tokens.forEach((token) => {
    tokenByIdentity.set(`${token.lineNumber}:${token.wordIndex}:${token.charStart}`, token);
    tokenByCharStart.set(token.charStart, token);
  });

  return {
    enabled: true,
    tokens,
    tokenByIdentity,
    tokenByCharStart,
    syntaxSummary: {
      enabled: true,
      tokenCount: tokens.length,
      roleCounts: { content: 0, function: 0 },
      lineRoleCounts: { line_start: 0, line_mid: 0, line_end: 0 },
      stressRoleCounts: { primary: 0, secondary: 0, unstressed: 0, unknown: 0 },
      rhymePolicyCounts: { allow: 0, allow_weak: 0, suppress: 0 },
      reasonCounts: {},
      tokens,
    },
  };
}

describe('DeepRhymeEngine duplicate-scheme scanning', () => {
  it('keeps full scan for 2 same-scheme line endings', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      'line one alpha',
      'line two omega',
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(1);
    expect(result.schemePattern).toBe('AA');
  });

  it('avoids quadratic scans when same scheme repeats more than twice', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      'verse one alpha',
      'verse two omega',
      'verse three luna',
      'verse four sonata',
    ].join('\n'));

    // Previous behavior produced 6 (4 choose 2) connections.
    // New behavior uses minimal adjacent chaining for repeated schemes.
    expect(result.endRhymeConnections).toHaveLength(3);
    expect(result.schemePattern).toBe('AAAA');

    const groupSizes = Array.from(result.rhymeGroups.values()).map((lines) => lines.length);
    expect(groupSizes).toContain(4);
  });

  it('treats cross-line assonance as Truesight connection at 0.60+', () => {
    const engine = new DeepRhymeEngine(createAssonanceMockPhonemeEngine(0.65));
    const result = engine.analyzeDocument([
      'dark box',
      'sharp chops',
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(1);
    expect(result.schemePattern).toBe('AA');
    expect(result.endRhymeConnections[0].type).toBe('assonance');
  });

  it('keeps low-score assonance below Truesight threshold', () => {
    const engine = new DeepRhymeEngine(createAssonanceMockPhonemeEngine(0.59));
    const result = engine.analyzeDocument([
      'dark box',
      'sharp chops',
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(0);
    expect(result.schemePattern).toBe('AB');
  });

  it('does not count repeated lexical endings as rhyme connections', () => {
    const engine = new DeepRhymeEngine(createMockPhonemeEngine());
    const result = engine.analyzeDocument([
      "I'm a joy boy",
      "I'm a joy boy",
    ].join('\n'));

    expect(result.endRhymeConnections).toHaveLength(0);
    expect(result.schemePattern).toBe('AB');
  });

  it('detects stressed-vowel assonance even when terminal rhyme does not match', () => {
    const engine = new DeepRhymeEngine(createStressedAssonanceFallbackMockPhonemeEngine());
    const result = engine.analyzeDocument('rhythm timid');

    expect(result.internalRhymeConnections).toHaveLength(1);
    expect(result.internalRhymeConnections[0].type).toBe('assonance');
    expect(result.internalRhymeConnections[0].score).toBeGreaterThanOrEqual(0.6);
  });

  it('suppresses internal pairs where both words are non-terminal function words', () => {
    const engine = new DeepRhymeEngine(createUniformScoreMockPhonemeEngine());
    const syntaxLayer = createSyntaxLayer([
      { lineNumber: 0, wordIndex: 0, charStart: 0, role: 'function', lineRole: 'line_start', stem: 'and', normalized: 'and' },
      { lineNumber: 0, wordIndex: 1, charStart: 4, role: 'function', lineRole: 'line_mid', stem: 'to', normalized: 'to' },
      { lineNumber: 0, wordIndex: 2, charStart: 7, role: 'content', lineRole: 'line_end', stem: 'go', normalized: 'go' },
    ]);

    const result = engine.analyzeDocument('and to go', { syntaxLayer });

    const hasSuppressedPair = result.internalRhymeConnections.some((connection) => {
      const pair = [connection.wordA.word.toLowerCase(), connection.wordB.word.toLowerCase()].sort().join('|');
      return pair === 'and|to';
    });

    expect(hasSuppressedPair).toBe(false);
    expect(result.statistics.syntaxGating.enabled).toBe(true);
    expect(result.statistics.syntaxGating.suppressedPairs).toBeGreaterThanOrEqual(1);
  });

  it('allows weakened line-end function pairs and emits gate metadata', () => {
    const engine = new DeepRhymeEngine(createUniformScoreMockPhonemeEngine());
    const syntaxLayer = createSyntaxLayer([
      { lineNumber: 0, wordIndex: 0, charStart: 0, role: 'function', lineRole: 'line_end', stem: 'to', normalized: 'to' },
      { lineNumber: 1, wordIndex: 0, charStart: 3, role: 'function', lineRole: 'line_end', stem: 'so', normalized: 'so' },
    ]);

    const result = engine.analyzeDocument('to\nso', { syntaxLayer });

    expect(result.endRhymeConnections).toHaveLength(1);
    expect(result.endRhymeConnections[0].syntax?.gate).toBe('allow_weak');
    expect(result.endRhymeConnections[0].syntax?.multiplier).toBeCloseTo(0.9, 6);
    expect(result.endRhymeConnections[0].syntax?.reasons).toContain('both_function_line_end_exception');
  });

  it('drops weak stem-echo internal pairs below threshold after syntax multiplier', () => {
    const engine = new DeepRhymeEngine(createUniformScoreMockPhonemeEngine(0.7));
    const syntaxLayer = createSyntaxLayer([
      { lineNumber: 0, wordIndex: 0, charStart: 0, role: 'content', lineRole: 'line_start', stem: 'bak', normalized: 'baking' },
      { lineNumber: 0, wordIndex: 1, charStart: 7, role: 'content', lineRole: 'line_end', stem: 'bak', normalized: 'baked' },
    ]);

    const result = engine.analyzeDocument('baking baked', { syntaxLayer });

    expect(result.internalRhymeConnections).toHaveLength(0);
    expect(result.statistics.syntaxGating.weakenedPairs).toBeGreaterThanOrEqual(1);
  });

  it('keeps function-content pairs when phonetic affinity is strong', () => {
    const engine = new DeepRhymeEngine(createUniformScoreMockPhonemeEngine(0.62));
    const syntaxLayer = createSyntaxLayer([
      { lineNumber: 0, wordIndex: 0, charStart: 0, role: 'function', lineRole: 'line_start', stem: 'to', normalized: 'to' },
      { lineNumber: 0, wordIndex: 1, charStart: 3, role: 'content', lineRole: 'line_end', stem: 'glow', normalized: 'glow' },
    ]);

    const result = engine.analyzeDocument('to glow', { syntaxLayer });

    expect(result.internalRhymeConnections).toHaveLength(1);
    expect(result.internalRhymeConnections[0].syntax?.reasons).toContain('phonetic_affinity_override');
    expect(result.internalRhymeConnections[0].score).toBeGreaterThanOrEqual(0.6);
  });

  it('aligns IN-cluster words into shared end-rhyme connectivity', () => {
    PhonemeEngine.clearCache();
    const engine = new DeepRhymeEngine(PhonemeEngine);
    const text = ['obsidian', 'olympian', 'victim', 'rhythm', 'median'].join('\n');
    const result = engine.analyzeDocument(text);

    const connectedWords = new Set(
      result.endRhymeConnections.flatMap((connection) => [
        String(connection.wordA.word || '').toLowerCase(),
        String(connection.wordB.word || '').toLowerCase(),
      ])
    );

    ['obsidian', 'olympian', 'victim', 'rhythm', 'median'].forEach((word) => {
      expect(connectedWords.has(word)).toBe(true);
    });
    expect(result.endRhymeConnections.some((connection) => connection.type === 'assonance')).toBe(true);
  });
});
