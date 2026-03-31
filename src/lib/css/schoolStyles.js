/**
 * School Styles Generator
 * Generates CSS variables for school theming
 */

import { SCHOOLS } from '../../data/schools.js';

export function generateSchoolCSSVariables() {
  let css = ':root {\n';
  
  for (const [key, school] of Object.entries(SCHOOLS)) {
    const schoolKey = key.toLowerCase();
    css += `  --${schoolKey}-primary: ${school.colorHsl ? `hsl(${school.colorHsl.h}, ${school.colorHsl.s}%, ${school.colorHsl.l}%)` : '#808080'};\n`;
    css += `  --${schoolKey}-primary-glow: ${school.colorHsl ? `hsla(${school.colorHsl.h}, ${school.colorHsl.s}%, ${school.colorHsl.l}%, 0.3)` : 'rgba(128, 128, 128, 0.3)'};\n`;
  }
  
  css += '}\n';
  return css;
}

export function generateLockedSchoolStyles() {
  return '';
}
