# Scholomance MUD Dictionary Architecture (V1)

**Status**: Planning
**Goal**: Transform the offline dictionary into a deep, procedurally generated MMORPG database.
**Philosophy**: "Words are Reagents." Every word in the dictionary should be a potential item, spell component, or world seed, grounded in rigorous linguistic data.

---

## 1. Executive Summary

We are moving from a passive "lookup" dictionary to an **Active Reality Engine**. Instead of just returning a definition for "Obsidian", the API will return:
1.  **Linguistic Data**: Phonemes `AH0 B S IH1 D IY0 AH0 N`, Syllables: 4, Stress: `x/xx`.
2.  **Semantic Tags**: `Mineral`, `Volcanic`, `Darkness`, `Sharp`.
3.  **MUD Entity**: An item (Reagent), rarity "Uncommon", elemental affinity "Fire/Earth".
4.  **Crafting**: Used in recipes for "Blade of Glass" or "Shadow Ward".

This architecture is designed for **AI-Assisted Production**:
- **Phase 1 (Foundation)** establishes the deterministic linguistic truth (low hallucination risk).
- **Phase 2 (Taxonomy)** uses semantic mapping rules (AI-friendly classification).
- **Phase 3 (Generation)** allows AI agents to "dream" lore and mechanics within strict schema constraints.

---

## 2. Phase 1: The Linguistic Bedrock (Immediate)

**Goal**: Pre-calculate all objective linguistic data during the build process to remove runtime latency and client-side dependencies.

### 2.1 Database Schema Extensions
New table `phonetics` linked to `entry`.

```sql
CREATE TABLE phonetics (
    entry_id INTEGER PRIMARY KEY,
    ipa_clean TEXT,            -- Standardized IPA
    arpabet TEXT,             -- CMU-style phonemes (AH0 B S IH1 D IY0 AH0 N)
    syllable_count INTEGER,
    stress_pattern TEXT,      -- e.g., "01020"
    rhyme_key TEXT,           -- Vowel+Coda of primary stress (IH1 D)
    alliteration_key TEXT,    -- First phoneme (AH0)
    FOREIGN KEY(entry_id) REFERENCES entry(id)
);
```

### 2.2 Build Pipeline Updates (`build_scholomance_dict.py`)
1.  **Ingest CMU Dict**: Download and parse the CMU Pronouncing Dictionary as a source.
2.  **G2P Fallback**: Integrate a lightweight Grapheme-to-Phoneme model (or simple rules) for words not in CMU Dict.
3.  **Pre-calc**: Compute syllable counts and rhyme keys for every entry at build time.

### 2.3 AI Task "Agent-Linguist"
*   **Prompt**: "Write a Python module `scripts/lib/phonetics.py` that takes a word/IPA and outputs the `phonetics` row data using `eng_to_ipa` or `g2p_en` libraries."

---

## 3. Phase 2: The Arcane Taxonomy (High Priority)

**Goal**: Map 100,000+ words to a finite set of MMORPG-style tags (`Element`, `School`, `ItemType`).

### 3.1 The Tag Graph
We define a hierarchical tag system.
*   **Roots**: `Physical`, `Abstract`, `Action`, `Descriptor`.
*   **Physical -> Material**: `Metal`, `Wood`, `Stone`, `Liquid`, `Gas`.
*   **Abstract -> Element**: `Fire`, `Water`, `Air`, `Earth`, `Void`, `Light`.
*   **Action -> SpellType**: `Attack`, `Defense`, `Utility`, `Summon`.

### 3.2 Semantic Mapping Strategy
Use Open English WordNet (OEWN) `lexnames` and `hypernyms` to bulk-tag words.

*   **Rule 1**: If OEWN lexname is `noun.substance`, Tag = `Material`.
*   **Rule 2**: If hypernym path includes "weapon", Tag = `Equipment`.
*   **Rule 3 (AI Enrichment)**: Use embeddings or keyword matching on definitions to assign Elemental affinities (e.g., "burning" -> `Fire`).

