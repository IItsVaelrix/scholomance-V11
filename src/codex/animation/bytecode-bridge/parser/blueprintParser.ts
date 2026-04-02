/**
 * Bytecode Blueprint Bridge — Parser
 * 
 * Parses bytecode blueprint blocks from PDR source documents.
 * Converts line-based syntax into Canonical Animation Schema (IR).
 * 
 * Syntax Example:
 * ```
 * ANIM_START
 * ID orb-transmission-pulse
 * TARGET id player-orb
 * PRESET transmission-pulse
 * DURATION 800
 * EASE TOKEN IN_OUT_ARC
 * SCALE BASE 1.0 PEAK 1.05 ENV sine PERIOD 800
 * ANIM_END
 * ```
 */

import {
  AnimationBlueprintV1,
  BlueprintParseResult,
  DiagnosticEntry,
  BLUEPRINT_ERROR_CODES,
} from "../contracts/blueprint.types.ts";

// ─── Constants ───────────────────────────────────────────────────────────────

const ANIM_START_MARKER = "ANIM_START";
const ANIM_END_MARKER = "ANIM_END";

const REQUIRED_DIRECTIVES = new Set(["ID", "TARGET", "DURATION", "EASE", "LOOP"]);

const VALID_DIRECTIVES = new Set([
  "ANIM_START",
  "ANIM_END",
  "ID",
  "NAME",
  "DESCRIPTION",
  "TARGET",
  "PRESET",
  "DURATION",
  "DELAY",
  "LOOP",
  "EASE",
  "PHASE",
  "SCALE",
  "ROTATE",
  "TRANSLATE_X",
  "TRANSLATE_Y",
  "OPACITY",
  "GLOW",
  "BLUR",
  "ENVELOPE",
  "SYMMETRY",
  "GRID",
  "ANCHOR",
  "COMPOSITE",
  "BACKEND_HINT",
  "CONSTRAINT",
  "QA",
  "METADATA",
]);

// ─── Parser State ────────────────────────────────────────────────────────────

interface ParserState {
  lines: string[];
  currentIndex: number;
  errors: DiagnosticEntry[];
  warnings: DiagnosticEntry[];
  sourceMap: Map<number, string>;
  directives: Map<string, string[]>;
}

// ─── Core Parser ─────────────────────────────────────────────────────────────

/**
 * Parse a bytecode blueprint block from source text
 */
export function parseBlueprintBlock(source: string): BlueprintParseResult {
  const lines = source.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
  
  const state: ParserState = {
    lines,
    currentIndex: 0,
    errors: [],
    warnings: [],
    sourceMap: new Map(),
    directives: new Map(),
  };

  // Validate ANIM_START
  if (lines[0] !== ANIM_START_MARKER) {
    state.errors.push(createError(
      BLUEPRINT_ERROR_CODES.PARSE_MISSING_ANIM_START,
      "parse",
      `Expected '${ANIM_START_MARKER}' at start of blueprint block`,
      1,
      undefined,
      `Add '${ANIM_START_MARKER}' as the first line of your blueprint`
    ));
    return { success: false, errors: state.errors, warnings: state.warnings };
  }

  // Parse all lines
  while (state.currentIndex < lines.length) {
    const line = lines[state.currentIndex];
    const lineNum = state.currentIndex + 1;
    
    state.sourceMap.set(lineNum, line);

    if (line === ANIM_END_MARKER) {
      state.currentIndex++;
      break;
    }

    parseDirective(state, line, lineNum);
    state.currentIndex++;
  }

  // Validate ANIM_END
  const lastLine = lines[lines.length - 1];
  if (lastLine !== ANIM_END_MARKER) {
    state.errors.push(createError(
      BLUEPRINT_ERROR_CODES.PARSE_MISSING_ANIM_END,
      "parse",
      `Expected '${ANIM_END_MARKER}' at end of blueprint block`,
      lines.length,
      undefined,
      `Add '${ANIM_END_MARKER}' as the last line of your blueprint`
    ));
    return { success: false, errors: state.errors, warnings: state.warnings };
  }

  // Check for required directives
  for (const required of REQUIRED_DIRECTIVES) {
    if (!state.directives.has(required)) {
      state.errors.push(createError(
        BLUEPRINT_ERROR_CODES.PARSE_MISSING_REQUIRED_FIELD,
        "parse",
        `Missing required directive: ${required}`,
        1,
        required,
        `Add '${required} <value>' to your blueprint`
      ));
    }
  }

  if (state.errors.length > 0) {
    return { success: false, errors: state.errors, warnings: state.warnings };
  }

  // Build blueprint from directives
  const blueprint = buildBlueprint(state);
  
  return {
    success: true,
    blueprint,
    errors: state.errors,
    warnings: state.warnings,
    sourceMap: state.sourceMap,
  };
}

