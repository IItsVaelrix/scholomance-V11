/**
 * NATURAL LANGUAGE AMP (NLU-AMP)
 * 
 * Layer 0: Intent Recognition & Semantic Parsing
 * Converts plain English prompts into PixelBrain configuration
 * 
 * Architecture:
 * 1. Tokenization & POS tagging (lightweight)
 * 2. Intent classification (visual generation, style transfer, effect application)
 * 3. Entity extraction (subjects, materials, colors, styles)
 * 4. Parameter mapping (SemanticParameters output)
 */

import { clamp01, createAmplifierResult, createAmplifierDiagnostic } from '../shared.js';
import { LEXICAL_VISUAL_DB } from '../../semantic/visual-extractor.js';
import { nluToPixelBrainParams } from '../../semantic/semantic-math-bridge.js';

const ID = 'natural_language_amp';
const LABEL = 'Natural Language Understanding AMP';
const TIER = 'COMMON';
const CLAIMED_WEIGHT = 0.03;
const VERSION = '3.0.0';

/**
 * Intent types for visual generation
 */
const INTENT_TYPES = Object.freeze({
  GENERATE_VISUAL: 'GENERATE_VISUAL',
  APPLY_STYLE: 'APPLY_STYLE',
  APPLY_EFFECT: 'APPLY_EFFECT',
  MODIFY_MATERIAL: 'MODIFY_MATERIAL',
  MODIFY_LIGHTING: 'MODIFY_LIGHTING',
  COMPOSE_SCENE: 'COMPOSE_SCENE',
  UNKNOWN: 'UNKNOWN',
});

/**
 * Entity types for extraction
 */
const ENTITY_TYPES = Object.freeze({
  SUBJECT: 'SUBJECT',         // Main object (dragon, knight, forest)
  MATERIAL: 'MATERIAL',       // Surface type (metal, stone, crystal)
  COLOR: 'COLOR',             // Color references (red, golden, dark)
  STYLE: 'STYLE',             // Visual style (GameBoy, 8-bit, CRT)
  EFFECT: 'EFFECT',           // Visual effects (fire, glow, shadow)
  LIGHTING: 'LIGHTING',       // Lighting description (bright, dim, harsh)
  COMPOSITION: 'COMPOSITION', // Layout (centered, symmetric, radial)
  MOOD: 'MOOD',               // Emotional tone (dark, heroic, peaceful)
});

/**
 * Keyword mappings for intent detection
 */
const INTENT_KEYWORDS = Object.freeze({
  [INTENT_TYPES.GENERATE_VISUAL]: [
    'show', 'display', 'render', 'generate', 'create', 'make', 'visualize',
    'draw', 'paint', 'depict', 'illustrate', 'present',
  ],
  [INTENT_TYPES.APPLY_STYLE]: [
    'style', 'in the style of', 'make it look like', 'convert to',
    'gameboy', '8-bit', '16-bit', 'retro', 'pixel', 'crt',
  ],
  [INTENT_TYPES.APPLY_EFFECT]: [
    'with', 'add', 'apply', 'effect', 'glow', 'shine', 'sparkle',
    'animate', 'motion', 'blur',
  ],
  [INTENT_TYPES.MODIFY_MATERIAL]: [
    'material', 'texture', 'surface', 'made of', 'composed of',
    'metallic', 'stone', 'crystal', 'organic', 'energy',
  ],
  [INTENT_TYPES.MODIFY_LIGHTING]: [
    'light', 'lighting', 'bright', 'dark', 'dim', 'harsh', 'soft',
    'glow', 'illuminate', 'shadow',
  ],
  [INTENT_TYPES.COMPOSE_SCENE]: [
    'compose', 'arrange', 'layout', 'position', 'center',
    'symmetric', 'balanced', 'radial', 'spiral',
  ],
});

/**
 * Subject keyword database
 */
const SUBJECT_KEYWORDS = Object.freeze([
  'dragon', 'knight', 'warrior', 'wizard', 'castle', 'forest', 'mountain',
  'river', 'ocean', 'fire', 'ice', 'lightning', 'shadow', 'light',
  'crystal', 'gem', 'sword', 'shield', 'armor', 'wing', 'tail',
  'tree', 'flower', 'vine', 'stone', 'rock', 'cave', 'temple',
  'palace', 'tower', 'bridge', 'path', 'garden', 'ruin',
  'phoenix', 'wolf', 'eagle', 'serpent', 'tiger', 'lion',
  'moon', 'sun', 'star', 'cloud', 'storm', 'wind',
  'skull', 'bone', 'spirit', 'ghost', 'demon', 'angel',
  'vision', 'mage', 'sorcerer', 'witch', 'fairy', 'elf',
  'dwarf', 'giant', 'unicorn', 'griffin', 'hydra', 'golem',
]);

