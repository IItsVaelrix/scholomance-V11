import {
  COMBAT_ARENA_SCHOOL,
  COMBAT_SCHOOLS,
  clamp01,
  getCombatRarityByScore,
  getCounterSchool,
  getIntelligenceSignal,
  getOpponentMemoryWindow,
  getSchoolEffectiveness,
} from './combat.balance.js';
import { buildCombatProfile, tokenizeCombatWords } from './combat.profile.js';

const SCHOOL_DISPLAY_NAMES = Object.freeze({
  SONIC: 'Sonic Thaumaturgy',
  PSYCHIC: 'Psychic Schism',
  VOID: 'The Void',
  ALCHEMY: 'Verbal Alchemy',
  WILL: 'Willpower Surge',
});

const OPPONENT_BANK = Object.freeze({
  SONIC: Object.freeze({
    names: Object.freeze(['Resonant Shade', 'Echo Revenant', 'The Phonocrat']),
    subtitles: Object.freeze(['Harmonic Predator', 'Breaker of Choruses', 'The Resonant Knife']),
    flavor: Object.freeze([
      'harmonics coil into a blade of living pressure',
      'your rhythm snaps inside a chamber of feedback',
      'resonance turns the chamber itself against you',
      'the room answers me in a wall of sharpened vowels',
    ]),
  }),
  PSYCHIC: Object.freeze({
    names: Object.freeze(['Schism Oracle', 'Mnemonic Hound', 'The Fractured Mind']),
    subtitles: Object.freeze(['Reader of Fault Lines', 'Arbiter of Thought', 'The Split Witness']),
    flavor: Object.freeze([
      'the seam between meanings opens under your feet',
      'your intent divides before the sentence can finish',
      'my thought enters the line and breaks its spine',
      'the counter-idea blooms before your syntax lands',
    ]),
  }),
  VOID: Object.freeze({
    names: Object.freeze(['The Cryptonym', 'Null Scribe', 'Hollow Tongue']),
    subtitles: Object.freeze(['Consumer of Syntax', 'Void Linguist', 'The Wordless One']),
    flavor: Object.freeze([
      'the null between syllables widens and drinks your force',
      'silence folds inward and leaves no surface to strike',
      'the anti-word hollows the meaning out of your breath',
      'void grammar strips the lattice from the line',
    ]),
  }),
  ALCHEMY: Object.freeze({
    names: Object.freeze(['Mercurial Apostle', 'Verbalith', 'The Brass Grammarian']),
    subtitles: Object.freeze(['Author of Revisions', 'Transmuter of Terrain', 'The Tongue of Metals']),
    flavor: Object.freeze([
      'the ground rewrites itself beneath your meter',
      'mercurial grammar turns impact into consequence',
      'the sentence changes state and the field obeys',
      'I distill your momentum into colder matter',
    ]),
  }),
  WILL: Object.freeze({
    names: Object.freeze(['Iron Liturgist', 'Crown of Intent', 'The Volitional Saint']),
    subtitles: Object.freeze(['Bearer of Imperative Fire', 'The Unbent Word', 'Judge of Resolve']),
    flavor: Object.freeze([
      'my will enters the line and reality consents',
      'your language buckles where resolve becomes law',
      'force gathers in the grammar like a drawn spear',
      'the decree lands before the echo can protest',
    ]),
  }),
});

const COUNTER_TEMPLATES = Object.freeze([
  (token) => `I turn ${token} back through your own line`,
  (token) => `your ${token} fractures before it can settle`,
  (token) => `${token} becomes the hinge of your undoing`,
  (token) => `I answer ${token} with a harder grammar`,
  (token) => `the name ${token} collapses under counter-pressure`,
]);

