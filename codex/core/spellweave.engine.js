/**
 * Spellweave Engine - The Syntactic Bridge
 * 
 * Resolves the relationship between the Verse (energy) and the Weave (form).
 */

import { lookupSemanticToken, INTENTS } from './semantics.registry';

/**
 * @typedef {Object} BridgeResult
 * @property {string} intent - The resolved action intent.
 * @property {string} school - The resolved school.
 * @property {number} resonance - Magnitude multiplier.
 * @property {string[]} predicates - Extracted predicates.
 * @property {string[]} objects - Extracted objects.
 * @property {boolean} collapsed - Whether the spell collapsed due to poor syntax.
 */

/**
 * Parses the Spellweave for semantic tokens.
 * @param {string} weave 
 * @returns {Object}
 */
export function parseWeave(weave) {
  const tokens = weave.toUpperCase().match(/\b(\w+)\b/g) || [];
  const predicates = [];
  const objects = [];

  tokens.forEach(token => {
    const semantic = lookupSemanticToken(token);
    if (semantic?.type === "PREDICATE") predicates.push(token);
    if (semantic?.type === "OBJECT") objects.push(token);
  });

  return { predicates, objects };
}

/**
 * Calculates the Syntactic Bridge between Verse and Weave.
 * @param {Object} params
 * @param {string} params.verse - The 300-char Verse.
 * @param {string} params.weave - The 60-100 char Spellweave.
 * @param {string} params.dominantSchool - The school identified by the Verse's vowel gravity.
 * @returns {BridgeResult}
 */
export function calculateSyntacticBridge({ verse, weave, dominantSchool }) {
  const { predicates, objects } = parseWeave(weave);
  
  // ANTI-EXPLOIT: Syntactic Collapse
  // If more than 3 predicates are used without enough connecting text, the spell collapses.
  const collapsed = predicates.length > 3 || (predicates.length === 0 && objects.length === 0);
  
  if (collapsed) {
    return {
      intent: INTENTS.UTILITY,
      school: dominantSchool,
      resonance: 0.1,
      predicates,
      objects,
      collapsed: true
    };
  }

  // Determine primary intent from the first predicate
  const primaryPredicate = predicates[0] || "STRIKE";
  const predicateData = lookupSemanticToken(primaryPredicate);
  
  // Calculate Resonance
  let resonance = 1.0;

  // 1. School Alignment: Does the Weave action match the Verse's school?
  if (predicateData.school === dominantSchool) {
    resonance += 0.2;
  } else {
    resonance -= 0.1; // Minor friction for mismatch
  }

  // 2. Semantic Alignment: Does the Verse contain synonyms or related concepts?
  // (Simplified for now: check if Weave objects appear in the Verse)
  objects.forEach(obj => {
    if (verse.toUpperCase().includes(obj)) {
      resonance += 0.15;
    }
  });

  // 3. Complexity Bonus: More than one unique object increases resonance but adds "weight"
  if (objects.length > 1) {
    resonance += 0.1;
  }

  return {
    intent: predicateData.intent,
    school: predicateData.school,
    resonance: Math.max(0.1, resonance),
    predicates,
    objects,
    collapsed: false
  };
}