/**
 * Material keyword mappings
 */
const MATERIAL_KEYWORDS = Object.freeze({
  metal: ['metal', 'metallic', 'steel', 'iron', 'gold', 'silver', 'bronze', 'chrome'],
  stone: ['stone', 'rock', 'marble', 'granite', 'concrete', 'brick'],
  organic: ['organic', 'flesh', 'skin', 'wood', 'plant', 'leaf', 'bark'],
  energy: ['energy', 'plasma', 'fire', 'light', 'electric', 'magical', 'ethereal'],
  crystalline: ['crystal', 'gem', 'diamond', 'glass', 'ice', 'prism', 'jewel'],
  fabric: ['fabric', 'cloth', 'silk', 'leather', 'fur', 'feather'],
});

/**
 * Style keyword mappings
 */
const STYLE_KEYWORDS = Object.freeze({
  gameboy: ['gameboy', 'game boy', 'gb', 'monochrome', '4-color'],
  '8bit': ['8-bit', '8bit', 'nes', 'nintendo', 'retro'],
  '16bit': ['16-bit', '16bit', 'snes', 'super nintendo', 'super famicom'],
  crt: ['crt', 'television', 'tv', 'monitor', 'scanline'],
  pixel: ['pixel', 'pixelated', 'low-res', 'low resolution', 'blocky'],
});

/**
 * Color keyword mappings (basic)
 */
const COLOR_KEYWORDS = Object.freeze({
  red: ['red', 'crimson', 'scarlet', 'ruby', 'blood', 'rose'],
  orange: ['orange', 'amber', 'gold', 'sunset'],
  yellow: ['yellow', 'golden', 'lemon', 'sunshine'],
  green: ['green', 'emerald', 'jade', 'forest', 'lime'],
  blue: ['blue', 'azure', 'sapphire', 'ocean', 'sky'],
  purple: ['purple', 'violet', 'amethyst', 'lavender', 'plum'],
  pink: ['pink', 'magenta', 'rose', 'blush'],
  white: ['white', 'silver', 'pearl', 'snow', 'ivory'],
  black: ['black', 'dark', 'obsidian', 'ebony', 'shadow'],
  gray: ['gray', 'grey', 'silver', 'ash', 'slate'],
});

/**
 * Lighting keyword mappings
 */
const LIGHTING_KEYWORDS = Object.freeze({
  bright: ['bright', 'brilliant', 'radiant', 'luminous', 'glowing'],
  dim: ['dim', 'dark', 'shadowy', 'gloomy', 'murky'],
  harsh: ['harsh', 'sharp', 'stark', 'dramatic', 'high-contrast'],
  soft: ['soft', 'gentle', 'diffused', 'warm', 'subtle'],
  cold: ['cold', 'cool', 'icy', 'frosty', 'blue-tinted'],
  warm: ['warm', 'hot', 'fiery', 'orange-tinted', 'golden'],
});

/**
 * Mood keyword mappings
 */
const MOOD_KEYWORDS = Object.freeze({
  heroic: ['heroic', 'brave', 'noble', 'valiant', 'courageous'],
  dark: ['dark', 'evil', 'sinister', 'menacing', 'ominous'],
  peaceful: ['peaceful', 'calm', 'serene', 'tranquil', 'gentle'],
  mysterious: ['mysterious', 'enigmatic', 'cryptic', 'hidden', 'secret'],
  magical: ['magical', 'mystical', 'enchanted', 'spellbound', 'arcane'],
  fierce: ['fierce', 'aggressive', 'violent', 'intense', 'powerful'],
});

/**
 * Tokenize input text
 */
function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 0);
}

/**
 * Detect primary intent from tokens
 */