// ─── Directive Parser ────────────────────────────────────────────────────────

function parseDirective(state: ParserState, line: string, lineNum: number): void {
  const parts = line.split(/\s+/);
  const directive = parts[0].toUpperCase();

  if (!VALID_DIRECTIVES.has(directive)) {
    state.errors.push(createError(
      BLUEPRINT_ERROR_CODES.PARSE_UNKNOWN_DIRECTIVE,
      "parse",
      `Unknown directive: ${directive}`,
      lineNum,
      directive,
      `Valid directives: ${Array.from(VALID_DIRECTIVES).join(", ")}`
    ));
    return;
  }

  // Check for duplicates (ANIM_START/END allowed multiple for nesting detection)
  if (directive !== ANIM_START_MARKER && directive !== ANIM_END_MARKER) {
    const existing = state.directives.get(directive);
    if (existing && !isMultiValueDirective(directive)) {
      state.errors.push(createError(
        BLUEPRINT_ERROR_CODES.PARSE_DUPLICATE_DIRECTIVE,
        "parse",
        `Duplicate directive: ${directive}`,
        lineNum,
        directive,
        `${directive} can only be specified once`
      ));
      return;
    }
  }

  const args = parts.slice(1);
  const existingArgs = state.directives.get(directive) || [];
  state.directives.set(directive, [...existingArgs, ...args]);
}

function isMultiValueDirective(directive: string): boolean {
  return directive === "CONSTRAINT" || directive === "QA" || directive === "METADATA";
}

// ─── Blueprint Builder ───────────────────────────────────────────────────────

function buildBlueprint(state: ParserState): AnimationBlueprintV1 {
  const get = (key: string): string | undefined => state.directives.get(key)?.join(" ");
  const getAll = (key: string): string[] => state.directives.get(key) || [];

  const targetParts = (get("TARGET") || "").split(/\s+/);
  const selectorType = (targetParts[0] || "id") as AnimationBlueprintV1["target"]["selectorType"];
  const targetValue = targetParts.slice(1).join(" ") || "";

  const easingParts = (get("EASE") || "").split(/\s+/);
  const easingType = (easingParts[0] || "token") as AnimationBlueprintV1["easing"]["type"];
  const easingValue = easingParts.slice(1).join(" ") || "linear";

  const loopStr = get("LOOP") || "1";
  const loop: number | "infinite" = loopStr.toLowerCase() === "infinite" ? "infinite" : parseInt(loopStr, 10) || 1;

  const blueprint: AnimationBlueprintV1 = {
    version: "1.0",
    id: get("ID") || "unknown",
    name: get("NAME") || undefined,
    description: get("DESCRIPTION") || undefined,
    target: {
      selectorType: selectorType === "id" || selectorType === "class" || selectorType === "role" || selectorType === "symbolic" || selectorType === "engine-target" ? selectorType : "id",
      value: targetValue,
    },
    preset: get("PRESET") || undefined,
    durationMs: parseInt(get("DURATION") || "0", 10) || 400,
    delayMs: parseInt(get("DELAY") || "0", 10) || 0,
    loop,
    easing: {
      type: easingType === "token" || easingType === "cubic" || easingType === "spring" || easingType === "custom" ? easingType : "token",
      value: easingValue,
    },
    phase: parseFloat(get("PHASE") || "0") || undefined,
  };

  // Parse transforms
  const transforms: AnimationBlueprintV1["transforms"] = {};
  
  for (const transform of ["SCALE", "ROTATE", "TRANSLATE_X", "TRANSLATE_Y", "OPACITY", "GLOW", "BLUR"]) {
    const value = get(transform);
    if (value) {
      const key = transform.toLowerCase().replace("_", "") as keyof typeof transforms;
      transforms[key] = parseTransform(value);
    }
  }

  if (Object.keys(transforms).length > 0) {
    blueprint.transforms = transforms;
  }

  // Parse envelopes
  const envelopeValues = getAll("ENVELOPE");
  if (envelopeValues.length > 0) {
    blueprint.envelopes = {};
    for (const envStr of envelopeValues) {
      const [target, kind, ...params] = envStr.split(/\s+/);
      if (target && kind) {
        blueprint.envelopes[target.toLowerCase()] = {
          kind: kind as AnimationBlueprintV1["envelopes"][string]["kind"],
          params: parseEnvelopeParams(params),
        };
      }
    }
  }

  // Parse symmetry
  const symmetryStr = get("SYMMETRY");
  if (symmetryStr) {
    blueprint.symmetry = parseSymmetry(symmetryStr);
  }

  // Parse grid
  const gridStr = get("GRID");
  if (gridStr) {
    blueprint.grid = parseGrid(gridStr);
  }

  // Parse anchor
  const anchorStr = get("ANCHOR");
  if (anchorStr) {
    blueprint.anchors = parseAnchor(anchorStr);
  }

  // Parse compositing
  const compositeStr = get("COMPOSITE");
  if (compositeStr) {
    blueprint.compositing = parseCompositing(compositeStr);
  }

  // Parse constraints
  const constraintValues = getAll("CONSTRAINT");
  if (constraintValues.length > 0) {
    blueprint.constraints = parseConstraints(constraintValues);
  }

  // Parse QA
  const qaValues = getAll("QA");
  if (qaValues.length > 0) {
    blueprint.qa = parseQA(qaValues);
  }

  // Parse metadata
  const metadataValues = getAll("METADATA");
  if (metadataValues.length > 0) {
    blueprint.metadata = parseMetadata(metadataValues);
  }

  return blueprint;
}

