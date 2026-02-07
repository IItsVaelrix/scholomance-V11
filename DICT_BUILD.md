# Scholomance Offline Dictionary Build

This repo includes a build script to generate a large, offline, Python-ready dictionary database from open datasets. The output is a single SQLite file with FTS5 for fast lookup and search.

## Sources (Open Data)
- **Kaikki/Wiktextract (Wiktionary)** JSONL dumps for definitions, senses, examples, etymology, and pronunciations. Kaikki publishes regularly updated raw dumps and points to the current URLs.
- **Open English WordNet (OEWN)** for semantic relations (synonyms, hypernyms, etc.), released under CC BY 4.0.
- **Optional SCOWL wordlists** for lexicon gating/spellcheck word inventories.

Licensing notes:
- Wiktionary content is under CC BY-SA and GFDL; Kaikki data inherits those terms.
- Open English WordNet is CC BY 4.0.
- SCOWL wordlists are open; see the upstream repo for details.

## Install Dependencies
```bash
pip install requests tqdm orjson
```

## Build Script
Script location: `scripts/build_scholomance_dict.py`

### Get Data URLs
1. **Kaikki/Wiktextract**: go to the Kaikki raw data page and choose the English JSONL dump you want. Copy its direct URL.
2. **OEWN**: pick a release asset from the OEWN GitHub releases page (XML, gz).
3. **SCOWL (optional)**: use a wordlist URL from the SCOWL-derived wordlist repo.

### Run
```bash
python scripts/build_scholomance_dict.py \
  --kaikki_url "PASTE_KAIKKI_JSONL_OR_GZ_URL" \
  --oewn_url "PASTE_OEWN_XML_OR_GZ_URL" \
  --scowl_url "PASTE_SCOWL_WORDLIST_URL" \
  --db scholomance_dict.sqlite \
  --overwrite
```

Optional:
- `--export_jsonl path.jsonl` to write Kaikki entries to JSONL in parallel.
- `--lang English` to filter Kaikki entries by language (default: English).
- `--max_entries 10000` for test runs.

## Serve API (Optional)
Run the lightweight API server so the app can query the offline dictionary:
```bash
python scripts/serve_scholomance_dict.py --db scholomance_dict.sqlite --host 127.0.0.1 --port 8787
```
Point the app to it with `VITE_SCHOLOMANCE_DICT_API_URL` in `.env`.

## Schema Summary
The script creates these key tables:
- `entry`: Kaikki/Wiktionary entries (headword, pos, ipa, etymology, senses_json).
- `entry_fts`: FTS5 index for full-text search over headword + glosses/examples.
- `wordnet_synset`: OEWN synsets (definitions, examples, lexname).
- `wordnet_lemma`: lemma → synset mapping (for synonyms, sense lookup).
- `wordnet_rel`: synset relationships (hypernym, hyponym, etc.).
- `lexicon`: SCOWL wordlist (optional).
- `meta`: build metadata + source URLs.

## Query Examples
### Lookup by headword (exact)
```sql
SELECT headword, pos, ipa, etymology, senses_json
FROM entry
WHERE headword_lower = lower('time');
```

### Prefix search
```sql
SELECT headword, pos
FROM entry
WHERE headword_lower LIKE 'time%';
```

### Full-text search (glosses/examples)
```sql
SELECT e.headword, e.pos
FROM entry_fts f
JOIN entry e ON e.id = f.rowid
WHERE entry_fts MATCH 'unit NEAR/3 time'
LIMIT 25;
```

### WordNet synonyms (via synset)
```sql
SELECT l2.lemma
FROM wordnet_lemma l1
JOIN wordnet_lemma l2 ON l1.synset_id = l2.synset_id
WHERE l1.lemma_lower = lower('run')
LIMIT 50;
```

## Notes
- Kaikki dumps are large (multiple GB). Expect long download and build times.
- For best performance, use SSD storage and keep `dict_data/` on the same drive.
- You can store additional fields later (phonemes, syllables, rhyme families) without schema pain.