function detectIntent(tokens) {
  const intentScores = {};
  
  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    intentScores[intent] = 0;
    for (const keyword of keywords) {
      const keywordTokens = keyword.split(' ');
      if (keywordTokens.length === 1) {
        if (tokens.includes(keyword)) {
          intentScores[intent] += 2;
        }
      } else {
        // Multi-word keyword check
        const text = tokens.join(' ');
        if (text.includes(keyword)) {
          intentScores[intent] += 3;
        }
      }
    }
  }
  
  // Find highest scoring intent
  let maxIntent = INTENT_TYPES.UNKNOWN;
  let maxScore = 0;
  for (const [intent, score] of Object.entries(intentScores)) {
    if (score > maxScore) {
      maxScore = score;
      maxIntent = intent;
    }
  }
  
  // Default to GENERATE_VISUAL if we have subject keywords
  if (maxIntent === INTENT_TYPES.UNKNOWN) {
    for (const subject of SUBJECT_KEYWORDS) {
      if (tokens.includes(subject)) {
        return { intent: INTENT_TYPES.GENERATE_VISUAL, confidence: 0.5 };
      }
    }
  }
  
  return {
    intent: maxIntent,
    confidence: maxScore > 0 ? clamp01(maxScore / 5) : 0.3,
  };
}

/**
 * Extract entities from tokens
 */
function extractEntities(tokens, fullText) {
  const entities = {
    [ENTITY_TYPES.SUBJECT]: [],
    [ENTITY_TYPES.MATERIAL]: [],
    [ENTITY_TYPES.COLOR]: [],
    [ENTITY_TYPES.STYLE]: [],
    [ENTITY_TYPES.EFFECT]: [],
    [ENTITY_TYPES.LIGHTING]: [],
    [ENTITY_TYPES.COMPOSITION]: [],
    [ENTITY_TYPES.MOOD]: [],
  };
  
  // Extract subjects
  for (const subject of SUBJECT_KEYWORDS) {
    if (tokens.includes(subject)) {
      entities[ENTITY_TYPES.SUBJECT].push(subject);
    }
  }
  
  // Extract materials
  for (const [material, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        entities[ENTITY_TYPES.MATERIAL].push(material);
        break;
      }
    }
  }
  
  // Extract colors
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        entities[ENTITY_TYPES.COLOR].push(color);
        break;
      }
    }
  }
  
  // Extract styles
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword) || fullText.toLowerCase().includes(keyword)) {
        entities[ENTITY_TYPES.STYLE].push(style);
        break;
      }
    }
  }
  
  // Extract lighting
  for (const [lighting, keywords] of Object.entries(LIGHTING_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        entities[ENTITY_TYPES.LIGHTING].push(lighting);
        break;
      }
    }
  }
  
  // Extract mood
  for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
    for (const keyword of keywords) {
      if (tokens.includes(keyword)) {
        entities[ENTITY_TYPES.MOOD].push(mood);
        break;
      }
    }
  }
  
  // Extract composition keywords
  const compositionKeywords = ['centered', 'symmetric', 'radial', 'spiral', 'balanced', 'asymmetric'];
  for (const keyword of compositionKeywords) {
    if (tokens.includes(keyword)) {
      entities[ENTITY_TYPES.COMPOSITION].push(keyword);
    }
  }
  
  // Extract effects
  const effectKeywords = ['fire', 'ice', 'lightning', 'glow', 'sparkle', 'shadow', 'wind', 'storm'];
  for (const keyword of effectKeywords) {
    if (tokens.includes(keyword) && !entities[ENTITY_TYPES.SUBJECT].includes(keyword)) {
      entities[ENTITY_TYPES.EFFECT].push(keyword);
    }
  }
  
  // Deduplicate
  for (const key of Object.keys(entities)) {
    entities[key] = [...new Set(entities[key])];
  }
  
  return Object.freeze(entities);
}

/**
 * Convert extracted entities to SemanticParameters
 */
