import { SCHOOLS, generateSchoolColor } from "../../data/schools.js";

/**
 * Generate CSS variables for all schools
 * This allows dynamic school addition without CSS changes
 * @returns {string} CSS variable block
 */
export function generateSchoolCSSVariables() {
  const lines = [':root {'];
  const defaultSchool = SCHOOLS.SONIC;
  const defaultColor = generateSchoolColor(defaultSchool.id);

  // Generate color variables
  Object.entries(SCHOOLS).forEach(([id, school]) => {
    const color = generateSchoolColor(id);
    const colorLower = id.toLowerCase();

    lines.push(`  --school-${colorLower}: ${color};`);
    lines.push(`  --school-${colorLower}-hsl: ${school.colorHsl.h}, ${school.colorHsl.s}%, ${school.colorHsl.l}%;`);
    lines.push(`  --school-${colorLower}-glow: hsla(${school.colorHsl.h}, ${school.colorHsl.s}%, ${school.colorHsl.l}%, 0.4);`);
    lines.push(`  --school-${colorLower}-lock-bleed: hsla(${school.colorHsl.h}, ${school.colorHsl.s}%, ${school.colorHsl.l}%, 0.4);`);
  });

  // Generate angle variables
  Object.entries(SCHOOLS).forEach(([id, school]) => {
    lines.push(`  --school-${id.toLowerCase()}-angle: ${school.angle}deg;`);
  });

  // Active school defaults (SONIC)
  lines.push(`  --active-school-color: ${defaultColor};`);
  lines.push(`  --active-school-h: ${defaultSchool.colorHsl.h};`);
  lines.push(`  --active-school-s: ${defaultSchool.colorHsl.s}%;`);
  lines.push(`  --active-school-l: ${defaultSchool.colorHsl.l}%;`);
  lines.push(
    `  --active-school-glow: hsla(${defaultSchool.colorHsl.h}, ${defaultSchool.colorHsl.s}%, ${defaultSchool.colorHsl.l}%, 0.4);`
  );

  const defaultAtmosphere = defaultSchool.atmosphere || {
    auroraIntensity: 1,
    saturation: 100,
    vignetteStrength: 0.7,
    scanlineOpacity: 0,
  };
  lines.push(`  --active-aurora-intensity: ${defaultAtmosphere.auroraIntensity};`);
  lines.push(`  --active-saturation: ${defaultAtmosphere.saturation}%;`);
  lines.push(`  --active-vignette-strength: ${defaultAtmosphere.vignetteStrength};`);
  lines.push(`  --active-scanline-opacity: ${defaultAtmosphere.scanlineOpacity};`);

  lines.push('}');
  return lines.join('\n');
}

/**
 * Generate locked state styles
 * @returns {string} CSS for locked schools
 */
export function generateLockedSchoolStyles() {
  return `
.school--locked-distant {
  opacity: 0.2;
  filter: grayscale(1) blur(1px);
  cursor: not-allowed;
  position: relative;
}

.school--locked-distant::after {
  content: attr(data-glyph);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  opacity: 0.3;
  color: var(--lock-bleed-color, rgba(255, 255, 255, 0.3));
}

.school--locked-approaching {
  opacity: 0.4;
  filter: grayscale(0.7);
  cursor: not-allowed;
  position: relative;
}

.school--locked-approaching::after {
  content: attr(data-glyph);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  opacity: 0.6;
  color: var(--lock-bleed-color, rgba(255, 255, 255, 0.5));
  opacity: 0.7;
  transition: opacity 150ms ease;
}

.school--locked-approaching:hover::after {
  opacity: 1;
}

.school--locked-near {
  opacity: 0.65;
  filter: grayscale(0.3);
  cursor: pointer;
  position: relative;
}

.school--locked-near::before {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  background: var(--lock-bleed-color, rgba(255, 255, 255, 0.2));
  opacity: 0.15;
  transition: opacity 150ms ease;
}

.school--locked-near:hover::before {
  opacity: 0.3;
}

.school--locked-near::after {
  content: attr(data-glyph);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  opacity: 0.9;
  color: var(--lock-bleed-color, rgba(255, 255, 255, 0.9));
  text-shadow: 0 0 12px var(--lock-bleed-color, rgba(255, 255, 255, 0.6));
}

/* lock-pulse and lock-glow animations removed — replaced with hover glow */

.school-progress-ring {
  transition: stroke-dashoffset 0.3s ease;
}

/* Unlock animation */
@keyframes unlock-flash {
  0% { background-color: rgba(255, 255, 255, 0); }
  50% { background-color: rgba(255, 255, 255, 0.3); }
  100% { background-color: rgba(255, 255, 255, 0); }
}

.school-unlocked {
  animation: unlock-flash 0.8s ease-out;
}

/* Light mode — swap lock indicators to dark colors */
[data-theme="light"] .school--locked::after,
[data-theme="light"] .school--locked-approaching::after,
[data-theme="light"] .school--locked-near::after {
  color: var(--lock-bleed-color, rgba(0, 0, 0, 0.5));
  text-shadow: none;
}

[data-theme="light"] .school--locked-near::before {
  background: var(--lock-bleed-color, rgba(0, 0, 0, 0.1));
}

@keyframes unlock-flash-light {
  0% { background-color: rgba(0, 0, 0, 0); }
  50% { background-color: rgba(0, 0, 0, 0.08); }
  100% { background-color: rgba(0, 0, 0, 0); }
}

[data-theme="light"] .school-unlocked {
  animation: unlock-flash-light 0.8s ease-out;
}
`;
}
