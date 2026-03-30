import { bytecodeToPalette } from '../../pixelbrain/color-byte-mapping.js';
import { mapToCoordinates } from '../../pixelbrain/coordinate-mapping.js';
import { buildPixelBrainTokenBytecode } from '../../pixelbrain/token-to-bytecode.js';
import {
  clamp01,
  createAmplifierDiagnostic,
  createAmplifierResult,
  roundTo,
} from '../shared.js';

const ID = 'pixelbrain_phase1_bridge';
const LABEL = 'PixelBrain Phase 1 Bridge';
const TIER = 'COMMON';
const CLAIMED_WEIGHT = 0.04;
const VERSION = '1.0.0';

function formatLabel(value, fallback) {
  const safeValue = String(value || '').trim().toLowerCase();
  if (!safeValue) return fallback;
  return safeValue.replace(/(^|_)([a-z])/g, (_, prefix, char) => `${prefix ? ' ' : ''}${char.toUpperCase()}`).trim();
}

function computeCoordinateSpread(coordinates, canvas) {
  const safeCoordinates = Array.isArray(coordinates) ? coordinates : [];
  if (safeCoordinates.length === 0) return 0;

  const xs = safeCoordinates.map((coordinate) => Number(coordinate?.snappedX ?? coordinate?.x) || 0);
  const ys = safeCoordinates.map((coordinate) => Number(coordinate?.snappedY ?? coordinate?.y) || 0);
  const xSpread = (Math.max(...xs) - Math.min(...xs)) / Math.max(1, Number(canvas?.width) || 1);
  const ySpread = (Math.max(...ys) - Math.min(...ys)) / Math.max(1, Number(canvas?.height) || 1);
  return roundTo(clamp01((xSpread * 0.5) + (ySpread * 0.5)));
}

function buildPaletteCatalog(tokenHints) {
  const paletteByBytecode = new Map();
  (Array.isArray(tokenHints) ? tokenHints : []).forEach((hint) => {
    if (!hint?.bytecode || paletteByBytecode.has(hint.bytecode)) return;
    paletteByBytecode.set(hint.bytecode, bytecodeToPalette(hint.bytecode, {
      colorFeatures: hint.colorFeatures,
    }));
  });

  return Object.freeze(
    [...paletteByBytecode.values()]
      .sort((left, right) => left.bytecode.localeCompare(right.bytecode))
      .map((palette) => Object.freeze({
        key: palette.key,
        bytecode: palette.bytecode,
        schoolId: palette.schoolId || null,
        rarity: palette.rarity,
        effect: palette.effect,
        colors: Object.freeze([...palette.colors]),
        byteMap: Object.freeze({ ...palette.byteMap }),
      }))
  );
}

function buildCoordinatePayload(coordinateGrid, tokenHints) {
  const byTokenId = new Map(
    (Array.isArray(tokenHints) ? tokenHints : []).map((hint) => [Number(hint?.tokenId) || 0, hint])
  );

  return Object.freeze(
    (Array.isArray(coordinateGrid?.coordinates) ? coordinateGrid.coordinates : []).map((coordinate) => {
      const hint = byTokenId.get(Number(coordinate?.tokenId) || 0);
      return Object.freeze({
        tokenId: Number(coordinate?.tokenId) || 0,
        token: String(hint?.token || ''),
        lineIndex: Number(coordinate?.lineIndex ?? hint?.lineIndex) || 0,
        bytecode: String(hint?.bytecode || ''),
        schoolId: hint?.schoolId || null,
        rarity: String(hint?.rarity || 'COMMON'),
        effect: String(hint?.effect || 'INERT'),
        emphasis: roundTo(Number(coordinate?.emphasis ?? hint?.anchorWeight) || 0),
        x: roundTo(Number(coordinate?.x) || 0, 2),
        y: roundTo(Number(coordinate?.y) || 0, 2),
        z: roundTo(Number(coordinate?.z) || 0),
        snappedX: Number.isFinite(Number(coordinate?.snappedX)) ? Number(coordinate.snappedX) : Math.round(Number(coordinate?.x) || 0),
        snappedY: Number.isFinite(Number(coordinate?.snappedY)) ? Number(coordinate.snappedY) : Math.round(Number(coordinate?.y) || 0),
        paletteKey: String(hint?.bytecode || ''),
      });
    })
  );
}

function topTokenLabels(entries, limit = 4) {
  return (Array.isArray(entries) ? entries : [])
    .slice()
    .sort((left, right) => {
      const rightWeight = Number(right?.anchorWeight) || 0;
      const leftWeight = Number(left?.anchorWeight) || 0;
      if (rightWeight !== leftWeight) return rightWeight - leftWeight;
      return String(left?.token || '').localeCompare(String(right?.token || ''));
    })
    .slice(0, limit)
    .map((entry) => String(entry?.token || '').trim())
    .filter(Boolean);
}

