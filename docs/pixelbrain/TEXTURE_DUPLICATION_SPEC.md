# PixelBrain Reference Image Duplication with Scholomance Textures

## Overview

**Feature Name:** Void Echo — Reference Image Texturing  
**Status:** Spec → Implementation  
**Owner:** Claude (UI/Visual), Codex (Backend/Engine)  
**Priority:** P1 — Core PixelBrain Enhancement  

---

## Vision

Transform uploaded reference images into **Scholomance-themed variants** by applying arcane texture overlays, material transmutation, and phonemic color mapping. The feature preserves the original image's composition while re-skinning it with grimoire aesthetics: parchment, leather, gold leaf, aurora gradients, and school-aligned chromatic fields.

**World-Law Connection:** The Void does not merely copy — it *echoes*. Each duplicate bears the semantic imprint of Scholomance's linguistic substrate, mapping image anatomy to phoneme families and school dominions.

---

## Use Cases

### 1. Asset Variation
**User Story:** As a game developer, I want to generate multiple textured variants of my pixel art so I can use them as environment tiles, item icons, or spell effects without manual recoloring.

**Example:** Upload a sword sprite → Generate 5 variants: SONIC (purple lightning), PSYCHIC (cyan mind-flame), ALCHEMY (magenta corrosion), WILL (orange radiance), VOID (zinc entropy).

### 2. Thematic Consistency
**User Story:** As a world-builder, I want all my assets to share a cohesive Scholomance aesthetic so my game feels like it belongs in the grimoire universe.

**Example:** Upload 20 dungeon tiles → Apply "Dungeon Core" texture pack → All tiles now share parchment borders, gold glyphs, and shadow vignettes.

### 3. Phonemic Visualization
**User Story:** As a linguistics researcher, I want to see how image regions map to phoneme families so I can study the relationship between visual form and linguistic sound.

**Example:** Upload a portrait → Generate phoneme overlay showing vowel distributions (SONIC vowels glow purple, PSYCHIC vowels pulse cyan).

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │ UploadSection│  │TextureSelector│  │ DuplicatePreviewGrid │   │
│  └──────┬──────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                │                      │               │
│         └────────────────┴──────────────────────┘               │
│                          │                                      │
│                   POST /api/image/duplicate                     │
└──────────────────────────┼──────────────────────────────────────┘
                           │
┌──────────────────────────┼──────────────────────────────────────┐
│                    BACKEND (Fastify)                            │
│                          ▼                                      │
│  ┌────────────────────────────────────────────────────────┐     │
│  │           imageDuplication.service.js                  │     │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │     │
│  │  │ TextureLoader│  │ Compositor   │  │ PhonemeMapper│ │     │
│  │  └──────────────┘  └──────────────┘  └──────────────┘ │     │
│  └────────────────────────────────────────────────────────┘     │
│                          │                                      │
│  ┌───────────────────────┼────────────────────────────────┐     │
│  │              Texture Assets (PNG)                      │     │
│  │  /textures/parchment.png  /textures/leather.png        │     │
│  │  /textures/gold_leaf.png  /textures/aurora_*.png       │     │
│  │  /textures/school_*.png   /textures/glyph_*.png        │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Specification

### Endpoint: `POST /api/image/duplicate`

**Purpose:** Generate Scholomance-textured duplicates of an uploaded reference image.

#### Request

```
POST /api/image/duplicate
Content-Type: multipart/form-data

Parameters:
  - image: File (PNG, JPEG, BMP, max 5MB)
  - textures: String[] (optional, default: ['parchment', 'gold_leaf'])
  - schools: String[] (optional, default: [])
  - blendMode: String (optional, default: 'multiply')
  - opacity: Number (optional, default: 0.7, range: 0-1)
  - applyPhonemeMapping: Boolean (optional, default: false)
  - count: Number (optional, default: 1, range: 1-10)
```

#### Response