function entitiesToSemanticParameters(entities, _intent) {
  const params = {
    surface: {
      material: 'stone',
      reflectivity: 0.3,
      roughness: 0.5,
      texture: 'grained',
    },
    form: {
      scale: 1.0,
      symmetry: 'none',
      complexity: 0.5,
      dominantAxis: 'horizontal',
    },
    light: {
      angle: 45,
      hardness: 0.5,
      color: '#888888',
      intensity: 0.5,
    },
    color: {
      primaryHue: 0,
      saturation: 0.5,
      brightness: 0.5,
      paletteSize: 4,
    },
    style: null,
    effects: [],
  };
  
  // Apply material
  if (entities[ENTITY_TYPES.MATERIAL].length > 0) {
    const material = entities[ENTITY_TYPES.MATERIAL][0];
    params.surface.material = material;
    
    const materialDefaults = {
      metal: { reflectivity: 0.8, roughness: 0.3, texture: 'smooth' },
      stone: { reflectivity: 0.15, roughness: 0.9, texture: 'grained' },
      organic: { reflectivity: 0.3, roughness: 0.7, texture: 'fibrous' },
      energy: { reflectivity: 0.5, roughness: 0.4, texture: 'smooth' },
      crystalline: { reflectivity: 0.9, roughness: 0.1, texture: 'crystalline' },
      fabric: { reflectivity: 0.2, roughness: 0.6, texture: 'fibrous' },
    };
    
    Object.assign(params.surface, materialDefaults[material] || {});
  }
  
  // Apply color
  if (entities[ENTITY_TYPES.COLOR].length > 0) {
    const color = entities[ENTITY_TYPES.COLOR][0];
    const colorHues = {
      red: 0,
      orange: 30,
      yellow: 60,
      green: 120,
      blue: 210,
      purple: 270,
      pink: 330,
      white: 0,
      black: 0,
      gray: 0,
    };
    
    params.color.primaryHue = colorHues[color] || 0;
    
    // Adjust saturation/brightness based on color
    if (color === 'white' || color === 'silver') {
      params.color.brightness = 0.9;
      params.color.saturation = 0.1;
    } else if (color === 'black' || color === 'dark') {
      params.color.brightness = 0.15;
    } else if (['red', 'orange', 'yellow'].includes(color)) {
      params.color.saturation = 0.8;
      params.color.brightness = 0.6;
    } else if (['blue', 'purple'].includes(color)) {
      params.color.saturation = 0.7;
      params.color.brightness = 0.5;
    }
    
    // Set light color
    const colorHexMap = {
      red: '#FF4500',
      orange: '#FFA500',
      yellow: '#FFD700',
      green: '#228B22',
      blue: '#4169E1',
      purple: '#9370DB',
      pink: '#FF69B4',
      white: '#FFFFFF',
      black: '#1A1A1A',
      gray: '#808080',
    };
    params.light.color = colorHexMap[color] || params.light.color;
  }
  
  // Apply lighting
  if (entities[ENTITY_TYPES.LIGHTING].length > 0) {
    const lighting = entities[ENTITY_TYPES.LIGHTING][0];
    const lightingDefaults = {
      bright: { intensity: 0.9, hardness: 0.6 },
      dim: { intensity: 0.2, hardness: 0.3 },
      harsh: { intensity: 0.8, hardness: 0.95 },
      soft: { intensity: 0.5, hardness: 0.2 },
      cold: { color: '#4169E1', intensity: 0.6 },
      warm: { color: '#FF6347', intensity: 0.7 },
    };
    
    Object.assign(params.light, lightingDefaults[lighting] || {});
  }
  
  // Apply mood to form/lighting
  if (entities[ENTITY_TYPES.MOOD].length > 0) {
    const mood = entities[ENTITY_TYPES.MOOD][0];
    const moodDefaults = {
      heroic: { form: { scale: 1.3, symmetry: 'vertical' }, light: { intensity: 0.8, color: '#FFD700' } },
      dark: { form: { scale: 1.2, symmetry: 'none' }, light: { intensity: 0.25, hardness: 0.7, color: '#2F2F4F' } },
      peaceful: { form: { scale: 1.0, symmetry: 'horizontal' }, light: { intensity: 0.5, hardness: 0.3, color: '#87CEEB' } },
      mysterious: { form: { scale: 1.1, symmetry: 'radial' }, light: { intensity: 0.35, hardness: 0.4, color: '#9370DB' } },
      magical: { form: { scale: 1.2, symmetry: 'radial' }, light: { intensity: 0.7, hardness: 0.5, color: '#E0FFFF' } },
      fierce: { form: { scale: 1.4, symmetry: 'diagonal' }, light: { intensity: 0.85, hardness: 0.8, color: '#FF4500' } },
    };
    
    const moodConfig = moodDefaults[mood] || {};
    if (moodConfig.form) Object.assign(params.form, moodConfig.form);
    if (moodConfig.light) Object.assign(params.light, moodConfig.light);
  }
  
  // Apply composition
  if (entities[ENTITY_TYPES.COMPOSITION].length > 0) {
    const composition = entities[ENTITY_TYPES.COMPOSITION][0];
    const compositionDefaults = {
      centered: { symmetry: 'vertical', dominantAxis: 'vertical' },
      symmetric: { symmetry: 'vertical' },
      radial: { symmetry: 'radial', dominantAxis: 'radial' },
      spiral: { symmetry: 'radial', dominantAxis: 'radial' },
      balanced: { symmetry: 'horizontal' },
      asymmetric: { symmetry: 'none' },
    };
    
    Object.assign(params.form, compositionDefaults[composition] || {});
  }
  
  // Apply style
  if (entities[ENTITY_TYPES.STYLE].length > 0) {
    params.style = entities[ENTITY_TYPES.STYLE][0];
  }
  
  // Apply effects
  if (entities[ENTITY_TYPES.EFFECT].length > 0) {
    params.effects = entities[ENTITY_TYPES.EFFECT];
  }
  
  // Apply subject-specific defaults
  if (entities[ENTITY_TYPES.SUBJECT].length > 0) {
    const subject = entities[ENTITY_TYPES.SUBJECT][0];
    const subjectDefaults = LEXICAL_VISUAL_DB.get(subject);
    if (subjectDefaults) {
      // Merge with lower priority than explicit entities
      params.surface = { ...subjectDefaults.surface, ...params.surface };
      params.form = { ...subjectDefaults.form, ...params.form };
      params.light = { ...subjectDefaults.light, ...params.light };
    }
  }
  
  return Object.freeze(params);
}

