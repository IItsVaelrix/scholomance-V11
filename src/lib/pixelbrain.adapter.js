/**
 * PIXELBRAIN ADAPTER
 * 
 * Bridge between UI surface and Codex-level logic.
 * Ensures UI files don't violate architectural boundaries.
 */

// --- Coordinate & Formula Logic ---
import { 
  generatePixelArtFromImage as codexGeneratePixelArtFromImage,
  transcribeFullPixelData as codexTranscribeFullPixelData
} from '../../codex/core/pixelbrain/image-to-pixel-art';

import { 
  evaluateFormulaWithColor as codexEvaluateFormulaWithColor 
} from '../../codex/core/pixelbrain/formula-to-coordinates';

import { 
  parseErrorForAI as codexParseErrorForAI,
  BytecodeError as codexBytecodeError,
  ERROR_CATEGORIES as codexERROR_CATEGORIES,
  ERROR_SEVERITY as codexERROR_SEVERITY,
  MODULE_IDS as codexMODULE_IDS,
  ERROR_CODES as codexERROR_CODES
} from '../../codex/core/pixelbrain/bytecode-error.js';

import {
  analyzeImageToFormula as codexAnalyzeImageToFormula,
  formulaToBytecode as codexFormulaToBytecode,
  parseBytecodeToFormula as codexParseBytecodeToFormula,
  FORMULA_TYPES as codexFORMULA_TYPES
} from '../../codex/core/pixelbrain/image-to-bytecode-formula.js';

// --- Grid & Template Logic ---
import {
  createTemplateGrid as codexCreateTemplateGrid,
  clearCell as codexClearCell,
  exportToAseprite as codexExportToAseprite,
  generateGridPreview as codexGenerateGridPreview,
  getCellAtPosition as codexGetCellAtPosition,
  floodFill as codexFloodFill,
  GRID_TYPES as codexGRID_TYPES,
  setCell as codexSetCell
} from '../../codex/core/pixelbrain/template-grid-engine.js';

// --- Physics & Animation ---
import {
  getRotationAtTime as codexGetRotationAtTime
} from '../../codex/core/pixelbrain/gear-glide-amp.js';

import { roundTo as codexRoundTo } from '../../codex/core/pixelbrain/shared.js';

// --- EXPORTS ---

export const FORMULA_TYPES = codexFORMULA_TYPES;
export const GRID_TYPES = codexGRID_TYPES;

export const BytecodeError = codexBytecodeError;
export const ERROR_CATEGORIES = codexERROR_CATEGORIES;
export const ERROR_SEVERITY = codexERROR_SEVERITY;
export const MODULE_IDS = codexMODULE_IDS;
export const ERROR_CODES = codexERROR_CODES;

export function generatePixelArtFromImage(analysis, canvasSize, extension) {
  return codexGeneratePixelArtFromImage(analysis, canvasSize, extension);
}

export function transcribeFullPixelData(pixelData, dimensions, canvasSize) {
  return codexTranscribeFullPixelData(pixelData, dimensions, canvasSize);
}

export function evaluateFormulaWithColor(formula, canvasSize, time) {
  return codexEvaluateFormulaWithColor(formula, canvasSize, time);
}

export function parseErrorForAI(error) {
  return codexParseErrorForAI(error);
}

export function analyzeImageToFormula(analysis) {
  return codexAnalyzeImageToFormula(analysis);
}

export function formulaToBytecode(formula) {
  return codexFormulaToBytecode(formula);
}

export function parseBytecodeToFormula(bytecode) {
  return codexParseBytecodeToFormula(bytecode);
}

export function createTemplateGrid(config) {
  return codexCreateTemplateGrid(config);
}

export function clearCell(layer, x, y) {
  return codexClearCell(layer, x, y);
}

export function exportToAseprite(grid) {
  return codexExportToAseprite(grid);
}

export function generateGridPreview(grid) {
  return codexGenerateGridPreview(grid);
}

export function getCellAtPosition(grid, x, y) {
  return codexGetCellAtPosition(grid, x, y);
}

export function floodFill(grid, layer, x, y, color) {
  return codexFloodFill(grid, layer, x, y, color);
}

export function setCell(layer, x, y, color, emphasis) {
  return codexSetCell(layer, x, y, color, emphasis);
}

export function getRotationAtTime(time, bpm) {
  return codexGetRotationAtTime(time, bpm);
}

export function roundTo(val, precision) {
  return codexRoundTo(val, precision);
}
