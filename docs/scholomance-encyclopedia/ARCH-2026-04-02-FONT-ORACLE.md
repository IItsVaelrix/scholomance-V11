# ARCH-2026-04-02-FONT-ORACLE

## Bytecode Search Code
`SCHOL-ENC-BYKE-SEARCH-002`

## Architecture Proposal: PixelBrain Font Audit Oracle

**Status:** PDR Drafted → Pending Implementation
**Classification:** Architectural + Rendering Systems + Measurement Infrastructure
**Priority:** Critical

---

## Summary

The **Font Audit Oracle** converts typography from an assumed browser service into a **PixelBrain-measured rendering material**.

This architecture was conceived after the Linux Font Crisis (BUG-2026-04-02-WHITESPACE-ALIGNMENT) revealed that:
- Georgia font is not available on Linux
- Browser silently fell back to DejaVu Serif
- Our overlay measurement assumed Georgia metrics
- Result: Text misalignment on Linux

The Oracle ensures this class of bug is **impossible** by making font measurement deterministic and environment-stamped.

---

## Core Design: Dual-Truth Model

### A. Capability Registry (Advisory)
What the browser environment appears capable of:
- `supportsFontFace` - CSS FontFace API available
- `supportsMeasureText` - Canvas measureText available
- `supportsBoundingBoxMetrics` - actualBoundingBox* APIs available
- `supportsLocalFontInspection` - Local Font Access API available

### B. Measured Reality (Authoritative)
What PixelBrain actually rendered and verified:
- Resolved font family (may differ from requested!)
- Source: `local` | `webfont` | `fallback` | `unknown`
- Probe measurements: widths, ascents, descents, ink bounds
- Glyph atlas fingerprint: pixel-level glyph verification
- Confidence score: 0.0 - 1.0
- Support verdict: `supported` | `supported-with-risk` | `fallback` | `unsupported`

**Key Principle:** Capability is advisory. Measurement is authoritative.

---

## Architecture Pipeline

```
FontRequest
→ Environment Probe (browser, OS, DPR)
→ Capability Registry Snapshot
→ Font Resolution Attempt (local/web/fallback)
→ Runtime Font Load Barrier
→ Probe String Measurement (canvas)
→ Glyph Atlas Render + Analysis
→ Fallback / Mismatch Detection
→ ByteCode FontSpec Payload
→ Cache (environment-stamped)
→ QA / Layout Consumers
```

---

## ByteCode FontSpec Format

```ts
type CompiledFontSpecBytecode = {
  version: 1;
  family: string;                    // Requested: "Crimson Pro"
  resolvedFamily: string;            // Actual: "DejaVu Serif"
  source: 'local' | 'webfont' | 'fallback' | 'unknown';
  environment: {
    browser: 'firefox';
    browserVersion: '145';
    os: 'linux';
    dpr: 1.0;
  };
  supportVerdict: 'supported' | 'supported-with-risk' | 'fallback' | 'unsupported';
  confidence: 0.95;
  probeMetrics: [
    { text: 'Hamburgefonstiv', width: 126.42, ascent: 12.14, descent: 3.88 },
    { text: ' ', width: 4.0 },
    { text: 'W', width: 18.5 },
    { text: 'i', width: 4.2 },
  ];
  atlasFingerprint: '0x74aab19d';
  cacheKey: 'crimson-pro-16-400-firefox-145-linux-1.0';
};
```

---

## How This Solves The Linux Font Crisis

### Before (Broken)
```javascript
// CSS requests Georgia
fontFamily: 'Georgia, serif'

// Linux has no Georgia → Falls back to DejaVu Serif
// Our code assumes Georgia metrics
const spaceWidth = 4.5;  // Georgia space width (WRONG!)

// Overlay uses wrong metrics → Misalignment
```