// ─── Sub-Parsers ─────────────────────────────────────────────────────────────

function parseTransform(value: string): AnimationBlueprintV1["transforms"]["scale"] {
  const parts = value.split(/\s+/);
  const result: Record<string, number | string> = {};

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].toLowerCase();
    const next = parts[i + 1];
    
    if (key === "base" && next) {
      result.base = parseFloat(next);
      i++;
    } else if (key === "peak" && next) {
      result.peak = parseFloat(next);
      i++;
    } else if (key === "min" && next) {
      result.min = parseFloat(next);
      i++;
    } else if (key === "max" && next) {
      result.max = parseFloat(next);
      i++;
    } else if (key === "unit" && next) {
      result.unit = next;
      i++;
    } else if (key === "env" && next) {
      result.envelope = { kind: next as any, params: {} };
      i++;
    }
  }

  return result as AnimationBlueprintV1["transforms"]["scale"];
}

function parseEnvelopeParams(params: string[]): Record<string, number | string | boolean> {
  const result: Record<string, number | string | boolean> = {};
  
  for (let i = 0; i < params.length; i++) {
    const key = params[i].toLowerCase();
    const value = params[i + 1];
    
    if (value) {
      if (key === "period" || key === "amplitude" || key === "phase" || key === "half_life" || key === "duration" || key === "decay") {
        result[key] = parseFloat(value);
      } else if (value.toLowerCase() === "true") {
        result[key] = true;
      } else if (value.toLowerCase() === "false") {
        result[key] = false;
      } else {
        result[key] = value;
      }
      i++;
    }
  }

  return result;
}

function parseSymmetry(value: string): AnimationBlueprintV1["symmetry"] {
  const parts = value.split(/\s+/);
  const result: AnimationBlueprintV1["symmetry"] = { type: "none" };

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].toLowerCase();
    const next = parts[i + 1];
    
    if (key === "type" && next) {
      result.type = next as AnimationBlueprintV1["symmetry"]["type"];
      i++;
    } else if (key === "order" && next) {
      result.order = parseInt(next, 10);
      i++;
    } else if (key === "origin" && next) {
      const x = parseFloat(next);
      const y = parseFloat(parts[i + 2] || "0.5");
      const space = (parts[i + 3] || "local") as "local" | "grid" | "world";
      result.origin = { x, y, space };
      i += 2;
    }
  }

  return result;
}

function parseGrid(value: string): AnimationBlueprintV1["grid"] {
  const parts = value.split(/\s+/);
  const result: AnimationBlueprintV1["grid"] = { mode: "free" };

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].toLowerCase();
    const next = parts[i + 1];
    
    if (key === "mode" && next) {
      result.mode = next as AnimationBlueprintV1["grid"]["mode"];
      i++;
    } else if (key === "lattice" && next) {
      result.latticeId = next;
      i++;
    } else if (key === "snap" && next) {
      result.snap = next.toLowerCase() === "true";
      i++;
    } else if (key === "cell_width" && next) {
      result.cellWidth = parseFloat(next);
      i++;
    } else if (key === "cell_height" && next) {
      result.cellHeight = parseFloat(next);
      i++;
    }
  }

  return result;
}

function parseAnchor(value: string): AnimationBlueprintV1["anchors"] {
  const parts = value.split(/\s+/);
  const result: AnimationBlueprintV1["anchors"] = {};

  for (let i = 0; i < parts.length; i++) {
    const key = parts[i].toLowerCase();
    const next = parts[i + 1];
    
    if (key === "pivot_x" && next) {
      result.pivotX = parseFloat(next);
      i++;
    } else if (key === "pivot_y" && next) {
      result.pivotY = parseFloat(next);
      i++;
    } else if (key === "space" && next) {
      result.originSpace = next as AnimationBlueprintV1["anchors"]["originSpace"];
      i++;
    }
  }

  return result;
}

