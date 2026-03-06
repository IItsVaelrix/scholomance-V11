import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DICTIONARY_LIMIT = 20000;
const SEQUENCE_LIMIT = 50000;
const PAIR_SEPARATOR = "\u0000";

function normalizeLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

const SONG_HEADER_REGEX = /^\s*(\d+)\s*[.)]\s+(.+?)\s*$/;

function inferTitleFromHeader(line) {
  return String(line || "").match(SONG_HEADER_REGEX);
}

function tokenize(text) {
  if (!text) return [];
  // Match words, including those with apostrophes like "don't"
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

function mergeCount(map, key, count = 1) {
  map.set(key, (map.get(key) || 0) + count);
}

function ingestTokens(words, frequencyMap, sequenceMap) {
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (word.length < 2) continue;

    mergeCount(frequencyMap, word, 1);

    if (i < words.length - 1) {
      const next = words[i + 1];
      if (next.length < 2) continue;
      mergeCount(sequenceMap, `${word}${PAIR_SEPARATOR}${next}`, 1);
    }
  }
}

function sortByFrequencyDescThenLexAsc(a, b) {
  if (b[1] !== a[1]) return b[1] - a[1];
  return String(a[0]).localeCompare(String(b[0]));
}

function buildPayload(frequencyMap, sequenceMap) {
  const dictionary = [...frequencyMap.entries()]
    .sort(sortByFrequencyDescThenLexAsc)
    .slice(0, DICTIONARY_LIMIT)
    .map(([word]) => word);

  const dictionarySet = new Set(dictionary);
  const sequences = [...sequenceMap.entries()]
    .map(([pair, count]) => {
      const [prev, next] = pair.split(PAIR_SEPARATOR);
      return { prev, next, count };
    })
    .filter((entry) => dictionarySet.has(entry.prev) && dictionarySet.has(entry.next))
    .sort((a, b) => (
      b.count - a.count ||
      a.prev.localeCompare(b.prev) ||
      a.next.localeCompare(b.next)
    ))
    .slice(0, SEQUENCE_LIMIT)
    .map(({ prev, next, count }) => [prev, next, count]);

  return {
    version: 2,
    dictionary,
    sequences,
  };
}

async function run() {
  const corpusDbPath = process.env.SCHOLOMANCE_CORPUS_PATH || path.resolve(process.cwd(), "scholomance_corpus.sqlite");
  const preferredInputPath = path.resolve(process.cwd(), "docs", "references", "DATA-SET 1.md");
  const outputPath = path.resolve(process.cwd(), "public", "corpus.json");

  const frequencyMap = new Map();
  const sequenceMap = new Map();
  let sentenceCount = 0;

  if (fs.existsSync(corpusDbPath)) {
    console.log(`[corpus] found SQLite corpus at: ${corpusDbPath}`);
    const db = new Database(corpusDbPath, { readonly: true, fileMustExist: true });
    try {
      console.log("[corpus] calculating word frequencies and sequences from SQLite...");
      const sentenceQuery = db.prepare("SELECT text FROM sentence");
      for (const row of sentenceQuery.iterate()) {
        ingestTokens(tokenize(row?.text), frequencyMap, sequenceMap);
        sentenceCount += 1;
        if (sentenceCount % 50000 === 0) {
          console.log(
            `[corpus] processed ${sentenceCount} sentences... ` +
            `vocab=${frequencyMap.size} pairCandidates=${sequenceMap.size}`
          );
        }
      }
    } finally {
      db.close();
    }
  } else {
    console.log(`[corpus] SQLite not found, falling back to: ${preferredInputPath}`);
    if (!fs.existsSync(preferredInputPath)) {
      console.error(`Input not found: ${preferredInputPath}`);
      process.exit(1);
    }

    const text = fs.readFileSync(preferredInputPath, "utf8");
    const rawLines = text.split("\n");

    for (const rawLine of rawLines) {
      const line = normalizeLineText(rawLine);
      if (!line || inferTitleFromHeader(line)) continue;

      ingestTokens(tokenize(line), frequencyMap, sequenceMap);
      sentenceCount += 1;
    }
  }

  const payload = buildPayload(frequencyMap, sequenceMap);

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload));

  console.log(`[corpus] processed ${sentenceCount} text units`);
  console.log(
    `[corpus] wrote v${payload.version} payload with ` +
    `${payload.dictionary.length} words and ${payload.sequences.length} weighted sequences to ${outputPath}`
  );
}

run().catch((error) => {
  console.error("[corpus] failed:", error);
  process.exitCode = 1;
});
