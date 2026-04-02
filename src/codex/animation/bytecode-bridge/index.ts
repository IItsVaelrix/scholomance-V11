/**
 * Bytecode Blueprint Bridge — Main Entry Point
 * 
 * Unified API for parsing, validating, compiling, and executing animation blueprints.
 * 
 * Usage:
 * ```ts
 * import { BytecodeBlueprintBridge } from './bytecode-bridge';
 * 
 * const result = await BytecodeBlueprintBridge.execute({
 *   source: blueprintString,
 *   targets: ['css', 'phaser'],
 *   execute: true,
 *   targetElement: element,
 * });
 * ```
 */

import {
  AnimationBlueprintV1,
  CompiledAnimationOutput,
  BlueprintParseResult,
  BlueprintValidateResult,
  BlueprintCompileResult,
} from "./contracts/blueprint.types.ts";

import {
  parseBlueprintBlock,
  parseBlueprintsFromDocument,
  extractBlueprintBlocks,
} from "./parser/blueprintParser.ts";

import {
  validateBlueprint,
  expandPresets,
  BlueprintValidator,
} from "./validator/blueprintValidator.ts";

import {
  compileBlueprint,
  BlueprintCompiler,
} from "./compiler/blueprintCompiler.ts";

import {
  CSSAdapter,
  PhaserAdapter,
  PixelBrainAdapter,
  BytecodeAdapter,
  AdapterRegistry,
  BackendAdapter,
  AdapterApplyOptions,
  AdapterApplyResult,
} from "./adapters/backendAdapters.ts";

import {
  validateAnimationBlueprint,
  AnimationBlueprintV1Schema,
} from "./contracts/blueprint.schemas.ts";

// ─── Bridge API ──────────────────────────────────────────────────────────────

export interface BridgeExecuteOptions {
  /** Blueprint source string or parsed blueprint */
  source: string | AnimationBlueprintV1;
  
  /** Compilation targets (default: all) */
  targets?: Array<"css" | "phaser" | "pixelbrain" | "bytecode">;
  
  /** Execute the compiled animation immediately */
  execute?: boolean;
  
  /** Target element for execution */
  targetElement?: HTMLElement | Phaser.GameObjects.GameObject | unknown;
  
  /** Preset registry for expansion */
  presets?: Map<string, { name: string; version: string; defaults: Partial<AnimationBlueprintV1> }>;
  
  /** Callbacks */
  onStart?: () => void;
  onComplete?: () => void;
  onUpdate?: (progress: number) => void;
}

export interface BridgeExecuteResult {
  success: boolean;
  parseResult?: BlueprintParseResult;
  validateResult?: BlueprintValidateResult;
  compileResult?: BlueprintCompileResult;
  executionResult?: AdapterApplyResult;
  output?: CompiledAnimationOutput;
  errors: Array<{ code: string; message: string; severity: string }>;
  warnings: Array<{ code: string; message: string; severity: string }>;
}

/**
 * Compilation cache to avoid re-parsing/compiling identical blueprints
 */
const compilationCache = new Map<string, {
  blueprint: AnimationBlueprintV1;
  compileResult: BlueprintCompileResult;
  timestamp: number;
}>();

const CACHE_TTL_MS = 60000; // 1 minute cache

/**
 * Clear expired cache entries
 */
function cleanupCache(): void {
  const now = Date.now();
  for (const [key, value] of compilationCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS) {
      compilationCache.delete(key);
    }
  }
}

// Run cleanup every 2 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupCache, 120000);
}

/**
 * Main bridge execution function
 */
