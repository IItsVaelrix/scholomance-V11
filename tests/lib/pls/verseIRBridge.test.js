import { describe, expect, it } from 'vitest';
import {
  attachPlsVerseIRBridge,
  buildPlsVerseIRBridge,
  resolvePlsVerseIRState,
} from '../../../src/lib/pls/verseIRBridge.js';

function createCompilerRef({
  lineIndex,
  tokenId,
  word,
  charStart,
  charEnd,
  rhymeTailSignature,
  primaryStressedVowelFamily,
  terminalVowelFamily,
  isLineStart = false,
  isLineEnd = false,
  activeWindowIds = [],
  syllableCount = 1,
}) {
  return {
    lineIndex,
    tokenId,
    charStart,
    charEnd,
    rhymeTailSignature,
    primaryStressedVowelFamily,
    terminalVowelFamily,
    isLineStart,
    isLineEnd,
    activeWindowIds,
    syllableCount,
    normalizedWord: String(word || '').toUpperCase(),
  };
}

describe('verseIRBridge', () => {
  it('resolves the most recent matching line end and the adjacent current line', () => {
    const bridge = buildPlsVerseIRBridge(
      {
        verseIRVersion: '1.0.0',
        mode: 'line-aware',
        tokenCount: 6,
        lineCount: 3,
        syllableWindowCount: 3,
      },
      {
        enabled: true,
        inspector: {
          anchors: [
            {
              word: 'ember',
              normalizedWord: 'EMBER',
              lineIndex: 0,
              compilerRef: createCompilerRef({
                lineIndex: 0,
                tokenId: 0,
                word: 'ember',
                charStart: 0,
                charEnd: 5,
                primaryStressedVowelFamily: 'EH',
                terminalVowelFamily: 'ER',
                isLineStart: true,
              }),
            },
            {
              word: 'stone',
              normalizedWord: 'STONE',
              lineIndex: 0,
              compilerRef: createCompilerRef({
                lineIndex: 0,
                tokenId: 1,
                word: 'stone',
                charStart: 6,
                charEnd: 11,
                rhymeTailSignature: 'OW-N',
                primaryStressedVowelFamily: 'OW',
                terminalVowelFamily: 'OW',
                isLineEnd: true,
              }),
            },
            {
              word: 'echo',
              normalizedWord: 'ECHO',
              lineIndex: 1,
              compilerRef: createCompilerRef({
                lineIndex: 1,
                tokenId: 2,
                word: 'echo',
                charStart: 12,
                charEnd: 16,
                primaryStressedVowelFamily: 'EH',
                terminalVowelFamily: 'OW',
                isLineStart: true,
                activeWindowIds: [4],
              }),
            },
            {
              word: 'stone',
              normalizedWord: 'STONE',
              lineIndex: 1,
              compilerRef: createCompilerRef({
                lineIndex: 1,
                tokenId: 3,
                word: 'stone',
                charStart: 17,
                charEnd: 22,
                rhymeTailSignature: 'OW-N',
                primaryStressedVowelFamily: 'OW',
                terminalVowelFamily: 'OW',
                isLineEnd: true,
                activeWindowIds: [4],
              }),
            },
            {
              word: 'echo',
              normalizedWord: 'ECHO',
              lineIndex: 2,
              compilerRef: createCompilerRef({
                lineIndex: 2,
                tokenId: 4,
                word: 'echo',
                charStart: 23,
                charEnd: 27,
                primaryStressedVowelFamily: 'EH',
                terminalVowelFamily: 'OW',
                isLineStart: true,
                activeWindowIds: [5],
              }),
            },
            {
              word: 'hollow',
              normalizedWord: 'HOLLOW',
              lineIndex: 2,
              compilerRef: createCompilerRef({
                lineIndex: 2,
                tokenId: 5,
                word: 'hollow',
                charStart: 28,
                charEnd: 34,
                rhymeTailSignature: 'AA-OW',
                primaryStressedVowelFamily: 'AA',
                terminalVowelFamily: 'OW',
                isLineEnd: true,
                activeWindowIds: [5],
              }),
            },
          ],
          windows: [
            {
              id: 4,
              lineIndex: 1,
              repeated: true,
              syllableLength: 2,
              signature: 'EH-OW',
              anchorWords: ['echo', 'stone'],
            },
            {
              id: 5,
              lineIndex: 2,
              repeated: true,
              syllableLength: 2,
              signature: 'EH-OW',
              anchorWords: ['echo', 'hollow'],
            },
          ],
        },
      }
    );

    const state = resolvePlsVerseIRState({
      prevLineEndWord: 'stone',
      currentLineWords: ['echo'],
      plsPhoneticFeatures: attachPlsVerseIRBridge({ family: 'OW' }, bridge),
    });

    expect(state).not.toBeNull();
    expect(state?.previousLineEnd).toMatchObject({
      lineIndex: 1,
      normalizedWord: 'STONE',
      rhymeTailSignature: 'OW-N',
    });
    expect(state?.currentLine).toMatchObject({
      lineIndex: 2,
      repeatedWindowCount: 1,
    });
    expect(state?.currentLine?.anchorWords).toContain('ECHO');
    expect(state?.currentLine?.terminalRhymeTailSignatures).toContain('AA-OW');
    expect(state?.compiler).toMatchObject({
      verseIRVersion: '1.0.0',
      lineCount: 3,
    });
  });

  it('prefers the line immediately after the previous line end when overlap ties', () => {
    const bridge = buildPlsVerseIRBridge(
      null,
      {
        enabled: true,
        inspector: {
          anchors: [
            {
              word: 'night',
              normalizedWord: 'NIGHT',
              lineIndex: 0,
              compilerRef: createCompilerRef({
                lineIndex: 0,
                tokenId: 0,
                word: 'night',
                charStart: 0,
                charEnd: 5,
                rhymeTailSignature: 'AY-T',
                primaryStressedVowelFamily: 'AY',
                terminalVowelFamily: 'AY',
                isLineEnd: true,
              }),
            },
            {
              word: 'echo',
              normalizedWord: 'ECHO',
              lineIndex: 1,
              compilerRef: createCompilerRef({
                lineIndex: 1,
                tokenId: 1,
                word: 'echo',
                charStart: 6,
                charEnd: 10,
                primaryStressedVowelFamily: 'EH',
                terminalVowelFamily: 'OW',
              }),
            },
            {
              word: 'echo',
              normalizedWord: 'ECHO',
              lineIndex: 2,
              compilerRef: createCompilerRef({
                lineIndex: 2,
                tokenId: 2,
                word: 'echo',
                charStart: 11,
                charEnd: 15,
                primaryStressedVowelFamily: 'EH',
                terminalVowelFamily: 'OW',
              }),
            },
          ],
          windows: [],
        },
      }
    );

    const state = resolvePlsVerseIRState({
      prevLineEndWord: 'night',
      currentLineWords: ['echo'],
      plsPhoneticFeatures: { verseIRBridge: bridge },
    });

    expect(state?.previousLineEnd?.lineIndex).toBe(0);
    expect(state?.currentLine?.lineIndex).toBe(1);
  });

  it('returns null when the context has no usable VerseIR bridge', () => {
    expect(resolvePlsVerseIRState({
      prevLineEndWord: 'night',
      currentLineWords: ['echo'],
      plsPhoneticFeatures: null,
    })).toBeNull();

    expect(resolvePlsVerseIRState({
      prevLineEndWord: 'night',
      currentLineWords: ['echo'],
      plsPhoneticFeatures: { verseIRBridge: null },
    })).toBeNull();
  });
});
