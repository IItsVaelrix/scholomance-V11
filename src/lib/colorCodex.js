/**
 * ColorCodex - Unified phonetic color algorithm.
 *
 * Produces connection-aware, salience-weighted color entries for Truesight.
 * This replaces flat 1:1 family coloring with an Anchor/Ghost model:
 * high-salience words become anchors, low-salience words are ghosted.
 */

import { normalizeVowelFamily } from "./vowelFamily.js";
import { weightBalancer } from "./phoneticWeighting.js";

/** Minimum connection score to cluster two words together. */
const CLUSTER_MIN_SCORE = 0.60;

/** Base opacity for words with no rhyme connections. */
const BASE_OPACITY = 0.45;

/** Opacity range mapped from connection score. */
const OPACITY_SCALE = 0.55;

/** Minimum salience required for a word to be an "anchor". */
const GLOBAL_SALIENCE_THRESHOLD = 0.34;

/** Max number of active color clusters per line. */
const MAX_ACTIVE_CLUSTERS_PER_LINE = 3;

/** Central vowels to de-emphasize unless strongly supported by context. */
const SCHWA_FAMILIES = new Set(["AH", "ER", "UR"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

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

  /** @returns {Map<number, number[]>} root -> member charStarts */
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
  let r = 0;
  let g = 0;
  let b = 0;
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
  let r;
  let g;
  let b;
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
  const toHex = (value) => {
    const asHex = Math.round(clamp(value, 0, 1) * 255).toString(16);
    return asHex.length === 1 ? `0${asHex}` : asHex;
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

    // Primary stress and multisyllabic forms carry more cluster authority.
    const impactWeight =
      (profile.syllableCount || 1) * (profile.stressPattern?.includes("1") ? 1.5 : 1.0);
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
 * Builds a map of charStart -> best connection.
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
    if (Number.isInteger(csA) && csA >= 0) {
      update(csA, score, type, syllablesMatched, syntaxMultiplier, phoneticWeight);
    }
    if (Number.isInteger(csB) && csB >= 0) {
      update(csB, score, type, syllablesMatched, syntaxMultiplier, phoneticWeight);
    }
  }

  return best;
}

// ---------------------------------------------------------------------------
// Salience helpers
// ---------------------------------------------------------------------------

function resolveSyntaxToken(profile, syntaxLayer) {
  if (!syntaxLayer || typeof syntaxLayer !== "object") return null;
  const charStart = Number(profile?.charStart);
  if (Number.isInteger(charStart) && charStart >= 0) {
    const byChar = syntaxLayer.tokenByCharStart?.get?.(charStart);
    if (byChar) return byChar;
  }
  const lineIndex = Number(profile?.lineIndex);
  const wordIndex = Number(profile?.wordIndex);
  if (Number.isInteger(lineIndex) && Number.isInteger(wordIndex) && Number.isInteger(charStart)) {
    const key = `${lineIndex}:${wordIndex}:${charStart}`;
    return syntaxLayer.tokenByIdentity?.get?.(key) || null;
  }
  return null;
}

function getStressSalienceWeight(profile, syntaxToken) {
  const stressPattern = String(profile?.stressPattern || "");
  if (stressPattern.includes("1")) return 1.22;
  if (stressPattern.includes("2")) return 1.08;

  const stressRole = String(profile?.stressRole || syntaxToken?.stressRole || "").toLowerCase();
  if (stressRole === "primary") return 1.22;
  if (stressRole === "secondary") return 1.08;
  if (stressRole === "unstressed") return 0.76;
  return 0.92;
}

function getSyntaxSalienceWeight(profile, syntaxToken) {
  const rhymePolicy = String(profile?.rhymePolicy || syntaxToken?.rhymePolicy || "allow");
  const role = String(profile?.role || syntaxToken?.role || "content");
  const lineRole = String(profile?.lineRole || syntaxToken?.lineRole || "line_mid");

  let weight = 1;
  if (rhymePolicy === "suppress") weight *= 0.55;
  else if (rhymePolicy === "allow_weak") weight *= 0.88;

  if (role === "function") weight *= 0.88;
  if (lineRole === "line_end") weight *= 1.05;

  return clamp(weight, 0.45, 1.2);
}

function buildTokenFrequencyMap(wordAnalyses) {
  const map = new Map();
  for (const profile of wordAnalyses) {
    const key = String(profile?.normalizedWord || profile?.word || "").toUpperCase();
    if (!key) continue;
    map.set(key, (map.get(key) || 0) + 1);
  }
  return map;
}

function getRarityWeight(profile, frequencyMap) {
  const key = String(profile?.normalizedWord || profile?.word || "").toUpperCase();
  const frequency = Math.max(1, Number(frequencyMap.get(key) || 1));
  if (frequency === 1) return 1.18;
  return clamp(1.16 - (frequency - 1) * 0.07, 0.72, 1.12);
}

function buildLineClusterAllowList(entries, maxActiveClustersPerLine) {
  const byLine = new Map();

  for (const entry of entries) {
    if (!Number.isInteger(entry.lineIndex) || entry.lineIndex < 0) continue;
    const key = entry.clusterKey || `char:${entry.charStart}`;
    if (!byLine.has(entry.lineIndex)) byLine.set(entry.lineIndex, new Map());
    const lineBuckets = byLine.get(entry.lineIndex);
    const current = lineBuckets.get(key) || 0;
    if (entry.salience > current) lineBuckets.set(key, entry.salience);
  }

  const allowList = new Map();
  for (const [lineIndex, clusters] of byLine) {
    const selected = Array.from(clusters.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxActiveClustersPerLine)
      .map(([key]) => key);
    allowList.set(lineIndex, new Set(selected));
  }

  return allowList;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Builds a per-word color map from analysis data and rhyme connections.
 */
export function buildColorMap(wordAnalyses, allConnections, palette, options = {}) {
  const colorMap = new Map();

  if (!Array.isArray(wordAnalyses) || wordAnalyses.length === 0 || !palette) {
    return colorMap;
  }

  const connections = Array.isArray(allConnections) ? allConnections : [];

  // 1. Build charStart -> word profile lookup.
  const wordMap = new Map();
  for (const profile of wordAnalyses) {
    const cs = Number(profile?.charStart);
    if (!Number.isInteger(cs) || cs < 0) continue;
    wordMap.set(cs, profile);
  }

  // 2. Refrain/Identity pass: strict union for strong links.
  const uf = new UnionFind();
  for (const conn of connections) {
    const score = Number(conn.score) || 0;
    if (score < CLUSTER_MIN_SCORE && conn.type !== "identity") continue;

    const csA = conn.wordA?.charStart;
    const csB = conn.wordB?.charStart;
    if (Number.isInteger(csA) && csA >= 0 && Number.isInteger(csB) && csB >= 0) {
      uf.union(csA, csB);
    }
  }

  const clusters = uf.clusters();

  // 3. Resolve canonical cluster families/colors.
  const clusterFamily = new Map();
  const clusterColor = new Map();
  for (const [root, members] of clusters) {
    if (members.length < 2) continue;
    const family = selectCanonicalFamily(members, wordMap);
    if (!family) continue;
    clusterFamily.set(root, family);
    clusterColor.set(root, palette[family] || "");
  }

  // 4. Build provisional entries.
  const bestConnMap = buildBestConnectionMap(connections);
  const balancedWeights = weightBalancer.calculateWeights(Array.from(wordMap.values()));
  const tokenFrequency = buildTokenFrequencyMap(Array.from(wordMap.values()));
  const syntaxLayer = options.syntaxLayer || null;
  const provisionalEntries = [];

  for (const [charStart, profile] of wordMap) {
    const family = normalizeVowelFamily(profile.vowelFamily);
    if (!family && !uf.parent.has(charStart)) continue;

    const bestConn = bestConnMap.get(charStart) || null;
    const balanceWeight = balancedWeights.get(charStart) || 1;

    const root = uf.parent.has(charStart) ? uf.find(charStart) : null;
    const hasCluster = root !== null && clusterColor.has(root);

    let baseColor = hasCluster ? clusterColor.get(root) : (palette[family] || "");
    if (!baseColor) {
      baseColor = options.theme === "light" ? "#333333" : "#ffffff";
    }

    const bestScore = bestConn ? bestConn.score : 0;
    const syntaxMultiplier = bestConn ? bestConn.syntaxMultiplier : 1;
    const phoneticWeight = bestConn ? (bestConn.phoneticWeight || 1) : 1;
    const weightIntensity = clamp(phoneticWeight, 0.85, 1.2);

    let fullOpacity =
      (BASE_OPACITY + (bestScore * OPACITY_SCALE * weightIntensity)) * balanceWeight;
    if (bestConn?.type === "identity") {
      fullOpacity = 0.95 * balanceWeight;
    }
    fullOpacity *= syntaxMultiplier;
    fullOpacity = clamp(fullOpacity, 0.2, 1);

    const syntaxToken = resolveSyntaxToken(profile, syntaxLayer);
    const stressWeight = getStressSalienceWeight(profile, syntaxToken);
    const syntaxWeight = getSyntaxSalienceWeight(profile, syntaxToken);
    const rarityWeight = getRarityWeight(profile, tokenFrequency);
    const syllableCount = Math.max(1, Number(profile?.syllableCount) || 1);
    const syllableWeight = clamp(0.92 + Math.min(3, syllableCount - 1) * 0.08, 0.9, 1.16);
    const schwaWeight = family && SCHWA_FAMILIES.has(family)
      ? ((bestScore >= 0.9 || Number(bestConn?.syllablesMatched) >= 2) ? 0.9 : 0.52)
      : 1;
    const connectionSignal = bestConn ? (0.45 + bestScore * 0.55) : 0.24;
    const salience = clamp(
      connectionSignal * stressWeight * syntaxWeight * syllableWeight * balanceWeight * rarityWeight * schwaWeight,
      0,
      1
    );

    const isMultiSyllable = bestConn ? bestConn.syllablesMatched >= 2 : false;
    if (isMultiSyllable) {
      baseColor = boostLightness(baseColor, 0.06);
    }

    const lineIndex = Number.isInteger(profile?.lineIndex) ? profile.lineIndex : -1;
    const clusterKey = hasCluster ? `cluster:${root}` : `family:${family || "none"}`;

    provisionalEntries.push({
      charStart,
      lineIndex,
      clusterKey,
      baseColor,
      fullOpacity,
      salience,
      hasCluster,
      root,
      bestConn,
      bestScore,
      isMultiSyllable,
      phoneticWeight,
      syntaxMultiplier,
      family,
    });
  }

  // 5. Anchor/Ghost pass with per-line cluster cap.
  const mode = String(options.analysisMode || "none");
  const requestedThreshold = Number(options.salienceThreshold);
  const baseThreshold = Number.isFinite(requestedThreshold)
    ? requestedThreshold
    : GLOBAL_SALIENCE_THRESHOLD;
  const modeOffset = mode === "vowel" ? -0.04 : 0;
  const salienceThreshold = clamp(baseThreshold + modeOffset, 0.18, 0.75);

  const requestedLineCap = Number(options.maxActiveClustersPerLine);
  const maxActiveClustersPerLine =
    Number.isFinite(requestedLineCap) && requestedLineCap > 0
      ? Math.floor(requestedLineCap)
      : MAX_ACTIVE_CLUSTERS_PER_LINE;
  const lineAllowList = buildLineClusterAllowList(provisionalEntries, maxActiveClustersPerLine);

  for (const entry of provisionalEntries) {
    const lineAllowedClusters = lineAllowList.get(entry.lineIndex);
    const linePass = !lineAllowedClusters || lineAllowedClusters.has(entry.clusterKey);
    const forcedAnchor = entry.bestConn?.type === "identity";
    const isAnchor = forcedAnchor || (entry.salience >= salienceThreshold && linePass);
    const isGhost = !isAnchor;

    const opacity = isAnchor
      ? clamp(entry.fullOpacity * (0.72 + entry.salience * 0.28), 0.22, 1)
      : clamp(0.16 + (entry.salience * 0.22), 0.12, 0.48);

    colorMap.set(entry.charStart, {
      color: entry.baseColor,
      opacity,
      groupId: entry.hasCluster ? String(entry.root) : null,
      rhymeType: entry.bestConn ? entry.bestConn.type : null,
      isMultiSyllable: entry.isMultiSyllable,
      bestScore: entry.bestScore,
      phoneticWeight: entry.phoneticWeight,
      salience: entry.salience,
      isAnchor,
      isGhost,
      lineIndex: entry.lineIndex,
      clusterKey: entry.clusterKey,
      family: entry.family,
      syntaxMultiplier: entry.syntaxMultiplier,
    });
  }

  return colorMap;
}