/**
 * Parse natural language prompt
 * @param {string} prompt - Natural language input
 * @returns {Object} Parsed intent with semantic parameters
 */
export function parseNaturalLanguagePrompt(prompt) {
  const tokens = tokenize(prompt);
  const fullText = String(prompt || '').toLowerCase();
  
  // Detect intent
  const { intent, confidence } = detectIntent(tokens);
  
  // Extract entities
  const entities = extractEntities(tokens, fullText);
  
  // Convert to semantic parameters
  const semanticParams = entitiesToSemanticParameters(entities, intent);
  
  // Build verse text from intent (for downstream processing)
  const generatedVerse = generateVerseFromIntent(entities, semanticParams);
  
  return Object.freeze({
    intent,
    confidence,
    entities,
    semanticParams,
    generatedVerse,
    originalPrompt: prompt,
  });
}

/**
 * Generate verse text from parsed intent
 * Creates verses with strong rhyme and stress patterns for PixelBrain analysis
 */
function generateVerseFromIntent(entities, _params) {
  const subjects = entities[ENTITY_TYPES.SUBJECT];
  const moods = entities[ENTITY_TYPES.MOOD];
  const effects = entities[ENTITY_TYPES.EFFECT];
  const colors = entities[ENTITY_TYPES.COLOR];

  // Build rich verse with strong phonetic patterns
  const subject = subjects[0] || 'vision';
  const mood = moods[0] || 'mysterious';
  const effect = effects[0];
  const color = colors[0];
  
  // Pre-built verses with strong rhyme schemes (AABB or ABAB)
  const subjectVerses = {
    dragon: {
      heroic: "The dragon soars through golden skies so bright\nWith fire burning in its eyes so light\nThe wings spread wide across the morning sun\nThe battle of the ages has begun",
      dark: "The shadow dragon takes its darksome flight\nThrough endless realms of everlasting night\nWith scales of obsidian gleaming cold\nA tale of ancient power to be told",
      magical: "The crystal dragon weaves its spell so deep\nWhere ancient powers in the darkness sleep\nWith scales that shimmer bright with arcane light\nIt guards the secrets of the endless night",
      default: "The dragon rises from its lair of stone\nWith thunder in its mighty roar so lone\nThe fire burns within its scaled breast\nPut all the watching warriors to the test",
    },
    knight: {
      heroic: "The knight stands tall with sword held up so high\nBeneath the watchful golden shining sky\nWith armor gleaming bright in morning light\nThe hero prepares for the coming fight",
      dark: "The fallen knight in armor black as night\nWalks the path of no return from fight\nWith shadow in its hollow eyes so deep\nThe cursed warrior has a vow to keep",
      magical: "The enchanted knight with runes aglow so bright\nChannels power from the depths of night\nWith magic flowing through the steel so cold\nA story of ancient power to be told",
      default: "The knight rides forth upon the battlefield\nWith courage as its only shield so sealed\nThe banner waves above the armored head\nAmong the living and among the dead",
    },
    forest: {
      peaceful: "The ancient forest breathes so calm and still\nUpon the green and gently sloping hill\nWith leaves that whisper soft in morning breeze\nThe trees stand tall and proud among these",
      mysterious: "Through misty woods where shadows dance and play\nThe hidden path leads ever far away\nWith secrets in the darkness deep concealed\nThe forest keeps its magic well sealed",
      magical: "The enchanted woods with leaves of silver light\nShimmer softly through the starlit night\nWith magic in every branch and root so deep\nThe forest has its ancient vows to keep",
      default: "The forest grows where ancient rivers flow\nWith moss upon the stones that gleam so low\nThe creatures hide within the shadows deep\nWhere nature has its promises to keep",
    },
    crystal: {
      magical: "The crystal grows with facets shining bright\nRefracting pure and ethereal light\nWith colors dancing through the gem so clear\nThe magic of the earth is present here",
      mysterious: "Deep within the crystal cave so dark\nWhere light meets shadow on the water spark\nWith gems that gleam with power from below\nThe crystal has its secrets to bestow",
      default: "The crystal palace rises from the stone\nWith towers gleaming bright and all alone\nWith walls of gem and floors of shining glass\nThe ages watch the crystal kingdom pass",
    },
    castle: {
      heroic: "The castle stands upon the hill so high\nWith banners waving in the morning sky\nWith stone walls strong against the enemy\nThe fortress of the brave and bold to be",
      dark: "The ruined castle crumbles in the night\nWhere shadows dance in pale and ghostly light\nWith broken towers reaching for the sky\nThe castle watches centuries go by",
      magical: "The enchanted castle gleams with arcane light\nWith magic wards that glow throughout the night\nWith spells upon each stone and tower high\nThe castle reaches for the starlit sky",
      default: "The ancient castle guards the valley floor\nWith stone walls strong as they were before\nWith turrets reaching for the clouds above\nThe castle stands as testament to love",
    },
    phoenix: {
      magical: "The phoenix rises from the ashes bright\nWith feathers burning in eternal light\nWith fire in its wings and song so clear\nThe bird of rebirth has no need for fear",
      default: "The phoenix flies across the burning sky\nWith flames that never fade and never die\nWith song that echoes through the ages long\nThe phoenix sings its everlasting song",
    },
    warrior: {
      heroic: "The warrior stands upon the battlefield\nWith courage as its only trusty shield\nWith sword held high against the enemy\nThe fighter shows what brave can be",
      default: "The warrior fights beneath the banner red\nAmong the living and among the dead\nWith strength that comes from deep within the soul\nThe fighter plays its destined role",
    },
    shadow: {
      dark: "The shadow creeps across the darkened floor\nWith darkness seeping through the ancient door\nWith silence in its wake so deep and cold\nThe shadow has its secrets to unfold",
      mysterious: "The shadow dances on the moonlit wall\nWith whispers that echo through the hall\nWith mystery in every darkened space\nThe shadow moves with silent grace",
      default: "The shadow falls across the sleeping land\nWith darkness gentle as a mother's hand\nWith night that covers all beneath its wing\nThe shadow has its quiet song to sing",
    },
    fire: {
      fierce: "The fire burns with fury bright and bold\nWith flames that reach and twist and never fold\nWith heat that waves across the burning air\nThe fire shows its power everywhere",
      default: "The fire crackles in the hearth so warm\nWith flames that dance and twist in every form\nWith light that pushes back the dark of night\nThe fire gives its comforting delight",
    },
    ocean: {
      peaceful: "The ocean waves roll gently on the shore\nWith rhythm that has echoed evermore\nWith water blue that stretches far and wide\nThe ocean has its secrets deep inside",
      default: "The ocean roars beneath the stormy sky\nWith waves that reach and touch the clouds so high\nWith power that no mortal can contain\nThe ocean shows its wild domain",
    },
    mountain: {
      heroic: "The mountain rises proud against the sky\nWith peaks that touch the clouds that float so high\nWith stone that stands against the test of time\nThe mountain climbs in majesty sublime",
      default: "The mountain stands so ancient and so still\nWith snow upon its cold and rocky hill\nWith valleys deep below its mighty peak\nThe mountain has its silent song to speak",
    },
    palace: {
      magical: "The palace gleams with magic in each stone\nWith spells and wards that make it all alone\nWith towers reaching for the starlit sky\nThe palace watches centuries go by",
      default: "The palace rises from the marble floor\nWith golden gates and every wealthy door\nWith halls that echo with the royal sound\nThe palace has its glory all around",
    },
    temple: {
      mysterious: "The temple stands in silence deep and old\nWith secrets that the priests have never told\nWith stone that holds the prayers of ages past\nThe temple has its shadows that will last",
      magical: "The temple glows with runes upon the wall\nWith magic that answers every prayerful call\nWith power flowing through the sacred stone\nThe temple stands eternal and alone",
      default: "The ancient temple guards its holy ground\nWith silence as its most sacred sound\nWith altars raised to gods of days before\nThe temple opens wide its sacred door",
    },
    light: {
      heroic: "The light breaks forth across the darkened sky\nWith brilliance that no shadow can deny\nWith radiance that fills the world so bright\nThe light defeats the darkness of the night",
      magical: "The light dances with colors in the air\nWith magic that shows beauty everywhere\nWith glow that comes from deep within the soul\nThe light makes every broken spirit whole",
      default: "The light shines down from heavens up above\nWith warmth that fills the heart with endless love\nWith beams that chase the shadows far away\nThe light brings hope to every brand new day",
    },
    moon: {
      mysterious: "The moon hangs pale against the darkened sky\nWith light that makes the shadows dance and fly\nWith silver beams that touch the sleeping earth\nThe moon has watched the world since ancient birth",
      magical: "The moon glows bright with magic in its light\nWith power that awakens in the night\nWith influence upon the tides so deep\nThe moon has ancient promises to keep",
      default: "The moon rises above the darkened hill\nWith silence that the nighttime makes so still\nWith face that watches all the world below\nThe moon has seen the ages come and go",
    },
    star: {
      magical: "The star burns bright against the velvet night\nWith magic in its shimmering silver light\nWith distance that no mortal can conceive\nThe star has wonders that it can achieve",
      default: "The star twinkles in the darkened sky so deep\nWith promises that it will always keep\nWith light that travels through the endless space\nThe star shows hope to all the human race",
    },
    wizard: {
      magical: "The wizard stands with staff held up so high\nWith magic crackling in the stormy sky\nWith robes that flow with power from within\nThe wizard casts away the force of sin",
      default: "The wizard reads from books of ancient lore\nWith spells that open every locked door\nWith knowledge gathered through the ages long\nThe wizard sings his powerful song",
    },
  };
  
  // Get verse for subject and mood
  const subjectData = subjectVerses[subject];
  if (subjectData) {
    return subjectData[mood] || subjectData.heroic || subjectData.default || Object.values(subjectData)[0];
  }
  
  // Generic fallback with strong rhyme scheme
  const colorWord = color || 'bright';
  
  return `The ${subject} stands in ${mood} grace so ${colorWord}\n${effect ? `With ${effect} dancing all around this place` : 'In this sacred and most hallowed place'}\n${'Bathed in brilliant radiant golden light'}\nA vision burning ever pure and bright`;
}

