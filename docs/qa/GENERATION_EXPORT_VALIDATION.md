# QA Generation & Export Validation

Comprehensive QA validation system for Scholomance V11 generation and export functionality.

## Overview

This QA system validates:
- **School Styles Generation** - CSS variable generation for school themes
- **Corpus Generation** - Dictionary and sequence pair extraction for PLS
- **PixelBrain Export** - Aseprite-compatible pixel art asset export

## File Structure

```
tests/qa/generation/
├── school-styles-generation.test.js    # School CSS generation tests
├── corpus-generation.test.js           # Corpus/Dictionary generation tests
└── pixelbrain-aseprite-export.test.js  # Aseprite export validation tests

scripts/
└── qa-generation-validation.js         # Main validation runner
```

## Running Validation

### Full Validation Suite

```bash
# Run all generation/export validation
node scripts/qa-generation-validation.js

# With HTML report
node scripts/qa-generation-validation.js --report

# Attempt auto-fixes (where applicable)
node scripts/qa-generation-validation.js --fix
```

### Individual Test Suites

```bash
# School styles generation tests
npm run test -- tests/qa/generation/school-styles-generation.test.js

# Corpus generation tests
npm run test -- tests/qa/generation/corpus-generation.test.js

# PixelBrain Aseprite export tests
npm run test -- tests/qa/generation/pixelbrain-aseprite-export.test.js

# All generation tests
npm run test -- tests/qa/generation/*.test.js
```

## Validation Coverage

### School Styles Generation

| Test Category | Coverage |
|--------------|----------|
| Script Contract | CLI args, fallback mechanism |
| CSS Output | Syntax validation, school themes, variable structure |
| Error Handling | Missing directories, API failures |
| Performance | Generation time, file size limits |
| Integration | Programmatic function exports |

### Corpus Generation

| Test Category | Coverage |
|--------------|----------|
| Script Contract | Constants, normalization functions |
| Payload Structure | Version, dictionary, sequences schema |
| Text Processing | Normalization, tokenization, counting |
| Sequence Generation | Word pairs, filtering |
| Sorting/Limiting | Frequency sort, dictionary limits |
| File I/O | Directory creation, JSON writing |
| Database Config | Environment variables, fallbacks |
| Performance | Token processing efficiency |

### PixelBrain Aseprite Export

| Test Category | Coverage |
|--------------|----------|
| Export Presets | Structure validation, Aseprite preset |
| PNG Export | Coordinate structure, scaling, dimensions |
| JSON Metadata | Aseprite-compatible structure, formula bytecode |
| Coordinate Mapping | Grid snapping, bounds validation |
| Color Palette | Aseprite structure, GPL/ACT formats |
| Export Pipeline | Complete pipeline, preset application |
| Aseprite-Specific | Frames, layers, animation tags |
| Error Handling | Empty inputs, missing data, invalid formats |

## Export Format Specifications

### Aseprite-Compatible Export

The PixelBrain export system generates Aseprite-compatible output:

**PNG + JSON Structure:**
```json
{
  "aseprite": {
    "version": "1.3",
    "compatible": true
  },
  "pixelBrain": {
    "formula": { ... },
    "coordinates": [ ... ],
    "palettes": [ ... ]
  },
  "meta": {
    "size": { "w": 160, "h": 144 },
    "frameTags": [ ... ],
    "layers": [ ... ]
  }
}
```

**Supported Export Presets:**
| Preset | Format | Scale | Metadata | Target |
|--------|--------|-------|----------|--------|
| GODOT | PNG | 1x | Yes | Godot Engine |
| UNITY | PNG | 2x | Yes | Unity Engine |
| WEB | PNG | 1x | No | Web display |
| FORMULA | JSON | 1x | No | Formula data only |
| ASEPRITE | PNG+JSON | 1x | Yes | Aseprite import |

### Palette Export Formats

**GPL Format (GIMP/Aseprite):**
```
GIMP Palette
Name: PixelBrain Palette
Columns: 4
#
255 0 0    #FF0000
0 255 0    #00FF00
0 0 255    #0000FF
```

**ACT Format (Photoshop/Aseprite):**
- Binary format: 3 bytes per color (R, G, B)
- Maximum 256 colors
- No header, raw RGB data

## CI/CD Integration

Add to your CI pipeline:

```yaml
# .github/workflows/qa-generation.yml
name: QA Generation Validation

on: [push, pull_request]

jobs:
  validate-generation:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run generation validation
        run: node scripts/qa-generation-validation.js --report

      - name: Upload report
        uses: actions/upload-artifact@v4
        with:
          name: qa-generation-report
          path: reports/qa-generation-validation.html
```

## Troubleshooting

### School Styles Generation Fails

**Symptom:** `✗ Failed to generate school-styles.css`

**Solutions:**
1. Check `src/lib/css/schoolStyles.js` exists and exports required functions
2. Verify output directory permissions: `src/lib/css/generated/`
3. Run manually: `node scripts/generate-school-styles.js`

### Corpus Generation Skipped

**Symptom:** `⚠ Corpus source not found, skipping...`

**Solutions:**
1. Create corpus database at `scholomance_corpus.sqlite`
2. Or add fallback data to `docs/references/DATA-SET 1.md`
3. Set environment variable: `SCHOLOMANCE_CORPUS_PATH=/path/to/corpus.sqlite`

### Aseprite Export Tests Fail

**Symptom:** Coordinate or palette validation failures

**Solutions:**
1. Verify coordinate structure: `{ x, y, z, color, emphasis }`
2. Check color format: Must be `#RRGGBB` hex
3. Validate palette has at least one color entry

## Adding New Validation Tests

```javascript
// tests/qa/generation/my-new-feature.test.js

import { describe, it, expect } from 'vitest';

describe('My Feature Generation QA', () => {
  describe('Input Validation', () => {
    it('should accept valid input', () => {
      // Test implementation
    });

    it('should reject invalid input', () => {
      // Test implementation
    });
  });

  describe('Output Validation', () => {
    it('should produce correct output structure', () => {
      // Test implementation
    });
  });
});
```

## Performance Benchmarks

| Operation | Target | Current |
|-----------|--------|---------|
| School styles generation | < 5s | ~1s |
| Corpus generation (10k words) | < 30s | ~15s |
| PixelBrain export | < 500ms | ~200ms |
| Full test suite | < 60s | ~30s |

## Related Documentation

- `BLACKBOX.md` - Testing architecture
- `SCHEMA_CONTRACT.md` - Data schemas
- `codex/core/pixelbrain/` - PixelBrain implementation
- `scripts/generate-school-styles.js` - School styles generator
- `scripts/generate_corpus.js` - Corpus generator

## Maintenance

### Quarterly Audit Checklist

- [ ] Update performance benchmarks
- [ ] Review test coverage for new features
- [ ] Validate Aseprite format compatibility
- [ ] Check export preset requirements
- [ ] Update CI/CD integration examples
- [ ] Verify documentation accuracy

### Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-03-31 | Initial implementation |
