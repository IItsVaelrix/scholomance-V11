export const VERSEIR_AMPLIFIER_VERSION = '1.0.0';
export const VERSEIR_AMPLIFIER_NOVELTY_BUDGET = 0.15;

const TOKEN_NORMALIZE_REGEX = /[^a-z0-9'-]/g;

export function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function roundTo(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

function normalizeToken(token) {
  return String(token || '')
    .trim()
    .toLowerCase()
    .replace(TOKEN_NORMALIZE_REGEX, '')
    .replace(/^['-]+|['-]+$/g, '');
}

export function collectVerseIRTokenStats(verseIR) {
  const tokens = Array.isArray(verseIR?.tokens) ? verseIR.tokens : [];
  const tokenEntries = [];
  const tokenCounts = new Map();

  for (const token of tokens) {
    const normalized = normalizeToken(token?.normalized || token?.text);
    if (!normalized) continue;
    const lineIndex = Number.isInteger(token?.lineIndex) ? token.lineIndex : 0;
    tokenEntries.push({
      normalized,
      lineIndex,
    });
    tokenCounts.set(normalized, (tokenCounts.get(normalized) || 0) + 1);
  }

  return {
    tokenEntries,
    tokenCounts,
    totalTokens: tokenEntries.length,
    lineCount: Array.isArray(verseIR?.lines) && verseIR.lines.length > 0
      ? verseIR.lines.length
      : Math.max(1, new Set(tokenEntries.map((entry) => entry.lineIndex)).size),
  };
}

function buildMatchRecords(domains, tokenEntries, tokenCounts, tierResonance, lineCount) {
  const matches = [];
  const totalTokens = Math.max(1, tokenEntries.length);

  for (const domain of domains) {
    const lexemes = Array.isArray(domain?.lexemes)
      ? [...new Set(domain.lexemes.map((lexeme) => normalizeToken(lexeme)).filter(Boolean))]
      : [];
    if (lexemes.length === 0) continue;

    const matchedTokens = lexemes.filter((lexeme) => tokenCounts.has(lexeme));
    if (matchedTokens.length === 0) continue;

    let hits = 0;
    const matchedLineIndexes = new Set();
    for (const entry of tokenEntries) {
      if (!matchedTokens.includes(entry.normalized)) continue;
      hits += 1;
      matchedLineIndexes.add(entry.lineIndex);
    }

    const coverage = matchedTokens.length / lexemes.length;
    const density = clamp01(hits / Math.max(2, totalTokens * 0.18));
    const lineSpread = clamp01(matchedLineIndexes.size / Math.max(1, lineCount));
    const score = clamp01(((coverage * 0.45) + (density * 0.35) + (lineSpread * 0.20)) * tierResonance);

    matches.push(Object.freeze({
      id: String(domain.id || ''),
      label: String(domain.label || domain.id || ''),
      hits,
      score: roundTo(score),
      coverage: roundTo(coverage),
      lineSpread: roundTo(lineSpread),
      tokens: Object.freeze([...matchedTokens].sort((left, right) => {
        const leftCount = tokenCounts.get(left) || 0;
        const rightCount = tokenCounts.get(right) || 0;
        if (rightCount !== leftCount) return rightCount - leftCount;
        return left.localeCompare(right);
      })),
      archetypes: Object.freeze(
        Array.isArray(domain?.archetypes)
          ? domain.archetypes
            .map((archetype) => ({
              id: String(archetype?.id || ''),
              label: String(archetype?.label || archetype?.id || ''),
              weight: clamp01(archetype?.weight ?? 0.5),
            }))
            .filter((archetype) => archetype.id && archetype.label)
          : []
      ),
    }));
  }

  return matches.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.hits !== left.hits) return right.hits - left.hits;
    return left.label.localeCompare(right.label);
  });
}

function buildArchetypeScores(matches) {
  const archetypes = new Map();

  for (const match of matches) {
    const resonance = clamp01(match.score);
    for (const archetype of match.archetypes) {
      if (!archetype?.id || !archetype?.label) continue;
      const existing = archetypes.get(archetype.id) || {
        id: archetype.id,
        label: archetype.label,
        score: 0,
      };
      existing.score += resonance * clamp01(archetype.weight);
      archetypes.set(archetype.id, existing);
    }
  }

  return Object.freeze(
    [...archetypes.values()]
      .map((archetype) => ({
        ...archetype,
        score: roundTo(clamp01(archetype.score)),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) return right.score - left.score;
        return left.label.localeCompare(right.label);
      })
      .slice(0, 4)
      .map((archetype) => Object.freeze(archetype))
  );
}

