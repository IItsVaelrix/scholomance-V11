import { SCHOOLS, VOWEL_FAMILY_TO_SCHOOL } from '../../../data/schools.js';
import { normalizeVowelFamily } from '../../phonology/vowelFamily.js';

export const VERSE_IR_PALETTE_FAMILIES = Object.freeze([
  'IY', 'IH', 'EY', 'EH', 'AE',
  'AA', 'AH', 'AO', 'OW', 'UH',
  'UW', 'ER', 'AX', 'AY', 'AW',
  'OY', 'UR', 'OH', 'OO', 'YUW',
]);

const PCA_VOWEL_FORMANTS = Object.freeze({
  IY: Object.freeze([270, 2290]),
  IH: Object.freeze([390, 1990]),
  EY: Object.freeze([530, 1840]),
  EH: Object.freeze([610, 1720]),
  AE: Object.freeze([860, 1550]),
  AA: Object.freeze([730, 1090]),
  AH: Object.freeze([640, 1190]),
  AO: Object.freeze([570, 840]),
  OW: Object.freeze([460, 1100]),
  UH: Object.freeze([440, 1020]),
  UW: Object.freeze([300, 870]),
  ER: Object.freeze([490, 1350]),
  AX: Object.freeze([500, 1500]),
  AY: Object.freeze([660, 1720]),
  AW: Object.freeze([760, 1320]),
  OY: Object.freeze([500, 1000]),
  A: Object.freeze([730, 1090]),
  OH: Object.freeze([550, 950]),
  OO: Object.freeze([400, 900]),
  UR: Object.freeze([450, 1200]),
  YUW: Object.freeze([350, 1800]),
});

const PCA_FAMILY_ALIASES = Object.freeze({
  YOO: 'YUW',
  EE: 'IY',
  IN: 'IH',
});

const SCHOOL_COLOR_ANCHORS = Object.freeze({
  SONIC: 'AE',
  PSYCHIC: 'IY',
  VOID: 'AX',
  ALCHEMY: 'EY',
  WILL: 'AH',
  NECROMANCY: 'AA',
  ABJURATION: 'UW',
  DIVINATION: 'AO',
});

