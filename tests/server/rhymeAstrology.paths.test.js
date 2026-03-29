import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  hasRhymeAstrologyArtifactBundle,
  resolveRhymeAstrologyArtifactPaths,
} from '../../codex/server/utils/rhymeAstrologyPaths.js';

function createArtifactBundle(outputDir) {
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(path.join(outputDir, 'rhyme_lexicon.sqlite'), '');
  writeFileSync(path.join(outputDir, 'rhyme_index.sqlite'), '');
  writeFileSync(path.join(outputDir, 'rhyme_edges.sqlite'), '');
  writeFileSync(path.join(outputDir, 'rhyme_emotion_priors.json'), '{}');
}

describe('[Server] rhymeAstrology artifact paths', () => {
  let tempDir = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('falls back to the persistent bundle when the configured output dir is missing', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'rhyme-astro-paths-'));
    const projectRoot = path.join(tempDir, 'app');
    const persistentDataDir = path.join(tempDir, 'var', 'data');
    const persistentOutputDir = path.join(persistentDataDir, 'rhyme-astrology');

    createArtifactBundle(persistentOutputDir);

    const paths = resolveRhymeAstrologyArtifactPaths({
      outputDir: path.join(tempDir, 'dict_data', 'rhyme-astrology'),
      projectRoot,
      persistentDataDir,
      isProduction: true,
    });

    expect(paths.outputDir).toBe(persistentOutputDir);
    expect(paths.usedExistingArtifactsFallback).toBe(true);
    expect(hasRhymeAstrologyArtifactBundle(paths)).toBe(true);
    expect(paths.hasEmotionPriors).toBe(true);
  });

  it('prefers the persistent production output when a configured external path is missing on first boot', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'rhyme-astro-paths-'));
    const projectRoot = path.join(tempDir, 'app');
    const persistentDataDir = path.join(tempDir, 'var', 'data');
    const configuredOutputDir = path.join(tempDir, 'dict_data', 'rhyme-astrology');

    const paths = resolveRhymeAstrologyArtifactPaths({
      outputDir: configuredOutputDir,
      projectRoot,
      persistentDataDir,
      isProduction: true,
    });

    expect(paths.outputDir).toBe(path.join(persistentDataDir, 'rhyme-astrology'));
    expect(paths.usedProductionPersistentFallback).toBe(true);
    expect(paths.hasCompleteDbSet).toBe(false);
  });
});
