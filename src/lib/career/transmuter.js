/**
 * VerseIR Career Transmuter
 * 
 * Maps low-torque language to high-fidelity 'Aura' keywords.
 * Optimizes for ATS specifications by increasing linguistic torque.
 */

const TORQUE_MAP = {
  // WILL School (Leadership & Operations)
  "led": "Orchestrated",
  "managed": "Catalyzed",
  "helped": "Facilitated",
  "started": "Initiated",
  "improved": "Refined",
  "handled": "Navigated",
  
  // ALCHEMY School (Engineering & Technical)
  "built": "Architected",
  "coded": "Engineered",
  "fixed": "Optimized",
  "used": "Deployed",
  "tested": "Validated",
  "updated": "Transmuted",
  
  // PSYCHIC School (Design & UX)
  "designed": "Envisioned",
  "created": "Conceptualized",
  "made": "Forged",
  "drew": "Visualized",
  "thought": "Synthesized",
  
  // SONIC School (QA & Support)
  "checked": "Audited",
  "monitored": "Resonated",
  "supported": "Stabilized",
  "asked": "Queried",
  
  // VOID School (Security & Compliance)
  "secured": "Fortified",
  "blocked": "Nullified",
  "watched": "Surveilled",
  "followed": "Observed"
};

const SPECTRAL_ANCHORS = [
  "High-Fidelity",
  "Scalable Infrastructure",
  "Distributed Consensus",
  "Algorithmic Precision",
  "Linguistic Torque",
  "Syntactic Integrity",
  "Aura Calibration",
  "Resonance Optimization"
];

/**
 * Transmutes a raw string into an ATS-optimized 'Sigil' (Resume content).
 */
export function transmuteToSigil(text) {
  if (!text) return "";

  let optimized = text;

  // 1. Apply Torque Map (Word Replacement)
  Object.entries(TORQUE_MAP).forEach(([low, high]) => {
    const regex = new RegExp(`\\b${low}\\b`, 'gi');
    optimized = optimized.replace(regex, high);
  });

  // 2. Infuse Spectral Anchors (Keywords)
  // Logic: Append relevant anchors if the text is short, or sprinkle them in.
  if (optimized.length < 500) {
    const anchor = SPECTRAL_ANCHORS[Math.floor(Math.random() * SPECTRAL_ANCHORS.length)];
    optimized += `\n\nCORE RESONANCE: Specialized in ${anchor} and Systemic Calibration.`;
  }

  // 3. Clean up syntax
  optimized = optimized.replace(/\s+/g, ' ').trim();
  
  // Formatting into a pseudo-ATS structure
  return `--- SCHOLOMANCE CAREER SIGIL v11.3 ---\n\n${optimized}\n\n[BINDING COMPLETE]`;
}

/**
 * Generates a downloadable file blob.
 */
export function generateSigilFile(content, filename = "career_sigil.txt") {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
