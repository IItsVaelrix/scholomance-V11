# Handoff: VowelFamilyPanel — Truesight Decoupling

**For:** Gemini / Codex
**From:** Claude (UI)
**Status:** Blocked — requires state machine changes outside UI ownership

---

## What We Want

VowelFamilyPanel should be openable independent of Truesight mode. Right now it only renders when `isTruesight && analysisMode === ANALYSIS_MODES.VOWEL`. The coupling makes no product sense — vowel family breakdown is useful data regardless of whether the overlay is active.

## Why Claude Can't Do It

The attempt was made and immediately reverted. The Truesight gate on the panel is load-bearing:

- `vowelFamilyAnalytics` useMemo early-returns empty when `!isTruesight` (ReadPage.jsx ~line 325)
- The FloatingPanel render gates on `isTruesight && analysisMode === ANALYSIS_MODES.VOWEL`
- Removing those guards without fixing the underlying state machine breaks the UI — the panel opens but the `analysisMode` state that drives it is entangled with Truesight activation

The `analysisMode` / `isTruesight` relationship is defined in state logic that lives in hooks and data layers Claude does not own.

## What Codex Needs to Do

1. **Audit the `analysisMode` state machine** — determine whether `ANALYSIS_MODES.VOWEL` can be set independently of `isTruesight`, or whether activating vowel mode currently forces/requires Truesight on.

2. **If they are coupled in the state machine** — decouple them. `analysisMode` should be settable freely; `isTruesight` should be an independent boolean. The UI will then render the panel based on `analysisMode === ANALYSIS_MODES.VOWEL` alone.

3. **Expose `vowelSummary` data independent of Truesight** — `usePanelAnalysis` (or equivalent) should compute `vowelSummary` regardless of `isTruesight`. Currently the data path may only run when Truesight is active.

4. **Once state is clean, notify Claude** — the UI-side changes are trivial (remove two guard conditions, update deps array, update empty state string). Claude will apply them once the state contract is confirmed safe.

## UI Changes Waiting (Claude will apply after Codex confirms)

```jsx
// ReadPage.jsx — vowelFamilyAnalytics useMemo
// Remove: if (!isTruesight || analysisMode !== ANALYSIS_MODES.VOWEL)
// Replace with: if (analysisMode !== ANALYSIS_MODES.VOWEL)
// Remove isTruesight from deps array

// ReadPage.jsx — FloatingPanel render gate
// Remove: {isTruesight && analysisMode === ANALYSIS_MODES.VOWEL &&
// Replace with: {analysisMode === ANALYSIS_MODES.VOWEL &&

// VowelFamilyPanel.jsx — empty state
// "Enable Truesight and add some verse." → "Add some verse to see phoneme breakdown."
```
