# CODEx Phoneme Parsing Rules & Syntactical Layer Specifications

This document defines the linguistic rules and computational logic required for the CODEx Syntactical Layer to perform high-fidelity phoneme parsing, syllabification, and prosodic analysis of English text.

## 1. Phonetic Representation (ARPAbet)

CODEx utilizes the **ARPAbet** symbol set (standardized by the CMU Pronouncing Dictionary) for internal phonetic processing. This ensures compatibility with existing phoneme engines while providing a machine-readable ASCII format.

- **Vowels (Nuclei):** `AA, AE, AH, AO, AW, AY, EH, ER, EY, IH, IY, OW, OY, UH, UW`.
- **Consonants (Edges):** `B, CH, D, DH, F, G, HH, JH, K, L, M, N, NG, P, R, S, SH, T, TH, V, W, Y, Z, ZH`.
- **Stress Markers:** `0` (No stress), `1` (Primary stress), `2` (Secondary stress).

---

## 2. Syllabic Architecture

Syllabification is the foundational step for meter and rhyme analysis. CODEx follows the **Maximal Onset Principle** and the **Sonority Sequencing Principle (SSP)**.

### 2.1 The Syllable Template: `(O) N (C)`
- **Onset (O):** Initial consonant(s). Optional.
- **Nucleus (N):** The core vowel sound. Obligatory.
- **Coda (C):** Final consonant(s). Optional.
- **Rhyme (R):** The combination of Nucleus + Coda.

### 2.2 Sonority Sequencing Principle (SSP)
Phonemes must be arranged such that sonority increases toward the nucleus and decreases toward the margins.
**Sonority Hierarchy (High to Low):**
1. Vowels (`AA, IY, etc.`)
2. Glides (`W, Y`)
3. Liquids (`L, R`)
4. Nasals (`M, N, NG`)
5. Fricatives (`F, V, S, Z, SH, ZH, TH, DH`)
6. Affricates (`CH, JH`)
7. Stops (`P, B, T, D, K, G`)

*Exception:* `/s/` + Stop clusters (e.g., "ST", "SP", "SK") are permitted onsets despite SSP violations.

---

## 3. Phonotactic Constraints (English)

Rules governing allowable phoneme sequences in the Syntactical Layer.

### 3.1 Onset Constraints
- **Max length:** 3 consonants (e.g., "STRENGTH").
- **3-Consonant Rule:** If length is 3, the first must be `/s/`, the second a voiceless stop (`/p, t, k/`), and the third a liquid or glide (`/l, r, w, y/`).
- **Forbidden Onsets:** `/ng/` (NG) never begins a syllable. `/h/` (HH) never ends one.

### 3.2 Coda Constraints
- **Max length:** 4 consonants (e.g., "SIXTHS" -> `/s ih k s th s/`).
- **Post-Vocalic `/r/`:** In rhotic dialects (standard for CODEx), `/r/` functions as part of the coda or a rhotacized vowel (`ER`).

---

## 4. Phonological Processes (Dynamic Analysis)

To simulate natural speech ("The Ritual Flow"), the syntactical layer must account for:

### 4.1 Aspiration & Allophony
- **Aspiration:** Voiceless stops (`P, T, K`) are aspirated at the start of stressed syllables unless preceded by `S`.
- **Flapping:** `/t/` and `/d/` between vowels (where the second is unstressed) become a flap `[ɾ]` (e.g., "BUTTER").
- **Glottalization:** `/t/` before a nasal in the next syllable (e.g., "BUTTON") may be realized as a glottal stop.

### 4.2 Assimilation
- **Place Assimilation:** `/n/` becomes `/m/` before bilabial sounds (`P, B, M`) (e.g., "IN-BETWEEN" -> `/ih m b ih t w iy n/`).
- **Voicing Assimilation:** Plural suffixes (`S`) and past tense suffixes (`D`) must match the voicing of the preceding phoneme.
    - `/cat/` + `/s/` = `/cats/` (Voiceless)
    - `/dog/` + `/s/` = `/dogz/` (Voiced)

### 4.3 Elision (Zeroing)
- Deletion of unstressed vowels in fast speech (e.g., "CAMERA" -> `/k ae m r ah/`).

---

## 5. Prosodic & Metrical Analysis

The layer calculates meter by mapping stress markers to metrical feet.

### 5.1 Lexical Stress Rules
- **Nouns/Adjectives:** Typically stressed on the first syllable (e.g., **TA**-ble).
- **Verbs:** Typically stressed on the second syllable (e.g., re-**CORD**).
- **Compounds:** Primary stress usually on the first element (e.g., **BLACK**-bird).

### 5.2 Metrical Feet
- **Iamb:** Unstressed-Stressed (0 1)
- **Trochee:** Stressed-Unstressed (1 0)
- **Anapest:** Unstressed-Unstressed-Stressed (0 0 1)
- **Dactyl:** Stressed-Unstressed-Unstressed (1 0 0)
- **Spondee:** Stressed-Stressed (1 1)

---

## 6. Rhyme Engine Logic

Rhymes are calculated based on the **Rhyme (Nucleus + Coda)** of the final stressed syllable and all subsequent unstressed syllables.

- **Perfect Rhyme:** Identical Rhyme parts, different Onsets (e.g., "VANE" / "RAIN").
- **Slant Rhyme (Consonance):** Matching Coda, different Nucleus (e.g., "BENT" / "SANT").
- **Assonance:** Matching Nucleus, different Coda (e.g., "LAKE" / "FATE").
- **Masculine Rhyme:** Stressed final syllable.
- **Feminine Rhyme:** Stressed penultimate syllable followed by an unstressed one (e.g., "POW-der" / "LOUD-er").