function stableHash(value) {
  const text = String(value || '');
  let hash = 5381;
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash) + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function createSeededRandom(seed) {
  let state = (Math.abs(Number(seed) || 1) % 2147483646) + 1;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function pickOne(random, items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  return items[Math.floor(random() * items.length)];
}

function shuffle(random, items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function tokenizeHistoryLines(history) {
  if (!Array.isArray(history)) return [];

  return history
    .flatMap((entry) => {
      if (!entry) return [];
      if (Array.isArray(entry.lines) && entry.lines.length > 0) {
        return entry.lines;
      }
      if (typeof entry.text === 'string') {
        return entry.text.split(/\n+/g);
      }
      return [];
    })
    .map((line) => String(line || '').trim())
    .filter(Boolean);
}

function collectMemoryLines(history, intelligence) {
  const lines = tokenizeHistoryLines(history);
  const memoryWindow = getOpponentMemoryWindow(intelligence);
  if (!Number.isFinite(memoryWindow)) {
    return lines;
  }
  return memoryWindow <= 1 ? lines.slice(-1) : lines.slice(-memoryWindow);
}

function collectFocusTokens(memoryLines, intelligence, random) {
  const weighted = [];

  for (const line of memoryLines) {
    const tokens = tokenizeCombatWords(line)
      .filter((token) => token.length >= 4)
      .map((token) => ({
        token,
        weight: token.length + (/[xzvqk]/i.test(token) ? 2 : 0),
      }));
    weighted.push(...tokens);
  }

  if (weighted.length === 0) {
    return [];
  }

  weighted.sort((left, right) => {
    if (right.weight !== left.weight) return right.weight - left.weight;
    return left.token.localeCompare(right.token);
  });

  const maxTokens = intelligence >= 12 ? 4 : intelligence >= 6 ? 3 : 2;
  const selected = [];
  const seen = new Set();

  const rankedPool = intelligence >= 6
    ? weighted
    : shuffle(random, weighted);

  for (const entry of rankedPool) {
    if (selected.length >= maxTokens) break;
    if (seen.has(entry.token)) continue;
    seen.add(entry.token);
    selected.push(entry.token);
  }

  return selected;
}

function buildCounterFragments(random, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return [];
  }

  return tokens.map((token) => {
    const template = pickOne(random, COUNTER_TEMPLATES);
    return typeof template === 'function' ? template(token) : String(token);
  });
}

function getAttackSchool(opponent, playerSchool, intelligence) {
  if (Number(intelligence) >= 6) {
    return getCounterSchool(playerSchool, opponent?.school);
  }
  return COMBAT_SCHOOLS.includes(opponent?.school) ? opponent.school : COMBAT_ARENA_SCHOOL;
}

function buildSyntheticTraces({
  intelligence,
  memoryLineCount,
  attackSchool,
  targetSchool,
  rarity,
}) {
  const intSignal = getIntelligenceSignal(intelligence);
  const schoolEffect = getSchoolEffectiveness(attackSchool, targetSchool);

  return [
    {
      heuristic: 'counter_intelligence',
      rawScore: intSignal,
      weight: 1,
      contribution: Number((intSignal * 12).toFixed(2)),
      explanation: `INT ${intelligence} drives a ${memoryLineCount}-line counter response.`,
    },
    {
      heuristic: 'school_counter',
      rawScore: clamp01((schoolEffect - 0.82) / 0.43),
      weight: 1,
      contribution: Number((((schoolEffect - 1) * 18) + 4).toFixed(2)),
      explanation: `${attackSchool} presses against ${targetSchool} through the affinity table.`,
    },
    {
      heuristic: 'rarity_pressure',
      rawScore: clamp01(rarity?.score ?? 0),
      weight: 1,
      contribution: Number((((rarity?.totalMultiplier ?? 1) - 1) * 10).toFixed(2)),
      explanation: `${rarity?.label || 'Common'} wording sharpens the counter-verse.`,
    },
  ];
}

export function createCombatOpponent(options = {}) {
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const school = COMBAT_SCHOOLS.includes(options.school)
    ? options.school
    : pickOne(random, COMBAT_SCHOOLS);
  const bank = OPPONENT_BANK[school] || OPPONENT_BANK.VOID;
  const intelligence = Number.isFinite(Number(options.int))
    ? Number(options.int)
    : (4 + Math.floor(random() * 17));

  return {
    name: String(options.name || pickOne(random, bank.names) || 'The Cryptonym'),
    subtitle: String(options.subtitle || pickOne(random, bank.subtitles) || 'Counter-Sorcerer'),
    school,
    schoolName: SCHOOL_DISPLAY_NAMES[school] || school,
    int: intelligence,
  };
}

export function generateOpponentSpell({
  opponent,
  playerHistory = [],
  playerContext = null,
  turnNumber = 1,
  arenaSchool = COMBAT_ARENA_SCHOOL,
} = {}) {
  const safeOpponent = opponent || createCombatOpponent();
  const memoryLines = collectMemoryLines(playerHistory, safeOpponent.int);
  const playerSchool = playerContext?.school || COMBAT_ARENA_SCHOOL;
  const attackSchool = getAttackSchool(safeOpponent, playerSchool, safeOpponent.int);
  const seed = stableHash([
    safeOpponent.name,
    safeOpponent.school,
    safeOpponent.int,
    attackSchool,
    playerSchool,
    turnNumber,
    ...memoryLines,
  ].join('|'));
  const random = createSeededRandom(seed);
  const bank = OPPONENT_BANK[attackSchool] || OPPONENT_BANK.VOID;
  const focusTokens = collectFocusTokens(memoryLines, safeOpponent.int, random);
  const directFragments = buildCounterFragments(random, focusTokens);
  const flavorCount = safeOpponent.int >= 12 ? 2 : 1;
  const flavorFragments = Array.from({ length: flavorCount }, () => pickOne(random, bank.flavor)).filter(Boolean);
  const fragmentBudget = safeOpponent.int >= 12 ? 3 : 2;
  const fragments = shuffle(random, [...directFragments, ...flavorFragments]).slice(0, fragmentBudget);

  const rawSpell = fragments.length > 0
    ? fragments.join(', ')
    : String(pickOne(random, bank.flavor) || 'The counter-verse arrives without warning');
  const spell = `${rawSpell.charAt(0).toUpperCase()}${rawSpell.slice(1).trim().replace(/[,. ]+$/, '')}.`;

  const intSignal = getIntelligenceSignal(safeOpponent.int);
  const schoolEffect = getSchoolEffectiveness(attackSchool, playerSchool);
  const memorySignal = memoryLines.length > 0
    ? clamp01(memoryLines.length / (Number.isFinite(getOpponentMemoryWindow(safeOpponent.int)) ? 8 : 12))
    : 0;
  const tokenSignal = focusTokens.length > 0 ? clamp01(focusTokens.length / 4) : 0;
  const syntheticRarityScore = clamp01((intSignal * 0.45) + (memorySignal * 0.2) + (tokenSignal * 0.15) + (random() * 0.2));
  const rarity = getCombatRarityByScore(syntheticRarityScore);
  const syntheticTotalScore = Math.round(
    30
    + (intSignal * 24)
    + (memorySignal * 12)
    + (tokenSignal * 8)
    + ((schoolEffect - 1) * 24)
  );
  const profile = buildCombatProfile({
    text: spell,
    scoreData: {
      totalScore: syntheticTotalScore,
      traces: [],
    },
    arenaSchool,
    fallbackSchool: attackSchool,
  });
  const damage = Math.max(
    24,
    Math.round(
      (28 + (safeOpponent.int * 3.5))
      * schoolEffect
      * (1 + (memorySignal * 0.12))
      * (1 + (tokenSignal * 0.08))
      * Math.min(1.38, 0.86 + ((profile.rarity.totalMultiplier + rarity.totalMultiplier) * 0.12))
    )
  );
  const traces = buildSyntheticTraces({
    intelligence: safeOpponent.int,
    memoryLineCount: memoryLines.length,
    attackSchool,
    targetSchool: playerSchool,
    rarity: {
      ...profile.rarity,
      score: syntheticRarityScore,
    },
  });

  return {
    spell,
    damage,
    school: attackSchool,
    traces,
    explainTrace: traces,
    rarity: profile.rarity,
    schoolAffinityMultiplier: schoolEffect,
    memoryLinesUsed: memoryLines.length,
    counterTokens: focusTokens,
  };
}