function buildMatches(tokenHints, coordinateGrid) {
  const safeHints = Array.isArray(tokenHints) ? tokenHints : [];
  const activeHints = safeHints.filter((hint) => String(hint?.effect || 'INERT') !== 'INERT');
  const lineCount = Math.max(1, new Set(safeHints.map((hint) => Number(hint?.lineIndex) || 0)).size);
  const activeCoverage = activeHints.length / Math.max(1, safeHints.length);
  const anchorCoverage = activeHints.length > 0
    ? activeHints.filter((hint) => Boolean(hint?.isAnchor)).length / activeHints.length
    : 0;
  const matches = [];
  const schoolBuckets = new Map();

  activeHints.forEach((hint) => {
    const schoolId = String(hint?.schoolId || 'VOID').trim().toUpperCase() || 'VOID';
    if (!schoolBuckets.has(schoolId)) schoolBuckets.set(schoolId, []);
    schoolBuckets.get(schoolId).push(hint);
  });

  matches.push(Object.freeze({
    id: `pixelbrain_axis_${coordinateGrid?.dominantAxis || 'horizontal'}`,
    label: `${formatLabel(coordinateGrid?.dominantAxis, 'Horizontal')} Axis`,
    hits: activeHints.length,
    score: roundTo(clamp01((activeCoverage * 0.6) + (anchorCoverage * 0.4))),
    coverage: roundTo(activeCoverage),
    lineSpread: roundTo(clamp01(lineCount / Math.max(1, lineCount))),
    tokens: Object.freeze(topTokenLabels(activeHints)),
  }));

  matches.push(Object.freeze({
    id: `pixelbrain_symmetry_${coordinateGrid?.dominantSymmetry || 'none'}`,
    label: `${formatLabel(coordinateGrid?.dominantSymmetry, 'None')} Symmetry`,
    hits: activeHints.filter((hint) => Boolean(hint?.isAnchor)).length,
    score: roundTo(clamp01((anchorCoverage * 0.75) + 0.1)),
    coverage: roundTo(anchorCoverage),
    lineSpread: roundTo(clamp01(lineCount / Math.max(1, lineCount))),
    tokens: Object.freeze(topTokenLabels(activeHints.filter((hint) => Boolean(hint?.isAnchor)))),
  }));

  schoolBuckets.forEach((entries, schoolId) => {
    const uniqueLines = new Set(entries.map((entry) => Number(entry?.lineIndex) || 0)).size;
    matches.push(Object.freeze({
      id: `pixelbrain_palette_${schoolId.toLowerCase()}`,
      label: `${schoolId} Palette`,
      hits: entries.length,
      score: roundTo(clamp01((entries.length / Math.max(1, activeHints.length)) + ((uniqueLines / Math.max(1, lineCount)) * 0.2))),
      coverage: roundTo(entries.length / Math.max(1, activeHints.length)),
      lineSpread: roundTo(uniqueLines / Math.max(1, lineCount)),
      tokens: Object.freeze(topTokenLabels(entries)),
    }));
  });

  return Object.freeze(
    matches
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        if (right.hits !== left.hits) return right.hits - left.hits;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 4)
  );
}

function buildArchetypes({ coordinateGrid, paletteCount, anchorDensity, spread }) {
  const archetypes = [
    {
      id: 'pixelbrain_golden_ratio_lattice',
      label: 'Golden Ratio Lattice',
      score: roundTo(clamp01((spread * 0.65) + 0.18)),
    },
    {
      id: 'pixelbrain_palette_weave',
      label: 'Palette Weave',
      score: roundTo(clamp01((paletteCount / 5) * 0.75)),
    },
    {
      id: `pixelbrain_${String(coordinateGrid?.dominantSymmetry || 'none').trim().toLowerCase()}_gate`,
      label: `${formatLabel(coordinateGrid?.dominantSymmetry, 'None')} Gate`,
      score: roundTo(clamp01((anchorDensity * 0.7) + (String(coordinateGrid?.dominantSymmetry || 'none') !== 'none' ? 0.18 : 0))),
    },
  ];

  return Object.freeze(
    archetypes
      .filter((archetype) => archetype.score > 0)
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 3)
      .map((archetype) => Object.freeze(archetype))
  );
}

