/**
 * PIXEL MICROPROCESSOR: Chroma Quantizer
 * 
 * Maps raw image colors to the nearest Scholomance School palettes.
 * Synchronizes external visual data with world-law color constraints.
 */

import { SCHOOLS } from '../../../../src/data/schools.js';
import { clamp01, roundTo } from '../../pixelbrain/shared.js';

/**
 * Quantize colors to nearest school affinity
 * @param {Object} payload - { colors, schoolId }
 * @returns {Object} { quantizedColors }
 */
export function quantizeChroma({ colors, schoolId }) {
  const targetSchool = SCHOOLS[String(schoolId || 'VOID').toUpperCase()] || SCHOOLS.VOID;
  const schoolHue = targetSchool.colorHsl?.h || 0;
  
  const quantized = (Array.isArray(colors) ? colors : []).map(color => {
    const hex = typeof color === 'string' ? color : color.hex;
    const rgb = hexToRgb(hex);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    
    // Shift hue towards school hue if school is specified
    const finalHue = schoolId ? lerpHue(hsl.h, schoolHue, 0.4) : hsl.h;
    
    return {
      original: hex,
      quantized: hslToHex(finalHue, hsl.s, hsl.l),
      schoolAffinity: schoolId || 'NONE'
    };
  });

  return { quantizedColors: quantized };
}

function hexToRgb(hex) {
  const value = String(hex || '').trim().replace('#', '');
  return {
    r: parseInt(value.slice(0, 2), 16) || 0,
    g: parseInt(value.slice(2, 4), 16) || 0,
    b: parseInt(value.slice(4, 6), 16) || 0,
  };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = s * Math.min(l, 1 - l) / 100;
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
}

function lerpHue(h1, h2, t) {
  const d = h2 - h1;
  const delta = d + (Math.abs(d) > 180 ? (d > 0 ? -360 : 360) : 0);
  return (h1 + delta * t + 360) % 360;
}