### After (Fixed)
```javascript
// Font Oracle audits request
const fontSpec = await PixelBrainFontOracle.audit({
  family: 'Georgia',
  sizePx: 16,
});

// Returns:
fontSpec = {
  resolvedFamily: 'DejaVu Serif',  // Detected fallback!
  source: 'fallback',
  supportVerdict: 'fallback',
  confidence: 0.85,
  probeMetrics: [
    { text: ' ', width: 5.2 },  // Measured DejaVu space width
  ],
}

// Overlay uses MEASURED metrics → Perfect alignment
const spaceWidth = fontSpec.probeMetrics.find(p => p.text === ' ').width;
```

---

## Implementation Phases

### Phase 1: Capability + Measurement Foundation
- [ ] Environment stamp (browser, OS, DPR)
- [ ] Capability registry (feature detection)
- [ ] Font resolution attempt model
- [ ] Runtime probe measurement
- [ ] Initial support verdict
- [ ] Cache with environment key

### Phase 2: Glyph Atlas Verification
- [ ] Glyph atlas render pipeline
- [ ] Ink-bounds extraction
- [ ] Fingerprint hashing
- [ ] Fallback similarity scoring
- [ ] Confidence model

### Phase 3: ByteCode FontSpec Compiler
- [ ] Canonical FontSpec IR
- [ ] Persistent environment-stamped cache
- [ ] QA integration
- [ ] Layout consumer APIs

### Phase 4: Canonical Fingerprint Library
- [ ] Known-good font fingerprints
- [ ] Browser-family delta heuristics
- [ ] Confidence tuning over time

---

## Consumer Systems

### ScrollEditor
Uses FontSpec for:
- Line alignment with measured space widths
- Overlay positioning with measured token widths
- Per-word clickable regions with ink bounds
- Exact editor geometry calibration

### TrueSight Overlay
Uses FontSpec for:
- Measured bounds for phoneme overlays
- Glyph-aware clickable regions
- Fallback detection → Adapt overlay strategy

### Browser QA
Uses FontSpec for:
- Detecting unexpected fallback
- Browser drift detection
- Version-specific rendering changes
- Environment mismatch alerts

### Responsive Layout Engine
Uses FontSpec for:
- Measured typography instead of assumed CSS dimensions
- Deterministic text container sizing
- Cross-browser parity assertions

---

## Success Criteria

This architecture is successful when PixelBrain can:

1. ✅ Accept a specific font request
2. ✅ Audit it on Chrome, Firefox, Edge, Opera
3. ✅ Determine whether truly supported or fallback
4. ✅ Return measured pixel metrics per environment
5. ✅ Verify glyph identity through atlas analysis
6. ✅ Compile result into ByteCode FontSpec payloads
7. ✅ Expose safe/unsafe guidance for exact layout consumers

---

## Why This Matters For Scholomance

Scholomance is not a generic website. Typography participates in:

- **Mystical UI composition** - Font choice is thematic, not decorative
- **Clickable text overlays** - Phoneme highlighting requires pixel-perfect hitboxes
- **Verse editor geometry** - Word-wrap simulation needs measured metrics
- **Deterministic QA** - Text drift must be detectable and preventable
- **Emergent in-game behavior** - Font availability can trigger transmutation events

**Example: Emergent Font Transmutation**
```javascript
// Player inscribes verse with "Crimson Pro" typography
const verseRequest = { typography: { family: 'Crimson Pro' } };

// Font Oracle audits environment
const audit = await PixelBrainFontOracle.audit(verseRequest.typography);

if (audit.supportVerdict === 'fallback') {
  // In-game event: Font transmutation ritual required
  triggerEvent('FONT_TRANSMUTATION', {
    requested: audit.requestedFamily,
    resolved: audit.resolvedFamily,
    action: 'offer_webfont_load_or_adapt_layout',
  });
}
```

This turns a technical limitation into a **diegetic game mechanic**.

---

## Related Encyclopedia Entries

- `BUG-2026-04-02-WHITESPACE-ALIGNMENT` - The Linux Font Crisis that motivated this architecture
- `VAELRIX_LAW.md` - Law #8 (Bytecode Is Priority) - This makes typography bytecode-governed

---

## PDR Location

Full PDR: `pixelbrain_font_audit_bytecode_pdr.md`

---

*Entry Status: PROPOSED | Created: 2026-04-02 | Author: Angel (IItsVaelrix)*
