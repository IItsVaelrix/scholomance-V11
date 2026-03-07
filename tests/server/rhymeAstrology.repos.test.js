import { afterEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';
import { createRhymeAstrologyLexiconRepo } from '../../codex/server/services/rhyme-astrology/lexiconRepo.js';
import { createRhymeAstrologyIndexRepo } from '../../codex/server/services/rhyme-astrology/indexRepo.js';

function createLexiconFixtureDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE lexicon_node (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL,
      normalized TEXT NOT NULL,
      phonemes_json TEXT NOT NULL,
      stress_pattern TEXT NOT NULL,
      syllable_count INTEGER NOT NULL,
      vowel_skeleton_json TEXT NOT NULL,
      consonant_skeleton_json TEXT NOT NULL,
      ending_signature TEXT NOT NULL,
      onset_signature TEXT NOT NULL,
      dominant_vowel_family TEXT NOT NULL,
      frequency_score REAL NOT NULL
    );
  `);
  db.prepare(`
    INSERT INTO lexicon_node (
      id, token, normalized, phonemes_json, stress_pattern, syllable_count,
      vowel_skeleton_json, consonant_skeleton_json, ending_signature, onset_signature,
      dominant_vowel_family, frequency_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'w_1',
    'flame',
    'flame',
    JSON.stringify(['F', 'L', 'EY1', 'M']),
    '1',
    1,
    JSON.stringify(['EY1']),
    JSON.stringify(['F', 'L', 'M']),
    'EY1-M',
    'F-L',
    'EY',
    0.95
  );
  db.prepare(`
    INSERT INTO lexicon_node (
      id, token, normalized, phonemes_json, stress_pattern, syllable_count,
      vowel_skeleton_json, consonant_skeleton_json, ending_signature, onset_signature,
      dominant_vowel_family, frequency_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'w_2',
    'frame',
    'frame',
    JSON.stringify(['F', 'R', 'EY1', 'M']),
    '1',
    1,
    JSON.stringify(['EY1']),
    JSON.stringify(['F', 'R', 'M']),
    'EY1-M',
    'F-R',
    'EY',
    0.8
  );
  db.close();
}

function createIndexFixtureDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE signature_bucket (
      ending_signature TEXT NOT NULL,
      node_id TEXT NOT NULL,
      token TEXT NOT NULL,
      frequency_score REAL NOT NULL,
      syllable_count INTEGER NOT NULL,
      stress_pattern TEXT NOT NULL,
      dominant_vowel_family TEXT NOT NULL,
      phonemes_json TEXT NOT NULL,
      vowel_skeleton_json TEXT NOT NULL,
      consonant_skeleton_json TEXT NOT NULL
    );

    CREATE TABLE constellation_cluster (
      id TEXT PRIMARY KEY,
      ending_signature TEXT NOT NULL,
      anchor_id TEXT NOT NULL,
      label TEXT NOT NULL,
      dominant_vowel_family_json TEXT NOT NULL,
      dominant_stress_pattern TEXT NOT NULL,
      members_json TEXT NOT NULL,
      density_score REAL NOT NULL,
      cohesion_score REAL NOT NULL
    );
  `);

  db.prepare(`
    INSERT INTO signature_bucket (
      ending_signature, node_id, token, frequency_score, syllable_count, stress_pattern,
      dominant_vowel_family, phonemes_json, vowel_skeleton_json, consonant_skeleton_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'EY1-M',
    'w_2',
    'frame',
    0.8,
    1,
    '1',
    'EY',
    JSON.stringify(['F', 'R', 'EY1', 'M']),
    JSON.stringify(['EY1']),
    JSON.stringify(['F', 'R', 'M'])
  );

  db.prepare(`
    INSERT INTO constellation_cluster (
      id, ending_signature, anchor_id, label, dominant_vowel_family_json,
      dominant_stress_pattern, members_json, density_score, cohesion_score
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'c_ey1_m_1',
    'EY1-M',
    'w_2',
    'EY-M Cluster',
    JSON.stringify(['EY']),
    '1',
    JSON.stringify(['w_2', 'w_3']),
    0.7,
    0.9
  );

  db.close();
}

function createEdgesFixtureDb(dbPath) {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE hot_edge (
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      from_token TEXT NOT NULL,
      to_token TEXT NOT NULL,
      exact_rhyme_score REAL NOT NULL,
      slant_rhyme_score REAL NOT NULL,
      vowel_match_score REAL NOT NULL,
      consonant_match_score REAL NOT NULL,
      stress_alignment_score REAL NOT NULL,
      syllable_delta_penalty REAL NOT NULL,
      overall_score REAL NOT NULL,
      reasons_json TEXT NOT NULL
    );
  `);
  db.prepare(`
    INSERT INTO hot_edge (
      from_id, to_id, from_token, to_token,
      exact_rhyme_score, slant_rhyme_score, vowel_match_score, consonant_match_score,
      stress_alignment_score, syllable_delta_penalty, overall_score, reasons_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'w_1',
    'w_2',
    'flame',
    'frame',
    1,
    1,
    1,
    0.9,
    1,
    0,
    0.97,
    JSON.stringify(['matching ending signature EY1-M'])
  );
  db.close();
}

describe('[Server] rhyme-astrology repositories', () => {
  let tempDir = null;

  afterEach(() => {
    if (tempDir) {
      rmSync(tempDir, { recursive: true, force: true });
      tempDir = null;
    }
  });

  it('returns empty-safe lexicon repo when db path is missing', () => {
    const warn = vi.fn();
    const repo = createRhymeAstrologyLexiconRepo('', { log: { warn } });
    expect(repo.lookupNodeByNormalized('flame')).toBe(null);
    expect(repo.lookupNodesByNormalizedBatch(['flame'])).toEqual({});
    expect(() => repo.close()).not.toThrow();
    expect(warn).toHaveBeenCalled();
  });

  it('loads lexicon nodes from sqlite', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'rhyme-astro-lexicon-'));
    const lexiconDbPath = path.join(tempDir, 'rhyme_lexicon.sqlite');
    createLexiconFixtureDb(lexiconDbPath);

    const repo = createRhymeAstrologyLexiconRepo(lexiconDbPath);
    const flame = repo.lookupNodeByNormalized('Flame');
    const batch = repo.lookupNodesByNormalizedBatch(['flame', 'frame']);

    expect(flame?.id).toBe('w_1');
    expect(flame?.endingSignature).toBe('EY1-M');
    expect(batch.frame?.id).toBe('w_2');
    expect(batch.flame?.token).toBe('flame');

    repo.close();
  });

  it('loads hot edges, bucket members, and clusters from sqlite', () => {
    tempDir = mkdtempSync(path.join(os.tmpdir(), 'rhyme-astro-index-'));
    const indexDbPath = path.join(tempDir, 'rhyme_index.sqlite');
    const edgesDbPath = path.join(tempDir, 'rhyme_edges.sqlite');
    createIndexFixtureDb(indexDbPath);
    createEdgesFixtureDb(edgesDbPath);

    const repo = createRhymeAstrologyIndexRepo({
      indexDbPath,
      edgesDbPath,
    });

    const hotEdges = repo.lookupHotEdges('w_1', 10);
    const bucketMembers = repo.lookupBucketMembers('EY1-M', 10);
    const clusters = repo.lookupClustersByEndingSignature('EY1-M', 10);

    expect(hotEdges).toHaveLength(1);
    expect(hotEdges[0].toToken).toBe('frame');
    expect(bucketMembers).toHaveLength(1);
    expect(bucketMembers[0].id).toBe('w_2');
    expect(clusters).toHaveLength(1);
    expect(clusters[0].label).toBe('EY-M Cluster');

    repo.close();
  });
});

