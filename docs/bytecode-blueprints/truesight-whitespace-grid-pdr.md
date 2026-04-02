# Truesight Whitespace Alignment — Bytecode Blueprint

**Problem:** Textarea whitespace not symmetrically aligned with truesight overlay tokens.

**Root Cause:** CSS-based alignment cannot guarantee mathematical precision between native browser text rendering and custom overlay rendering.

**Solution:** VerseIR bytecode-driven adaptive grid with vectorized coordinate placement.

---

## Bytecode Blueprint

```text
ANIM_START
ID truesight-whitespace-grid
TARGET class editor-textarea-wrapper
PRESET adaptive-grid-sync
DURATION 0
TRIGGER mount

# Grid topology
GRID_MODE lattice
GRID_CELL_WIDTH var(--editor-content-font-size)
GRID_CELL_HEIGHT var(--editor-content-line-height)
GRID_ORIGIN top-left
GRID_SNAP integer

# Typography tokens — single source of truth
FONT_FAMILY "JetBrains Mono"
FONT_SIZE var(--editor-content-font-size)
LINE_HEIGHT var(--editor-content-line-height)
LETTER_SPACING 0
WORD_SPACING 0
TAB_SIZE 2

# Coordinate system
COORD_SPACE text-grid
COORD_ORIGIN (0, 0)
COORD_X_STEP font_size
COORD_Y_STEP line_height

# VerseIR integration
VERSEIR_TOKEN_POSITION absolute
VERSEIR_COLOR_BYTECODE authoritative
VERSEIR_COORD_SNAP grid

CONSTRAINT DETERMINISTIC true
CONSTRAINT PIXEL_SNAP true

QA INVARIANT whitespace-symmetric
QA INVARIANT token-grid-aligned
QA INVARIANT color-bytecode-authoritative

ANIM_END
```

---

## Implementation Pattern

### 1. Grid Coordinate Contract

```typescript
// src/codex/core/verseir-amplifier/plugins/truesightGrid.ts

export type GridCoordinate = {
  lineIndex: number;
  tokenIndex: number;
  x: number; // grid cells from left
  y: number; // grid cells from top
  charStart: number;
  charEnd: number;
};

export type GridTopology = {
  cellWidth: number;   // font-size in px
  cellHeight: number;  // line-height in px
  originX: number;     // padding-left in px
  originY: number;     // padding-top in px
};
```

### 2. VerseIR Token → Grid Coordinate Mapping

```typescript
// Compile VerseIR tokens to grid coordinates
export function compileTokenGrid(verseIR: VerseIR, topology: GridTopology): GridCoordinate[] {
  return verseIR.tokens.map((token, index) => {
    const lineIndex = token.lineIndex;
    const charStart = token.charStart;
    
    // Calculate grid position
    const x = charStart; // Each character = 1 grid cell (monospace)
    const y = lineIndex;
    
    return {
      lineIndex,
      tokenIndex: index,
      x,
      y,
      charStart,
      charEnd: token.charEnd,
    };
  });
}
```

### 3. Truesight Overlay Rendering

```typescript
// src/pages/Read/ScrollEditor.jsx

// Bytecode-driven token placement
function renderTruesightToken(token, gridCoord, topology, colorBytecode) {
  const left = topology.originX + (gridCoord.x * topology.cellWidth);
  const top = topology.originY + (gridCoord.y * topology.cellHeight);
  
  return (
    <span
      className="truesight-word-token"
      style={{
        position: 'absolute',
        left: `${left}px`,
        top: `${top}px`,
        width: `${(token.length) * topology.cellWidth}px`,
        height: `${topology.cellHeight}px`,
        color: bytecodeToColor(colorBytecode),
      }}
    >
      {token.text}
    </span>
  );
}
```

### 4. Textarea Sync

```typescript
// Textarea uses identical grid topology
<textarea
  style={{
    fontFamily: 'JetBrains Mono',
    fontSize: `${topology.cellWidth}px`,
    lineHeight: `${topology.cellHeight}px`,
    letterSpacing: '0',
    wordSpacing: '0',
    paddingLeft: `${topology.originX}px`,
    paddingTop: `${topology.originY}px`,
    tabSize: 2,
  }}
/>
```

---

## Color Bytecode Integration

```typescript
// Use phoneticColor amplifier for authoritative color
import { phoneticColorAmplifier } from '../../../codex/core/verseir-amplifier/plugins/phoneticColor';

async function getTokenColor(token, options) {
  const result = await phoneticColorAmplifier.analyze({
    verseIR: { tokens: [token] },
    options,
  });
  
  // Extract color bytecode
  const colorBytecode = result.visualBytecode?.[0]?.palette?.bytecode;
  return bytecodeToColor(colorBytecode);
}
```

---

## QA Invariants

```typescript
describe('Truesight Grid Alignment', () => {
  it('textarea and overlay have identical grid topology', () => {
    const textareaGrid = getGridTopology(textarea);
    const overlayGrid = getGridTopology(overlay);
    
    expect(textareaGrid.cellWidth).toBe(overlayGrid.cellWidth);
    expect(textareaGrid.cellHeight).toBe(overlayGrid.cellHeight);
    expect(textareaGrid.originX).toBe(overlayGrid.originX);
    expect(textareaGrid.originY).toBe(overlayGrid.originY);
  });
  
  it('tokens are placed at integer grid coordinates', () => {
    const tokens = getOverlayTokens();
    for (const token of tokens) {
      expect(token.left % topology.cellWidth).toBe(0);
      expect(token.top % topology.cellHeight).toBe(0);
    }
  });
  
  it('color bytecode is authoritative', () => {
    const tokens = getOverlayTokens();
    for (const token of tokens) {
      expect(token.color).toBe(bytecodeToColor(token.bytecode));
    }
  });
});
```

---

## Migration Path

1. **Phase 1:** Create `compileTokenGrid` function (1 hour)
2. **Phase 2:** Wire VerseIR → grid coordinates (1 hour)
3. **Phase 3:** Update truesight overlay rendering (2 hours)
4. **Phase 4:** Integrate phoneticColor bytecode (1 hour)
5. **Phase 5:** Remove CSS-based alignment (30 min)

**Total:** ~5.5 hours to full bytecode-driven grid alignment

---

*This is PixelBrain Phase 2: VerseIR coordinates drive everything. CSS is dead. Long live bytecode.*