```json
{
  "success": true,
  "duplicates": [
    {
      "id": "dup_7f8a9b2c",
      "url": "/api/image/duplicate/7f8a9b2c.png",
      "texture": "parchment",
      "school": null,
      "phonemeMapped": false,
      "dimensions": { "width": 256, "height": 256 },
      "previewBase64": "data:image/png;base64,..."
    },
    {
      "id": "dup_3c4d5e6f",
      "url": "/api/image/duplicate/3c4d5e6f.png",
      "texture": "gold_leaf",
      "school": "SONIC",
      "phonemeMapped": true,
      "dimensions": { "width": 256, "height": 256 },
      "previewBase64": "data:image/png;base64,..."
    }
  ],
  "processingTime": 1247,
  "metadata": {
    "originalDimensions": { "width": 256, "height": 256 },
    "textureCount": 2,
    "schoolCount": 1
  }
}
```

#### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `NO_IMAGE_PROVIDED` | 400 | No file uploaded |
| `INVALID_BUFFER` | 400 | File buffer corrupted or empty |
| `UNSUPPORTED_FORMAT` | 400 | Image format not PNG/JPEG/BMP |
| `FILE_TOO_LARGE` | 413 | File exceeds 5MB limit |
| `INVALID_TEXTURE` | 400 | Requested texture not found |
| `INVALID_SCHOOL` | 400 | Requested school not in allowed list |
| `GENERATION_FAILED` | 500 | Texture composition failed |

---

## Texture System

### Base Textures

| ID | File | Blend Mode | Opacity | Description |
|----|------|------------|---------|-------------|
| `parchment` | `parchment_base.png` | multiply | 0.6 | Aged paper with fiber grain |
| `leather` | `leather_grain.png` | overlay | 0.5 | Dark leather with tooling patterns |
| `gold_leaf` | `gold_foil.png` | screen | 0.4 | Metallic gold shimmer |
| `vellum` | `vellum_smooth.png` | soft-light | 0.5 | Smooth parchment, lighter |
| `stone` | `stone_rune.png` | hard-light | 0.3 | Carved stone with glyph indentations |
| `aurora` | `aurora_borealis.png` | color-dodge | 0.35 | Ethereal light curtains |
| `shadow` | `shadow_vignette.png` | multiply | 0.5 | Dark edges, focus center |
| `glyph_border` | `glyph_frame.png` | normal | 0.8 | Ornate border frame |

### School Textures

| School | File | Effect |
|--------|------|--------|
| `SONIC` | `sonic_resonance.png` | Purple wave patterns |
| `PSYCHIC` | `psychic_flame.png` | Cyan mind-fire |
| `ALCHEMY` | `alchemy_corrosion.png` | Magenta chemical drip |
| `WILL` | `will_radiance.png` | Orange divine light |
| `VOID` | `void_entropy.png` | Zinc decay/static |

### Phoneme Overlay

When `applyPhonemeMapping: true`, the system:
1. Analyzes image regions for edge density and brightness
2. Maps regions to vowel families (per `VOWEL_FAMILY_TO_SCHOOL`)
3. Applies school-colored glow to mapped regions
4. Generates phoneme heatmap overlay

**Phoneme Mapping Heuristics:**
- High contrast edges → Plosive consonants (sharp, hard)
- Smooth gradients → Fricative vowels (soft, flowing)
- Bright regions → High vowels (/i/, /u/)
- Dark regions → Low vowels (/ɑ/, /ɔ/)

---

## Blend Modes

Supported Canvas blend modes:

| Mode | Effect | Best For |
|------|--------|----------|
| `normal` | Direct overlay | Opaque textures |
| `multiply` | Darkens base | Parchment, leather |
| `screen` | Lightens base | Gold, aurora |
| `overlay` | Contrast boost | Leather, stone |
| `soft-light` | Subtle contrast | Vellum, subtle textures |
| `hard-light` | High contrast | Stone, glyphs |
| `color-dodge` | Bright highlights | Aurora, magic effects |
| `color-burn` | Dark shadows | Void, decay |
| `luminosity` | Brightness only | Preserving hue |

---

## Implementation Plan

### Phase 1: Backend Foundation
**Files:**
- `codex/server/services/imageDuplication.service.js` (NEW)
- `codex/server/routes/imageDuplication.routes.js` (NEW)
- `codex/core/pixelbrain/image-texturing.js` (NEW)
- `codex/core/pixelbrain/phoneme-mapping.js` (NEW)

