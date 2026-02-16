# Scholomance Color Logic & Phoneme Audit

This document provides a line-by-line logical audit of the phonetic analysis and color rendering pipeline in Scholomance V10.

## 1. Executive Summary
The current phonetic-to-visual mapping system is approximately **60-75% consistent**. While the broad "ritual theme" works, there are critical logical discrepancies in how phonemes are grouped and normalized, leading to "color bleeding" where distinct sounds are rendered identically.

---

## 2. Core Logical Discrepancies

### A. The "AY" vs "EY" Merge (PRICE vs FACE)
*   **Location:** `src/lib/vowelFamily.js`
*   **Logic:** `AY: "EY"` in `FAMILY_ALIASES`.
*   **Audit:** This is a major phonetic inaccuracy. `AY` (as in *LIKE*, *TIME*) is a diphthong starting with an open central vowel. `EY` (as in *FACE*, *MAKE*) is a mid front diphthong.
*   **Visual Result:** Words like "Like" and "Lake" will appear in the exact same color (Violet/Purple), making it impossible for the user to distinguish between these two distinct sound families.

### B. The "ER" vs "IH" Merge (NURSE vs KIT)
*   **Location:** `src/lib/vowelFamily.js`
*   **Logic:** `ER: "IH"` in `FAMILY_ALIASES`.
*   **Audit:** `ER` is a rhotic vowel (r-colored). `IH` is a near-high front lax vowel. They share almost no phonetic commonality other than being relatively "closed".
*   **Visual Result:** "Bird" and "Bit" are colored identically. This dilutes the "Sonic Thaumaturgy" accuracy.

### C. The Magic-E Mapping Error
*   **Location:** `src/lib/phoneme.engine.js`, `splitToPhonemes` method.
*   **Logic:** `const MAGIC_MAP = { 'A': 'EY', 'E': 'IY', 'I': 'EY', 'O': 'OW', 'U': 'UW' };`
*   **Audit:** Look at the 'I' mapping. Pattern `I-C-E` (e.g., *LIKE*) maps 'I' to `EY`.
*   **Correction:** 'I' in a Magic-E pattern must map to `AY` (PRICE), not `EY` (FACE). This is a typo in the core heuristic engine.

### D. The Schwa / Mouth Merge
*   **Location:** `src/lib/vowelFamily.js`
*   **Logic:** `AX: "A"`, `AW: "A"`.
*   **Audit:** `AX` (Schwa) is central and neutral. `AW` (as in *MOUTH*) is a wide diphthong. `A` (as in *LOT*) is a back open vowel.
*   **Visual Result:** Three very different sound profiles are collapsed into the "Rose/Warm" bucket.

---

## 3. The New "U" Family Consolidation (Green)
*   **Logic:** `AH`, `UH`, `UW` -> `U`.
*   **Audit:** While intentional for the "Green" requirement, this merges:
    1.  `AH` (STRUT - "Cut") - Mid-open central.
    2.  `UH` (FOOT - "Put") - Near-high near-back.
    3.  `UW` (BOOT - "Boot") - High back.
*   **Discrepancy:** The "Green" family is now over-indexed. In a typical document, nearly 25% of words will be Green because it captures the most common central sounds.

---

## 4. Component-Level Audit

### `src/lib/colorCodex.js`
*   **Logic:** Uses `UnionFind` to cluster words by connection score.
*   **Audit:** If the `DeepRhymeEngine` uses the normalized families (where `AY == EY`), the `UnionFind` will create clusters containing both families. The `selectCanonicalFamily` function then picks one family by "majority vote" for the entire cluster.
*   **Discrepancy:** This "Majority Vote" logic actively overwrites the true phonetic family of a word with its neighbor's family color if they are linked. This is "Rhyme-Aware Coloring" but can be perceived as "Mapping Inaccuracy" if the user wants to see the raw sound.

---

## 5. Summary of Phonetic Integrity
| Sound | ARPAbet | Current Family | Logical Status |
| :--- | :--- | :--- | :--- |
| **LIKE** | `AY` | `EY` | ❌ **Error** (Merged with FACE) |
| **BIRD** | `ER` | `IH` | ❌ **Error** (Merged with KIT) |
| **ABOUT**| `AX` | `A` | ⚠️ **Diluted** (Merged with LOT) |
| **PUT**  | `UH` | `U` | ✅ **Intentional** (Consolidated) |
| **CUT**  | `AH` | `U` | ✅ **Intentional** (Consolidated) |

## 6. Recommendations for 100% Consistency
1.  **De-alias AY and EY:** Restore `AY` as its own distinct family in the palette.
2.  **Fix Magic-E:** Correct the `MAGIC_MAP` in `phoneme.engine.js`.
3.  **Restore ER:** Give rhotic vowels their own palette position (`UR` exists but is under-utilized).
4.  **Decouple Normalization from Analysis:** `DeepRhymeEngine` should rhyming using "Slant" logic rather than forcing different phonemes into the same "Family" bucket before comparison.
