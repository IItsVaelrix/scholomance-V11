# Text Cursor Alignment — Bytecode Blueprint

**Problem:** Textarea caret indicator misaligned with truesight overlay text width.

**Root Cause:** CSS-only approach cannot guarantee pixel-perfect sync between native browser caret and custom overlay rendering.

**Solution:** Use Animation AMP + Bytecode Blueprint to drive both textarea and overlay from the same deterministic source.

---

## Bytecode Blueprint

```text
ANIM_START
ID cursor-alignment-sync
TARGET class editor-textarea-wrapper
PRESET cursor-sync
DURATION 0
TRIGGER mount

# Typography tokens — single source of truth
FONT_FAMILY "JetBrains Mono"
FONT_SIZE var(--editor-content-font-size)
LINE_HEIGHT var(--editor-content-line-height)
LETTER_SPACING 0
WORD_SPACING 0
PADDING_X var(--editor-content-padding-x)
PADDING_Y var(--editor-content-padding-y)

# Sync constraints
CONSTRAINT DETERMINISTIC true
CONSTRAINT PIXEL_SNAP true

QA INVARIANT typography-matched
QA INVARIANT caret-overlay-aligned

ANIM_END
```

---

## Implementation Pattern

### 1. Typography Token Contract

```typescript
// src/codex/animation/bytecode-bridge/contracts/cursor-sync.types.ts

export type CursorSyncBlueprint = {
  fontFamily: string;
  fontSize: string | number;
  lineHeight: string | number;
  letterSpacing: number;
  wordSpacing: number;
  paddingX: string | number;
  paddingY: string | number;
  tabSize: number;
};

export type CursorSyncOutput = {
  textareaStyles: React.CSSProperties;
  overlayStyles: React.CSSProperties;
  caretPosition: { x: number; y: number; height: number };
};
```

### 2. Sync Hook

```typescript
// src/ui/animation/hooks/useCursorSync.ts

export function useCursorSync(blueprint: CursorSyncBlueprint) {
  const [output, setOutput] = useState<CursorSyncOutput | null>(null);
  
  useEffect(() => {
    // Compile blueprint to deterministic styles
    const compiled = compileCursorSync(blueprint);
    
    setOutput({
      textareaStyles: {
        fontFamily: compiled.fontFamily,
        fontSize: compiled.fontSize,
        lineHeight: compiled.lineHeight,
        letterSpacing: `${compiled.letterSpacing}px`,
        wordSpacing: `${compiled.wordSpacing}px`,
        padding: `${compiled.paddingY}px ${compiled.paddingX}px`,
        tabSize: compiled.tabSize,
        MozTabSize: compiled.tabSize,
        WebkitTextFillColor: 'currentColor',
        boxSizing: 'border-box',
      },
      overlayStyles: {
        fontFamily: compiled.fontFamily,
        fontSize: compiled.fontSize,
        lineHeight: compiled.lineHeight,
        letterSpacing: `${compiled.letterSpacing}px`,
        wordSpacing: `${compiled.wordSpacing}px`,
        padding: `${compiled.paddingY}px ${compiled.paddingX}px`,
        tabSize: compiled.tabSize,
        MozTabSize: compiled.tabSize,
        boxSizing: 'border-box',
      },
      caretPosition: calculateCaretPosition(blueprint),
    });
  }, [blueprint]);
  
  return output;
}
```

### 3. ScrollEditor Integration

```typescript
// src/pages/Read/ScrollEditor.jsx

import { useCursorSync } from '../../ui/animation/hooks/useCursorSync';

const cursorSyncBlueprint = {
  fontFamily: 'JetBrains Mono',
  fontSize: 'var(--editor-content-font-size)',
  lineHeight: 'var(--editor-content-line-height)',
  letterSpacing: 0,
  wordSpacing: 0,
  paddingX: 'var(--editor-content-padding-x)',
  paddingY: 'var(--editor-content-padding-y)',
  tabSize: 2,
};

export function ScrollEditor(props) {
  const cursorSync = useCursorSync(cursorSyncBlueprint);
  
  return (
    <div className="editor-textarea-wrapper" style={cursorSync?.overlayStyles}>
      <textarea
        className="editor-textarea"
        style={cursorSync?.textareaStyles}
        // ... rest of props
      />
      <div
        className="truesight-overlay"
        style={cursorSync?.overlayStyles}
        // ... rest of props
      />
    </div>
  );
}
```

---

## Why Bytecode Is The Answer

| CSS-Only Approach | Bytecode Blueprint Approach |
|-------------------|----------------------------|
| Manual sync across 3+ selectors | Single source of truth |
| Browser-dependent caret rendering | Deterministic caret position |
| No validation | QA invariants enforce alignment |
| Debugging = eyeballing | Debugging = inspect bytecode output |
| Drift over time | Always aligned by design |

---

## QA Invariants

```typescript
// tests/codex/animation/cursor-sync.test.ts

describe('Cursor Sync Blueprint', () => {
  it('textarea and overlay have identical typography', () => {
    const output = compileCursorSync(blueprint);
    expect(output.textareaStyles.fontFamily).toBe(output.overlayStyles.fontFamily);
    expect(output.textareaStyles.fontSize).toBe(output.overlayStyles.fontSize);
    expect(output.textareaStyles.lineHeight).toBe(output.overlayStyles.lineHeight);
    expect(output.textareaStyles.letterSpacing).toBe(output.overlayStyles.letterSpacing);
  });
  
  it('caret position is deterministic', () => {
    const output1 = compileCursorSync(blueprint);
    const output2 = compileCursorSync(blueprint);
    expect(output1.caretPosition).toEqual(output2.caretPosition);
  });
});
```

---

## Migration Path

1. **Phase 1:** Create `useCursorSync` hook (1 hour)
2. **Phase 2:** Wire into ScrollEditor (30 min)
3. **Phase 3:** Remove redundant CSS rules (30 min)
4. **Phase 4:** Add QA tests (1 hour)

**Total:** ~3 hours to full bytecode-driven cursor alignment

---

*This is how PixelBrain was meant to work. Bytecode first. CSS second. Never the reverse.*
