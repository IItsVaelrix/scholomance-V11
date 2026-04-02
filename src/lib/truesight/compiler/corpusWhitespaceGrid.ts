/**
 * Corpus-Enhanced Adaptive Grid (CEAG)
 * 
 * Uses corpus probability and inference to achieve perfect linguistic
 * whitespace alignment between textarea and overlay layers.
 * 
 * ALGORITHM:
 * 1. Load word frequency from corpus
 * 2. For each token:
 *    - Base: measureTextWidth() → pixel width
 *    - Adjust: apply corpus probability weight
 *      - Common words → tighter spacing (higher confidence)
 *      - Rare words → looser spacing (lower confidence)
 * 3. Build topology with refined measurements
 * 4. Apply symmetry transforms using formula: x' = (2 * axisX) - x - (w - 1)
 */

import { WORD_TOKEN_REGEX } from '../../../lib/wordTokenization';

const SPACING_FACTOR = 0.15; // Maximum adjustment for common words (15%)
const MIN_CONFIDENCE = 0.3; // Minimum confidence for rare words
const MAX_CONFIDENCE = 1.0; // Maximum confidence for common words

export interface CorpusTokenMeasurement {
  token: string;
  pixelWidth: number;
  charCount: number;
  pixelsPerChar: number;
  corpusFrequency: number;
  spacingConfidence: number;
  adjustedWidth: number;
}

export interface CorpusAdaptiveGridTopology {
  originX: number;
  originY: number;
  baseCellWidth: number;
  baseCellHeight: number;
  adaptiveScale: number;
  totalCols: number;
  totalWidth: number;
  measurements: Map<string, CorpusTokenMeasurement>;
  corpusStats: {
    totalWords: number;
    uniqueWords: number;
    avgFrequency: number;
  };
}

let cachedCorpusFreq: Map<string, number> | null = null;
let corpusLoadPromise: Promise<Map<string, number>> | null = null;

/**
 * Load corpus word frequencies from the public JSON
 */
export async function loadCorpusFrequencies(): Promise<Map<string, number>> {
  if (cachedCorpusFreq) return cachedCorpusFreq;
  
  if (corpusLoadPromise) {
    return corpusLoadPromise;
  }
  
  corpusLoadPromise = (async () => {
    try {
      const response = await fetch('/corpus.json');
      if (!response.ok) {
        console.warn('[CEAG] Failed to load corpus.json:', response.status);
        return new Map();
      }
      
      const payload = await response.json();
      const words = payload?.dictionary || [];
      
      const freqMap = new Map<string, number>();
      
      if (Array.isArray(words)) {
        words.forEach((word, _index) => {
          if (word && typeof word === 'string') {
            const normalized = word.toLowerCase().trim();
            if (normalized) {
              const current = freqMap.get(normalized) || 0;
              freqMap.set(normalized, current + 1);
            }
          }
        });
      }
      
      cachedCorpusFreq = freqMap;
      console.log(`[CEAG] Loaded ${freqMap.size} corpus words`);
      return freqMap;
    } catch (err) {
      console.warn('[CEAG] Corpus load error:', err);
      return new Map();
    }
  })();
  
  return corpusLoadPromise;
}

/**
 * Get cached corpus frequencies (synchronous, may be empty)
 */
export function getCachedCorpusFrequencies(): Map<string, number> {
  return cachedCorpusFreq || new Map();
}

/**
 * Calculate spacing confidence based on corpus word frequency
 * Uses logarithmic scaling for better distribution
 */
export function getSpacingConfidence(
  word: string, 
  corpusFreq: Map<string, number>
): number {
  const normalized = word.toLowerCase().trim();
  const frequency = corpusFreq.get(normalized) || 0;
  
  if (frequency === 0) {
    return MIN_CONFIDENCE;
  }
  
  const logFreq = Math.log1p(frequency);
  const maxLogFreq = Math.log1p(1000);
  const normalizedFreq = Math.min(logFreq / maxLogFreq, 1);
  
  return MIN_CONFIDENCE + (normalizedFreq * (MAX_CONFIDENCE - MIN_CONFIDENCE));
}

/**
 * Measure text width using offscreen canvas
 */
