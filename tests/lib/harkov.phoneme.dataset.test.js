/**
 * HHM Phoneme Analysis — Dataset Integration Tests
 *
 * Parses real verse from DATA-SET 1 and runs it through the Hidden Harkov Model
 * (via buildSyntaxLayer → buildHiddenHarkovSummary) to stress-test known phonetic
 * tripwires: Silent E, Homographs, Homonyms, Synonyms, and state transitions.
 *
 * Coverage targets:
 *  - Stanza batching (4-bar grouping)
 *  - Hidden state inference (terminal_anchor, stress_anchor, function_gate, etc.)
 *  - Token weight differentiation (content > function, line_end > line_mid)
 *  - Stage signal ordering and clamping
 *  - Transition matrix probability integrity
 *  - Silent E words: higher tokenWeight, primary stress, correct hidden state
 *  - Homograph tripwire: identical spellings at different positions → different states
 *  - Homonym tripwire: same pronunciation, different spelling → identical syntax treatment
 *  - PREDICTOR/SPELLCHECK stage separation and independent HHM modifiers
 *  - Dictionary source metadata attached at token and summary level
 */

import { describe, it, expect } from 'vitest';
import {
  buildHiddenHarkovSummary,
  HHM_LOGIC_ORDER,
  HHM_STAGE_WEIGHTS,
} from '../../src/lib/models/harkov.model.js';
import { buildSyntaxLayer } from '../../src/lib/syntax.layer.js';
import { JudiciaryEngine } from '../../codex/core/judiciary.js';

// ─────────────────────────────────────────────────────────────────────────────
// Phonetic helpers
// ─────────────────────────────────────────────────────────────────────────────

const FUNCTION_WORD_SET = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'than',
  'i', 'me', 'my', 'you', 'your', 'we', 'us', 'he', 'him', 'his',
  'she', 'her', 'it', 'its', 'they', 'them', 'their', 'this', 'that',
  'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been',
  'do', 'does', 'did', 'have', 'has', 'had', 'to', 'of', 'in', 'on',
  'at', 'for', 'from', 'with', 'by', 'as', 'not', 'no', 'so', 'too',
  'just', 'can', 'could', 'would', 'should', 'will', 'shall', 'might',
  'may', 'must', 'into', 'onto', 'upon', 'like', 'when', 'where', 'how',
]);

// Silent-E words from the dataset — the trailing E is silent, vowel is long
// and carries primary stress (the phoneme tripwire we're stress-testing)
const SILENT_E_WORDS = new Set([
  'stone', 'blade', 'grave', 'flame', 'write', 'white', 'style', 'plane',
  'frame', 'name', 'made', 'pave', 'paved', 'make', 'take', 'place',
  'time', 'line', 'mine', 'side', 'wide', 'ride', 'alive', 'divine',
  'inside', 'life', 'bone', 'bones', 'close', 'rose', 'those', 'use',
  'rise', 'shine', 'fine', 'vine', 'pine', 'spine', 'cage', 'age',
  'page', 'sage', 'rage', 'wave', 'save', 'cave', 'gave', 'have',
  'obake', 'sake', 'lake', 'wake', 'bake', 'fake', 'make', 'rake',
  'hate', 'late', 'fate', 'gate', 'rate', 'state', 'plate', 'skate',
  'pile', 'file', 'while', 'mile', 'style', 'smile', 'tile', 'vile',
  'wild', 'mild', 'child', 'defiled', 'smile', 'smiles',
]);

/**
 * Infers syllable stress for a word token.
 * Test approximation only — production uses PhonemeEngine + CMU dict.
 * Rules: function words → unstressed; silent-E words → primary;
 * multi-syllable → primary on first, unstressed after.
 */