**Tasks:**
1. Create texture asset directory structure
2. Implement texture loading and caching
3. Build canvas-based compositor
4. Add phoneme mapping algorithm
5. Register routes in `codex/server/index.js`

### Phase 2: Frontend UI
**Files:**
- `src/pages/PixelBrain/components/DuplicateSection.jsx` (NEW)
- `src/pages/PixelBrain/components/TextureSelector.jsx` (NEW)
- `src/pages/PixelBrain/components/DuplicatePreviewGrid.jsx` (NEW)
- `src/pages/PixelBrain/PixelBrainPage.jsx` (MODIFY)

**Tasks:**
1. Add "Duplicate with Texture" button to UploadSection
2. Create texture picker with preview thumbnails
3. Build school selector checkboxes
4. Add blend mode and opacity sliders
5. Create preview grid for generated duplicates
6. Add download all / export options

### Phase 3: Integration & Polish
**Files:**
- `src/pages/PixelBrain/PixelBrainPage.css` (MODIFY)
- `docs/pixelbrain/TEXTURE_DUPLICATION.md` (NEW)

**Tasks:**
1. Wire frontend to backend endpoint
2. Add loading states with skeleton screens
3. Implement error handling with bytecode errors
4. Add visual regression tests
5. Write user documentation

---

## File Structure

```
scholomance-V11/
├── codex/
│   ├── core/
│   │   └── pixelbrain/
│   │       ├── image-texturing.js          # NEW - Texture composition
│   │       └── phoneme-mapping.js          # NEW - Phoneme overlay
│   └── server/
│       ├── services/
│       │   └── imageDuplication.service.js # NEW - Business logic
│       └── routes/
│           └── imageDuplication.routes.js  # NEW - API routes
├── src/
│   └── pages/
│       └── PixelBrain/
│           ├── components/
│           │   ├── DuplicateSection.jsx    # NEW
│           │   ├── TextureSelector.jsx     # NEW
│           │   └── DuplicatePreviewGrid.jsx # NEW
│           └── PixelBrainPage.jsx          # MODIFY
├── public/
│   └── textures/
│       ├── base/
│       │   ├── parchment_base.png
│       │   ├── leather_grain.png
│       │   ├── gold_foil.png
│       │   └── ...
│       ├── school/
│       │   ├── sonic_resonance.png
│       │   ├── psychic_flame.png
│       │   └── ...
│       └── phoneme/
│           ├── vowel_heatmap.png
│           └── consonant_overlay.png
└── docs/
    └── pixelbrain/
        └── TEXTURE_DUPLICATION.md          # NEW - User guide
```

---

## Data Flow

### 1. Upload & Analysis
```
User uploads image
    ↓
Frontend creates preview
    ↓
POST /api/image/duplicate with texture options
    ↓
Backend validates buffer
    ↓
Decode image to pixel data
```

### 2. Texture Composition
```
Load base image canvas
    ↓
For each requested texture:
  - Load texture PNG
  - Scale to match base dimensions
  - Apply blend mode + opacity
  - Composite onto base canvas
    ↓
If school selected:
  - Load school texture
  - Apply school color filter
  - Composite with additive blend
    ↓
If phoneme mapping enabled:
  - Analyze image regions
  - Generate phoneme heatmap
  - Apply colored glow overlay
```

### 3. Output Generation
```
Flatten composite canvas
    ↓
Encode as PNG buffer
    ↓
Store in temp directory with UUID
    ↓
Return URLs + preview base64
    ↓
Frontend displays in preview grid
```

---

## UI Mockup

