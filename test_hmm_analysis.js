
import { analyzeText } from "./codex/core/analysis.pipeline.js";
import { buildSyntaxLayer } from "./src/lib/syntax.layer.js";

// 1. Read first stanza from DATA-SET 1.md
const text = `The pen obake
Lyrical hokage
Mystical flow Java, you're sipping the whole latte
Physical growth? Grande`;

console.log("--- 🧠 SCHOLOMANCE HMM CONTEXTUAL ANALYSIS TEST ---");
console.log("Input Stanza:");
console.log(text);
console.log("\n--- STAGE 1: Linguistic Pipeline (analyzeText) ---");

const doc = analyzeText(text);

console.log("\n--- STAGE 2: Syntax Layer (HMM Contextual Prediction) ---");
const syntaxLayer = buildSyntaxLayer(doc);

// Output the judgment for each token
syntaxLayer.tokens.forEach((token, idx) => {
    console.log(`[${idx}] Word: "${token.word.padEnd(10)}" | Role: ${token.role.padEnd(10)} | Policy: ${token.rhymePolicy.padEnd(10)} | Reasons: ${token.reasons.join(", ")}`);
});

console.log("\n--- SUMMARY ---");
console.log(`Total Tokens: ${syntaxLayer.syntaxSummary.tokenCount}`);
console.log(`Content Words: ${syntaxLayer.syntaxSummary.roleCounts.content}`);
console.log(`Function Words: ${syntaxLayer.syntaxSummary.roleCounts.function}`);
console.log("--- TEST COMPLETE ---");
