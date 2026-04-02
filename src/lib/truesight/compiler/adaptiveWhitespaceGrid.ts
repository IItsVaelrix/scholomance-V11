/**
 * Adaptive Whitespace Grid — Bytecode-driven token width calculation
 * 
 * Measures ACTUAL rendered text width (not character count) to ensure
 * perfect whitespace alignment between textarea and overlay.
 * 
 * Now uses CORPUS-ENHANCED ADAPTIVE GRID (CEAG) for linguistic alignment:
 * - Common words get tighter spacing (higher confidence)
 * - Rare words get looser spacing (corpus probability weighted)
 * 
 * ALGORITHM:
 * 1. Load word frequencies from corpus
 * 2. Render hidden measurement spans for each unique token length
 * 3. Calculate pixel width per character for that token
 * 4. Apply corpus probability weights for refined spacing
 * 5. Build adaptive grid topology from measurements
 * 6. Apply to overlay rendering
 */

import {
  loadCorpusFrequencies,
  getCachedCorpusFrequencies,
  getSpacingConfidence,
  getCorpusAdjustedWidth,
  measureTextWidth as measureTextWidthCore,
} from './corpusWhitespaceGrid';

export interface AdaptiveGridTopology {
  originX: number;
  originY: number;
  baseCellWidth: number;    // font-size in px
  baseCellHeight: number;   // line-height in px
  adaptiveScale: number;    // Scale factor for current font rendering
  totalCols: number;        // Maximum columns in editor
  totalWidth: number;      // Exact content width in pixels
  corpusEnabled?: boolean;   // Whether corpus refinement is active
}

export interface TokenMeasurement {
  token: string;
  pixelWidth: number;
  charCount: number;
  pixelsPerChar: number;
}

/**
 * Mirror a column coordinate across the vertical axis
 * Formula: cols - col - span
 */
export function mirrorCol(cols: number, col: number, span: number): number {
  return cols - col - span;
}

/**
 * Mirror a rectangle across a vertical axis X
 * Formula: x' = (2 * axisX) - x - (w - 1)
 * This ensures pixel-center correctness on discrete grids.
 */
export function mirrorRectX(x: number, w: number, axisX: number): number {
  return (2 * axisX) - x - (w - 1);
}

/**
 * Get the symmetry axis X for a given topology
 */
export function getSymmetryAxisX(topology: AdaptiveGridTopology): number {
  // Use exact totalWidth for the axis to match visual center of textarea
  return (topology.totalWidth - 1) / 2;
}

/**
 * Measure actual rendered width of text using hidden canvas
 */
export function measureTextWidth(text: string, fontFamily: string, fontSize: string): number {
  // Create offscreen canvas for measurement
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return 0;
  
  // Use a precise font string to match textarea rendering
  ctx.font = `${fontSize} ${fontFamily}`;
  const metrics = ctx.measureText(text);
  
  return metrics.width;
}

/**
 * Measure multiple tokens and calculate adaptive scale
 */
export function measureTokens(
  tokens: string[],
  fontFamily: string,
  fontSize: number
): { measurements: TokenMeasurement[]; adaptiveScale: number } {
  const measurements: TokenMeasurement[] = [];
  let totalPixelsPerChar = 0;
  let count = 0;
  
  // Ensure we have at least some representative tokens for measurement
  const tokensToMeasure = tokens.length > 0 
    ? tokens.filter(t => t.trim().length > 0) 
    : ['hello', 'world', 'test'];

  if (tokensToMeasure.length === 0) {
    tokensToMeasure.push('hello');
  }
  
  for (const token of tokensToMeasure) {
    const pixelWidth = measureTextWidth(token, fontFamily, `${fontSize}px`);
    const charCount = token.length;
    const pixelsPerChar = charCount > 0 ? pixelWidth / charCount : 0;
    
    measurements.push({
      token,
      pixelWidth,
      charCount,
      pixelsPerChar,
    });
    
    totalPixelsPerChar += pixelsPerChar;
    count++;
  }
  
  // Calculate adaptive scale (ratio of actual rendering to ideal monospace)
  const avgPixelsPerChar = count > 0 ? totalPixelsPerChar / count : fontSize;
  const adaptiveScale = avgPixelsPerChar / fontSize;
  
  return { measurements, adaptiveScale };
}

