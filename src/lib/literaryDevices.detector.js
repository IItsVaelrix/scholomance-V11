/**
 * Literary Device Detection Engine
 * Algorithmically detects common poetic and literary devices in text.
 */

export const LITERARY_DEVICES = {
  ALLITERATION: {
    name: "Alliteration",
    definition: "Repetition of initial consonant sounds in neighboring words.",
  },
  ANAPHORA: {
    name: "Anaphora",
    definition: "Repetition of a word or phrase at the beginning of successive lines.",
  },
  ENJAMBMENT: {
    name: "Enjambment",
    definition: "Continuation of a sentence beyond the end of a line break.",
  },
  REPETITION: {
    name: "Repetition",
    definition: "Deliberate reuse of words or phrases for rhythmic or thematic emphasis.",
  },
  INTERNAL_RHYME: {
    name: "Internal Rhyme",
    definition: "Rhyming words placed within the same line rather than at line endings.",
  },
  EPISTROPHE: {
    name: "Epistrophe",
    definition: "Repetition of a word or phrase at the end of successive lines.",
  },
  SIMILE: {
    name: "Simile",
    definition: "A comparison using 'like' or 'as'.",
  },
  METAPHOR: {
    name: "Metaphor",
    definition: "A direct comparison between two unrelated things without using 'like' or 'as'.",
  },
};

// Common stop words to ignore in repetition analysis
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'i', 'me', 'my', 'we', 'us', 'our', 'you', 'your',
  'he', 'him', 'his', 'she', 'her', 'it', 'its', 'they', 'them', 'their',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'has', 'have', 'had', 'do', 'does', 'did',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  'in', 'on', 'at', 'to', 'for', 'of', 'by', 'from', 'up',
  'with', 'as', 'into', 'but', 'or', 'and', 'so', 'if',
  'not', 'no', 'nor', 'that', 'this', 'than', 'just', 'very', 'too', 'also',
]);

/**
 * Detects alliteration: consecutive words starting with the same consonant sound.
 */
function detectAlliteration(lines) {
  let count = 0;
  const examples = [];

  for (const line of lines) {
    const words = line.match(/\b[A-Za-z]+/g) || [];
    let streak = 1;
    for (let i = 1; i < words.length; i++) {
      const c1 = words[i - 1][0].toLowerCase();
      const c2 = words[i][0].toLowerCase();
      if (c1 === c2 && !'aeiou'.includes(c1)) {
        streak++;
        if (streak === 2) {
          count++;
          if (examples.length < 2) {
            // Collect the full alliterative group
            const start = i - 1;
            let end = i;
            while (end + 1 < words.length && words[end + 1][0].toLowerCase() === c1) {
              end++;
            }
            examples.push(words.slice(start, end + 1).join(' '));
          }
        }
      } else {
        streak = 1;
      }
    }
  }

  return { count, examples };
}

/**
 * Detects anaphora: repeated first words across multiple lines.
 */
function detectAnaphora(lines) {
  const beginnings = new Map();

  for (const line of lines) {
    const firstWord = line.trim().match(/^[A-Za-z]+/);
    if (firstWord) {
      const word = firstWord[0].toLowerCase();
      if (!STOP_WORDS.has(word) || word === 'i') {
        beginnings.set(word, (beginnings.get(word) || 0) + 1);
      }
    }
  }

  const repeated = Array.from(beginnings.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const count = repeated.reduce((sum, [, c]) => sum + c - 1, 0); // -1 per group (first isn't a repeat)
  const examples = repeated.slice(0, 2).map(([word, c]) => `"${word}" starts ${c} lines`);

  return { count, examples };
}

/**
 * Detects epistrophe: repeated last words across multiple lines.
 */
function detectEpistrophe(lines) {
  const endings = new Map();

  for (const line of lines) {
    const lastWord = line.trim().match(/[A-Za-z]+$/);
    if (lastWord) {
      const word = lastWord[0].toLowerCase();
      if (!STOP_WORDS.has(word)) {
        endings.set(word, (endings.get(word) || 0) + 1);
      }
    }
  }

  const repeated = Array.from(endings.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1]);

  const count = repeated.reduce((sum, [, c]) => sum + c - 1, 0);
  const examples = repeated.slice(0, 2).map(([word, c]) => `"${word}" ends ${c} lines`);

  return { count, examples };
}

/**
 * Detects enjambment: lines that don't end with punctuation
 * (suggesting the thought continues to the next line).
 */
function detectEnjambment(lines) {
  let count = 0;
  const examples = [];

  for (let i = 0; i < lines.length - 1; i++) {
    const trimmed = lines[i].trim();
    if (trimmed && !/[.!?,;:\-—]$/.test(trimmed)) {
      count++;
      if (examples.length < 2) {
        const preview = trimmed.length > 30 ? '...' + trimmed.slice(-30) : trimmed;
        examples.push(`L${i + 1}: "${preview}" →`);
      }
    }
  }

  return { count, examples };
}

/**
 * Detects word/phrase repetition (excluding stop words).
 */
