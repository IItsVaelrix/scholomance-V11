/**
 * ColorCodex — Unified phonetic color algorithm.
 *
 * Combines rhyme connections, multi-syllable matching, and phonetic affinity
 * from the deep rhyme engine into a per-word color map that replaces the flat
 * `palette[vowelFamily]` lookup with connection-aware, intensity-modulated colors.
 */

import { normalizeVowelFamily } from "./vowelFamily.js";
import { weightBalancer } from "./phoneticWeighting.js";

/** Minimum connection score to cluster two words together. */
const CLUSTER_MIN_SCORE = 0.60;

/** Base opacity for words with no rhyme connections. */
const BASE_OPACITY = 0.45;

/** Opacity range mapped from connection score. */
const OPACITY_SCALE = 0.55;

// ---------------------------------------------------------------------------
// Union-Find
// ---------------------------------------------------------------------------

class UnionFind {
  constructor() {
    /** @type {Map<number, number>} */
    this.parent = new Map();
    /** @type {Map<number, number>} */
    this.rank = new Map();
  }

  find(x) {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
    if (this.parent.get(x) !== x) {
      this.parent.set(x, this.find(this.parent.get(x)));
    }
    return this.parent.get(x);
  }

  union(x, y) {
    const rootX = this.find(x);
    const rootY = this.find(y);
    if (rootX === rootY) return;
    const rankX = this.rank.get(rootX);
    const rankY = this.rank.get(rootY);
    if (rankX < rankY) {
      this.parent.set(rootX, rootY);
    } else if (rankX > rankY) {
      this.parent.set(rootY, rootX);
    } else {
      this.parent.set(rootY, rootX);
      this.rank.set(rootX, rankX + 1);
    }
  }

  /** @returns {Map<number, number[]>} root → member charStarts */
  clusters() {
    const groups = new Map();
    for (const key of this.parent.keys()) {
      const root = this.find(key);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(key);
    }
    return groups;
  }
}

// ---------------------------------------------------------------------------
// Color helpers
// ---------------------------------------------------------------------------

/**
 * Parses a hex color string to HSL components.
 */
function hexToHsl(hex) {
  let r = 0, g = 0, b = 0;
  const clean = hex.replace("#", "");
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) / 255;
    g = parseInt(clean[1] + clean[1], 16) / 255;
    b = parseInt(clean[2] + clean[2], 16) / 255;
  } else {
    r = parseInt(clean.slice(0, 2), 16) / 255;
    g = parseInt(clean.slice(2, 4), 16) / 255;
    b = parseInt(clean.slice(4, 6), 16) / 255;
  }
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return { h, s, l };
}

/**
 * Converts HSL components to a hex color string.
 */
