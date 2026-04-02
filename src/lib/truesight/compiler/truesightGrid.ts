/**
 * Truesight Grid — Bytecode-driven whitespace alignment
 * 
 * Calculates VISUAL column positions (not document offsets) for perfect
 * alignment between textarea and truesight overlay.
 * 
 * KEY INSIGHT: We must work with LINE TEXT, not document char offsets.
 * Document char 50 on line 5 might be visual column 2 if the line starts at char 48.
 */

export interface GridTopology {
  cellWidth: number;    // font-size in px
  cellHeight: number;   // line-height in px
  originX: number;      // padding-left in px
  originY: number;      // padding-top in px
  tabSize: number;
  adaptiveScale: number;
}

export interface GridCoordinate {
  lineIndex: number;
  tokenIndex: number;
  x: number;            // VISUAL column within line (0 = first char of line)
  y: number;            // Line number from top
  charStart: number;
  charEnd: number;
  length: number;
}

/**
 * Compute grid topology from computed styles
 */
export function computeGridTopology(element: HTMLElement | null): GridTopology | null {
  if (!element) return null;
  
  const styles = window.getComputedStyle(element);
  const fontSize = parseFloat(styles.fontSize) || 16;
  // Use line-height 1.9 per Vaelrix Law
  const lineHeight = parseFloat(styles.lineHeight) || fontSize * 1.9;
  const paddingLeft = parseFloat(styles.paddingLeft) || 0;
  const paddingTop = parseFloat(styles.paddingTop) || 0;
  const tabSize = parseInt(styles.tabSize || '2', 10) || 2;
  
  return {
    cellWidth: fontSize,
    cellHeight: lineHeight,
    originX: paddingLeft,
    originY: paddingTop,
    tabSize,
    adaptiveScale: 1.0, // Default to 1.0 for standard grid
  };
}

/**
 * Calculate visual column for a token within its line
 * 
 * This is the KEY function - it converts document char offsets to visual columns.
 * 
 * @param lineText - The actual text of the line (e.g., "  indented text")
 * @param charStartInLine - Character position within lineText (e.g., 2 for "indented")
 * @returns Visual column (0-indexed)
 */
export function calculateVisualColumn(lineText: string, charStartInLine: number): number {
  // For monospace fonts, visual column = character position
  // (each character occupies exactly 1 cell)
  return charStartInLine;
}

/**
 * Compile tokens to grid coordinates using LINE TEXT (not document offsets)
 *
 * @param lines - Array of line objects with text and tokens
 * @returns Grid coordinates with visual column positions
 */
export function compileTokensToGrid(lines: Array<{
  lineIndex: number;
  lineText: string;  // The actual line text
  tokens: Array<{
    token: string;
    localStart: number;  // Position within lineText (NOT document offset)
    localEnd?: number;   // Optional - will be calculated from token.length if not provided
  }>;
}>): GridCoordinate[] {
  const coordinates: GridCoordinate[] = [];

  for (const line of lines) {
    for (let i = 0; i < line.tokens.length; i++) {
      const token = line.tokens[i];
      
      // ALWAYS use actual token text length for adaptive width
      // This ensures next token starts exactly one whitespace cell after
      const tokenLength = token.token.length;

      // Calculate VISUAL column from line text position
      const visualColumn = calculateVisualColumn(line.lineText, token.localStart);

      coordinates.push({
        lineIndex: line.lineIndex,
        tokenIndex: i,
        x: visualColumn,      // Visual column (0 = start of line)
        y: line.lineIndex,    // Line number
        charStart: token.localStart,
        charEnd: token.localStart + tokenLength,
        length: tokenLength,  // ALWAYS matches actual text length
      });
    }
  }

  return coordinates;
}

/**
 * Convert grid coordinate to pixel position
 */
export function gridToPixels(coord: GridCoordinate, topology: GridTopology): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  const slotWidth = topology.cellWidth * topology.adaptiveScale;
  return {
    left: topology.originX + (coord.x * slotWidth),
    top: topology.originY + (coord.y * topology.cellHeight),
    width: coord.length * slotWidth,
    height: topology.cellHeight,
  };
}