function detectRepetition(text) {
  const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
  const freq = new Map();

  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  const repeated = Array.from(freq.entries())
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1]);

  const count = repeated.reduce((sum, [, c]) => sum + c - 2, 0); // excess beyond 2
  const examples = repeated.slice(0, 2).map(([word, c]) => `"${word}" (${c}×)`);

  return { count, examples };
}

/**
 * Detects similes: comparisons using "like" or "as".
 */
function detectSimile(text) {
  // Pattern 1: "as [adj] as [noun]"
  // Pattern 2: "[noun/verb] like [a/the] [noun]"
  const simileRegex = /\b(as\s+\w+\s+as\s+[\w\s]+|[\w']+\s+like\s+(a\s+|the\s+)?[\w\s]+)\b/gi;
  const matches = text.match(simileRegex) || [];
  
  return {
    count: matches.length,
    examples: matches.slice(0, 2).map(m => `"${m.trim()}"`)
  };
}

/**
 * Detects basic metaphors: "[noun] is/are/was/were [noun/adj]".
 * This is a heuristic approximation.
 */
function detectMetaphor(text) {
  // Avoid common non-metaphorical "is" uses
  const metaphorRegex = /\b(I\s+am|life\s+is|love\s+is|hope\s+is|death\s+is|truth\s+is|[\w']+\s+(is|are|was|were)\s+(a\s+|the\s+)?(dream|fire|ocean|storm|mountain|shadow|mirror|thief|ghost|prison|garden|beast|star|labyrinth))\b/gi;
  const matches = text.match(metaphorRegex) || [];
  
  return {
    count: matches.length,
    examples: matches.slice(0, 2).map(m => `"${m.trim()}"`)
  };
}

/**
 * Master analysis: detect all literary devices and return top 3 by prevalence.
 * @param {string} text - Full document text.
 * @returns {Array<{ id: string, name: string, definition: string, count: number, examples: string[] }>}
 */
export function analyzeLiteraryDevices(text) {
  if (!text || !text.trim()) return [];

  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length === 0) return [];

  const results = [
    { id: 'ALLITERATION', ...detectAlliteration(lines) },
    { id: 'ANAPHORA', ...detectAnaphora(lines) },
    { id: 'EPISTROPHE', ...detectEpistrophe(lines) },
    { id: 'ENJAMBMENT', ...detectEnjambment(lines) },
    { id: 'REPETITION', ...detectRepetition(text) },
    { id: 'SIMILE', ...detectSimile(text) },
    { id: 'METAPHOR', ...detectMetaphor(text) },
  ].filter((r) => r.count > 0);

  // Sort by count descending, take top 3
  results.sort((a, b) => b.count - a.count);

  return results.slice(0, 3).map((r) => ({
    id: r.id,
    name: LITERARY_DEVICES[r.id].name,
    definition: LITERARY_DEVICES[r.id].definition,
    count: r.count,
    examples: r.examples,
  }));
}

/**
 * Basic emotion/tone detection via keyword matching.
 * Returns the dominant emotion label.
 * @param {string} text
 * @returns {string}
 */
export function detectEmotion(text) {
  if (!text) return 'Neutral';

  const lower = text.toLowerCase();

  const emotions = {
    Joy: ['joy', 'happy', 'happiness', 'delight', 'love', 'smile', 'laugh', 'bright', 'light', 'sun', 'warm', 'hope', 'free', 'dream', 'bliss', 'glory', 'paradise'],
    Melancholy: ['sad', 'sorrow', 'grief', 'tears', 'cry', 'loss', 'dark', 'shadow', 'pain', 'alone', 'lonely', 'fade', 'gone', 'empty', 'cold', 'rain', 'broken', 'fall', 'drown'],
    Rage: ['anger', 'rage', 'fury', 'hate', 'fight', 'battle', 'war', 'burn', 'fire', 'destroy', 'kill', 'blood', 'vengeance', 'wrath', 'strike'],
    Defiance: ['never', 'rise', 'stand', 'fight', 'resist', 'refuse', 'defy', 'break', 'free', 'unstoppable', 'fearless', 'power', 'strength', 'conquer'],
    Wonder: ['wonder', 'awe', 'mystery', 'magic', 'dream', 'beauty', 'stars', 'infinite', 'cosmos', 'transcend', 'ethereal', 'divine', 'sacred'],
    Dread: ['fear', 'afraid', 'terror', 'dread', 'anxious', 'horror', 'doom', 'nightmare', 'haunt', 'creep', 'grave', 'death', 'void'],
  };

  const scores = {};
  for (const [emotion, keywords] of Object.entries(emotions)) {
    scores[emotion] = keywords.reduce((score, kw) => {
      // Count occurrences, not just presence
      const regex = new RegExp(`\\b${kw}\\b`, 'gi');
      const matches = lower.match(regex);
      return score + (matches ? matches.length : 0);
    }, 0);
  }

  const sorted = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0);

  if (sorted.length === 0) return 'Neutral';
  return sorted[0][0];
}