function parseCompositing(value: string): AnimationBlueprintV1["compositing"] {
  const parts = value.split(/\s+/);
  const result: AnimationBlueprintV1["compositing"] = { pass: "css" };

  for (const part of parts) {
    const lower = part.toLowerCase();
    if (lower === "css" || lower === "phaser" || lower === "pixelbrain" || lower === "hybrid") {
      result.pass = lower as AnimationBlueprintV1["compositing"]["pass"];
    } else if (lower.startsWith("blend_")) {
      result.blendMode = lower.replace("blend_", "");
    } else if (lower.startsWith("z_")) {
      result.zLayer = parseInt(lower.replace("z_", ""), 10) || lower;
    }
  }

  return result;
}

function parseConstraints(values: string[]): AnimationBlueprintV1["constraints"] {
  const result: AnimationBlueprintV1["constraints"] = {};

  for (const value of values) {
    const parts = value.split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i].toLowerCase();
      const next = parts[i + 1];
      
      if (key === "deterministic" && next) {
        result.deterministic = next.toLowerCase() === "true";
        i++;
      } else if (key === "max_frame_ms" && next) {
        result.maxFrameMs = parseInt(next, 10);
        i++;
      } else if (key === "max_property_count" && next) {
        result.maxPropertyCount = parseInt(next, 10);
        i++;
      } else if (key === "allow_degradation" && next) {
        result.allowBackendDegradation = next.toLowerCase() === "true";
        i++;
      } else if (key === "require_parity" && next) {
        result.requireParityAcrossBackends = next.toLowerCase() === "true";
        i++;
      }
    }
  }

  return result;
}

function parseQA(values: string[]): AnimationBlueprintV1["qa"] {
  const result: AnimationBlueprintV1["qa"] = {};
  const invariants: string[] = [];

  for (const value of values) {
    const parts = value.split(/\s+/);
    const subKey = parts[0].toLowerCase();
    
    if (subKey === "invariant" && parts[1]) {
      invariants.push(parts[1]);
    } else if (subKey === "parity" && parts[1]) {
      result.parityMode = parts[1] as AnimationBlueprintV1["qa"]["parityMode"];
    } else if (subKey === "screenshot" && parts[1]) {
      result.screenshotRequired = parts[1].toLowerCase() === "true";
    }
  }

  if (invariants.length > 0) {
    result.invariants = invariants;
  }

  return result;
}

function parseMetadata(values: string[]): AnimationBlueprintV1["metadata"] {
  const result: AnimationBlueprintV1["metadata"] = {};

  for (const value of values) {
    const parts = value.split(/\s+/);
    for (let i = 0; i < parts.length; i++) {
      const key = parts[i].toLowerCase();
      const next = parts[i + 1];
      
      if (key === "author" && next) {
        result.author = next;
        i++;
      } else if (key === "created" && next) {
        result.createdAt = next;
        i++;
      } else if (key === "feature" && next) {
        result.feature = next;
        i++;
      } else if (key === "tag" && next) {
        result.tags = result.tags || [];
        result.tags.push(next);
        i++;
      }
    }
  }

  return result;
}

// ─── Error Helper ────────────────────────────────────────────────────────────

function createError(
  code: number,
  category: DiagnosticEntry["category"],
  message: string,
  line?: number,
  directive?: string,
  hint?: string
): DiagnosticEntry {
  return {
    code: `ANIM_${code.toString(16).toUpperCase().padStart(4, "0")}`,
    severity: "error",
    category,
    message,
    line,
    directive,
    hint,
  };
}

// ─── Export Utilities ────────────────────────────────────────────────────────

/**
 * Extract bytecode blueprint blocks from a markdown/PDR document
 */
export function extractBlueprintBlocks(markdown: string): Array<{ content: string; startIndex: number; endIndex: number }> {
  const blocks: Array<{ content: string; startIndex: number; endIndex: number }> = [];
  const lines = markdown.split("\n");
  
  let inBlock = false;
  let blockStart = -1;
  let blockContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    if (line === ANIM_START_MARKER && !inBlock) {
      inBlock = true;
      blockStart = i;
      blockContent = [line];
    } else if (inBlock) {
      blockContent.push(line);
      
      if (line === ANIM_END_MARKER) {
        blocks.push({
          content: blockContent.join("\n"),
          startIndex: blockStart,
          endIndex: i,
        });
        inBlock = false;
        blockContent = [];
      }
    }
  }

  return blocks;
}

/**
 * Parse all blueprint blocks from a markdown/PDR document
 */
export function parseBlueprintsFromDocument(markdown: string): BlueprintParseResult[] {
  const blocks = extractBlueprintBlocks(markdown);
  return blocks.map((block) => parseBlueprintBlock(block.content));
}