### 3.3 Database Schema Extensions
```sql
CREATE TABLE tags (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE,
    category TEXT -- 'Element', 'Material', 'School'
);

CREATE TABLE entry_tags (
    entry_id INTEGER,
    tag_id INTEGER,
    confidence REAL, -- 0.0 to 1.0 (1.0 = WordNet strict match, <1.0 = AI inferred)
    PRIMARY KEY (entry_id, tag_id)
);
```

### 3.4 AI Task "Agent-Taxonomist"
*   **Prompt**: "Create a mapping JSON that links OEWN Lexnames (e.g., `noun.animal`) to our MUD Tags (e.g., `Bestiary`). Write a script to populate `entry_tags` based on this map."

---

## 4. Phase 3: The Entity Generator (The "MMO" Layer)

**Goal**: Deterministically generate game objects from words. "Iron" becomes an item. "Run" becomes a spell component.

### 4.1 Entity Types
1.  **Reagent** (Nouns/Substances): Has `rarity`, `toxicity`, `value`.
2.  **Artifact** (Nouns/Objects): Has `slot` (Head, Hand), `stats` (Str, Int).
3.  **Glyph** (Verbs): Has `mana_cost`, `effect_type`, `cooldown`.
4.  **Bestiary** (Nouns/Animals): Has `hp`, `attack`, `behavior`.

### 4.2 Procedural Generation Rules (Deterministic)
Use the word itself as a seed for RNG to ensure "Iron" always generates the same item stats.
*   `ItemLevel` = `syllable_count * 10` + `phoneme_density`.
*   `Rarity` = Inverse frequency (using word frequency lists).
*   `DamageType` = Derived from `entry_tags` (e.g., `Fire` tag -> Fire Damage).

### 4.3 Database Schema Extensions
```sql
CREATE TABLE mud_entities (
    entry_id INTEGER PRIMARY KEY,
    entity_type TEXT, -- 'Reagent', 'Artifact', 'Glyph', 'Bestiary'
    data_json TEXT,   -- The full JSON stat block
    generated_at INTEGER
);
```

### 4.4 AI Task "Agent-Designer"
*   **Prompt**: "Write a Python class `EntityFactory` that takes a `WordEntry` (with tags and phonetics) and outputs a valid `mud_entities` JSON blob. Use the word string as the RNG seed."

---

## 5. Phase 4: The World Graph (Long Term)

**Goal**: Connect words into locations and quests.

*   **Locations**: Words tagged `noun.location` (e.g., "Castle", "Dungeon") become nodes.
*   **Connections**: Semantic relationships (Synonyms, Meronyms) become paths.
    *   "Castle" contains "Throne Room" (Meronym).
    *   "Forest" is near "Woodland" (Synonym).

---

## 6. Implementation Roadmap

| Order | Phase | Description | AI Role |
| :--- | :--- | :--- | :--- |
| **1** | **Foundation** | Add `phonetics` table and `eng_to_ipa` integration to build script. | Write the G2P logic and SQL migration. |
| **2** | **Taxonomy** | Define the `Tag` hierarchy and OEWN mapping rules. | Generate the mapping file and tagging logic. |
| **3** | **API V2** | Update `serve_scholomance_dict.py` to return Phonetics + Tags. | Update Python API handlers. |
| **4** | **Generation** | Implement the `EntityFactory` for Reagents and Artifacts. | Design the Item Schema and generation algo. |
| **5** | **Frontend** | Show "Item Cards" in the IDE when hovering words. | Create React components for MUD entities. |

## 7. Next Steps (User Action)

To expedite **Phase 1**, run the following command to task the AI with upgrading the build script:

> "Activate Phase 1 of ARCH_DICTIONARY_MUD: Add the `phonetics` table to `build_scholomance_dict.py` and integrate a basic IPA conversion step."