export async function executeBlueprint(options: BridgeExecuteOptions): Promise<BridgeExecuteResult> {
  const errors: Array<{ code: string; message: string; severity: string }> = [];
  const warnings: Array<{ code: string; message: string; severity: string }> = [];
  
  let blueprint: AnimationBlueprintV1;
  let parseResult: BlueprintParseResult | undefined;
  let validateResult: BlueprintValidateResult | undefined;
  let compileResult: BlueprintCompileResult | undefined;
  let executionResult: AdapterApplyResult | undefined;

  // Generate cache key
  const sourceStr = typeof options.source === "string" ? options.source : JSON.stringify(options.source);
  const cacheKey = `${sourceStr}-${options.targets?.join(',') || 'all'}`;
  
  // Check cache first
  const cached = compilationCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    blueprint = cached.blueprint;
    compileResult = cached.compileResult;
  } else {
    // Step 1: Parse if source is a string
    if (typeof options.source === "string") {
      parseResult = parseBlueprintBlock(options.source);
      
      if (!parseResult.success || !parseResult.blueprint) {
        errors.push(...parseResult.errors.map(e => ({ code: e.code, message: e.message, severity: e.severity })));
        return {
          success: false,
          parseResult,
          errors,
          warnings: warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })),
        };
      }
      
      blueprint = parseResult.blueprint;
      warnings.push(...parseResult.warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })));
    } else {
      blueprint = options.source;
    }

  // Step 2: Expand presets
  if (options.presets && blueprint.preset) {
    blueprint = expandPresets(blueprint, options.presets as Map<string, any>);
  }

  // Step 3: Validate
  validateResult = validateBlueprint(blueprint);
  
  if (!validateResult.valid) {
    errors.push(...validateResult.errors.map(e => ({ code: e.code, message: e.message, severity: e.severity })));
    return {
      success: false,
      parseResult,
      validateResult,
      errors,
      warnings: warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })),
    };
  }
  
  warnings.push(...validateResult.warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })));

  // Step 4: Compile
  compileResult = compileBlueprint(blueprint, {
    targets: options.targets,
  });
  
  if (!compileResult.success || !compileResult.output) {
    errors.push(...compileResult.errors.map(e => ({ code: e.code, message: e.message, severity: e.severity })));
    return {
      success: false,
      parseResult,
      validateResult,
      compileResult,
      errors,
      warnings: warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })),
    };
  }
  
  warnings.push(...compileResult.warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })));

  // Cache the compilation result
  compilationCache.set(cacheKey, {
    blueprint,
    compileResult,
    timestamp: Date.now(),
  });
  }

  // Step 5: Execute (if requested)
  if (options.execute && options.targetElement && compileResult.output) {
    const { targets } = compileResult.output;
    
    // Determine which adapter to use based on targets and preference
    let adapter: BackendAdapter | undefined;
    let payload: any;
    
    if (targets.css) {
      adapter = CSSAdapter;
      payload = targets.css;
    } else if (targets.phaser) {
      adapter = PhaserAdapter;
      payload = targets.phaser;
    } else if (targets.pixelbrain) {
      adapter = PixelBrainAdapter;
      payload = targets.pixelbrain;
    } else if (targets.bytecode) {
      adapter = BytecodeAdapter;
      payload = targets.bytecode;
    }
    
    if (adapter && payload) {
      executionResult = adapter.apply({
        targetElement: options.targetElement,
        payload,
        onStart: options.onStart,
        onComplete: options.onComplete,
        onUpdate: options.onUpdate,
      });
      
      if (!executionResult.success) {
        errors.push(...executionResult.errors.map(e => ({ code: e.code, message: e.message, severity: e.severity })));
      }
      
      warnings.push(...executionResult.warnings.map(w => ({ code: w.code, message: w.message, severity: w.severity })));
    }
  }

  return {
    success: errors.length === 0,
    parseResult,
    validateResult,
    compileResult,
    executionResult,
    output: compileResult.output,
    errors,
    warnings,
  };
}

/**
 * Parse and validate a blueprint without compiling
 */
export function parseAndValidate(source: string): {
  success: boolean;
  blueprint?: AnimationBlueprintV1;
  parseResult: BlueprintParseResult;
  validateResult: BlueprintValidateResult;
} {
  const parseResult = parseBlueprintBlock(source);
  
  if (!parseResult.success || !parseResult.blueprint) {
    return {
      success: false,
      parseResult,
      validateResult: { valid: false, errors: [], warnings: [] },
    };
  }
  
  const validateResult = validateBlueprint(parseResult.blueprint);
  
  return {
    success: validateResult.valid,
    blueprint: parseResult.blueprint,
    parseResult,
    validateResult,
  };
}

/**
 * Compile a blueprint to specific targets
 */
export function compileToTargets(
  blueprint: AnimationBlueprintV1,
  targets: Array<"css" | "phaser" | "pixelbrain" | "bytecode">
): BlueprintCompileResult {
  return compileBlueprint(blueprint, { targets });
}

/**
 * Get adapter capabilities
 */
export function getAdapterCapabilities(adapterName: string) {
  const adapter = AdapterRegistry.get(adapterName);
  return adapter?.capabilities;
}

/**
 * Check if an adapter supports a feature
 */
export function adapterSupports(adapterName: string, feature: string): boolean {
  return AdapterRegistry.supports(adapterName, feature);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

export const BytecodeBlueprintBridge = {
  execute: executeBlueprint,
  parseAndValidate,
  compileToTargets,
  getAdapterCapabilities,
  adapterSupports,
  
  // Direct access to subsystems
  parser: {
    parse: parseBlueprintBlock,
    parseFromDocument: parseBlueprintsFromDocument,
    extractBlocks: extractBlueprintBlocks,
  },
  
  validator: BlueprintValidator,
  compiler: BlueprintCompiler,
  adapters: AdapterRegistry,
  
  // Schema access
  schema: AnimationBlueprintV1Schema,
  validateSchema: validateAnimationBlueprint,
};

// ─── Default Export ──────────────────────────────────────────────────────────

export default BytecodeBlueprintBridge;
