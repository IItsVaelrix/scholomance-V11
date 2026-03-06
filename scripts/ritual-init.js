import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Production persistent disk paths
const DATA_DIR = process.env.NODE_ENV === 'production' ? '/var/data' : PROJECT_ROOT;
const DICT_PATH = path.join(DATA_DIR, 'scholomance_dict.sqlite');
const CORPUS_PATH = path.join(DATA_DIR, 'scholomance_corpus.sqlite');
const OEWN_XML_PATH = path.join(PROJECT_ROOT, 'english-wordnet-2024.xml.gz');

// 1. Ensure /var/data/audio exists
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
if (!existsSync(AUDIO_DIR)) {
  console.log(`[RITUAL] Creating audio storage at ${AUDIO_DIR}`);
  mkdirSync(AUDIO_DIR, { recursive: true });
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`[RITUAL] Executing: ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function downloadOEWN() {
  if (existsSync(OEWN_XML_PATH)) return;
  console.log('[RITUAL] Downloading Open English WordNet (OEWN)...');
  const url = 'https://github.com/globalwordnet/english-wordnet/releases/download/2024/english-wordnet-2024.xml.gz';
  await runCommand('curl', ['-L', url, '-o', OEWN_XML_PATH]);
}

async function main() {
  console.log('[RITUAL] Starting Production Initialization...');

  // 1. Dictionary Initialization
  if (!existsSync(DICT_PATH)) {
    console.log('[RITUAL] Dictionary missing. Commencing build...');
    try {
      await downloadOEWN();
      await runCommand('python3', [
        'scripts/build_scholomance_dict.py',
        '--db', DICT_PATH,
        '--oewn_path', OEWN_XML_PATH,
        '--overwrite'
      ]);
    } catch (err) {
      console.error('[RITUAL] Dictionary build failed:', err.message);
      // Don't exit; the app can run with degraded dictionary
    }
  } else {
    console.log('[RITUAL] Dictionary already exists on persistent storage.');
  }

  // 2. Super Corpus Initialization
  if (!existsSync(CORPUS_PATH)) {
    console.log('[RITUAL] Super Corpus missing. Commencing ingestion...');
    try {
      await runCommand('python3', [
        'scripts/build_super_corpus.py',
        '--db', CORPUS_PATH,
        '--dict', DICT_PATH,
        '--overwrite'
      ]);
    } catch (err) {
      console.error('[RITUAL] Corpus build failed:', err.message);
    }
  } else {
    console.log('[RITUAL] Super Corpus already exists on persistent storage.');
  }

  console.log('[RITUAL] Initialization Complete. Launching Scholomance CODEx.');
}

main().catch((err) => {
  console.error('[RITUAL] Critical initialization failure:', err);
  process.exit(1);
});