export const pixelBrainPhase1BridgeAmplifier = {
  id: ID,
  label: LABEL,
  tier: TIER,
  claimedWeight: CLAIMED_WEIGHT,

  route(context = {}) {
    const { verseIR, options = {} } = context;
    const enabled = options.pixelBrainEnabled === true;
    const tokens = Array.isArray(verseIR?.tokens) ? verseIR.tokens : [];

    if (!enabled) {
      return {
        score: 0,
        shouldRun: false,
        reason: 'pixelbrain_disabled',
      };
    }

    if (tokens.length === 0) {
      return {
        score: 0,
        shouldRun: false,
        reason: 'no_tokens',
      };
    }

    const phoneticCoverage = tokens.filter((token) => Array.isArray(token?.phonemes) && token.phonemes.length > 0).length / tokens.length;
    return {
      score: roundTo(clamp01(0.35 + (phoneticCoverage * 0.65))),
      shouldRun: phoneticCoverage > 0,
      reason: phoneticCoverage > 0 ? 'pixelbrain_substrate_available' : 'no_phonetic_substrate',
    };
  },

  async analyze(context = {}) {
    const { verseIR, options = {} } = context;
    const tokens = Array.isArray(verseIR?.tokens) ? verseIR.tokens : [];
    if (tokens.length === 0) {
      return createAmplifierResult({
        id: ID,
        label: LABEL,
        tier: TIER,
        claimedWeight: CLAIMED_WEIGHT,
        commentary: 'PixelBrain found no tokens to map.',
      });
    }

    const tokenHints = Object.freeze(
      tokens
        .map((token) => buildPixelBrainTokenBytecode(token, verseIR))
        .filter(Boolean)
    );
    const coordinateGrid = mapToCoordinates(tokenHints, verseIR, options.pixelBrainCanvas);
    const paletteCatalog = buildPaletteCatalog(tokenHints);
    const coordinates = buildCoordinatePayload(coordinateGrid, tokenHints);
    const activeTokenCount = tokenHints.filter((hint) => String(hint?.effect || 'INERT') !== 'INERT').length;
    const activeCoverage = activeTokenCount / Math.max(1, tokenHints.length);
    const anchorDensity = activeTokenCount > 0
      ? tokenHints.filter((hint) => Boolean(hint?.isAnchor)).length / activeTokenCount
      : 0;
    const rareShare = tokenHints.filter((hint) => String(hint?.rarity) === 'RARE').length / Math.max(1, tokenHints.length);
    const inexplicableShare = tokenHints.filter((hint) => String(hint?.rarity) === 'INEXPLICABLE').length / Math.max(1, tokenHints.length);
    const spread = computeCoordinateSpread(coordinates, coordinateGrid.canvas);
    const paletteDiversity = paletteCatalog.length / Math.max(1, Math.min(tokenHints.length, 6));
    const signal = clamp01((activeCoverage * 0.35) + (paletteDiversity * 0.25) + (spread * 0.2) + (anchorDensity * 0.2));
    const semanticDepth = clamp01((spread * 0.45) + (anchorDensity * 0.3) + (paletteDiversity * 0.25));
    const raritySignal = clamp01((rareShare * 0.55) + (inexplicableShare * 0.45));
    const matches = buildMatches(tokenHints, coordinateGrid);
    const archetypes = buildArchetypes({
      coordinateGrid,
      paletteCount: paletteCatalog.length,
      anchorDensity,
      spread,
    });
    const diagnostics = [
      createAmplifierDiagnostic({
        severity: 'info',
        source: ID,
        message: `PixelBrain stabilized ${paletteCatalog.length} palettes across ${activeTokenCount} active tokens on a ${formatLabel(coordinateGrid?.dominantAxis, 'horizontal')} axis.`,
        metadata: {
          activeTokenCount,
          tokenCount: tokenHints.length,
          paletteCount: paletteCatalog.length,
          dominantAxis: coordinateGrid?.dominantAxis || 'horizontal',
          dominantSymmetry: coordinateGrid?.dominantSymmetry || 'none',
        },
      }),
    ];

    if ((tokenHints.length - activeTokenCount) > activeTokenCount) {
      diagnostics.push(createAmplifierDiagnostic({
        severity: 'warning',
        source: ID,
        message: 'PixelBrain encountered more inert tokens than active anchors, so the lattice may feel sparse.',
        metadata: {
          inertTokenCount: tokenHints.length - activeTokenCount,
          activeTokenCount,
        },
      }));
    }

    return Object.freeze({
      ...createAmplifierResult({
        id: ID,
        label: LABEL,
        tier: TIER,
        claimedWeight: CLAIMED_WEIGHT,
        signal,
        semanticDepth,
        raritySignal,
        matches,
        archetypes,
        diagnostics,
        commentary: `${formatLabel(coordinateGrid?.dominantAxis, 'Horizontal')} lattice resolved into ${paletteCatalog.length} palette nodes with ${Math.round(signal * 100)}% bridge confidence.`,
      }),
      payload: Object.freeze({
        version: VERSION,
        tokenCount: tokenHints.length,
        activeTokenCount,
        paletteCount: paletteCatalog.length,
        dominantAxis: coordinateGrid?.dominantAxis || 'horizontal',
        dominantSymmetry: coordinateGrid?.dominantSymmetry || 'none',
        canvas: Object.freeze({
          width: Number(coordinateGrid?.canvas?.width) || 160,
          height: Number(coordinateGrid?.canvas?.height) || 144,
          gridSize: Number(coordinateGrid?.canvas?.gridSize) || 1,
          goldenPoint: Object.freeze({
            x: Number(coordinateGrid?.canvas?.goldenPoint?.x) || 0,
            y: Number(coordinateGrid?.canvas?.goldenPoint?.y) || 0,
          }),
        }),
        palettes: paletteCatalog,
        coordinates,
      }),
    });
  },
};
