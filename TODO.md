# Vowel Family Consolidation - 8 Core Families

## Goal
Consolidate from 16 vowel families down to 8 core families for tighter phoneme logic, while maintaining 5-color sonic palettes for schools.

## 8 Core Vowel Families
1. **IY** - High front (machine, green, gene, boolean)
2. **IH** - Near-high front (obelisk, continent, constant) + ER
3. **EY** - Mid front (bait, day) + AY diphthong
4. **AE** - Low front (bat, dragon) + EH
5. **A** - Low back (obvious, monument, constant) + AA, AH, AX, AW
6. **AO** - Mid back rounded (water, slaughter, martyr, conquer) - DISTINCT
7. **OW** - Mid-high back (soul, cold, boulder, hole) + OH, OY
8. **UW** - High back (boot, true) + OO, YOO, YUW, UH

## Implementation Steps

### Step 1: Update vowelFamily.js - Consolidation Aliases
- [x] Plan approved
- [x] Add new aliases to FAMILY_ALIASES:
  - EH → AE
  - AY → EY
  - AW → A
  - OY → OW
  - UH → UW
  - ER → IH
  - Keep existing: AA→A, AH→A, AX→A, OH→OW, OO→UW, YOO→UW, YUW→UW

### Step 2: Update vowelPalette.js - 8 Core Positions
- [x] Reduce VOWEL_POSITIONS to 8 entries (IY, IH, EY, AE, A, AO, OW, UW)
- [x] Remove: EH, AY, AW, OY, UH, ER, AA, AH (handled by aliases)
- [x] Adjust IPA positions for better color distribution

### Step 3: Update schoolPalettes.js - 5-Color Palettes
- [x] Reduce each palette from 16 colors to 8 colors
- [x] Update DEFAULT_VOWEL_COLORS (8 entries)
- [x] Update DEFAULT_LIGHT_COLORS (8 entries)
- [x] Update SONIC_COLORS (8 entries)
- [x] Update SONIC_LIGHT_COLORS (8 entries)
- [x] Update PSYCHIC_COLORS (8 entries)
- [x] Update PSYCHIC_LIGHT_COLORS (8 entries)
- [x] Update VOID_COLORS (8 entries)
- [x] Update VOID_LIGHT_COLORS (8 entries)
- [x] Update ALCHEMY_COLORS (8 entries)
- [x] Update ALCHEMY_LIGHT_COLORS (8 entries)
- [x] Update WILL_COLORS (8 entries)
- [x] Update WILL_LIGHT_COLORS (8 entries)

### Step 4: Update phoneme.engine.js - ARPABET Mapping
- [x] Update ARPABET_TO_FAMILY to map to 8 core families:
  - 'EH' → 'AE'
  - 'AY' → 'EY'
  - 'AW' → 'A'
  - 'OY' → 'OW'
  - 'UH' → 'UW'
  - 'ER' → 'IH'
- [x] Update VOWEL_FAMILY_TO_SCHOOL mapping for 8 families
- [x] Verify EXCEPTIONS dictionary still works with new mappings

### Step 5: Update schools.js - Vowel Affinities
- [x] Update SONIC vowelAffinities (currently: AO, IH, OW)
- [x] Update PSYCHIC vowelAffinities (currently: AY, IY, UW) → (EY, IY, UW)
- [x] Update VOID vowelAffinities (currently: UH, ER) → (UW, IH)
- [x] Update ALCHEMY vowelAffinities (currently: EY, A, OH) → (EY, A, OW)
- [x] Update WILL vowelAffinities (currently: AE, AW, EH) → (AE, A)
- [x] Ensure each school has appropriate vowel coverage

### Step 6: Testing & Verification
- [x] Run phoneme.engine.test.js
- [x] Run colorCodex.test.js
- [x] Test rhyme matching for example words:
  - soul/cold/boulder (OW family)
  - water/slaughter/martyr (AO family)
  - machine/green/gene (IY family)
  - obelisk/continent (IH family)
- [x] Verify Truesight color rendering
- [x] Check school palette switching

### Step 7: Documentation
- [x] Update comments in affected files
- [x] Note breaking changes if any
- [x] Document the 8 core families in README or ARCH docs

## Notes
- AO must stay distinct from OW (water vs soul)
- ER maps to IH (r-colored central → near-high front)
- Diphthongs map to their primary vowel quality
- School palettes will use 5 distinct colors but map to 8 families (some colors shared)
