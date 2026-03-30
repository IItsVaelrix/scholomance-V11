import { describe, it, expect } from 'vitest';
import { buildSyntaxLayer } from './src/lib/syntax.layer.js';

/**
 * A mock document parser. In the actual codebase, this would be the real implementation.
 * It converts plain text into the document structure that buildSyntaxLayer expects.
 * @param {string} text
 */
function parseTextToDoc(text) {
  const lines = text.split('\n').map((line, i) => {
    let charIndex = 0;
    const words = line.split(' ').map((word) => {
      const start = line.indexOf(word, charIndex);
      const end = start + word.length;
      charIndex = end;
      return { text: word, start, end, deepPhonetics: { syllables: [{ stress: 1 }] } };
    });
    return { words, number: i };
  });
  return { lines };
}

describe('Scholomance CODEx: Linguistic IQ Assessment', () => {

  describe('Syntactical Interpretation', () => {
    it('Correctly identifies function words vs. content words using HMM', () => {
      const text = "The quick brown fox jumps over the lazy dog";
      const doc = parseTextToDoc(text);
      const layer = buildSyntaxLayer(doc);

      const roles = layer.tokens.map(t => t.role);

      // The HMM should correctly classify these based on statistical likelihood
      expect(roles).toEqual([
        'function', // The
        'content',  // quick
        'content',  // brown
        'content',  // fox
        'content',  // jumps
        'function', // over
        'function', // the
        'content',  // lazy
        'content',  // dog
      ]);
    });

    it('Uses contextual triggers to refine HMM predictions for ambiguous words', () => {
      // "will" is a verb trigger, so "run" should be content (a verb)
      const text = "He will run";
      const doc = parseTextToDoc(text);
      const layer = buildSyntaxLayer(doc);

      const runToken = layer.tokens.find(t => t.normalized === 'run');
      expect(runToken.role).toBe('content');
      expect(runToken.reasons).toContain('verb_precursor_context');

      // "my" is a noun trigger, so "will" becomes content (a noun)
      const text2 = "I admire my will";
      const doc2 = parseTextToDoc(text2);
      const layer2 = buildSyntaxLayer(doc2);

      const willToken = layer2.tokens.find(t => t.normalized === 'will');
      expect(willToken.role).toBe('content');
      expect(willToken.reasons).toContain('noun_precursor_context');
    });

    it('Assigns line roles correctly (start, mid, end)', () => {
      const text = "One\nTwo Three\nFour Five Six";
      const doc = parseTextToDoc(text);
      const layer = buildSyntaxLayer(doc);

      const one = layer.tokens.find(t => t.normalized === 'one');
      const three = layer.tokens.find(t => t.normalized === 'three');
      const four = layer.tokens.find(t => t.normalized === 'four');
      const five = layer.tokens.find(t => t.normalized === 'five');
      const six = layer.tokens.find(t => t.normalized === 'six');

      // A single-word line is considered the end of the line
      expect(one.lineRole).toBe('line_end');
      expect(three.lineRole).toBe('line_end');
      expect(four.lineRole).toBe('line_start');
      expect(five.lineRole).toBe('line_mid');
      expect(six.lineRole).toBe('line_end');
    });

    it('[Aspirational] HHM correctly identifies hidden states in ambiguous phrases', () => {
      // "Fruit flies like a banana" is a classic syntactic ambiguity example.
      const text = "Fruit flies like a banana";
      const doc = parseTextToDoc(text);
      const layer = buildSyntaxLayer(doc);

      const fliesToken = layer.tokens.find(t => t.normalized === 'flies');
      const bananaToken = layer.tokens.find(t => t.normalized === 'banana');

      // HHM states are rhythmic/syntactic anchors, not POS tags.
      expect(fliesToken.hhm.hiddenState).toBe('stress_anchor');
      expect(fliesToken.hhm.stageScores.SYNTAX.signal).toBeGreaterThan(0.9);
      expect(bananaToken.hhm.hiddenState).toBe('terminal_anchor');
    });
  });
});
