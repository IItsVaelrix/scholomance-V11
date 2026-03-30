export const GOLDEN_RATIO = 1.618033988749895;
export const GOLDEN_ANGLE = 137.50776405003785;

export const DEFAULT_PIXELBRAIN_CANVAS = Object.freeze({
  width: 160,
  height: 144,
  gridSize: 1,
});

export function clamp01(value) {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function clampNumber(value, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return min;
  return Math.max(min, Math.min(max, numeric));
}

export function roundTo(value, digits = 3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Number(numeric.toFixed(digits));
}

export function hashString(value) {
  const input = String(value ?? '');
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function normalizeDegrees(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric % 360) + 360) % 360;
}

export function createBytecodeString({
  schoolId = 'VOID',
  rarity = 'COMMON',
  effect = 'INERT',
} = {}) {
  const safeSchool = String(schoolId || 'VOID').trim().toUpperCase() || 'VOID';
  const safeRarity = String(rarity || 'COMMON').trim().toUpperCase() || 'COMMON';
  const safeEffect = String(effect || 'INERT').trim().toUpperCase() || 'INERT';
  return `VW-${safeSchool}-${safeRarity}-${safeEffect}`;
}

export function parseBytecodeString(bytecode) {
  const safeBytecode = String(bytecode || '').trim().toUpperCase();
  const parts = safeBytecode.split('-');

  return Object.freeze({
    version: parts[0] === 'VW' ? 'VW' : 'VW',
    schoolId: parts[1] || 'VOID',
    rarity: parts[2] || 'COMMON',
    effect: parts[3] || 'INERT',
  });
}

export function createByteMap(colors) {
  return Object.freeze(
    Object.fromEntries(
      (Array.isArray(colors) ? colors : []).map((color, index) => [String(index), String(color || '')])
    )
  );
}

export function hslToHex(h, s, l) {
  const safeHue = normalizeDegrees(h);
  const safeSaturation = clampNumber(s, 0, 100);
  const safeLightness = clampNumber(l, 0, 100) / 100;
  const amplitude = (safeSaturation * Math.min(safeLightness, 1 - safeLightness)) / 100;
  const channel = (index) => {
    const k = (index + (safeHue / 30)) % 12;
    const color = safeLightness - (amplitude * Math.max(Math.min(k - 3, 9 - k, 1), -1));
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };

  return `#${channel(0)}${channel(8)}${channel(4)}`;
}
