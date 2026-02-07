#!/usr/bin/env python3
"""
build_scholomance_dict.py

Build a large offline dictionary SQLite DB with FTS5.

Sources (open):
- Kaikki/Wiktextract JSONL extracted from Wiktionary (Wiktionary license applies)
- Open English WordNet (OEWN) release XML
- Optional SCOWL-derived wordlist for lexicon gating

Output:
- SQLite database with entry tables + FTS for fast search
- Optional JSONL export of Kaikki entries
"""

from __future__ import annotations

import argparse
import gzip
import io
import os
import sqlite3
import sys
import time
import xml.etree.ElementTree as ET
from typing import Iterable, Optional

import orjson
import requests
from tqdm import tqdm

DEFAULT_DB_PATH = "scholomance_dict.sqlite"
DEFAULT_DATA_DIR = "dict_data"
DEFAULT_LANG = "English"
SCHEMA_VERSION = "1"


def download_file(url: str, out_path: str, chunk_size: int = 1024 * 1024) -> None:
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)
    with requests.get(url, stream=True, timeout=120) as r:
        r.raise_for_status()
        total = int(r.headers.get("Content-Length") or 0)
        with open(out_path, "wb") as f, tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            desc=f"Downloading {os.path.basename(out_path)}",
        ) as pbar:
            for chunk in r.iter_content(chunk_size=chunk_size):
                if chunk:
                    f.write(chunk)
                    pbar.update(len(chunk))


def open_maybe_gzip(path: str) -> io.BufferedReader | gzip.GzipFile:
    if path.endswith(".gz"):
        return gzip.open(path, "rb")
    return open(path, "rb")


def normalize_headword(word: str) -> str:
    return word.strip()