```
┌────────────────────────────────────────────────────────────┐
│  PIXELBRAIN — Void Echo                                    │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌──────────────┐                                          │
│  │  [Preview]   │  Texture Presets:                        │
│  │   Original   │  ☐ Parchment   ☐ Leather   ☐ Gold Leaf  │
│  │              │  ☐ Vellum      ☐ Stone     ☐ Aurora     │
│  │              │                                          │
│  │              │  School Overlays:                        │
│  │              │  ☐ SONIC   ☐ PSYCHIC   ☐ ALCHEMY        │
│  │              │  ☐ WILL    ☐ VOID                       │
│  │              │                                          │
│  │              │  Phoneme Mapping:  [✓] Apply             │
│  │              │  Blend Mode:       [multiply ▼]          │
│  │              │  Opacity:          [████░░] 0.7          │
│  │              │  Variants:         [5 ▼]                 │
│  │              │                                          │
│  │              │         [ INITIATE ECHO ]                │
│  └──────────────┘                                          │
│                                                            │
│  Generated Variants:                                       │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│  │ Var1 │ │ Var2 │ │ Var3 │ │ Var4 │ │ Var5 │             │
│  │[📥]  │ │[📥]  │ │[📥]  │ │[📥]  │ │[📥]  │             │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘             │
│                                                            │
│  [Download All as ZIP]  [Export to Asset Pack]             │
└────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

1. **File Validation:** Strict MIME type checking, magic number verification
2. **Size Limits:** 5MB max input, 10MB max output
3. **Rate Limiting:** 10 requests/minute per user
4. **Temp Storage:** Auto-delete generated images after 1 hour
5. **No Execution:** Texture files are PNG-only, no SVG/XML to prevent XSS
6. **Buffer Sanitization:** Strip EXIF/metadata from outputs

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Single duplicate generation | < 500ms |
| 5 variants batch | < 2000ms |
| Texture load time (cached) | < 50ms |
| Phoneme mapping | < 300ms |
| Memory per request | < 50MB |

---

## Testing Strategy

### Unit Tests
- `image-texturing.test.js` — Texture loading, blend modes, opacity
- `phoneme-mapping.test.js` — Region analysis, vowel mapping
- `imageDuplication.service.test.js` — Service layer validation

### Integration Tests
- `duplicate-api.test.js` — Full API request/response cycle
- `texture-cache.test.js` — Asset loading and caching

### Visual Regression Tests
- `tests/visual/pixelbrain/duplicate-parchment.png`
- `tests/visual/pixelbrain/duplicate-gold-leaf.png`
- `tests/visual/pixelbrain/duplicate-sonic.png`
- `tests/visual/pixelbrain/duplicate-phoneme.png`

### Manual QA Checklist
- [ ] Upload PNG, apply parchment texture → Verify blend
- [ ] Upload JPEG, apply all 5 school overlays → Verify colors
- [ ] Enable phoneme mapping on high-contrast image → Verify heatmap
- [ ] Generate 10 variants → Verify performance < 3s
- [ ] Download all as ZIP → Verify file integrity

---

## Success Metrics

1. **Adoption:** 40% of reference image users try duplication within 1 week
2. **Retention:** Users who generate duplicates return 2x more often
3. **Assets Generated:** 1000+ textured variants in first month
4. **Performance:** 95% of requests complete under 1s
5. **Error Rate:** < 1% generation failures

---

## Future Enhancements

### Phase 4: Advanced Texturing
- Custom texture upload (user-provided PNG overlays)
- Texture blending preview (real-time canvas preview)
- Animated textures (GIF/APNG support)
- Layered textures (stack multiple with individual controls)

### Phase 5: AI-Assisted
- Auto-suggest textures based on image content
- Semantic texture mapping (sky → aurora, stone → runes)
- Style transfer from existing Scholomance assets

### Phase 6: Batch Processing
- Upload 20 images → Apply texture pack to all
- Queue system for large batches
- Background processing with progress notifications

---

## Handoff Notes

**For Claude:**
- Texture selector UI needs to feel grimoire-themed (parchment backgrounds, gold borders)
- Preview grid should animate in with Framer Motion (staggered fade-in)
- Download buttons should use school-colored icons

**For Codex:**
- Texture caching is critical — preload on server start
- Phoneme mapping can reuse existing `VOWEL_FAMILY_TO_SCHOOL` from `src/data/schools.js`
- Use `canvas.compose()` pattern from existing pixel art pipeline

**For Blackbox:**
- Visual regression baselines needed for all 8 base textures + 5 schools
- Performance tests for batch generation (1, 5, 10 variants)
- Error path testing (invalid texture, corrupted input, timeout)

---

## Approval

**Spec Status:** ⏳ Pending Review  
**Next Step:** Implementation (Phase 1 — Backend Foundation)  
**ETA:** 3-4 sprints (backend + frontend + QA)

---

*The Void echoes. Every image bears its mark.*