/**
 * Natural Language AMP Plugin
 * 
 * Two modes of operation:
 * 1. DIRECT_MODE: NLU parameters directly configure visualization (deterministic)
 * 2. GENERATE_MODE: NLU generates verse for full pipeline analysis (creative)
 */
export const naturalLanguageAmp = {
  id: ID,
  label: LABEL,
  tier: TIER,
  claimedWeight: CLAIMED_WEIGHT,
  version: VERSION,
  
  /**
   * Route decision - run if text appears to be natural language prompt
   */
  route(context = {}) {
    const { verseIR, options = {} } = context;
    const rawText = String(verseIR?.rawText || '').trim();
    
    // Check if this looks like a natural language prompt
    const isNaturalLanguage = this.isNaturalLanguagePrompt(rawText);
    
    if (!isNaturalLanguage) {
      return {
        score: 0,
        shouldRun: false,
        reason: 'not_natural_language',
      };
    }
    
    return {
      score: 0.9,
      shouldRun: true,
      reason: 'natural_language_detected',
      mode: options.nluMode || 'direct', // 'direct' or 'generate'
    };
  },
  
  /**
   * Check if text appears to be a natural language prompt
   * FIX: Use LEXICAL_VISUAL_DB + token-based matching for proper routing
   */
  isNaturalLanguagePrompt(text) {
    if (!text || text.length < 5) return false;
    
    const tokens = tokenize(text);
    const lowerText = text.toLowerCase();
    
    // 1. INTENT CHECK: Catch commands like "Make it...", "Generate...", "Style..."
    for (const keywords of Object.values(INTENT_KEYWORDS)) {
      for (const keyword of keywords) {
        // Fixed: Uses tokens.includes to catch end-of-sentence keywords
        if (lowerText.startsWith(keyword) || tokens.includes(keyword)) {
          return true;
        }
      }
    }
    
    // 2. THE DYNAMIC BRIDGE: Catch any subject defined in the Scholomance Visual DB
    // This replaces hardcoded SUBJECT_KEYWORDS array
    const hasSemanticSubject = tokens.some(token => LEXICAL_VISUAL_DB.has(token));
    if (hasSemanticSubject) return true;
    
    // 3. STYLE FALLBACK: Catch raw formatting requests like "8-bit" or "gameboy"
    for (const styleKeywords of Object.values(STYLE_KEYWORDS)) {
      for (const keyword of styleKeywords) {
        if (tokens.includes(keyword)) {
          return true;
        }
      }
    }
    
    return false;
  },
  
  /**
   * Analyze and extract semantic parameters with mathematical constraints
   */
  async analyze(context = {}) {
    const { verseIR, options = {} } = context;
    const rawText = String(verseIR?.rawText || '').trim();
    
    console.log('[NLU-AMP] Analyzing:', rawText.substring(0, 50));
    console.log('[NLU-AMP] Is natural language?', this.isNaturalLanguagePrompt(rawText));
    
    if (!rawText) {
      return createAmplifierResult({
        id: ID,
        label: LABEL,
        tier: TIER,
        claimedWeight: CLAIMED_WEIGHT,
        commentary: 'No text provided for natural language analysis.',
      });
    }

    // --- THE GEOMETRY STARVATION PATCH ---
    // If prompt has fewer than 10 words, force 'generate' mode so PixelBrain
    // has enough coordinate mass (tokens) to render a dense, visible structure.
    const tokenCount = tokenize(rawText).length;
    const mode = (tokenCount < 10) ? 'generate' : (options.nluMode || 'direct');
    
    console.log('[NLU-AMP] Token count:', tokenCount, '| Mode:', mode);
    // -------------------------------------
    
    // Parse the prompt
    const parsed = parseNaturalLanguagePrompt(rawText);
    
    console.log('[NLU-AMP] Parsed entities:', parsed.entities);
    console.log('[NLU-AMP] Generated verse:', parsed.generatedVerse?.substring(0, 60));
    
    // Convert entities to mathematical constraints (THE BRIDGE)
    const mathConstraints = nluToPixelBrainParams(parsed.entities, parsed.semanticParams);
    
    const diagnostics = [];
    
    if (parsed.confidence < 0.5) {
      diagnostics.push(createAmplifierDiagnostic({
        severity: 'warning',
        source: ID,
        message: 'Low confidence in natural language interpretation.',
        metadata: {
          intent: parsed.intent,
          confidence: parsed.confidence,
        },
      }));
    }
    
    // Build commentary based on mode
    const commentary = mode === 'direct'
      ? `NLU direct: ${parsed.intent} → ${mathConstraints.surface.material}/${mathConstraints.form.symmetry} constraints.`
      : `NLU generate: "${parsed.intent}" → generated verse for phonetic analysis.`;
    
    diagnostics.push(createAmplifierDiagnostic({
      severity: 'info',
      source: ID,
      message: `Parsed: ${parsed.intent} with ${Object.keys(parsed.entities).reduce((sum, key) => sum + parsed.entities[key].length, 0)} entities → ${mathConstraints.coordinateDensity} coord density, ${mathConstraints.latticeConnections} connections.`,
      metadata: {
        intent: parsed.intent,
        confidence: parsed.confidence,
        entities: parsed.entities,
        mathConstraints: {
          coordinateDensity: mathConstraints.coordinateDensity,
          latticeConnections: mathConstraints.latticeConnections,
          ditherMethod: mathConstraints.ditherMethod,
          extension: mathConstraints.extension,
        },
        mode,
      },
    }));
    
    return Object.freeze({
      ...createAmplifierResult({
        id: ID,
        label: LABEL,
        tier: TIER,
        claimedWeight: CLAIMED_WEIGHT,
        signal: parsed.confidence,
        semanticDepth: clamp01(Object.keys(parsed.entities).reduce((sum, key) => sum + parsed.entities[key].length, 0) / 10),
        matches: [],
        archetypes: [],
        diagnostics,
        commentary,
      }),
      payload: Object.freeze({
        version: VERSION,
        intent: parsed.intent,
        confidence: parsed.confidence,
        entities: parsed.entities,
        semanticParams: parsed.semanticParams,
        mathConstraints, // THE BRIDGE OUTPUT
        generatedVerse: mode === 'generate' ? parsed.generatedVerse : null, // FIX: Include verse in generate mode
        originalPrompt: parsed.originalPrompt,
        mode, // Report the actual mode used (may be auto-switched)
      }),
    });
  },
};

console.log('[NLU-AMP] Plugin loaded');

/**
 * Export helper functions for direct use
 */
export {
  tokenize,
  detectIntent,
  extractEntities,
  entitiesToSemanticParameters,
  INTENT_TYPES,
  ENTITY_TYPES,
};
