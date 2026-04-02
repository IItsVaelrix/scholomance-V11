# BUG-2026-04-02-WHITESPACE-ALIGNMENT

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-001`

## Bug Description

Users reported that long lines of text in the ScrollEditor had misaligned word highlighting in Truesight mode. The colored word overlays appeared on the wrong visual line after the browser wrapped the text, breaking the phonetic visualization.

**Manifestation:**
- Textarea text wraps at word boundaries (browser default with `pre-wrap`)
- Overlay words positioned as if no wrap occurred
- After first visual wrap, all subsequent words misaligned
- Truesight coloring appeared on wrong words or floating in empty space

**User Impact:**
- Phonetic analysis visualization broken for long lines
- Could not trust Truesight mode for scrolls with sentences exceeding editor width
- Core feature (phonetic word coloring) unreliable

## Root Cause

The textarea used `white-space: pre-wrap` + `overflow-wrap: break-word` which allows the browser to automatically wrap lines at word boundaries when text exceeds container width. However, the overlay positioning logic in `compileAdaptiveGrid()` and `buildOverlayLines()` calculated word positions based on their character offset within the original text line (`\n` splits only), not accounting for **visual line breaks** created by the browser's word-wrap behavior.

**Technical Details:**
1. `buildOverlayLines()` splits content by `\n` (actual newlines only)
2. `compileAdaptiveGrid()` positions words using `localStart * slotWidth`
3. Browser wraps "long line of text that exceeds width" into multiple visual lines
4. Overlay still positions words as if they're all on one line
5. Result: Words after visual wrap are positioned off-screen or on wrong line

## Thought Process

1. **First observation:** Running `npm run lint` revealed 27 errors in `ScrollEditor.jsx` - undefined functions and missing state variables.

2. **Investigation path:**
   - Fixed all 27 lint errors
   - User reported: "Why does the white space not calculate so that it simply adapts and makes each word tokenize with perfect asymmetrical alignment so that it is formatted the way a MS DOS terminal is"
   - User's theory: "Our math for wordwrap is incorrect"

3. **Initial solution attempt (WRONG):**
   - Changed CSS to `white-space: pre` (no wrapping, horizontal scroll)
   - This worked BUT user then asked: "DOM is not the Source of Truth, right? PixelBrain is?"
   - **Critical realization:** We were trying to change the DOM behavior instead of fixing the overlay

4. **Architecture correction:**
   - User questioned: "we should change the <textarea> into a RichTextBox if we can do so without issue"
   - **Caught the violation:** Using `contentEditable` would make DOM the source of truth
   - This violates Vaelrix Law #4 (Server Is Truth) and Law #8 (Bytecode Is Priority)
   - **Correct architecture:** Bytecode → Derived State → Render (textarea + overlay), NEVER read FROM DOM

5. **Breakthrough moment:**
   - Option A: No wrap (MS DOS terminal) - simple but changes UX
   - Option B: Simulate word-wrap in overlay using bytecode-measured widths - preserves UX, proper architecture
   - **Chose Option B:** Keep textarea `pre-wrap`, make overlay calculate visual line breaks

6. **Solution derived:**
   - Rewrite `buildOverlayLines()` to simulate word-wrap:
     - Track cumulative token width as tokens are processed
     - When `currentX + tokenWidth > containerWidth`, wrap to next visual line
     - Store `x` position and `visualLineIndex` on each token
   - Update overlay rendering to use token's `x` position instead of `compileAdaptiveGrid()`
   - Result: Overlay wraps exactly like textarea, perfect alignment

## Changes Made

| File | Lines Changed | Rationale |
|------|---------------|-----------|
| `src/pages/Read/ScrollEditor.jsx` | 29-143 | Rewrote `buildOverlayLines()` with word-wrap simulation, **measured space width**, kerning-aware token widths, **full font spec (style/weight)** |
| `src/pages/Read/ScrollEditor.jsx` | 565-598 | Updated `updateTypography` to capture `fontStyle` and `fontWeight` |
| `src/pages/Read/ScrollEditor.jsx` | 638-652 | Added `containerWidth` calculation, updated `buildOverlayLines` call with topology |
| `src/pages/Read/ScrollEditor.jsx` | 1084-1113 | Updated overlay rendering to use token's `x` position from word-wrap simulation |
| `src/pages/Read/IDE.css` | ~1598 | Reverted to `white-space: pre-wrap` (original behavior preserved) |

## Testing

1. **Lint:** `npm run lint` - passes (warnings only, no errors)
2. **Build:** `npm run build` - successful, no compile errors
3. **Manual testing:**
   - Typed long lines (200+ characters) in ScrollEditor
   - Verified word wrap occurs naturally in textarea
   - Enabled Truesight mode
   - Confirmed colored words align perfectly with textarea words after wraps
   - Tested with various line lengths - all align correctly

**Before Fix:**
```
Textarea: "This is a very long line that wraps to multiple visual lines"
           (wraps at "wraps" - browser creates visual line break)
