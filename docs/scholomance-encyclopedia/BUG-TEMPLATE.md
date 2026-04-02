# BUG-TEMPLATE

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-TEMPLATE`

## Bug Description
[What was broken, how it manifested, user impact]

**Example:**
> Users reported that long lines of text in the ScrollEditor had misaligned word highlighting in Truesight mode. The colored word overlays appeared on the wrong visual line after the browser wrapped the text.

## Root Cause
[Technical explanation of why the bug occurred]

**Example:**
> The textarea used `white-space: pre-wrap` which allows the browser to wrap lines at word boundaries when text exceeds container width. However, the overlay positioning logic in `compileAdaptiveGrid()` calculated word positions based on their character offset within the original text line, not accounting for visual line breaks created by the browser's word-wrap behavior.

## Thought Process
[Step-by-step reasoning]

**Example:**
1. **First observation:** The lint errors showed `resolveWordTokenAtOffset` and related functions were undefined, but the real issue was deeper - the whitespace handling was fundamentally mismatched between textarea and overlay.

2. **Investigation path:** 
   - Ran lint, found 27 errors in ScrollEditor.jsx
   - Fixed the undefined functions first
   - User reported whitespace still didn't align properly
   - User's theory: "word-wrap math is incorrect"

3. **Dead ends encountered:**
   - Initially tried to simulate browser word-wrap in the overlay (too complex, browser algorithms vary)
   - Considered measuring rendered line breaks (fragile, performance concern)

4. **Breakthrough moment:**
   - Realized `white-space: pre-wrap` on textarea but overlay used absolute positioning with no wrap awareness
   - MS DOS terminal model: use `white-space: pre` (no wrapping) for perfect alignment

5. **Solution derived:**
   - Change CSS from `pre-wrap` to `pre` for textarea, overlay, and truesight-line containers
   - Lines extend horizontally with scrollbar instead of wrapping
   - Perfect 1-space alignment between words, like MS DOS terminal

## Changes Made

| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `src/pages/Read/IDE.css` | ~1598 | Changed textarea/overlay from `white-space: pre-wrap` to `pre` |
| `src/pages/Read/IDE.css` | ~1535 | Added `white-space: pre` to `.truesight-line` container |
| `src/pages/Read/IDE.css` | ~1503 | Added `white-space: pre` to `.word-background-layer > div` |
| `src/pages/Read/ScrollEditor.jsx` | 1-1259 | Fixed 27 lint errors (undefined functions, missing state) |

## Testing

**Example:**
1. Ran `npm run lint` - all 27 errors fixed, 0 errors remaining
2. Ran `npm run build` - successful build
3. Manual testing: Typed long lines in ScrollEditor, verified no word wrap occurs
4. Verified horizontal scrollbar appears for overflow content
5. Confirmed Truesight overlay words align perfectly with textarea words

## Lessons Learned

**Example:**
1. **Whitespace modes must match:** When using overlay rendering on top of textarea, both must have identical `white-space` settings. Mismatched modes guarantee alignment drift.

2. **User theories are valuable:** The user's theory that "word-wrap math is incorrect" was correct - but the fix wasn't better math, it was eliminating the wrap entirely.

3. **MS DOS terminal model for precision:** For perfect character/word alignment, `white-space: pre` (no wrapping) is simpler and more reliable than trying to simulate browser word-wrap behavior.

4. **Fix root cause, not symptoms:** The lint errors were symptoms. The root cause was architectural mismatch between textarea and overlay whitespace handling.

---

*Entry Status: TEMPLATE | Last Updated: N/A*
