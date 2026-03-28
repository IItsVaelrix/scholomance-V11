import { describe, expect, it, vi } from 'vitest';
import { buildPhoneticSignature } from '../../codex/core/rhyme-astrology/signatures.js';
import { createRhymeAstrologyQueryEngine } from '../../codex/runtime/rhyme-astrology/queryEngine.js';

function makeNode(id, token, phonemes, frequencyScore = 0.5) {
  const signature = buildPhoneticSignature(phonemes);
  return {
    id,
    token,
    normalized: token,
    phonemes: signature.phonemes,
    stressPattern: signature.stressPattern,
    syllableCount: signature.syllableCount,
    vowelSkeleton: signature.vowelSkeleton,
    consonantSkeleton: signature.consonantSkeleton,
    endingSignature: signature.endingSignature,
    onsetSignature: signature.onsetSignature,
    frequencyScore,
    signature,
  };
}

describe('[Runtime] rhyme-astrology queryEngine', () => {
  it('uses hot-edge results for known anchor words', async () => {
    const flame = makeNode('w_1', 'flame', ['F', 'L', 'EY1', 'M'], 0.95);
    const frame = makeNode('w_2', 'frame', ['F', 'R', 'EY1', 'M'], 0.8);
    const phonemeEngine = {
      ensureInitialized: vi.fn(async () => {}),
      analyzeDeep: vi.fn(() => null),
    };

    const lexiconRepo = {
      lookupNodesByNormalizedBatch: vi.fn(() => ({ flame })),
      lookupNodeByNormalized: vi.fn(() => flame),
      close: vi.fn(),
    };
    const indexRepo = {
      lookupHotEdges: vi.fn(() => [{
        toId: 'w_2',
        toToken: 'frame',
        exactRhymeScore: 1,
        slantRhymeScore: 1,
        vowelMatchScore: 1,
        consonantMatchScore: 0.9,
        stressAlignmentScore: 1,
        syllableDeltaPenalty: 0,
        overallScore: 0.97,
        reasons: ['matching ending signature EY1-M'],
      }]),
      lookupBucketMembers: vi.fn(() => [frame]),
      lookupClustersByEndingSignature: vi.fn(() => []),
      close: vi.fn(),
    };

    const engine = createRhymeAstrologyQueryEngine({
      lexiconRepo,
      indexRepo,
      phonemeEngine,
      cacheSize: 20,
    });

    const result = await engine.query({
      text: 'flame',
      mode: 'word',
      limit: 10,
      minScore: 0.1,
    });

    expect(result.topMatches).toHaveLength(1);
    expect(result.topMatches[0]).toMatchObject({
      nodeId: 'w_2',
      token: 'frame',
    });
    expect(result.diagnostics.cacheHit).toBe(false);
    expect(result.diagnostics.candidateCount).toBe(1);
    expect(indexRepo.lookupHotEdges).toHaveBeenCalledWith('w_1', expect.any(Number));

    engine.close();
  });

  it('falls back to bucket scoring and serves cache hits', async () => {
    const frame = makeNode('w_2', 'frame', ['F', 'R', 'EY1', 'M'], 0.8);
    const name = makeNode('w_3', 'name', ['N', 'EY1', 'M'], 0.7);
    const phonemeEngine = {
      ensureInitialized: vi.fn(async () => {}),
      analyzeDeep: vi.fn((token) => {
        if (token === 'blame') {
          return { phonemes: ['B', 'L', 'EY1', 'M'] };
        }
        return { phonemes: [] };
      }),
    };

    const lexiconRepo = {
      lookupNodesByNormalizedBatch: vi.fn(() => ({})),
      lookupNodeByNormalized: vi.fn(() => null),
      close: vi.fn(),
    };
    const indexRepo = {
      lookupHotEdges: vi.fn(() => []),
      lookupBucketMembers: vi.fn(() => [frame, name]),
      lookupClustersByEndingSignature: vi.fn(() => []),
      close: vi.fn(),
    };

    const engine = createRhymeAstrologyQueryEngine({
      lexiconRepo,
      indexRepo,
      phonemeEngine,
      cacheSize: 20,
      bucketCandidateCap: 50,
    });

    const first = await engine.query({
      text: 'blame',
      mode: 'word',
      limit: 5,
      minScore: 0,
    });
    const second = await engine.query({
      text: 'blame',
      mode: 'word',
      limit: 5,
      minScore: 0,
    });

    expect(first.diagnostics.cacheHit).toBe(false);
    expect(first.topMatches.length).toBeGreaterThan(0);
    expect(first.diagnostics.candidateCount).toBeGreaterThan(0);
    expect(second.diagnostics.cacheHit).toBe(true);
    expect(second.topMatches).toEqual(first.topMatches);
    expect(indexRepo.lookupBucketMembers).toHaveBeenCalledTimes(1);

    engine.close();
  });

  it('returns line-query metadata for line mode', async () => {
    const flame = makeNode('w_1', 'flame', ['F', 'L', 'EY1', 'M'], 0.95);
    const same = makeNode('w_4', 'same', ['S', 'EY1', 'M'], 0.8);
    const frame = makeNode('w_2', 'frame', ['F', 'R', 'EY1', 'M'], 0.75);
    const phonemeEngine = {
      ensureInitialized: vi.fn(async () => {}),
      analyzeDeep: vi.fn(() => null),
    };

    const lexiconRepo = {
      lookupNodesByNormalizedBatch: vi.fn(() => ({ flame, same })),
      lookupNodeByNormalized: vi.fn((token) => (token === 'flame' ? flame : same)),
      close: vi.fn(),
    };
    const indexRepo = {
      lookupHotEdges: vi.fn(() => []),
      lookupBucketMembers: vi.fn(() => [flame, frame]),
      lookupClustersByEndingSignature: vi.fn(() => []),
      close: vi.fn(),
    };

    const engine = createRhymeAstrologyQueryEngine({
      lexiconRepo,
      indexRepo,
      phonemeEngine,
      cacheSize: 20,
    });

    const result = await engine.query({
      text: 'flame same',
      mode: 'line',
      limit: 5,
      minScore: 0,
    });

    expect(result.query.tokens).toEqual(['flame', 'same']);
    expect(result.query.lineEndingSignature).toBe('EY1-M');
    expect(Array.isArray(result.query.internalPattern)).toBe(true);
    expect(typeof result.query.stressContour).toBe('string');

    engine.close();
  });

  it('accepts VerseIR-backed anchors and returns compiler metadata', async () => {
    const same = makeNode('w_4', 'same', ['S', 'EY1', 'M'], 0.8);
    const frame = makeNode('w_2', 'frame', ['F', 'R', 'EY1', 'M'], 0.75);
    const phonemeEngine = {
      ensureInitialized: vi.fn(async () => {}),
      analyzeDeep: vi.fn(() => null),
    };

    const verseIR = {
      version: '1.0.0',
      rawText: 'flame same',
      normalizedText: 'flame same',
      lines: [
        {
          lineIndex: 0,
          text: 'flame same',
          tokenIds: [0, 1],
        },
      ],
      tokens: [
        {
          id: 0,
          text: 'flame',
          normalized: 'flame',
          lineIndex: 0,
          tokenIndexInLine: 0,
          charStart: 0,
          charEnd: 5,
          syllableCount: 1,
          phonemes: ['F', 'L', 'EY1', 'M'],
          stressPattern: '1',
          onset: ['F', 'L'],
          nucleus: ['EY'],
          coda: ['M'],
          rhymeTailSignature: 'EY1-M',
          consonantSkeleton: 'FLM',
          extendedRhymeKeys: ['EY1-M'],
          primaryStressedVowelFamily: 'EY',
          terminalVowelFamily: 'EY',
          flags: {
            isLineStart: true,
            isLineEnd: false,
          },
        },
        {
          id: 1,
          text: 'same',
          normalized: 'same',
          lineIndex: 0,
          tokenIndexInLine: 1,
          charStart: 6,
          charEnd: 10,
          syllableCount: 1,
          phonemes: ['S', 'EY1', 'M'],
          stressPattern: '1',
          onset: ['S'],
          nucleus: ['EY'],
          coda: ['M'],
          rhymeTailSignature: 'EY1-M',
          consonantSkeleton: 'SM',
          extendedRhymeKeys: ['EY1-M'],
          primaryStressedVowelFamily: 'EY',
          terminalVowelFamily: 'EY',
          flags: {
            isLineStart: false,
            isLineEnd: true,
          },
        },
      ],
      syllableWindows: [
        {
          id: 0,
          tokenSpan: [0, 1],
          lineSpan: [0, 0],
          charStart: 0,
          charEnd: 10,
          syllableLength: 2,
          phonemeSpan: ['F', 'L', 'EY1', 'M', 'S', 'EY1', 'M'],
          vowelSequence: ['EY', 'EY'],
          stressContour: '11',
          codaContour: 'M/M',
          signature: '2:EY/EY:M/M:11',
        },
      ],
      metadata: {
        mode: 'balanced',
        lineBreakStyle: 'none',
        tokenCount: 2,
        lineCount: 1,
        syllableWindowCount: 1,
        whitespaceFidelity: true,
      },
    };

    const lexiconRepo = {
      lookupNodesByNormalizedBatch: vi.fn(() => ({ same })),
      lookupNodeByNormalized: vi.fn(() => same),
      close: vi.fn(),
    };
    const indexRepo = {
      lookupHotEdges: vi.fn(() => [{
        toId: 'w_2',
        toToken: 'frame',
        exactRhymeScore: 1,
        slantRhymeScore: 1,
        vowelMatchScore: 1,
        consonantMatchScore: 0.9,
        stressAlignmentScore: 1,
        syllableDeltaPenalty: 0,
        overallScore: 0.96,
        reasons: ['matching ending signature EY1-M'],
      }]),
      lookupBucketMembers: vi.fn(() => [frame]),
      lookupClustersByEndingSignature: vi.fn(() => []),
      close: vi.fn(),
    };

    const engine = createRhymeAstrologyQueryEngine({
      lexiconRepo,
      indexRepo,
      phonemeEngine,
      cacheSize: 20,
    });

    const result = await engine.query({
      text: 'same',
      mode: 'word',
      verseIR,
      anchorTokenId: 1,
      anchorWindowIds: [0],
      limit: 5,
      minScore: 0,
    });

    expect(result.topMatches[0]).toMatchObject({
      nodeId: 'w_2',
      token: 'frame',
    });
    expect(result.query.compiler).toMatchObject({
      verseIRVersion: '1.0.0',
      source: 'provided',
      anchorTokenId: 1,
      anchorLineIndex: 0,
      activeTokenIds: [1],
      activeWindowIds: [0],
    });
    expect(result.query.tokens).toEqual(['same']);
    expect(indexRepo.lookupHotEdges).toHaveBeenCalledWith('w_4', expect.any(Number));

    engine.close();
  });
});
