import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
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

// Baked-in seed data paths (from Dockerfile build-time stage)
const SEED_DICT_PATH = '/app/data/scholomance_dict.sqlite';
const SEED_CORPUS_PATH = '/app/data/scholomance_corpus.sqlite';

// Resolved at call time — NOT at module load — so Render's persistent disk
// has time to mount before we check /var/data.
function resolveDataDir() {
  return IS_PRODUCTION && existsSync('/var/data') ? '/var/data' : PROJECT_ROOT;
}

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
function seedPersistentDisk(dictPath, corpusPath) {
  if (!IS_PRODUCTION) return;

  if (!existsSync(dictPath) && existsSync(SEED_DICT_PATH)) {
    console.log(`[RITUAL] Seeding dictionary from baked-in image: ${SEED_DICT_PATH} → ${dictPath}`);
    copyFileSync(SEED_DICT_PATH, dictPath);
  }
  if (!existsSync(corpusPath) && existsSync(SEED_CORPUS_PATH)) {
    console.log(`[RITUAL] Seeding corpus from baked-in image: ${SEED_CORPUS_PATH} → ${corpusPath}`);
    copyFileSync(SEED_CORPUS_PATH, corpusPath);
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

async function main() {
  const args = process.argv.slice(2);
  const isDetached = args.includes('--detach');

  console.log(`[RITUAL] Starting Production Initialization... (detached=${isDetached})`);

  async function runRitual() {
    try {
      // Resolve data dir here — after any startup delay — so Render's persistent
      // disk has had time to mount before we check existsSync('/var/data').
      const dataDir = resolveDataDir();
      const dictPath = path.join(dataDir, 'scholomance_dict.sqlite');
      const corpusPath = path.join(dataDir, 'scholomance_corpus.sqlite');

      // 0. Ensure audio storage directory exists
      const audioDir = path.join(dataDir, 'audio');
      if (!existsSync(audioDir)) {
        console.log(`[RITUAL] Creating audio storage at ${audioDir}`);
        try { mkdirSync(audioDir, { recursive: true }); } catch (_e) {
          // Best-effort
        }
      }

      // 1. Seed persistent disk from baked-in image (first boot only)
      seedPersistentDisk(dictPath, corpusPath);

      // 2. Dictionary check
      if (!existsSync(dictPath)) {
        // Runtime image does not include python3 or curl — databases must be
        // baked into the Docker image at build time or pre-seeded to /var/data.
        console.error('[RITUAL] FATAL: Dictionary DB missing and runtime build is not supported.');
        console.error(`[RITUAL]   Expected: ${dictPath}`);
        console.error('[RITUAL]   Rebuild the Docker image or seed /var/data manually.');
      } else {
        console.log(`[RITUAL] Dictionary ready at ${dictPath}.`);
      }

      // 3. Corpus check
      if (!existsSync(corpusPath)) {
        console.error('[RITUAL] FATAL: Corpus DB missing and runtime build is not supported.');
        console.error(`[RITUAL]   Expected: ${corpusPath}`);
        console.error('[RITUAL]   Rebuild the Docker image or seed /var/data manually.');
      } else {
        console.log(`[RITUAL] Corpus ready at ${corpusPath}.`);
      }

      // 4. Rhyme Astrology artifact initialization
      if (ENABLE_RHYME_ASTROLOGY) {
        if (!RHYME_ASTROLOGY_READY()) {
          if (!existsSync(dictPath)) {
            console.error('[RITUAL] FATAL: Rhyme Astrology build skipped — Dictionary DB missing.');
            console.error(`[RITUAL]   Expected: ${dictPath}`);
            console.error('[RITUAL]   Rebuild the Docker image or seed /var/data manually.');
          } else try {
            mkdirSync(RHYME_ASTROLOGY_PATHS.outputDir, { recursive: true });
            await runCommand(process.execPath, ['scripts/buildRhymeAstrologyIndex.js'], {
              env: {
                ...process.env,
                SCHOLOMANCE_DICT_PATH: dictPath,
                SCHOLOMANCE_CORPUS_PATH: corpusPath,
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
    // Delay gives Render's persistent disk mount time to settle before the
    // server process starts and also ensures ritual logs are visible.
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