function buildCommentary(label, tierLabel, matches, topArchetype) {
  if (matches.length === 0) {
    return `${label} found no living syntax to amplify.`;
  }

  const topMatch = matches[0];
  const tokenList = topMatch.tokens.slice(0, 3).join(', ');
  if (topArchetype?.label) {
    return `${label} traces ${tierLabel.toLowerCase()} matter through ${topMatch.label} and leans toward ${topArchetype.label}. (${tokenList})`;
  }
  return `${label} traces ${tierLabel.toLowerCase()} matter through ${topMatch.label}. (${tokenList})`;
}

function buildDiagnostics(matches, tierLabel) {
  return Object.freeze(
    matches
      .slice(0, 4)
      .map((match) => Object.freeze({
        start: 0,
        end: 0,
        severity: tierLabel === 'INEXPLICABLE'
          ? 'success'
          : tierLabel === 'RARE'
            ? 'info'
            : 'warning',
        message: `${tierLabel} resonance detected in ${match.label}.`,
        metadata: {
          words: [...match.tokens],
          tier: tierLabel,
          domain: match.id,
          hits: match.hits,
          score: match.score,
        },
      }))
  );
}

export function createTierAmplifier({
  id,
  label,
  tier,
  domains,
  claimedWeight = 0.05,
  tierResonance = 1,
} = {}) {
  const normalizedId = String(id || '').trim();
  const normalizedLabel = String(label || normalizedId).trim();
  const normalizedTier = String(tier || '').trim().toUpperCase();
  const safeClaimedWeight = clamp01(Number(claimedWeight) || 0.05);
  const safeTierResonance = clamp01(Number(tierResonance) || 1);

  return Object.freeze({
    id: normalizedId,
    label: normalizedLabel,
    tier: normalizedTier,
    claimedWeight: roundTo(safeClaimedWeight),
    async analyze(context = {}) {
      const { tokenEntries, tokenCounts, lineCount } = collectVerseIRTokenStats(context?.verseIR);
      const matches = buildMatchRecords(
        Array.isArray(domains) ? domains : [],
        tokenEntries,
        tokenCounts,
        safeTierResonance,
        lineCount
      );

      if (matches.length === 0) {
        return Object.freeze({
          id: normalizedId,
          label: normalizedLabel,
          tier: normalizedTier,
          claimedWeight: roundTo(safeClaimedWeight),
          signal: 0,
          semanticDepth: 0,
          raritySignal: 0,
          matches: Object.freeze([]),
          archetypes: Object.freeze([]),
          diagnostics: Object.freeze([]),
          commentary: `${normalizedLabel} found no viable signal.`,
        });
      }

      const topMatches = matches.slice(0, 3);
      const averageScore = topMatches.reduce((sum, match) => sum + match.score, 0) / topMatches.length;
      const averageCoverage = topMatches.reduce((sum, match) => sum + match.coverage, 0) / topMatches.length;
      const averageLineSpread = topMatches.reduce((sum, match) => sum + match.lineSpread, 0) / topMatches.length;
      const archetypes = buildArchetypeScores(topMatches);
      const archetypeLead = archetypes[0]?.score || 0;
      const semanticDepth = clamp01((averageScore * 0.6) + (averageCoverage * 0.25) + (averageLineSpread * 0.15));
      const raritySignal = clamp01((safeTierResonance * 0.4) + (averageScore * 0.35) + (averageCoverage * 0.25));
      const signal = clamp01((semanticDepth * 0.45) + (raritySignal * 0.25) + (archetypeLead * 0.30));

      return Object.freeze({
        id: normalizedId,
        label: normalizedLabel,
        tier: normalizedTier,
        claimedWeight: roundTo(safeClaimedWeight),
        signal: roundTo(signal),
        semanticDepth: roundTo(semanticDepth),
        raritySignal: roundTo(raritySignal),
        matches: Object.freeze(topMatches),
        archetypes,
        diagnostics: buildDiagnostics(topMatches, normalizedTier),
        commentary: buildCommentary(normalizedLabel, normalizedTier, topMatches, archetypes[0] || null),
      });
    },
  });
}
