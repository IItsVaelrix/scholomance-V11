# Overlay Integrity Contract

## The Contract

The textarea and Truesight overlay MUST produce **pixel-identical layout**. Any box-model, font, or text-breaking difference between the two layers causes overlay words to wrap at different column positions than the textarea text — making the caret appear offset from where it actually is.

## Forbidden CSS on Overlay-Only Elements

These CSS properties MUST NOT appear on overlay-only selectors (`.truesight-overlay`, `.grimoire-word`, `.truesight-word-token`, `.truesight-line--*`):

| Property | Reason |
|---|---|
| `font-size` other than `inherit` | Line heights diverge; all subsequent lines shift vertically |
| `padding` (non-zero, horizontal) on inline word elements | Adds cumulative width per word; lines wrap earlier in overlay |
| `word-break` differing from the textarea's rule | Long strings break at different columns |
| `margin` (non-zero, horizontal) on inline word elements | Same as padding |
| `letter-spacing` | Changes glyph width; accumulates across long lines |
| `white-space` differing from textarea | Affects how whitespace collapses |

**Shared rules that must stay identical** on both `.editor-textarea` and `.truesight-overlay`:
- `font-family`, `font-size`, `font-weight`, `line-height`
- `white-space: pre-wrap`
- `overflow-wrap: break-word`
- `padding` (the container padding, not word-element padding)
- `width`, `box-sizing`

## The Typing Freeze Contract

Async analysis results MUST NOT update the overlay while the user is actively typing.

**Why**: The overlay re-renders on every `setCommittedColors` call. If this fires mid-keystroke, the overlay shifts momentarily (even correctly), which the eye perceives as a cursor jump.

**Implementation pattern** (ReadPage.jsx):
```js
const isTypingRef = useRef(false);
const typingTimeoutRef = useRef(null);
const pendingCommitRef = useRef(null);

// In the analysis useEffect:
if (isTypingRef.current) {
  pendingCommitRef.current = next;
} else {
  setCommittedColors(next);
}

// In onContentChange:
isTypingRef.current = true;
clearTimeout(typingTimeoutRef.current);
typingTimeoutRef.current = setTimeout(() => {
  isTypingRef.current = false;
  if (pendingCommitRef.current) {
    setCommittedColors(pendingCommitRef.current);
    pendingCommitRef.current = null;
  }
}, 400); // 400ms after last keypress
```

**Threshold**: 400ms. Long enough to cover burst typing; short enough to feel responsive on pause.

## Alignment Verification (Ruler Test)

To manually verify overlay/textarea alignment:

1. Enable Truesight
2. Type a single very long line (80+ characters, no spaces) — confirm it wraps at the same column in both layers
3. Type a heading line (`## Title`) followed by several lines of verse — confirm all lines below the heading are vertically aligned with the cursor
4. Type mixed short/long words — confirm word colors track exactly to the word positions

## Adding New Overlay Features Safely

Checklist before shipping any change that touches `.truesight-overlay`, `.grimoire-word`, `.truesight-word-token`, or `.truesight-line--*`:

- [ ] Does the change add horizontal padding or margin to any inline element? → Remove it
- [ ] Does the change set `font-size` to anything other than `inherit`? → Remove it
- [ ] Does the change add or change `word-break`, `white-space`, or `overflow-wrap` on the overlay? → Must match textarea exactly
- [ ] Does the change trigger a React state update during active keystrokes? → Must go through `isTypingRef` guard
- [ ] Did you run the ruler test above? → Must pass before merge