function hslToHex(h, s, l) {
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (v) => {
    const hex = Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/**
 * Boosts lightness of a hex color by a percentage.
 */
function boostLightness(hex, boost) {
  const { h, s, l } = hexToHsl(hex);
  return hslToHex(h, s, Math.min(1, l + boost));
}

// ---------------------------------------------------------------------------
// Canonical family selection
// ---------------------------------------------------------------------------

/**
 * Selects the canonical vowel family for a cluster by weighted majority vote.
 */
function selectCanonicalFamily(memberCharStarts, wordMap) {
  const familyCounts = new Map();

  for (const cs of memberCharStarts) {
    const profile = wordMap.get(cs);
    if (!profile) continue;
    const family = normalizeVowelFamily(profile.vowelFamily);
    if (!family) continue;
    
    // Impact weighting: primary-stressed or multisyllabic carry more weight in selection
    const impactWeight = (profile.syllableCount || 1) * (profile.stressPattern?.includes('1') ? 1.5 : 1.0);
    familyCounts.set(family, (familyCounts.get(family) || 0) + impactWeight);
  }

  let bestFamily = "";
  let bestCount = 0;
  for (const [family, count] of familyCounts) {
    if (count > bestCount || (count === bestCount && family < bestFamily)) {
      bestCount = count;
      bestFamily = family;
    }
  }

  return bestFamily;
}

// ---------------------------------------------------------------------------
// Per-word best connection
// ---------------------------------------------------------------------------

/**
 * Builds a map of charStart → best connection.
 */
function buildBestConnectionMap(allConnections) {
  const best = new Map();

  const update = (charStart, score, type, syllablesMatched, syntaxMultiplier, phoneticWeight) => {
    const existing = best.get(charStart);
    if (!existing || score > existing.score) {
      best.set(charStart, { score, type, syllablesMatched, syntaxMultiplier, phoneticWeight });
    } else if (existing) {
      existing.syllablesMatched = Math.max(existing.syllablesMatched, syllablesMatched);
      existing.phoneticWeight = Math.max(existing.phoneticWeight || 0, phoneticWeight || 0);
    }
  };

  for (const conn of allConnections) {
    const score = Number(conn.score) || 0;
    const type = conn.type || "consonance";
    const syllablesMatched = Number(conn.syllablesMatched) || 0;
    const syntaxMultiplier = Number(conn.syntax?.multiplier) || 1;
    const phoneticWeight = Number(conn.phoneticWeight) || 1;

    const csA = conn.wordA?.charStart;
    const csB = conn.wordB?.charStart;
    if (Number.isInteger(csA) && csA >= 0) update(csA, score, type, syllablesMatched, syntaxMultiplier, phoneticWeight);
    if (Number.isInteger(csB) && csB >= 0) update(csB, score, type, syllablesMatched, syntaxMultiplier, phoneticWeight);
  }

  return best;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * @typedef {object} ColorCodexEntry
 */

/**
 * Builds a per-word color map from analysis data and rhyme connections.
 */
export function buildColorMap(wordAnalyses, allConnections, palette, options = {}) {
  const colorMap = new Map();

  if (!Array.isArray(wordAnalyses) || wordAnalyses.length === 0 || !palette) {
    return colorMap;
  }

  const connections = Array.isArray(allConnections) ? allConnections : [];

  // 1. Build charStart → word profile lookup
  const wordMap = new Map();
  for (const profile of wordAnalyses) {
    const cs = Number(profile?.charStart);
    if (!Number.isInteger(cs) || cs < 0) continue;
    wordMap.set(cs, profile);
  }

  // 2. Refrain/Identity Pass: force identical lines into strict identity clusters
  const uf = new UnionFind();
  for (const conn of connections) {
    const score = Number(conn.score) || 0;
    if (score < CLUSTER_MIN_SCORE && conn.type !== 'identity') continue;
    
    const csA = conn.wordA?.charStart;
    const csB = conn.wordB?.charStart;
    if (Number.isInteger(csA) && csA >= 0 && Number.isInteger(csB) && csB >= 0) {
      uf.union(csA, csB);
    }
  }

  const clusters = uf.clusters();

  // 3. Resolve cluster families and colors
  const clusterFamily = new Map();
  const clusterColor = new Map();

  for (const [root, members] of clusters) {
    if (members.length < 2) continue;
    const family = selectCanonicalFamily(members, wordMap);
    if (family) {
      clusterFamily.set(root, family);
      clusterColor.set(root, palette[family] || "");
    }
  }

  // 4. Build color entries
  const bestConnMap = buildBestConnectionMap(connections);
  const balancedWeights = weightBalancer.calculateWeights(wordAnalyses);

  for (const [cs, profile] of wordMap) {
    const family = normalizeVowelFamily(profile.vowelFamily);
    if (!family && !uf.parent.has(cs)) continue;

    const bestConn = bestConnMap.get(cs) || null;
    const balanceWeight = balancedWeights.get(cs) || 1.0;

    const root = uf.parent.has(cs) ? uf.find(cs) : null;
    const hasCluster = root !== null && clusterColor.has(root);
    
    let baseColor = hasCluster
      ? clusterColor.get(root)
      : (palette[family] || "");

    if (!baseColor) {
        // Ultimate fallback if no palette match
        baseColor = options.theme === 'light' ? "#333333" : "#ffffff";
    }

    const bestScore = bestConn ? bestConn.score : 0;
    const syntaxMult = bestConn ? bestConn.syntaxMultiplier : 1;
    const phoneticWeight = bestConn ? (bestConn.phoneticWeight || 1) : 1;
    
    // Combine connection intensity with phonetic balance weight
    const weightIntensity = Math.max(0.85, Math.min(1.15, phoneticWeight));
    let opacity = (BASE_OPACITY + (bestScore * OPACITY_SCALE * weightIntensity)) * balanceWeight;
    
    // Refrain stabilization: Identity matches should have high, consistent opacity
    if (bestConn?.type === 'identity') {
        opacity = 0.95 * balanceWeight;
    }

    opacity *= syntaxMult;
    opacity = Math.max(0.2, Math.min(1, opacity));

    const isMultiSyllable = bestConn ? bestConn.syllablesMatched >= 2 : false;
    if (isMultiSyllable) {
      baseColor = boostLightness(baseColor, 0.06);
    }

    colorMap.set(cs, {
      color: baseColor,
      opacity,
      groupId: hasCluster ? String(root) : null,
      rhymeType: bestConn ? bestConn.type : null,
      isMultiSyllable,
      bestScore,
      phoneticWeight
    });
  }

  return colorMap;
}
