
import fs from "node:fs";
import path from "node:path";

function normalizeLineText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

const SONG_HEADER_REGEX = /^\s*(\d+)\s*[\.\)]\s+(.+?)\s*$/;

function inferTitleFromHeader(line) {
  return String(line || "").match(SONG_HEADER_REGEX);
}

function tokenize(text) {
  if (!text) return [];
  // Match words, including those with apostrophes like "don't"
  return text.toLowerCase().match(/[a-z']+/g) || [];
}

async function run() {
  const inputPath = path.resolve(process.cwd(), "DATA-SET 1.md");
  const outputPath = path.resolve(process.cwd(), "public", "corpus.json");

  if (!fs.existsSync(inputPath)) {
    console.error(`Input not found: ${inputPath}`);
    process.exit(1);
  }

  console.log(`[corpus] reading source: ${inputPath}`);
  const text = fs.readFileSync(inputPath, "utf8");
  const rawLines = text.split("\n");

  const corpus = [];

  for (const rawLine of rawLines) {
    const line = normalizeLineText(rawLine);
    if (!line || inferTitleFromHeader(line)) continue;

    const words = tokenize(line);
    for (const word of words) {
        if (word.length < 2) continue;
        corpus.push(word);
    }
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(corpus));

  console.log(`[corpus] wrote ${corpus.length} tokens to ${outputPath}`);
}

run().catch((error) => {
  console.error("[corpus] failed:", error);
  process.exitCode = 1;
});
