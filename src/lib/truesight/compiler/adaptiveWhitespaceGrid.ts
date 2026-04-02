/**
 * Adaptive Whitespace Grid — Bytecode-driven token width calculation
 * 
 * Measures ACTUAL rendered text width (not character count) to ensure
 * perfect whitespace alignment between textarea and overlay.
 * 
 * Optimized for high-frequency updates (typing).
 */

import { WORD_TOKEN_REGEX } from '../../../lib/wordTokenization';

export interface AdaptiveGridTopology {
  originX: number;
  originY: number;
  baseCellWidth: number;    // font-size in px
  baseCellHeight: number;   // line-height in px
  adaptiveScale: number;    // Scale factor for current font rendering
  totalCols: number;        // Maximum columns in editor
  totalWidth: number;      // Exact content width in pixels
  fontFamily: string;
  fontSize: string;
  fontStyle: string;
  fontWeight: string;
  tabSize: number;
  corpusEnabled?: boolean;
}

// Singleton canvas for measurements to avoid allocation overhead
let measurementCanvas: HTMLCanvasElement | null = null;
let measurementContext: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();
let lastFontKey = "";

/**
 * Measure actual rendered width of text using a shared high-performance canvas
 */
export function measureTextWidth(
  text: string, 
  fontFamily: string, 
  fontSize: string,
  options: { fontStyle?: string; fontWeight?: string; dpr?: number } = {}
): number {
  if (typeof document === 'undefined') return text.length * 8;
  
  if (!measurementCanvas) {
    measurementCanvas = document.createElement('canvas');
    measurementContext = measurementCanvas.getContext('2d', { alpha: false });
  }
  
  const ctx = measurementContext;
  if (!ctx) return text.length * 8;
  
  const dpr = options.dpr || (typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1);
  const fontStyle = options.fontStyle || 'normal';
  const fontWeight = options.fontWeight || '400';
  
  // Cache key based on font properties and text
  const fontKey = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily} @${dpr}`;
  const cacheKey = `${fontKey}::${text}`;
  
  if (widthCache.has(cacheKey)) {
    return widthCache.get(cacheKey)!;
  }

  // Only update context font if it changed
  if (lastFontKey !== fontKey) {
    const fontSizeNum = parseFloat(fontSize) || 16;
    const fontSizeUnit = fontSize.replace(/[\d.]/g, '') || 'px';
    const scaledSize = fontSizeUnit === 'px' ? `${fontSizeNum * dpr}${fontSizeUnit}` : fontSize;
    ctx.font = `${fontStyle} ${fontWeight} ${scaledSize} ${fontFamily}`;
    lastFontKey = fontKey;
    // Clear cache when font changes to prevent memory leaks/stale values
    if (widthCache.size > 1000) widthCache.clear();
  }

  const metrics = ctx.measureText(text);
  const width = metrics.width / dpr;
  
  widthCache.set(cacheKey, width);
  return width;
}

/**
 * Core Word-Wrap Simulation Engine
 * Synchronizes visual positioning between textarea and overlay
 */
export function buildTruesightOverlayLines(content: string, containerWidth: number, topology: AdaptiveGridTopology) {
  const rawLines = String(content || "").split("\n");
  const visualLines: any[] = [];
  const allTokens: any[] = [];
  const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
  
  const fontOptions = { 
    fontStyle: topology.fontStyle, 
    fontWeight: topology.fontWeight, 
    dpr 
  };

  const spaceWidth = measureTextWidth(' ', topology.fontFamily, topology.fontSize, fontOptions);
  let globalVisualLineIndex = 0;

  for (let rawLineIndex = 0; rawLineIndex < rawLines.length; rawLineIndex++) {
    const lineText = rawLines[rawLineIndex];
    let currentX = 0;
    let currentLineTokens: any[] = [];
    let wordIndexInRawLine = 0;

    // Simple line type detection
    let lineType = "normal";
    if (lineText.startsWith("#")) lineType = "heading";
    else if (lineText.startsWith("- ") || lineText.startsWith("* ")) lineType = "list-item";

    // Use canonical regex for matching
    const LINE_TOKEN_REGEX = /[A-Za-z]+(?:['-][A-Za-z]+)*|\s+|[^A-Za-z'\s]+/g;

    const matches = [...lineText.matchAll(LINE_TOKEN_REGEX)];
    
    if (matches.length === 0) {
      // Empty line
      visualLines.push({ 
        lineIndex: globalVisualLineIndex++, 
        rawLineIndex,
        lineText: "", 
        tokens: [], 
        lineType 
      });
      continue;
    }

    for (const match of matches) {
      const token = match[0];
      const localStart = match.index ?? 0;
      const isWord = WORD_TOKEN_REGEX.test(token);
      
      let tokenWidth = 0;

      // Special handling for tabs
      if (token.includes('\t')) {
        for (const char of token) {
          if (char === '\t') tokenWidth += spaceWidth * topology.tabSize;
          else tokenWidth += measureTextWidth(char, topology.fontFamily, topology.fontSize, fontOptions);
        }
      } else {
        tokenWidth = measureTextWidth(token, topology.fontFamily, topology.fontSize, fontOptions);
      }

      // Check for wrap (but only if not the first token on the line)
      if (currentX + tokenWidth > containerWidth && currentX > 0) {
        // Emit current visual line
        visualLines.push({
          lineIndex: globalVisualLineIndex++,
          rawLineIndex,
          lineText,
          tokens: currentLineTokens,
          lineType
        });
        currentLineTokens = [];
        currentX = 0;
      }

      const tokenData = {
        token,
        localStart,
        localEnd: localStart + token.length,
        lineIndex: rawLineIndex,
        visualLineIndex: globalVisualLineIndex,
        wordIndex: isWord ? wordIndexInRawLine++ : null,
        x: currentX,
        width: tokenWidth,
      };

      currentLineTokens.push(tokenData);
      allTokens.push(tokenData);
      currentX += tokenWidth;
    }
    
    // Emit remaining tokens as the last visual line for this raw line
    if (currentLineTokens.length > 0) {
      visualLines.push({
        lineIndex: globalVisualLineIndex++,
        rawLineIndex,
        lineText,
        tokens: currentLineTokens,
        lineType
      });
    }
  }

  return { lines: visualLines, allTokens };
}

/**
 * Calculate adaptive token width in pixels
 */
export function getAdaptiveTokenWidth(
  token: string,
  topology: AdaptiveGridTopology
): number {
  return measureTextWidth(token, topology.fontFamily, topology.fontSize, {
    fontStyle: topology.fontStyle,
    fontWeight: topology.fontWeight
  });
}

/**
 * Build adaptive grid coordinates with measured widths
 * Legacy support for direct coordinate compilation
 */
export function compileAdaptiveGrid(lines: any[], topology: AdaptiveGridTopology, _options: { mirrored?: boolean } = {}) {
  const coordinates: any[] = [];
  return coordinates; 
}

export function computeAdaptiveGridTopology(
  element: HTMLElement | null,
  _sampleTokens: string[]
): AdaptiveGridTopology | null {
  if (!element) return null;
  
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize) || 16;
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.9; // Law 1.9
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  
  return {
    originX: paddingLeft,
    originY: paddingTop,
    baseCellWidth: fontSize,
    baseCellHeight: lineHeight,
    adaptiveScale: 1.0,
    totalCols: 80,
    totalWidth: element.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight),
    fontFamily: styles.fontFamily,
    fontSize: styles.fontSize,
    fontStyle: styles.fontStyle,
    fontWeight: styles.fontWeight,
    tabSize: parseInt(styles.tabSize || '2', 10) || 2,
    corpusEnabled: false,
  };
}