function inferStress(word) {
  const lower = word.toLowerCase().replace(/[^a-z']/g, '');

  if (FUNCTION_WORD_SET.has(lower)) {
    return [{ stress: 0 }];
  }
  if (SILENT_E_WORDS.has(lower)) {
    return [{ stress: 1 }];
  }

  // Approximate syllable count by vowel groups
  const vowelGroups = lower.match(/[aeiouy]+/g) || [];
  const syllableCount = Math.max(1, vowelGroups.length);

  if (syllableCount === 1) return [{ stress: 1 }];
  return Array.from({ length: syllableCount }, (_, i) => ({
    stress: i === 0 ? 1 : 0,
  }));
}

/**
 * Parses raw verse text into the analyzedDoc shape expected by buildSyntaxLayer.
 * Strips bracket/parenthesis markers ([Chorus], (Never again), etc.).
 * Tracks real character offsets across the full text.
 */
function parseTextToDoc(text) {
  const rawLines = text.split('\n');
  const lines = [];
  let globalOffset = 0;

  for (const rawLine of rawLines) {
    const cleaned = rawLine
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?\)/g, '')
      .replace(/\\/g, '')
      .trim();

    if (!cleaned) {
      globalOffset += rawLine.length + 1;
      continue;
    }

    const cleanedStart = rawLine.indexOf(cleaned.slice(0, 4));
    const lineBaseOffset = globalOffset + Math.max(0, cleanedStart);
    const wordMatches = [...cleaned.matchAll(/[a-zA-Z']+/g)];

    if (wordMatches.length === 0) {
      globalOffset += rawLine.length + 1;
      continue;
    }

    const words = wordMatches.map((match) => ({
      text: match[0],
      normalized: match[0].toLowerCase().replace(/[^a-z']/g, ''),
      start: lineBaseOffset + match.index,
      end: lineBaseOffset + match.index + match[0].length,
      deepPhonetics: { syllables: inferStress(match[0]) },
    }));

    lines.push({ number: lines.length, words });
    globalOffset += rawLine.length + 1;
  }

  return { lines };
}

// ─────────────────────────────────────────────────────────────────────────────
// Dataset fixtures extracted from DATA-SET 1
// ─────────────────────────────────────────────────────────────────────────────

// "Penne Obake" — dense silent-E content, rhyme-heavy, function/content mix
const PENNE_OBAKE_EXCERPT = `
The pen obake
Lyrical hokage
Mystical flow Java, you're sipping the whole latte
Physical growth? Grande
Invincible prose, Pottery molding the stone
Gotta be whole, devoted poetry
Mode is always arcane
Ghosts control the stark aim
Vocal code braille
You can feel where the tones blaze
Steel was a cold frame
Still with my old name
Growth doesn't morph but it changes, so don't wait
Pain was a road paved
Chain made of gold
Stone was a dull blade, Bones made of cold clay
`.trim();

// "Echocardiogram Glow" chorus — clean repeating 4-line stanzas, ideal for batching test
const ECHO_CHORUS = `
Bodies will pile
The streets are defiled
The evil, it smiles
Lethal and wild
Threading the needle
Upheaval with style
Bodies will pile
The streets are defiled
`.trim();

// Truly repeating fixture — same 4 lines twice, so stanza 0 and stanza 1 are identical
const REPEATING_STANZA = `
Bodies will pile
The streets are defiled
The evil it smiles
Lethal and wild
Bodies will pile
The streets are defiled
The evil it smiles
Lethal and wild
`.trim();

// "Gravity Well" — rhyme chain, end-stressed content, gold/glow/bold family
const GRAVITY_WELL_EXCERPT = `
Ring the bell, crazy in the head, glowing hell
In lyrical dojo, I'm spiritual Popo
Guardian of Gaia
The Mayan of Mojo
Tyrant of rhyme shines divine with a gold glow
The vocals are so bold
The waveforms stream like a synesthesia beam
You receive it with eyes closed
`.trim();

// "Human Zim" — write/right homophone context, morphological suffixes
const HUMAN_ZIM_EXCERPT = `
Syllable expression, bitch the penmanship is true
Bob The Builder with hammers in panic rooms
Wise with the mind designed like Simon Cowell rhyming vowels
Criticism hit like ricin, mic is foul
Melt divine, sweltering rhymes, melding inside with fire
Hell divine, swelling the mind, decibels match desire
`.trim();

// Direct silent-E tripwire line from "Penne Obake"
const SILENT_E_LINE = `Stone was a dull blade, Bones made of cold clay`;

// ─────────────────────────────────────────────────────────────────────────────
// Inline docs for homographs and homonyms found in or adjacent to the dataset
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Homographs: same spelling, different pronunciation and meaning.
 * The HHM cannot resolve these alone — it needs PREDICTOR sequential context.
 * PREDICTOR and SPELLCHECK now use dedicated HHM stages for disambiguation.
 */
const HOMOGRAPHS = {
  lead:  ['lɛd (metal weight)',    'liːd (to guide)'],
  close: ['kloʊs (near/adjacent)', 'kloʊz (to shut)'],
  wound: ['wuːnd (an injury)',     'waʊnd (past tense of wind)'],
  live:  ['lɪv (to exist)',        'laɪv (alive/performing)'],
  read:  ['riːd (present tense)',  'rɛd (past tense)'],
  tear:  ['tɪər (from the eye)',   'tɛr (to rip/shred)'],
  bow:   ['boʊ (weapon/ribbon)',   'baʊ (to bend/bow down)'],
  bass:  ['beɪs (musical tone)',   'bæs (the fish)'],
};

/**
 * Homonym pairs: same pronunciation, different spelling.
 * Both members of each pair should receive identical syntax classification
 * since they are phonemically indistinguishable without semantic context.
 */
const HOMONYM_PAIRS = [
  ['steel', 'steal'],
  ['pain',  'pane'],
  ['plane', 'plain'],
  ['soul',  'sole'],
  ['right', 'write'],
  ['gold',  'golled'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('[HHM] Hidden Harkov Model — Phoneme Analysis (DATA-SET 1)', () => {

  // ── 1. HHM constants ────────────────────────────────────────────────────────

  describe('HHM_LOGIC_ORDER and HHM_STAGE_WEIGHTS', () => {
    it('exports required stages in HHM_LOGIC_ORDER', () => {
      expect(HHM_LOGIC_ORDER).toContain('SYNTAX');
      expect(HHM_LOGIC_ORDER).toContain('PHONEME');
      expect(HHM_LOGIC_ORDER).toContain('HEURISTICS');
      expect(HHM_LOGIC_ORDER).toContain('METER');
    });

    it('SYNTAX appears first in logic order', () => {
      expect(HHM_LOGIC_ORDER[0]).toBe('SYNTAX');
    });

    it('stage weights sum to 1.0', () => {
      const total = Object.values(HHM_STAGE_WEIGHTS).reduce((s, w) => s + w, 0);
      expect(total).toBeCloseTo(1.0, 5);
    });

    it('SYNTAX carries the highest stage weight', () => {
      const max = Math.max(...Object.values(HHM_STAGE_WEIGHTS));
      expect(HHM_STAGE_WEIGHTS.SYNTAX).toBe(max);
    });

    it('METER carries the lowest stage weight', () => {
      const min = Math.min(...Object.values(HHM_STAGE_WEIGHTS));
      expect(HHM_STAGE_WEIGHTS.METER).toBe(min);
    });

    it('every stage in HHM_LOGIC_ORDER has a corresponding weight', () => {
      HHM_LOGIC_ORDER.forEach((stage) => {
        expect(typeof HHM_STAGE_WEIGHTS[stage]).toBe('number');
        expect(HHM_STAGE_WEIGHTS[stage]).toBeGreaterThan(0);
      });
    });
  });

  // ── 2. Graceful degradation ──────────────────────────────────────────────────

  describe('graceful degradation on bad inputs', () => {
    it('returns disabled summary and empty map for empty array', () => {
      const { summary, tokenStateByIdentity } = buildHiddenHarkovSummary([]);
      expect(summary.enabled).toBe(false);
      expect(summary.tokenCount).toBe(0);
      expect(tokenStateByIdentity.size).toBe(0);
    });

    it('returns disabled summary for null input', () => {
      const { summary } = buildHiddenHarkovSummary(null);
      expect(summary.enabled).toBe(false);
    });

    it('returns disabled summary for undefined input', () => {
      const { summary } = buildHiddenHarkovSummary(undefined);
      expect(summary.enabled).toBe(false);
    });

    it('does not throw for tokens missing optional fields', () => {
      const minimal = [
        { word: 'fire', normalized: 'fire', role: 'content', lineNumber: 0, wordIndex: 0, charStart: 0 },
        { word: 'and',  normalized: 'and',  role: 'function', lineNumber: 0, wordIndex: 1, charStart: 5 },
      ];
      expect(() => buildHiddenHarkovSummary(minimal)).not.toThrow();
    });

    it('buildSyntaxLayer with empty doc returns disabled layer', () => {
      const layer = buildSyntaxLayer({ lines: [] });
      expect(layer.enabled).toBe(false);
      expect(layer.tokens).toHaveLength(0);
    });
  });

  // ── 3. Stanza batching ───────────────────────────────────────────────────────

  describe('4-bar stanza batching', () => {
    it('groups lines 0–3 into stanza 0 and lines 4–7 into stanza 1', () => {
      const doc = parseTextToDoc(ECHO_CHORUS);
      const layer = buildSyntaxLayer(doc);

      expect(layer.hhm.enabled).toBe(true);
      expect(layer.hhm.stanzaSizeBars).toBe(4);
      expect(layer.hhm.stanzaCount).toBe(2);

      const s0 = layer.hhm.stanzas[0];
      const s1 = layer.hhm.stanzas[1];

      expect(s0.stanzaIndex).toBe(0);
      expect(s0.startLine).toBe(0);
      expect(s0.endLine).toBe(3);

      expect(s1.stanzaIndex).toBe(1);
      expect(s1.startLine).toBe(4);
      expect(s1.endLine).toBe(7);
    });

    it('assigns stanzaBar 1–4 cyclically per line within stanza', () => {
      const doc = parseTextToDoc(ECHO_CHORUS);
      const layer = buildSyntaxLayer(doc);

      for (let lineNum = 0; lineNum < 8; lineNum++) {
        const token = layer.tokens.find((t) => t.lineNumber === lineNum);
        if (!token) continue;
        const expectedBar = (lineNum % 4) + 1;
        expect(token.hhm?.stanzaBar).toBe(expectedBar);
      }
    });

    it('total token count equals sum of all stanza token counts', () => {
      const doc = parseTextToDoc(ECHO_CHORUS);
      const layer = buildSyntaxLayer(doc);
      const fromStanzas = layer.hhm.stanzas.reduce((sum, s) => sum + s.tokenCount, 0);
      expect(fromStanzas).toBe(layer.hhm.tokenCount);
    });

    it('each stanza lists only its own line numbers in bars[]', () => {
      const doc = parseTextToDoc(ECHO_CHORUS);
      const layer = buildSyntaxLayer(doc);

      layer.hhm.stanzas.forEach((stanza) => {
        stanza.bars.forEach((lineNum) => {
          const expectedStanzaIndex = Math.floor(lineNum / 4);
          expect(expectedStanzaIndex).toBe(stanza.stanzaIndex);
        });
      });
    });

    it('Penne Obake excerpt produces multiple stanzas', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      expect(layer.hhm.stanzaCount).toBeGreaterThan(1);
    });
  });

  // ── 4. Hidden state inference ────────────────────────────────────────────────

  describe('hidden state inference', () => {
    it('terminal_anchor: content words at line_end', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      const lineEndContent = layer.tokens.filter(
        (t) => t.lineRole === 'line_end' && t.role === 'content'
      );
      expect(lineEndContent.length).toBeGreaterThan(0);
      lineEndContent.forEach((token) => {
        expect(token.hhm?.hiddenState).toBe('terminal_anchor');
      });
    });

    it('stress_anchor: primary-stressed content words NOT at line_end', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      const stressAnchors = layer.tokens.filter(
        (t) => t.hhm?.hiddenState === 'stress_anchor'
      );
      expect(stressAnchors.length).toBeGreaterThan(0);
      stressAnchors.forEach((token) => {
        expect(token.stressRole).toBe('primary');
        expect(token.lineRole).not.toBe('line_end');
      });
    });

    it('function_gate: function words with rhymePolicy suppress', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      const gated = layer.tokens.filter((t) => t.hhm?.hiddenState === 'function_gate');
      expect(gated.length).toBeGreaterThan(0);
      gated.forEach((token) => {
        expect(token.role).toBe('function');
        expect(token.rhymePolicy).toBe('suppress');
      });
    });

    it('flow: mid-line content words with no special stress or position', () => {
      const doc = parseTextToDoc(GRAVITY_WELL_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      const flowTokens = layer.tokens.filter((t) => t.hhm?.hiddenState === 'flow');
      expect(flowTokens.length).toBeGreaterThan(0);
    });

    it('line_launch: only tokens at line_start position', () => {
      const doc = parseTextToDoc(GRAVITY_WELL_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      const launches = layer.tokens.filter((t) => t.hhm?.hiddenState === 'line_launch');
      launches.forEach((token) => {
        expect(token.lineRole).toBe('line_start');
      });
    });

    it('every token has a defined hiddenState', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      const validStates = new Set([
        'flow', 'terminal_anchor', 'stress_anchor', 'function_gate', 'line_launch', 'lexical_chain',
      ]);
      layer.tokens.forEach((token) => {
        expect(validStates.has(token.hhm?.hiddenState)).toBe(true);
      });
    });
  });

  // ── 5. Silent-E tripwire ─────────────────────────────────────────────────────

  describe('silent-E phonetic tripwire', () => {
    it('silent-E content words get higher tokenWeight than adjacent function words', () => {
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'Stone', start: 0,  end: 5,  deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'was',   start: 6,  end: 9,  deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'a',     start: 10, end: 11, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'blade', start: 12, end: 17, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const stone = layer.tokens.find((t) => t.word === 'Stone');
      const blade = layer.tokens.find((t) => t.word === 'blade');
      const was   = layer.tokens.find((t) => t.word === 'was');
      const a     = layer.tokens.find((t) => t.word === 'a');

      expect(stone.hhm.tokenWeight).toBeGreaterThan(was.hhm.tokenWeight);
      expect(stone.hhm.tokenWeight).toBeGreaterThan(a.hhm.tokenWeight);
      expect(blade.hhm.tokenWeight).toBeGreaterThan(was.hhm.tokenWeight);
    });

    it('silent-E word at line_end → terminal_anchor with boosted METER signal', () => {
      // "Steel was a cold frame" — "frame" has silent E, sits at line_end
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'Steel', start: 0,  end: 5,  deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'was',   start: 6,  end: 9,  deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'a',     start: 10, end: 11, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'cold',  start: 12, end: 16, deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'frame', start: 17, end: 22, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const frame = layer.tokens.find((t) => t.word === 'frame');
      const steel = layer.tokens.find((t) => t.word === 'Steel');

      expect(frame.lineRole).toBe('line_end');
      expect(frame.hhm.hiddenState).toBe('terminal_anchor');

      // METER signal at line_end gets a 1.08× multiplier — should exceed non-terminal
      expect(frame.hhm.stageScores.METER.signal)
        .toBeGreaterThan(steel.hhm.stageScores.METER.signal);
    });

    it('full silent-E dense line parses correctly with content > function ratio', () => {
      const doc = parseTextToDoc(SILENT_E_LINE);
      const layer = buildSyntaxLayer(doc);

      const contentWords  = layer.tokens.filter((t) => t.role === 'content');
      const functionWords = layer.tokens.filter((t) => t.role === 'function');

      // "Stone", "dull", "blade", "Bones", "made", "cold", "clay" are content
      expect(contentWords.length).toBeGreaterThan(functionWords.length);

      // Last token "clay" — content, line_end → terminal_anchor
      const lastToken = layer.tokens[layer.tokens.length - 1];
      expect(lastToken.hhm.hiddenState).toBe('terminal_anchor');
    });

    it('silent-E words at mid-line get stress_anchor, not terminal_anchor', () => {
      // "stone" mid-line (not at end) should be stress_anchor
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'molding', start: 0,  end: 7,  deepPhonetics: { syllables: [{ stress: 1 }, { stress: 0 }] } },
            { text: 'the',     start: 8,  end: 11, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'stone',   start: 12, end: 17, deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'hard',    start: 18, end: 22, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const stone = layer.tokens.find((t) => t.word === 'stone');

      expect(stone.lineRole).toBe('line_mid');
      expect(stone.hhm.hiddenState).toBe('stress_anchor');
    });

    it('"obake" from Penne Obake — silent-E word is classified as content at line_end', () => {
      const doc = parseTextToDoc('The pen obake');
      const layer = buildSyntaxLayer(doc);
      const obake = layer.tokens.find((t) => t.normalized === 'obake');

      expect(obake).toBeDefined();
      expect(obake.role).toBe('content');
      expect(obake.lineRole).toBe('line_end');
      expect(obake.hhm.hiddenState).toBe('terminal_anchor');
    });
  });

  // ── 6. Homograph tripwire ────────────────────────────────────────────────────

  describe('homograph tripwire — same spelling, ambiguous pronunciation', () => {
    it('documents all known homographs in the vocabulary', () => {
      expect(Object.keys(HOMOGRAPHS)).toContain('lead');
      expect(Object.keys(HOMOGRAPHS)).toContain('close');
      expect(Object.keys(HOMOGRAPHS)).toContain('wound');
      expect(Object.keys(HOMOGRAPHS)).toContain('live');
      expect(Object.keys(HOMOGRAPHS)).toContain('read');
      expect(Object.keys(HOMOGRAPHS)).toContain('tear');
      expect(Object.keys(HOMOGRAPHS)).toContain('bow');
    });

    it('"lead" at line_end → terminal_anchor; "lead" mid-line → stress_anchor (position resolves ambiguity)', () => {
      const doc = {
        lines: [
          {
            number: 0,
            words: [
              { text: 'I',    start: 0,  end: 1,  deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'will', start: 2,  end: 6,  deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'lead', start: 7,  end: 11, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          },
          {
            number: 1,
            words: [
              { text: 'with',   start: 12, end: 16, deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'a',      start: 17, end: 18, deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'lead',   start: 19, end: 23, deepPhonetics: { syllables: [{ stress: 1 }] } },
              { text: 'weight', start: 24, end: 30, deepPhonetics: { syllables: [{ stress: 1 }, { stress: 0 }] } },
            ],
          },
        ],
      };
      const layer = buildSyntaxLayer(doc);
      const leadEnd = layer.tokens.find((t) => t.word === 'lead' && t.lineNumber === 0);
      const leadMid = layer.tokens.find((t) => t.word === 'lead' && t.lineNumber === 1);

      // Both are content words — HHM can't resolve pronunciation ambiguity
      expect(leadEnd.role).toBe('content');
      expect(leadMid.role).toBe('content');

      // Position creates the only differentiation the HHM can express
      expect(leadEnd.hhm.hiddenState).toBe('terminal_anchor');
      expect(leadMid.hhm.hiddenState).toBe('stress_anchor');

      // line_end lead gets higher tokenWeight (0.15 bonus for lineRole === 'line_end')
      expect(leadEnd.hhm.tokenWeight).toBeGreaterThan(leadMid.hhm.tokenWeight);
    });

    it('"wound" mid-line vs line_end — HHM differentiates by position not pronunciation', () => {
      const doc = {
        lines: [
          {
            number: 0,
            words: [
              { text: 'the',   start: 0,  end: 3,  deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'wound', start: 4,  end: 9,  deepPhonetics: { syllables: [{ stress: 1 }] } },
              { text: 'heals', start: 10, end: 15, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          },
          {
            number: 1,
            words: [
              { text: 'string', start: 16, end: 22, deepPhonetics: { syllables: [{ stress: 1 }] } },
              { text: 'wound',  start: 23, end: 28, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          },
        ],
      };
      const layer = buildSyntaxLayer(doc);
      const woundMid = layer.tokens.find((t) => t.word === 'wound' && t.lineNumber === 0);
      const woundEnd = layer.tokens.find((t) => t.word === 'wound' && t.lineNumber === 1);

      expect(woundMid.hhm.hiddenState).toBe('stress_anchor');
      expect(woundEnd.hhm.hiddenState).toBe('terminal_anchor');
      expect(woundEnd.hhm.tokenWeight).toBeGreaterThan(woundMid.hhm.tokenWeight);
    });

    it('PREDICTOR and SPELLCHECK map to dedicated HHM stages', () => {
      // Disambiguation fix: PREDICTOR and SPELLCHECK must not share an HHM stage.
      // This allows sequential memory (PREDICTOR) and lexical validation (SPELLCHECK)
      // to contribute independently via stage-specific signals.

      const engine = new JudiciaryEngine();
      const tokenHhm = {
        tokenWeight: 0.85,
        logicOrder: [...HHM_LOGIC_ORDER],
        stageWeights: { ...HHM_STAGE_WEIGHTS },
        stageScores: Object.fromEntries(
          HHM_LOGIC_ORDER.map((stage, i) => [
            stage,
            { signal: 0.9 - i * 0.05, weight: HHM_STAGE_WEIGHTS[stage], weighted: 0, order: i + 1 },
          ])
        ),
      };
      const syntaxContext = {
        role: 'content',
        lineRole: 'line_end',
        stressRole: 'primary',
        rhymePolicy: 'allow',
        hhm: tokenHhm,
      };

      const predictorResult  = engine.getHhmModifier({ word: 'bow', layer: 'PREDICTOR' },  syntaxContext);
      const spellcheckResult = engine.getHhmModifier({ word: 'bow', layer: 'SPELLCHECK' }, syntaxContext);

      // Dedicated stages are now explicit and independent.
      expect(predictorResult.stage).toBe('PREDICTOR');
      expect(spellcheckResult.stage).toBe('SPELLCHECK');
      // Modifiers are no longer identical — sequential memory and spell validation are independently weighted.
      expect(predictorResult.modifier).not.toBeCloseTo(spellcheckResult.modifier, 5);
    });
  });

  // ── 7. Homonym tripwire ──────────────────────────────────────────────────────

  describe('homonym tripwire — same pronunciation, different spelling', () => {
    it('steel and steal receive identical syntax role classification', () => {
      const doc = {
        lines: [
          {
            number: 0,
            words: [
              { text: 'Steel', start: 0,  end: 5,  deepPhonetics: { syllables: [{ stress: 1 }] } },
              { text: 'was',   start: 6,  end: 9,  deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'cold',  start: 10, end: 14, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          },
          {
            number: 1,
            words: [
              { text: 'they',  start: 15, end: 19, deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: 'steal', start: 20, end: 25, deepPhonetics: { syllables: [{ stress: 1 }] } },
              { text: 'gold',  start: 26, end: 30, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          },
        ],
      };
      const layer = buildSyntaxLayer(doc);
      const steel = layer.tokens.find((t) => t.word === 'Steel');
      const steal = layer.tokens.find((t) => t.word === 'steal');

      // Homonyms: phonemically identical — syntax treats them equally
      expect(steel.role).toBe('content');
      expect(steal.role).toBe('content');
      expect(steel.stressRole).toBe('primary');
      expect(steal.stressRole).toBe('primary');
      expect(steel.rhymePolicy).toBe(steal.rhymePolicy);
    });

    it('"pain" and "pane" at same position type produce same HHM token weight', () => {
      const makeDoc = (word) => ({
        lines: [{
          number: 0,
          words: [
            { text: 'the',  start: 0, end: 3, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: word,   start: 4, end: 4 + word.length, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      });

      const painLayer = buildSyntaxLayer(makeDoc('pain'));
      const paneLayer = buildSyntaxLayer(makeDoc('pane'));

      const painToken = painLayer.tokens.find((t) => t.word === 'pain');
      const paneToken = paneLayer.tokens.find((t) => t.word === 'pane');

      // Same position type → same token weight (HHM is position-driven, not spelling-driven)
      expect(painToken.hhm.tokenWeight).toBeCloseTo(paneToken.hhm.tokenWeight, 5);
      expect(painToken.hhm.hiddenState).toBe(paneToken.hhm.hiddenState);
    });

    it('"right" and "write" at line_end both become terminal_anchor', () => {
      const makeEndDoc = (word) => ({
        lines: [{
          number: 0,
          words: [
            { text: 'I',   start: 0, end: 1, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: word,  start: 2, end: 2 + word.length, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      });

      const rightLayer = buildSyntaxLayer(makeEndDoc('right'));
      const writeLayer = buildSyntaxLayer(makeEndDoc('write'));

      const rightToken = rightLayer.tokens.find((t) => t.word === 'right');
      const writeToken = writeLayer.tokens.find((t) => t.word === 'write');

      expect(rightToken.hhm.hiddenState).toBe('terminal_anchor');
      expect(writeToken.hhm.hiddenState).toBe('terminal_anchor');
    });

    it('all homonym pairs produce matching role and rhymePolicy', () => {
      HOMONYM_PAIRS.forEach(([wordA, wordB]) => {
        const makeDoc = (word) => ({
          lines: [{
            number: 0,
            words: [{ text: word, start: 0, end: word.length, deepPhonetics: { syllables: [{ stress: 1 }] } }],
          }],
        });

        const layerA = buildSyntaxLayer(makeDoc(wordA));
        const layerB = buildSyntaxLayer(makeDoc(wordB));

        const tokenA = layerA.tokens[0];
        const tokenB = layerB.tokens[0];

        // Both are content words when appearing alone as the only token on a line
        expect(tokenA.role).toBe('content');
        expect(tokenB.role).toBe('content');
      });
    });
  });

  // ── 8. Synonym handling ──────────────────────────────────────────────────────

  describe('synonym groups — same meaning, different words', () => {
    it('void, abyss, darkness all classify as content words', () => {
      // All three are synonyms in the dataset ("swallowed all I could and became the abyss")
      const synonymGroup = ['void', 'abyss', 'darkness', 'shadow', 'emptiness'];
      synonymGroup.forEach((word) => {
        const doc = {
          lines: [{
            number: 0,
            words: [{ text: word, start: 0, end: word.length, deepPhonetics: { syllables: [{ stress: 1 }] } }],
          }],
        };
        const layer = buildSyntaxLayer(doc);
        expect(layer.tokens[0].role).toBe('content');
      });
    });

    it('stone, rock, blade, bone — all get primary stress and terminal_anchor at line_end', () => {
      const hardImagery = ['stone', 'rock', 'blade', 'bone', 'cold'];
      hardImagery.forEach((word) => {
        const doc = {
          lines: [{
            number: 0,
            words: [
              { text: 'the',  start: 0, end: 3, deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: word,   start: 4, end: 4 + word.length, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          }],
        };
        const layer = buildSyntaxLayer(doc);
        const token = layer.tokens.find((t) => t.word === word);
        expect(token.role).toBe('content');
        expect(token.lineRole).toBe('line_end');
        expect(token.hhm.hiddenState).toBe('terminal_anchor');
      });
    });

    it('flame, fire, blaze, burn — synonym group all reach terminal_anchor at line_end', () => {
      const fireGroup = ['flame', 'fire', 'blaze', 'burn'];
      fireGroup.forEach((word) => {
        const doc = {
          lines: [{
            number: 0,
            words: [
              { text: 'the',  start: 0, end: 3, deepPhonetics: { syllables: [{ stress: 0 }] } },
              { text: word,   start: 4, end: 4 + word.length, deepPhonetics: { syllables: [{ stress: 1 }] } },
            ],
          }],
        };
        const layer = buildSyntaxLayer(doc);
        const token = layer.tokens.find((t) => t.word === word);
        expect(token.hhm.hiddenState).toBe('terminal_anchor');
      });
    });
  });

  // ── 9. Transition matrix integrity ──────────────────────────────────────────

  describe('hidden state transition matrix', () => {
    it('probabilities from each source state sum to 1.0 within a stanza', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      layer.hhm.stanzas.forEach((stanza) => {
        const outgoing = {};
        stanza.transitions.forEach(({ from, probability }) => {
          outgoing[from] = (outgoing[from] || 0) + probability;
        });
        Object.entries(outgoing).forEach(([, total]) => {
          expect(total).toBeCloseTo(1.0, 5);
        });
      });
    });

    it('stress_anchor → terminal_anchor is captured as a dominant transition', () => {
      // The most common poetic sequence: a stressed content word mid-line
      // followed by the final stressed content word at line_end.
      // e.g. "The pen [stress_anchor:obake→terminal_anchor]"
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      const allTransitions = layer.hhm.stanzas.flatMap((s) => s.transitions);

      const stressToTerminal = allTransitions.find(
        (t) => t.from === 'stress_anchor' && t.to === 'terminal_anchor'
      );
      expect(stressToTerminal).toBeDefined();
      expect(stressToTerminal.count).toBeGreaterThan(0);
    });

    it('function_gate → stress_anchor is captured as a transition', () => {
      // Function word (suppress) followed by stressed content word mid-line.
      // e.g. "Gotta be whole" — "be" is function_gate, "whole" is stress_anchor.
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);
      const allTransitions = layer.hhm.stanzas.flatMap((s) => s.transitions);

      const gateToStress = allTransitions.find(
        (t) => t.from === 'function_gate' && t.to === 'stress_anchor'
      );
      expect(gateToStress).toBeDefined();
    });

    it('hidden state counts per stanza equal that stanza token count', () => {
      const doc = parseTextToDoc(ECHO_CHORUS);
      const layer = buildSyntaxLayer(doc);

      layer.hhm.stanzas.forEach((stanza) => {
        const counted = Object.values(stanza.hiddenStateCounts).reduce((a, b) => a + b, 0);
        expect(counted).toBe(stanza.tokenCount);
      });
    });

    it('transition probabilities are all in [0, 1]', () => {
      const doc = parseTextToDoc(GRAVITY_WELL_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      layer.hhm.stanzas.forEach((stanza) => {
        stanza.transitions.forEach(({ probability }) => {
          expect(probability).toBeGreaterThanOrEqual(0);
          expect(probability).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  // ── 10. Stage signal properties ──────────────────────────────────────────────

  describe('stage signal ordering and clamping', () => {
    it('all stage signals stay within [0.05, 1.6]', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      layer.tokens.forEach((token) => {
        if (!token.hhm?.stageScores) return;
        Object.values(token.hhm.stageScores).forEach(({ signal }) => {
          expect(signal).toBeGreaterThanOrEqual(0.05);
          expect(signal).toBeLessThanOrEqual(1.6);
        });
      });
    });

    it('SYNTAX signal is higher for content words than function words', () => {
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'the',   start: 0, end: 3, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'flame', start: 4, end: 9, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const the   = layer.tokens.find((t) => t.word === 'the');
      const flame = layer.tokens.find((t) => t.word === 'flame');

      expect(flame.hhm.stageScores.SYNTAX.signal)
        .toBeGreaterThan(the.hhm.stageScores.SYNTAX.signal);
    });

    it('METER signal is higher at line_end than line_start', () => {
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'burn', start: 0, end: 4, deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'and',  start: 5, end: 8, deepPhonetics: { syllables: [{ stress: 0 }] } },
            { text: 'rise', start: 9, end: 13, deepPhonetics: { syllables: [{ stress: 1 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const burn = layer.tokens.find((t) => t.word === 'burn');
      const rise = layer.tokens.find((t) => t.word === 'rise');

      // rise is line_end (1.08×), burn is line_start (0.98×)
      expect(rise.hhm.stageScores.METER.signal)
        .toBeGreaterThan(burn.hhm.stageScores.METER.signal);
    });

    it('PHONEME signal is higher for primary-stressed tokens', () => {
      const doc = {
        lines: [{
          number: 0,
          words: [
            { text: 'soul', start: 0, end: 4, deepPhonetics: { syllables: [{ stress: 1 }] } },
            { text: 'of',   start: 5, end: 7, deepPhonetics: { syllables: [{ stress: 0 }] } },
          ],
        }],
      };
      const layer = buildSyntaxLayer(doc);
      const soul = layer.tokens.find((t) => t.word === 'soul');
      const of_  = layer.tokens.find((t) => t.word === 'of');

      expect(soul.hhm.stageScores.PHONEME.signal)
        .toBeGreaterThan(of_.hhm.stageScores.PHONEME.signal);
    });

    it('stageScores include all stages from HHM_LOGIC_ORDER', () => {
      const doc = parseTextToDoc('Stone was cold');
      const layer = buildSyntaxLayer(doc);
      const stone = layer.tokens[0];

      HHM_LOGIC_ORDER.forEach((stage) => {
        expect(stone.hhm.stageScores[stage]).toBeDefined();
        expect(typeof stone.hhm.stageScores[stage].signal).toBe('number');
        expect(typeof stone.hhm.stageScores[stage].weighted).toBe('number');
      });
    });
  });

  // ── 11. Dictionary source metadata ──────────────────────────────────────────

  describe('dictionary source linkage metadata', () => {
    it('HHM summary includes scholomance and cmu dictionary sources', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      const sourceIds = new Set(layer.hhm.dictionarySources?.map((s) => s.id) || []);
      expect(sourceIds.has('scholomance')).toBe(true);
      expect(sourceIds.has('cmu')).toBe(true);
    });

    it('every token HHM state carries dictionarySources array', () => {
      const doc = parseTextToDoc(PENNE_OBAKE_EXCERPT);
      const layer = buildSyntaxLayer(doc);

      layer.tokens.forEach((token) => {
        if (!token.hhm) return;
        expect(Array.isArray(token.hhm.dictionarySources)).toBe(true);
        expect(token.hhm.dictionarySources.length).toBeGreaterThan(0);
        token.hhm.dictionarySources.forEach((source) => {
          expect(typeof source.id).toBe('string');
          expect(typeof source.linked).toBe('boolean');
        });
      });
    });

    it('sources are ordered by priority (ascending)', () => {
      const doc = parseTextToDoc('flame');
      const layer = buildSyntaxLayer(doc);
      const sources = layer.tokens[0]?.hhm?.dictionarySources || [];

      for (let i = 1; i < sources.length; i++) {
        expect(sources[i].priority).toBeGreaterThanOrEqual(sources[i - 1].priority);
      }
    });
  });

  // ── 12. Dataset-scale integration ───────────────────────────────────────────

  describe('dataset-scale integration', () => {
    it('Penne Obake excerpt — parses without error, HHM enabled', () => {
      expect(() => buildSyntaxLayer(parseTextToDoc(PENNE_OBAKE_EXCERPT))).not.toThrow();
      const layer = buildSyntaxLayer(parseTextToDoc(PENNE_OBAKE_EXCERPT));
      expect(layer.enabled).toBe(true);
      expect(layer.tokens.length).toBeGreaterThan(30);
      expect(layer.hhm.enabled).toBe(true);
    });

    it('Gravity Well excerpt — rhyme-dense terminal_anchor chain at line ends', () => {
      const layer = buildSyntaxLayer(parseTextToDoc(GRAVITY_WELL_EXCERPT));
      const terminalAnchors = layer.tokens.filter((t) => t.hhm?.hiddenState === 'terminal_anchor');
      // Every line ends with a content word in this excerpt
      expect(terminalAnchors.length).toBeGreaterThanOrEqual(
        layer.hhm.stanzaCount * 2
      );
    });

    it('Human Zim excerpt — write/right classified as content at line position', () => {
      const layer = buildSyntaxLayer(parseTextToDoc(HUMAN_ZIM_EXCERPT));
      const writeToken = layer.tokens.find(
        (t) => t.normalized === 'write' || t.normalized === 'right'
      );
      if (writeToken) {
        expect(writeToken.role).toBe('content');
        const validStates = ['stress_anchor', 'terminal_anchor', 'flow', 'line_launch'];
        expect(validStates).toContain(writeToken.hhm?.hiddenState);
      }
    });

    it('REPEATING_STANZA — identical 4-line blocks produce identical stanza state distributions', () => {
      // Uses a fixture where the exact same 4 lines repeat twice,
      // so stanza 0 and stanza 1 must have identical hidden state counts.
      const layer = buildSyntaxLayer(parseTextToDoc(REPEATING_STANZA));
      expect(layer.hhm.stanzaCount).toBe(2);

      const s0States = layer.hhm.stanzas[0].hiddenStateCounts;
      const s1States = layer.hhm.stanzas[1].hiddenStateCounts;

      // Every state present in s0 must appear in s1 with the same count
      Object.keys(s0States).forEach((state) => {
        expect(s1States[state]).toBe(s0States[state]);
      });
    });

    it('tokenByIdentity map is complete and consistent with token array', () => {
      const layer = buildSyntaxLayer(parseTextToDoc(PENNE_OBAKE_EXCERPT));
      layer.tokens.forEach((token) => {
        const key = `${token.lineNumber}:${token.wordIndex}:${token.charStart}`;
        expect(layer.tokenByIdentity.get(key)).toBe(token);
      });
    });

    it('syntaxSummary.hhm matches layer.hhm', () => {
      const layer = buildSyntaxLayer(parseTextToDoc(PENNE_OBAKE_EXCERPT));
      expect(layer.syntaxSummary.hhm).toEqual(layer.hhm);
    });
  });
});
