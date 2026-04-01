# PixelBrain: Neural Transmutation (AI Style Transfer)

## Overview
**Feature Name:** Void Echo — Neural Transmutation  
**Status:** Spec → Implementation  
**Concept:** Structural Re-interpretation of External AI Art  

The Void Echo feature allows users to import any external AI-generated pixel art (from DALL-E, Midjourney, etc.) and "Scholomance-ify" it. The system doesn't just overlay textures; it performs a **destructive re-encoding** that snaps the structural anatomy and color palette of the AI art to our canonical school laws.

---

## The Transmutation Pipeline

### 1. Anatomy Extraction (Lattice Tracing)
The input AI art is processed via the `pixel.trace` microprocessor. This converts the "hallucinated" edges of AI generators into a stable **VerseIR Lattice**.
*   **Edge Hardening:** Soft AI pixels are quantized into hard 1x1 or 2x2 grid points.
*   **Landmark Detection:** High-contrast regions are flagged as "Phonetic Anchors."

### 2. Chromatic Alignment (School Quantization)
External AI palettes are often "unlimited." We force these into the **Scholomance Gamut**:
*   **School Snapping:** Every color in the AI image is re-mapped to the nearest HSL coordinate of a specific School (e.g., all blues become **PSYCHIC** cyan).
*   **Harmony Enforcement:** The system ensures the output maintains high-contrast readability required for game assets.

### 3. Retro-Constraint Injection (Style Extensions)
Users can choose an "Era" for the transmuted AI art:
*   **GameBoy (DMG):** Forces a 4-color monochrome green palette.
*   **NES (8-bit):** Limits colors to 16 and enforces attribute-grid constraints.
*   **VGA (16-bit):** Allows 256 colors but enforces specific dither patterns.

### 4. Bytecode Ignition
Once transmuted, the system generates a **new 0xF Bytecode**. This allows an external image to be converted into a manually editable formula in our Template Editor.

---

## Technical Architecture

### Microprocessor Configuration
The transmutation uses a "Super-Pipeline" execution:
1. `pixel.decode` (Raw Buffer → Substrate)
2. `pixel.resample` (Substrate → 160x144 / 256x240)
3. `pixel.trace` (Structural Lattice Extraction)
4. `pixel.quantize` (Chromatic School Alignment)
5. `pixel.applyStyle` (Retro-Era Filtering)

### New Microprocessor: `pixel.transmute`
We will implement a wrapper microprocessor that orchestrates these steps in a single non-blocking WebWorker call.

---

## Use Cases
1.  **AI Asset Cleanup:** Take a "fuzzy" Midjourney sprite and turn it into a clean, grid-perfect Scholomance asset.
2.  **Thematic Skinning:** Upload one AI character and generate 5 versions, one for each school of magic.
3.  **Cross-Platform Porting:** Instantly turn a high-res AI painting into a 160x144 GameBoy-style asset for the web-game.

---

## Handoff Notes
*   **Codex:** Implement the `pixel.transmute` wrapper in `codex/core/microprocessors/pixel/Transmuter.js`.
*   **Claude:** UI should provide a "Transmute" button next to "Analyze."
*   **Blackbox:** Add QA tests for "Anatomy Preservation" — ensuring the transmuted asset still looks like the source image.
