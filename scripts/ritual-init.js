import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, statSync, copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBooleanFlag } from '../codex/server/utils/envFlags.js';
import {
  hasRhymeAstrologyArtifactBundle,
  resolveRhymeAstrologyArtifactPaths,
} from '../codex/server/utils/rhymeAstrologyPaths.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..');
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const ENABLE_RHYME_ASTROLOGY = parseBooleanFlag(process.env.ENABLE_RHYME_ASTROLOGY, false);

// Production persistent disk paths
const DATA_DIR = IS_PRODUCTION && existsSync('/var/data') ? '/var/data' : PROJECT_ROOT;
const DICT_PATH = path.join(DATA_DIR, 'scholomance_dict.sqlite');
const CORPUS_PATH = path.join(DATA_DIR, 'scholomance_corpus.sqlite');
const OEWN_XML_PATH = path.join(PROJECT_ROOT, 'english-wordnet-2025.xml.gz');

// Baked-in seed data paths (from Dockerfile build-time stage)
const SEED_DICT_PATH = '/app/data/scholomance_dict.sqlite';
const SEED_CORPUS_PATH = '/app/data/scholomance_corpus.sqlite';

const RHYME_ASTROLOGY_PATHS = resolveRhymeAstrologyArtifactPaths({
  projectRoot: PROJECT_ROOT,
  isProduction: IS_PRODUCTION,
});
const RHYME_ASTROLOGY_READY = () => hasRhymeAstrologyArtifactBundle(RHYME_ASTROLOGY_PATHS)
  && existsSync(RHYME_ASTROLOGY_PATHS.emotionPriorsPath);

/**
 * Seed persistent disk with baked-in databases on first boot.
 * Render's disk mount shadows the Dockerfile copies, so we copy them over.
 */
function seedPersistentDisk() {
  if (!IS_PRODUCTION) return;

  if (!existsSync(DICT_PATH) && existsSync(SEED_DICT_PATH)) {
    console.log(`[RITUAL] Seeding dictionary from baked-in image: ${SEED_DICT_PATH} → ${DICT_PATH}`);
    copyFileSync(SEED_DICT_PATH, DICT_PATH);
  }
  if (!existsSync(CORPUS_PATH) && existsSync(SEED_CORPUS_PATH)) {
    console.log(`[RITUAL] Seeding corpus from baked-in image: ${SEED_CORPUS_PATH} → ${CORPUS_PATH}`);
    copyFileSync(SEED_CORPUS_PATH, CORPUS_PATH);
  }
}

// 1. Ensure /var/data/audio exists
const AUDIO_DIR = path.join(DATA_DIR, 'audio');
if (!existsSync(AUDIO_DIR)) {
  console.log(`[RITUAL] Creating audio storage at ${AUDIO_DIR}`);
  try { mkdirSync(AUDIO_DIR, { recursive: true }); } catch (_e) {
    // Ignore errors — audio directory creation is best-effort
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`[RITUAL] Executing: ${command} ${args.join(' ')}`);
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      cwd: options.cwd || PROJECT_ROOT,
      env: options.env || process.env,
    });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else {
        const msg = `${command} exited with code ${code}`;
        console.error(`[RITUAL] Command failed: ${msg}`);
        reject(new Error(msg));
      }
    });
    proc.on('error', (err) => {
      console.error(`[RITUAL] Process error: ${err.message}`);
      reject(err);
    });
  });
}

async function downloadOEWN() {
  if (existsSync(OEWN_XML_PATH)) {
    console.log('[RITUAL] OEWN XML already exists.');
    return;
  }
  console.log('[RITUAL] Downloading Open English WordNet (OEWN)...');
  const url = 'https://github.com/globalwordnet/english-wordnet/releases/download/2025-edition/english-wordnet-2025.xml.gz';
  
  try {
    await runCommand('curl', ['-fL', url, '-o', OEWN_XML_PATH]);
    if (!existsSync(OEWN_XML_PATH)) {
      throw new Error('Download completed but file is missing.');
    }
    const stats = statSync(OEWN_XML_PATH);
    if (stats.size < 1000000) { // Should be ~10MB+
      throw new Error(`Downloaded file is suspiciously small (${stats.size} bytes). Download likely failed.`);
    }
    console.log(`[RITUAL] Downloaded OEWN (${(stats.size / 1024 / 1024).toFixed(2)} MB).`);
  } catch (err) {
    if (existsSync(OEWN_XML_PATH)) unlinkSync(OEWN_XML_PATH);
    throw new Error(`OEWN Download failed: ${err.message}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const isDetached = args.includes('--detach');

  console.log(`[RITUAL] Starting Production Initialization... (detached=${isDetached})`);

  async function runRitual() {
    try {
      // 0. Seed persistent disk from baked-in images (first boot only)
      seedPersistentDisk();

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
          // Don't stop the whole ritual, but some downstream might fail
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

      // 3. Rhyme Astrology artifact initialization
      if (ENABLE_RHYME_ASTROLOGY) {
        if (!RHYME_ASTROLOGY_READY()) {
          console.log(`[RITUAL] Rhyme Astrology artifacts missing. Building into ${RHYME_ASTROLOGY_PATHS.outputDir}...`);
          try {
            mkdirSync(RHYME_ASTROLOGY_PATHS.outputDir, { recursive: true });
            await runCommand(process.execPath, ['scripts/buildRhymeAstrologyIndex.js'], {
              env: {
                ...process.env,
                SCHOLOMANCE_DICT_PATH: DICT_PATH,
                SCHOLOMANCE_CORPUS_PATH: CORPUS_PATH,
                RHYME_ASTROLOGY_OUTPUT_DIR: RHYME_ASTROLOGY_PATHS.outputDir,
              },
            });
          } catch (err) {
            console.error('[RITUAL] Rhyme Astrology artifact build failed:', err.message);
          }
        } else {
          console.log(`[RITUAL] Rhyme Astrology artifacts already exist at ${RHYME_ASTROLOGY_PATHS.outputDir}.`);
        }
      }
      console.log('[RITUAL] Background indexing tasks completed.');
    } catch (critical) {
      console.error('[RITUAL] Critical background ritual error:', critical.message);
    }
  }

  if (isDetached) {
    console.log('[RITUAL] Detaching indexing tasks to background...');
    runRitual().catch(err => console.error('[RITUAL] Background ritual error:', err));
    // Small delay to ensure logs are visible before main process continues
    await new Promise(r => setTimeout(r, 1000));
  } else {
    await runRitual();
  }

  console.log('[RITUAL] Initialization Sequence Handoff. Launching Scholomance CODEx.');
}

main().catch((err) => {
  console.error('[RITUAL] Critical initialization failure:', err);
  process.exit(1);
});
