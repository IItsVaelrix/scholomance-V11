/**
 * PixelBrain Truesight AMP — Unified Syntactic Bridge
 * 
 * Integrates VerseIR analysis, high-performance typography, and 
 * visual mapping into a single authoritative module.
 * 
 * DESIGN:
 * - Deterministic analysis pipeline
 * - O(1) word lookup via lattice coordinates
 * - Hardware-accelerated measurement cache
 */

import { buildTruesightOverlayLines, AdaptiveGridTopology } from './adaptiveWhitespaceGrid';
import { compileVerseToIR } from './compileVerseToIR';
import { TRUESIGHT_ANALYSIS_MODES } from './analysisModes';

export interface TruesightBridgeResult {
  verseIR: any;
  overlay: {
    lines: any[];
    tokens: any[];
  };
  topology: AdaptiveGridTopology;
}

/**
 * Executes a full Truesight Transverse pass on text
 */
export async function runTruesightTransverse(
  text: string,
  containerWidth: number,
  topology: AdaptiveGridTopology,
  options: { mode?: string; theme?: 'dark' | 'light' } = {}
): Promise<TruesightBridgeResult> {
  // 1. VerseIR Analysis (The Physics)
  const verseIR = compileVerseToIR(text, { 
    mode: options.mode || TRUESIGHT_ANALYSIS_MODES.BALANCED 
  });

  // 2. Overlay Layout (The Surface)
  const overlay = buildTruesightOverlayLines(text, containerWidth, topology);

  return {
    verseIR,
    overlay,
    topology
  };
}

/**
 * Pixel-Perfect Coordinate Resolver
 * Maps a screen-space coordinate to a specific phoneme token
 */
export function resolvePhonemeAtPoint(
  x: number,
  y: number,
  bridge: TruesightBridgeResult
) {
  const { overlay, topology } = bridge;
  const { cellHeight } = topology;
  
  const visualLineIndex = Math.floor(y / cellHeight);
  const line = overlay.lines.find(l => l.lineIndex === visualLineIndex);
  
  if (!line) return null;
  
  return line.tokens.find((t: any) => x >= t.x && x <= t.x + t.width) || null;
}