const DEFAULT_SCHOOL_HSL = Object.freeze({ h: 174, s: 42, l: 46 });
const THEME_SCALARS = Object.freeze({
  huePc1: 6,
  huePc2: 4,
  saturationRadius: 10,
  saturationPc1: 2,
  saturationPc2Dampen: 3,
  lightnessPc1: 4,
  lightnessPc2: 18,
  lightnessOffset: 0,
  minSaturation: 12,
  maxSaturation: 86,
  minLightness: 18,
  maxLightness: 84,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function wrapHue(value) {
  return ((value % 360) + 360) % 360;
}

function round(value, decimals = 6) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function hslToHex(h, s, l) {
  const hue = wrapHue(h) / 360;
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;

  if (saturation === 0) {
    const gray = Math.round(lightness * 255);
    const hex = gray.toString(16).padStart(2, '0');
    return `#${hex}${hex}${hex}`;
  }

  const q = lightness < 0.5
    ? lightness * (1 + saturation)
    : lightness + saturation - (lightness * saturation);
  const p = (2 * lightness) - q;

  const hueToRgb = (t) => {
    let shifted = t;
    if (shifted < 0) shifted += 1;
    if (shifted > 1) shifted -= 1;
    if (shifted < 1 / 6) return p + ((q - p) * 6 * shifted);
    if (shifted < 1 / 2) return q;
    if (shifted < 2 / 3) return p + ((q - p) * (2 / 3 - shifted) * 6);
    return p;
  };

  const toHex = (value) => Math.round(clamp(value, 0, 1) * 255).toString(16).padStart(2, '0');
  return `#${toHex(hueToRgb(hue + (1 / 3)))}${toHex(hueToRgb(hue))}${toHex(hueToRgb(hue - (1 / 3)))}`;
}

function resolveProjectionFamily(value) {
  const raw = String(value || '').trim().toUpperCase();
  if (!raw) return '';

  const explicit = PCA_FAMILY_ALIASES[raw] || raw;
  if (PCA_VOWEL_FORMANTS[explicit]) return explicit;

  const normalized = PCA_FAMILY_ALIASES[normalizeVowelFamily(raw)] || normalizeVowelFamily(raw);
  return PCA_VOWEL_FORMANTS[normalized] ? normalized : '';
}

function buildPcaBasis() {
  const families = Object.keys(PCA_VOWEL_FORMANTS);
  const sampleCount = Math.max(1, families.length);

  const mean = [0, 0];
  families.forEach((family) => {
    const [f1, f2] = PCA_VOWEL_FORMANTS[family];
    mean[0] += f1;
    mean[1] += f2;
  });
  mean[0] /= sampleCount;
  mean[1] /= sampleCount;

  const std = [0, 0];
  families.forEach((family) => {
    const [f1, f2] = PCA_VOWEL_FORMANTS[family];
    std[0] += (f1 - mean[0]) ** 2;
    std[1] += (f2 - mean[1]) ** 2;
  });
  std[0] = Math.sqrt(std[0] / sampleCount) || 1;
  std[1] = Math.sqrt(std[1] / sampleCount) || 1;

  const zScores = new Map();
  families.forEach((family) => {
    const [f1, f2] = PCA_VOWEL_FORMANTS[family];
    zScores.set(family, [
      (f1 - mean[0]) / std[0],
      (f2 - mean[1]) / std[1],
    ]);
  });

  let covariance11 = 0;
  let covariance12 = 0;
  let covariance22 = 0;
  zScores.forEach(([z1, z2]) => {
    covariance11 += z1 * z1;
    covariance12 += z1 * z2;
    covariance22 += z2 * z2;
  });
  covariance11 /= sampleCount;
  covariance12 /= sampleCount;
  covariance22 /= sampleCount;

  const trace = covariance11 + covariance22;
  const determinant = (covariance11 * covariance22) - (covariance12 ** 2);
  const root = Math.sqrt(Math.max(0, ((trace ** 2) / 4) - determinant));
  const lambda1 = (trace / 2) + root;
  const lambda2 = (trace / 2) - root;

  const buildEigenvector = (lambda) => {
    if (Math.abs(covariance12) <= 1e-9) {
      return covariance11 >= covariance22 ? [1, 0] : [0, 1];
    }

    const vector = [lambda - covariance22, covariance12];
    const length = Math.hypot(vector[0], vector[1]) || 1;
    return [vector[0] / length, vector[1] / length];
  };

  let principalAxis = buildEigenvector(lambda1);
  let secondaryAxis = buildEigenvector(lambda2);

  if (principalAxis[1] < 0) {
    principalAxis = [-principalAxis[0], -principalAxis[1]];
  }
  if (secondaryAxis[0] < 0) {
    secondaryAxis = [-secondaryAxis[0], -secondaryAxis[1]];
  }

  const rawProjectionEntries = families.map((family) => {
    const [z1, z2] = zScores.get(family);
    return [
      family,
      {
        family,
        pc1Raw: (z1 * principalAxis[0]) + (z2 * principalAxis[1]),
        pc2Raw: (z1 * secondaryAxis[0]) + (z2 * secondaryAxis[1]),
      },
    ];
  });

  const maxAbsPc1 = rawProjectionEntries.reduce((max, [, value]) => Math.max(max, Math.abs(value.pc1Raw)), 1);
  const maxAbsPc2 = rawProjectionEntries.reduce((max, [, value]) => Math.max(max, Math.abs(value.pc2Raw)), 1);

  const projections = Object.freeze(Object.fromEntries(
    rawProjectionEntries.map(([family, value]) => {
      const pc1 = value.pc1Raw / maxAbsPc1;
      const pc2 = value.pc2Raw / maxAbsPc2;
      return [
        family,
        Object.freeze({
          family,
          pc1: round(pc1),
          pc2: round(pc2),
          radius: round(clamp(Math.hypot(pc1, pc2) / Math.sqrt(2), 0, 1)),
        }),
      ];
    })
  ));

  return Object.freeze({
    mean: Object.freeze(mean.map((value) => round(value))),
    std: Object.freeze(std.map((value) => round(value))),
    eigenvalues: Object.freeze([round(lambda1), round(lambda2)]),
    principalAxis: Object.freeze(principalAxis.map((value) => round(value))),
    secondaryAxis: Object.freeze(secondaryAxis.map((value) => round(value))),
    projections,
  });
}

const PCA_BASIS = buildPcaBasis();

function resolveSchoolKey(schoolId, family) {
  const requested = String(schoolId || '').trim().toUpperCase();
  if (requested && requested !== 'DEFAULT' && SCHOOLS[requested]) {
    return requested;
  }

  const familySchool = VOWEL_FAMILY_TO_SCHOOL[family] || null;
  return familySchool && SCHOOLS[familySchool] ? familySchool : null;
}

function resolveBaseHsl(schoolKey) {
  const school = schoolKey ? SCHOOLS[schoolKey] : null;
  if (school?.colorHsl) {
    return school.colorHsl;
  }
  return DEFAULT_SCHOOL_HSL;
}

export function resolveVerseIrColor(family, schoolId = null, _options = {}) {
  const resolvedFamily = resolveProjectionFamily(family);
  if (!resolvedFamily) {
    return Object.freeze({
      family: '',
      school: null,
      hex: '#888888',
      hsl: Object.freeze({ h: 0, s: 0, l: 53 }),
      projection: null,
    });
  }

  const projection = getVerseIrColorProjection(resolvedFamily);
  const schoolKey = resolveSchoolKey(schoolId, resolvedFamily);
  const baseHsl = resolveBaseHsl(schoolKey);
  const anchorFamily = SCHOOL_COLOR_ANCHORS[schoolKey] || resolvedFamily;
  const anchorProjection = getVerseIrColorProjection(anchorFamily) || projection;
  const themeConfig = THEME_SCALARS;

  const deltaPc1 = projection.pc1 - anchorProjection.pc1;
  const deltaPc2 = projection.pc2 - anchorProjection.pc2;
  const deltaRadius = clamp(Math.hypot(deltaPc1, deltaPc2) / 1.6, 0, 1);

  const hue = wrapHue(baseHsl.h + (deltaPc1 * themeConfig.huePc1) - (deltaPc2 * themeConfig.huePc2));
  const saturation = clamp(
    baseHsl.s
      + (deltaRadius * themeConfig.saturationRadius)
      + (deltaPc1 * themeConfig.saturationPc1)
      - (Math.abs(deltaPc2) * themeConfig.saturationPc2Dampen),
    themeConfig.minSaturation,
    themeConfig.maxSaturation
  );
  const lightness = clamp(
    baseHsl.l
      + themeConfig.lightnessOffset
      + (deltaPc1 * themeConfig.lightnessPc1)
      - (deltaPc2 * themeConfig.lightnessPc2),
    themeConfig.minLightness,
    themeConfig.maxLightness
  );

  return Object.freeze({
    family: resolvedFamily,
    school: schoolKey,
    hex: hslToHex(hue, saturation, lightness),
    hsl: Object.freeze({
      h: round(hue, 3),
      s: round(saturation, 3),
      l: round(lightness, 3),
    }),
    projection,
  });
}

export function buildVerseIrPalette(schoolId = 'DEFAULT') {
  const palette = {};
  VERSE_IR_PALETTE_FAMILIES.forEach((family) => {
    palette[family] = resolveVerseIrColor(family, schoolId).hex;
  });
  return Object.freeze(palette);
}

export function getVerseIrColorProjection(family) {
  const resolvedFamily = resolveProjectionFamily(family);
  if (!resolvedFamily) return null;
  return PCA_BASIS.projections[resolvedFamily] || null;
}

export const VERSE_IR_PCA_CHROMA_BASIS = PCA_BASIS;