export function measureTextWidth(
  text: string, 
  fontFamily: string, 
  fontSize: string,
  options: { fontStyle?: string; fontWeight?: string; dpr?: number } = {}
): number {
  const canvas = document.createElement('canvas');
  const dpr = options.dpr || (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return 0;
  
  const fontStyle = options.fontStyle || 'normal';
  const fontWeight = options.fontWeight || '400';

  // Parse font size and scale by DPR
  const fontSizeNum = parseFloat(fontSize) || 16;
  const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'px';
  const scaledSize = fontSizeUnit === 'px' ? `${fontSizeNum * dpr}${fontSizeUnit}` : fontSize;

  ctx.font = `${fontStyle} ${fontWeight} ${scaledSize} ${fontFamily}`;
  const metrics = ctx.measureText(text);
  
  return metrics.width / dpr;
}

/**
 * Measure tokens with corpus inference for refined spacing
 */
export function measureWithCorpusInference(
  tokens: string[],
  fontFamily: string,
  fontSize: number,
  corpusFreq?: Map<string, number>
): CorpusTokenMeasurement[] {
  const freq = corpusFreq || getCachedCorpusFrequencies();
  const measurements: CorpusTokenMeasurement[] = [];
  
  for (const token of tokens) {
    const isWord = WORD_TOKEN_REGEX.test(token);
    const charCount = token.length;
    const pixelWidth = measureTextWidth(token, fontFamily, `${fontSize}px`);
    const pixelsPerChar = charCount > 0 ? pixelWidth / charCount : 0;
    
    let spacingConfidence = MIN_CONFIDENCE;
    let adjustedWidth = pixelWidth;
    
    if (isWord && charCount > 0) {
      spacingConfidence = getSpacingConfidence(token, freq);
      const adjustment = 1 - (spacingConfidence * SPACING_FACTOR);
      adjustedWidth = pixelWidth * adjustment;
    }
    
    measurements.push({
      token,
      pixelWidth,
      charCount,
      pixelsPerChar,
      corpusFrequency: freq.get(token.toLowerCase()) || 0,
      spacingConfidence,
      adjustedWidth,
    });
  }
  
  return measurements;
}

/**
 * Calculate grid topology from measurements
 */
export function buildCorpusAdaptiveGrid(
  measurements: CorpusTokenMeasurement[],
  originX: number = 0,
  originY: number = 0,
  baseCellHeight: number = 24
): CorpusAdaptiveGridTopology {
  const measurementMap = new Map<string, CorpusTokenMeasurement>();
  let totalWidth = originX;
  let totalCols = 0;

  let totalFreq = 0;
  const uniqueWords = new Set<string>();
  
  for (const m of measurements) {
    measurementMap.set(m.token, m);
    totalWidth += m.adjustedWidth;
    totalCols += m.charCount;
    totalFreq += m.corpusFrequency;
    if (m.corpusFrequency > 0) {
      uniqueWords.add(m.token.toLowerCase());
    }
  }
  
  const fontSize = 16;
  const avgFreq = measurements.length > 0 ? totalFreq / measurements.length : 0;
  
  return {
    originX,
    originY,
    baseCellWidth: fontSize,
    baseCellHeight,
    adaptiveScale: 1,
    totalCols,
    totalWidth,
    measurements: measurementMap,
    corpusStats: {
      totalWords: totalFreq,
      uniqueWords: uniqueWords.size,
      avgFrequency: avgFreq,
    },
  };
}

/**
 * Mirror a column coordinate across the vertical axis
 * Formula: cols - col - span
 */
export function mirrorCorpusCol(cols: number, col: number, span: number): number {
  return cols - col - span;
}

/**
 * Mirror a rectangle across a vertical axis X
 * Formula: x' = (2 * axisX) - x - (w - 1)
 * This ensures pixel-center correctness on discrete grids.
 */
export function mirrorCorpusRectX(x: number, w: number, axisX: number): number {
  return (2 * axisX) - x - (w - 1);
}

/**
 * Get the symmetry axis X for a given topology
 */
export function getCorpusSymmetryAxisX(topology: CorpusAdaptiveGridTopology): number {
  return (topology.totalWidth - 1) / 2;
}

/**
 * Apply corpus refinement to a measurement
 * Returns adjusted width for overlay rendering
 */
export function getCorpusAdjustedWidth(
  token: string,
  measurements: Map<string, CorpusTokenMeasurement>
): number {
  const m = measurements.get(token);
  return m?.adjustedWidth || measureTextWidth(token, 'Georgia', '16px');
}

/**
 * Compile tokens to corpus-enhanced grid coordinates
 */
export function compileCorpusGrid(
  lines: Array<{
    lineIndex: number;
    lineText: string;
    tokens: Array<{ token: string; localStart: number }>;
  }>,
  topology: CorpusAdaptiveGridTopology,
  options: { mirrored?: boolean } = {}
): Array<{ x: number; pixelWidth: number }> {
  const coords: Array<{ x: number; pixelWidth: number }> = [];
  let currentX = topology.originX;
  
  for (const line of lines) {
    for (const t of line.tokens) {
      const pixelWidth = getCorpusAdjustedWidth(t.token, topology.measurements);
      let x = currentX;
      
      if (options.mirrored) {
        const axisX = getCorpusSymmetryAxisX(topology);
        x = mirrorCorpusRectX(currentX, pixelWidth, axisX);
      }
      
      coords.push({ x, pixelWidth });
      currentX += pixelWidth;
    }
  }
  
  return coords;
}