Overlay:  [words positioned as if all on one line - misaligned after wrap]
```

**After Fix:**
```
Textarea: "This is a very long line that wraps to multiple visual lines"
           (wraps at "wraps" - browser creates visual line break)
Overlay:  [words positioned on correct visual lines - perfect alignment]
```

## Lessons Learned

1. **Bytecode is the source of truth:** Never make DOM authoritative. The fix was to improve the bytecode-derived overlay calculation, not to change the textarea behavior.

2. **User questions reveal architectural gaps:** When the user asked "DOM is not the Source of Truth, right?" they caught a potential architecture violation. User intuition about system design is valuable.

3. **Option A vs Option B trade-offs:**
   - **Option A (MS DOS terminal):** Simpler, but changes UX (horizontal scroll)
   - **Option B (Word-wrap simulation):** More complex, preserves familiar UX
   - **Decision:** Option B respects user expectations while maintaining architectural purity

4. **Word-wrap simulation algorithm:**
   - **Measure actual space width:** `ctx.measureText(' ').width` — critical for alignment!
   - Track cumulative width: `currentX += tokenWidth + spaceWidth`
   - Wrap when: `currentX + nextTokenWidth > containerWidth`
   - Store visual line index and x position per token
   - Overlay renders using pre-calculated positions

5. **Font rendering considerations** (from research):
   - **Kerning matters:** "To" ≠ "T" + "o" measured separately — use `ctx.measureText(token)` for full words
   - **Georgia is proportional:** "i" is narrower than "w" — can't assume monospace
   - **Subpixel rounding:** Use `Math.ceil()` for display widths to prevent drift
   - **Zoom levels:** `ResizeObserver` recalculates topology on zoom changes
   - **Old-style figures:** Georgia uses descending numerals (3, 4, 7) — full word measurement handles this
   - **Font style/weight:** Italic and bold have different widths — we capture `fontStyle` and `fontWeight`

6. **Architecture pattern for overlay alignment:**
   ```
   Bytecode → Topology (fontFamily, fontSize, fontStyle, fontWeight)
                          ↓
   buildOverlayLines(content, containerWidth, topology)
                          ↓
   Token[] with { x, lineIndex, tokenWidth, spaceWidth }
                          ↓
   Overlay renders using token.x
   ```

7. **Vaelrix Law compliance:**
   - Law #4 (Server Is Truth): Textarea is decorative, bytecode-derived overlay is authoritative
   - Law #8 (Bytecode Is Priority): Overlay positions derived from topology (bytecode-measured)
   - Never read from DOM to calculate state

8. **Whitespace is NOT uniform:** In proportional fonts like Georgia:
   - Space character width varies by font/size
   - Tab width is multiple of space width
   - **Must measure:** `ctx.measureText(' ').width` not assumed

9. **Complete font specification required:**
   ```javascript
   // Font string: [style] [weight] [size] [family]
   ctx.font = `${fontStyle} ${fontWeight} ${fontSize} ${fontFamily}`;
   ```
   - `fontStyle: 'italic'` — changes letterforms (single-story 'a', 'g')
   - `fontWeight: '700'` — bold is "unusually heavy" in Georgia
   - Both affect character widths!

---

*Entry Status: COMPLETE | Last Updated: 2026-04-02 | Author: Claude (UI Agent)*