def init_db(db_path: str, overwrite: bool) -> sqlite3.Connection:
    if os.path.exists(db_path):
        if overwrite:
            os.remove(db_path)
        else:
            raise SystemExit(f"Refusing to overwrite existing DB: {db_path}. Use --overwrite.")

    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA temp_store=MEMORY;")

    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entry (
            id INTEGER PRIMARY KEY,
            headword TEXT NOT NULL,
            headword_lower TEXT NOT NULL,
            lang TEXT NOT NULL,
            pos TEXT,
            ipa TEXT,
            etymology TEXT,
            senses_json TEXT NOT NULL,
            source TEXT NOT NULL,
            source_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_entry_headword_lower ON entry(headword_lower);
        CREATE INDEX IF NOT EXISTS idx_entry_lang_pos ON entry(lang, pos);

        -- Contentless FTS: we insert rows manually with the same rowid as entry.id
        CREATE VIRTUAL TABLE IF NOT EXISTS entry_fts USING fts5(
            headword,
            content,
            tokenize='unicode61',
            prefix='2 3 4'
        );

        CREATE TABLE IF NOT EXISTS wordnet_synset (
            id TEXT PRIMARY KEY,
            pos TEXT,
            lexname TEXT,
            definition TEXT,
            examples_json TEXT,
            source TEXT NOT NULL,
            source_url TEXT
        );

        CREATE TABLE IF NOT EXISTS wordnet_lemma (
            lemma TEXT NOT NULL,
            lemma_lower TEXT NOT NULL,
            synset_id TEXT NOT NULL,
            sense_rank INTEGER,
            pos TEXT,
            source TEXT NOT NULL,
            source_url TEXT,
            FOREIGN KEY (synset_id) REFERENCES wordnet_synset(id)
        );

        CREATE INDEX IF NOT EXISTS idx_wordnet_lemma_lower ON wordnet_lemma(lemma_lower);
        CREATE INDEX IF NOT EXISTS idx_wordnet_lemma_synset ON wordnet_lemma(synset_id);

        CREATE TABLE IF NOT EXISTS wordnet_rel (
            synset_id TEXT NOT NULL,
            rel TEXT NOT NULL,
            target_synset_id TEXT NOT NULL,
            source TEXT NOT NULL,
            source_url TEXT,
            FOREIGN KEY (synset_id) REFERENCES wordnet_synset(id)
        );

        CREATE INDEX IF NOT EXISTS idx_wordnet_rel_synset ON wordnet_rel(synset_id);

        CREATE TABLE IF NOT EXISTS lexicon (
            word TEXT NOT NULL,
            word_lower TEXT NOT NULL,
            source TEXT NOT NULL,
            source_url TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_lexicon_word_lower ON lexicon(word_lower);
        """
    )
    return conn


def extract_ipa(pronunciations) -> Optional[str]:
    ipa_list: list[str] = []
    if isinstance(pronunciations, dict):
        for key in ("ipa", "ipa_us", "ipa_uk"):
            value = pronunciations.get(key)
            if isinstance(value, list):
                ipa_list.extend([v for v in value if isinstance(v, str)])
            elif isinstance(value, str):
                ipa_list.append(value)
    elif isinstance(pronunciations, list):
        for item in pronunciations:
            if isinstance(item, dict):
                value = item.get("ipa")
                if isinstance(value, list):
                    ipa_list.extend([v for v in value if isinstance(v, str)])
                elif isinstance(value, str):
                    ipa_list.append(value)
    if not ipa_list:
        return None
    deduped = []
    seen = set()
    for ipa in ipa_list:
        ipa = ipa.strip()
        if ipa and ipa not in seen:
            seen.add(ipa)
            deduped.append(ipa)
    return "; ".join(deduped)[:1000]


def extract_senses_text(senses: list[dict]) -> str:
    parts: list[str] = []
    for sense in senses:
        glosses = sense.get("glosses") or []
        if isinstance(glosses, list):
            parts.extend([g for g in glosses if isinstance(g, str)])
        examples = sense.get("examples") or []
        if isinstance(examples, list):
            for ex in examples:
                if isinstance(ex, dict):
                    t = ex.get("text")
                    if isinstance(t, str):
                        parts.append(t)
                elif isinstance(ex, str):
                    parts.append(ex)
    return "\n".join(p.strip() for p in parts if isinstance(p, str) and p.strip())


def iter_kaikki_jsonl(fp) -> Iterable[dict]:
    for line in fp:
        line = line.strip()
        if not line:
            continue
        yield orjson.loads(line)


def ingest_kaikki(
    conn: sqlite3.Connection,
    jsonl_path: str,
    source_url: str,
    lang_filter: str,
    export_jsonl_path: Optional[str],
    max_entries: Optional[int],
) -> int:
    cur = conn.cursor()
    inserted = 0
    entry_id = 1
    batch_rows = []
    fts_rows = []
    export_fp = open(export_jsonl_path, "wb") if export_jsonl_path else None

    try:
        with open_maybe_gzip(jsonl_path) as f:
            for obj in tqdm(iter_kaikki_jsonl(f), desc="Ingesting Kaikki/Wiktionary JSONL"):
                if max_entries is not None and inserted >= max_entries:
                    break

                lang = obj.get("lang") or obj.get("language") or ""
                if lang_filter and lang != lang_filter:
                    continue

                headword = normalize_headword(obj.get("word") or obj.get("title") or "")
                if not headword:
                    continue

                pos = obj.get("pos")
                ipa = extract_ipa(obj.get("pronunciations") or obj.get("pronunciation"))

                ety = obj.get("etymology_text")
                if isinstance(ety, list):
                    ety = "\n".join([x for x in ety if isinstance(x, str)])
                if not isinstance(ety, str):
                    ety = None

                senses = obj.get("senses") or []
                if not isinstance(senses, list):
                    senses = []

                senses_json = orjson.dumps(senses).decode("utf-8")
                fts_content = extract_senses_text(senses)

                batch_rows.append(
                    (
                        entry_id,
                        headword,
                        headword.casefold(),
                        lang,
                        pos,
                        ipa,
                        ety,
                        senses_json,
                        "kaikki_wiktionary",
                        source_url,
                    )
                )
                fts_rows.append((entry_id, headword, fts_content))

                if export_fp:
                    export_fp.write(
                        orjson.dumps(
                            {
                                "headword": headword,
                                "lang": lang,
                                "pos": pos,
                                "ipa": ipa,
                                "etymology": ety,
                                "senses": senses,
                                "source": "kaikki_wiktionary",
                                "source_url": source_url,
                            }
                        )
                        + b"\n"
                    )

                inserted += 1
                entry_id += 1

                if len(batch_rows) >= 5000:
                    cur.executemany(
                        """
                        INSERT INTO entry(
                            id, headword, headword_lower, lang, pos, ipa, etymology,
                            senses_json, source, source_url
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                        batch_rows,
                    )
                    cur.executemany(
                        "INSERT INTO entry_fts(rowid, headword, content) VALUES (?, ?, ?)",
                        fts_rows,
                    )
                    conn.commit()
                    batch_rows.clear()
                    fts_rows.clear()

        if batch_rows:
            cur.executemany(
                """
                INSERT INTO entry(
                    id, headword, headword_lower, lang, pos, ipa, etymology,
                    senses_json, source, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                batch_rows,
            )
            cur.executemany(
                "INSERT INTO entry_fts(rowid, headword, content) VALUES (?, ?, ?)",
                fts_rows,
            )
            conn.commit()

        return inserted
    finally:
        if export_fp:
            export_fp.close()


def strip_ns(tag: str) -> str:
    return tag.split("}", 1)[-1] if "}" in tag else tag


def sense_synset_id(elem: ET.Element) -> Optional[str]:
    synset = elem.get("synset") or elem.get("synsetRef") or elem.get("synset_id")
    if synset:
        return synset
    ref = elem.find(".//{*}SynsetRef")
    if ref is not None:
        return ref.get("synset") or ref.get("synsetRef")
    return None


def ingest_oewn_xml(
    conn: sqlite3.Connection,
    xml_path: str,
    source_url: str,
    max_entries: Optional[int],
) -> tuple[int, int, int]:
    cur = conn.cursor()
    syn_rows = []
    lemma_rows = []
    rel_rows = []
    syn_count = 0
    lemma_count = 0
    rel_count = 0

    with open_maybe_gzip(xml_path) as f:
        context = ET.iterparse(f, events=("end",))
        for _, elem in tqdm(context, desc="Ingesting OEWN XML"):
            tag = strip_ns(elem.tag)

            if tag == "Synset":
                syn_id = elem.get("id")
                if not syn_id:
                    elem.clear()
                    continue
                pos = elem.get("partOfSpeech") or elem.get("pos")
                lexname = elem.get("lexfile") or elem.get("lexname")
                definition = None
                examples: list[str] = []

                for child in elem:
                    ctag = strip_ns(child.tag)
                    if ctag == "Definition":
                        definition = " ".join(child.itertext()).strip() or None
                    elif ctag == "Example":
                        ex = " ".join(child.itertext()).strip()
                        if ex:
                            examples.append(ex)
                    elif ctag == "SynsetRelation":
                        rel = child.get("relType") or child.get("type") or child.get("rel")
                        target = child.get("target") or child.get("targetSynset")
                        if rel and target:
                            rel_rows.append((syn_id, rel, target, "oewn", source_url))

                syn_rows.append(
                    (
                        syn_id,
                        pos,
                        lexname,
                        definition,
                        orjson.dumps(examples).decode("utf-8"),
                        "oewn",
                        source_url,
                    )
                )
                syn_count += 1

                if len(syn_rows) >= 5000:
                    cur.executemany(
                        """
                        INSERT INTO wordnet_synset(
                            id, pos, lexname, definition, examples_json, source, source_url
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        syn_rows,
                    )
                    syn_rows.clear()

                if len(rel_rows) >= 10000:
                    cur.executemany(
                        """
                        INSERT INTO wordnet_rel(
                            synset_id, rel, target_synset_id, source, source_url
                        ) VALUES (?, ?, ?, ?, ?)
                        """,
                        rel_rows,
                    )
                    rel_count += len(rel_rows)
                    rel_rows.clear()

                if max_entries is not None and syn_count >= max_entries:
                    break

                elem.clear()

            elif tag == "LexicalEntry":
                lemma_elem = elem.find(".//{*}Lemma")
                lemma = None
                pos = elem.get("partOfSpeech")
                if lemma_elem is not None:
                    lemma = (
                        lemma_elem.get("writtenForm")
                        or lemma_elem.get("form")
                        or lemma_elem.get("lemma")
                    )
                    pos = pos or lemma_elem.get("partOfSpeech")

                if lemma:
                    lemma_lower = lemma.casefold()
                    senses = elem.findall(".//{*}Sense")
                    seen = set()
                    for idx, sense in enumerate(senses, start=1):
                        synset = sense_synset_id(sense)
                        if synset and synset not in seen:
                            lemma_rows.append(
                                (lemma, lemma_lower, synset, idx, pos, "oewn", source_url)
                            )
                            seen.add(synset)

                    if not senses:
                        synset_ref = elem.find(".//{*}SynsetRef")
                        synset = None
                        if synset_ref is not None:
                            synset = synset_ref.get("synset") or synset_ref.get("synsetRef")
                        if synset:
                            lemma_rows.append(
                                (lemma, lemma_lower, synset, 1, pos, "oewn", source_url)
                            )

                if len(lemma_rows) >= 10000:
                    cur.executemany(
                        """
                        INSERT INTO wordnet_lemma(
                            lemma, lemma_lower, synset_id, sense_rank, pos, source, source_url
                        ) VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                        lemma_rows,
                    )
                    lemma_count += len(lemma_rows)
                    lemma_rows.clear()

                elem.clear()

        if syn_rows:
            cur.executemany(
                """
                INSERT INTO wordnet_synset(
                    id, pos, lexname, definition, examples_json, source, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                syn_rows,
            )
        if lemma_rows:
            cur.executemany(
                """
                INSERT INTO wordnet_lemma(
                    lemma, lemma_lower, synset_id, sense_rank, pos, source, source_url
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                lemma_rows,
            )
            lemma_count += len(lemma_rows)
        if rel_rows:
            cur.executemany(
                """
                INSERT INTO wordnet_rel(
                    synset_id, rel, target_synset_id, source, source_url
                ) VALUES (?, ?, ?, ?, ?)
                """,
                rel_rows,
            )
            rel_count += len(rel_rows)

        conn.commit()

    return syn_count, lemma_count, rel_count


def ingest_scowl_wordlist(
    conn: sqlite3.Connection,
    path: str,
    source_url: str,
    max_entries: Optional[int],
) -> int:
    cur = conn.cursor()
    inserted = 0
    batch = []

    with open_maybe_gzip(path) as f:
        for line in f:
            if max_entries is not None and inserted >= max_entries:
                break
            if isinstance(line, bytes):
                line = line.decode("utf-8", errors="ignore")
            line = line.strip()
            if not line or line.startswith("#") or line.startswith(";"):
                continue
            for token in line.split():
                word = token.strip()
                if not word:
                    continue
                batch.append((word, word.casefold(), "scowl", source_url))
                inserted += 1
                if len(batch) >= 10000:
                    cur.executemany(
                        "INSERT INTO lexicon(word, word_lower, source, source_url) VALUES (?, ?, ?, ?)",
                        batch,
                    )
                    conn.commit()
                    batch.clear()

    if batch:
        cur.executemany(
            "INSERT INTO lexicon(word, word_lower, source, source_url) VALUES (?, ?, ?, ?)",
            batch,
        )
        conn.commit()

    return inserted


def main() -> None:
    ap = argparse.ArgumentParser(description="Build Scholomance offline dictionary SQLite DB.")
    ap.add_argument("--db", default=DEFAULT_DB_PATH, help="SQLite output path.")
    ap.add_argument("--data_dir", default=DEFAULT_DATA_DIR, help="Download/cache directory.")
    ap.add_argument("--overwrite", action="store_true", help="Overwrite existing DB.")
    ap.add_argument("--max_entries", type=int, default=None, help="Max entries per source (dev).")
    ap.add_argument("--lang", default=DEFAULT_LANG, help="Language filter for Kaikki data.")

    ap.add_argument("--kaikki_url", required=True, help="Direct URL to Kaikki/Wiktextract JSONL (.gz ok).")
    ap.add_argument("--oewn_url", default=None, help="Optional OEWN XML (.gz ok) direct URL.")
    ap.add_argument("--scowl_url", default=None, help="Optional SCOWL-derived wordlist URL (one word per line).")
    ap.add_argument("--export_jsonl", default=None, help="Optional JSONL export path for Kaikki entries.")

    args = ap.parse_args()
    os.makedirs(args.data_dir, exist_ok=True)

    kaikki_path = os.path.join(args.data_dir, os.path.basename(args.kaikki_url))
    if not os.path.exists(kaikki_path):
        download_file(args.kaikki_url, kaikki_path)

    oewn_path = None
    if args.oewn_url:
        oewn_path = os.path.join(args.data_dir, os.path.basename(args.oewn_url))
        if not os.path.exists(oewn_path):
            download_file(args.oewn_url, oewn_path)

    scowl_path = None
    if args.scowl_url:
        scowl_path = os.path.join(args.data_dir, os.path.basename(args.scowl_url))
        if not os.path.exists(scowl_path):
            download_file(args.scowl_url, scowl_path)

    conn = init_db(args.db, overwrite=args.overwrite)
    try:
        conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ("schema_version", SCHEMA_VERSION))
        conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ("built_at", str(int(time.time()))))
        conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ("kaikki_url", args.kaikki_url))
        if args.oewn_url:
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ("oewn_url", args.oewn_url))
        if args.scowl_url:
            conn.execute("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)", ("scowl_url", args.scowl_url))
        conn.commit()

        inserted = ingest_kaikki(
            conn,
            kaikki_path,
            source_url=args.kaikki_url,
            lang_filter=args.lang,
            export_jsonl_path=args.export_jsonl,
            max_entries=args.max_entries,
        )
        print(f"Inserted {inserted} Kaikki/Wiktionary entries.")

        if oewn_path:
            syn_count, lemma_count, rel_count = ingest_oewn_xml(
                conn,
                oewn_path,
                source_url=args.oewn_url,
                max_entries=args.max_entries,
            )
            print(
                "Inserted OEWN:",
                f"{syn_count} synsets, {lemma_count} lemmas, {rel_count} relations.",
            )

        if scowl_path:
            lex_count = ingest_scowl_wordlist(
                conn,
                scowl_path,
                source_url=args.scowl_url,
                max_entries=args.max_entries,
            )
            print(f"Inserted {lex_count} SCOWL lexicon words.")

        conn.execute("INSERT INTO entry_fts(entry_fts) VALUES ('optimize');")
        conn.commit()
    finally:
        conn.close()

    print(f"Done. Built: {args.db}")


if __name__ == "__main__":
    main()