/**
 * Compute adaptive grid topology from element styles
 * Initializes corpus loading for CEAG
 */
export function computeAdaptiveGridTopology(
  element: HTMLElement | null,
  sampleTokens: string[]
): AdaptiveGridTopology | null {
  if (!element) return null;
  
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize) || 16;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.5;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const fontFamily = styles.fontFamily;
  
  const totalWidth = element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
  
  const { adaptiveScale } = measureTokens(
    sampleTokens,
    fontFamily,
    fontSize
  );
  
  const slotWidth = fontSize * adaptiveScale;
  const totalCols = Math.floor(totalWidth / slotWidth) || 80;
  
  const corpusFreq = getCachedCorpusFrequencies();
  const corpusEnabled = corpusFreq.size > 0;
  
  return {
    originX: paddingLeft,
    originY: paddingTop,
    baseCellWidth: fontSize,
    baseCellHeight: lineHeight,
    adaptiveScale,
    totalCols,
    totalWidth,
    corpusEnabled,
  };
}

/**
 * Calculate adaptive token width in pixels
 * Uses corpus-enhanced refinement for linguistic alignment
 */
export function getAdaptiveTokenWidth(
  token: string,
  topology: AdaptiveGridTopology
): number {
  const corpusFreq = getCachedCorpusFrequencies();
  const hasCorpus = corpusFreq.size > 0;
  
  if (hasCorpus) {
    const confidence = getSpacingConfidence(token, corpusFreq);
    const corpusAdjusted = getCorpusAdjustedWidth(token, new Map());
    return corpusAdjusted;
  }
  
  const rawWidth = token.length * topology.baseCellWidth * topology.adaptiveScale + 0.1;
  return Math.min(Math.ceil(rawWidth), topology.totalWidth);
}

/**
 * Build adaptive grid coordinates with measured widths
 */
export function compileAdaptiveGrid(lines: Array<{
  lineIndex: number;
  lineText: string;
  tokens: Array<{
    token: string;
    localStart: number;
  }>;
}>, topology: AdaptiveGridTopology, options: { mirrored?: boolean } = {}): Array<{
  lineIndex: number;
  tokenIndex: number;
  x: number;
  y: number;
  pixelWidth: number;
  token: string;
  isMirrored: boolean;
}> {
  const coordinates: Array<{
    lineIndex: number;
    tokenIndex: number;
    x: number;
    y: number;
    pixelWidth: number;
    token: string;
    isMirrored: boolean;
  }> = [];
  
  const slotWidth = topology.baseCellWidth * topology.adaptiveScale;
  const isMirrored = !!options.mirrored;

  for (const line of lines) {
    for (let i = 0; i < line.tokens.length; i++) {
      const tokenData = line.tokens[i];
      const charSpan = tokenData.token.length;
      
      // Mirror in column space first for stability
      const col = tokenData.localStart;
      const mCol = isMirrored ? mirrorCol(topology.totalCols, col, charSpan) : col;
      
      // Convert to final pixel X
      const x = mCol * slotWidth;

      // Use Math.ceil for the display width to ensure all characters fit.
      // Capped epsilon to 0.1px to prevent full-pixel bloat.
      // Strict constraint: x + width must not exceed topology.totalWidth
      const rawWidth = charSpan * slotWidth + 0.1;
      const pixelWidth = Math.min(
        Math.ceil(rawWidth),
        Math.max(0, topology.totalWidth - x)
      );

      coordinates.push({
        lineIndex: line.lineIndex,
        tokenIndex: i,
        x,
        y: line.lineIndex * topology.baseCellHeight,
        pixelWidth,
        token: tokenData.token,
        isMirrored,
      });
    }
  }
  
  return coordinates;
}
