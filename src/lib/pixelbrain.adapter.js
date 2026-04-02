/**
 * PIXELBRAIN ADAPTER
 *
 * Bridge between UI surface and Codex-level logic.
 * Ensures UI files don't violate architectural boundaries.
 */

import { processorBridge } from './processor-bridge.js';

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
  setCell as codexSetCell,
  toggleSymmetryAxis as codexToggleSymmetryAxis,
} from '../../codex/core/pixelbrain/template-grid-engine.js';

// --- Lattice Grid Engine (NEW) ---
import {
  generateLatticeGrid as codexGenerateLatticeGrid,
  renderLattice as codexRenderLattice,
  paintCell as codexPaintCell,
  clearCell as codexClearLatticeCell,
  exportLatticeToAseprite as codexExportLatticeToAseprite,
  buildOccupancySet as codexBuildOccupancySet,
  resolveLatticeClick as codexResolveLatticeClick,
} from '../../codex/core/pixelbrain/lattice-grid-engine.js';

// --- Symmetry AMP ---
import {
  detectSymmetry as codexDetectSymmetry,
  applySymmetryToLattice as codexApplySymmetryToLattice,
  generateSymmetryOverlay as codexGenerateSymmetryOverlay,
} from '../../codex/core/pixelbrain/symmetry-amp.js';

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

export function toggleSymmetryAxis(grid, axis) {
  return codexToggleSymmetryAxis(grid, axis);
}

export function getRotationAtTime(time, bpm) {
  return codexGetRotationAtTime(time, bpm);
}

export function roundTo(val, precision) {
  return codexRoundTo(val, precision);
}

// --- LATTICE GRID ENGINE EXPORTS ---

export async function generateLatticeGrid(analysis) {
  return codexGenerateLatticeGrid(analysis);
}

export function renderLattice(canvas, lattice, zoom) {
  return codexRenderLattice(canvas, lattice, zoom);
}

export function paintCell(lattice, col, row, color) {
  return codexPaintCell(lattice, col, row, color);
}

export function clearLatticeCell(lattice, col, row) {
  return codexClearLatticeCell(lattice, col, row);
}

export function exportLatticeToAseprite(lattice, targetWidth, targetHeight) {
  return codexExportLatticeToAseprite(lattice, targetWidth, targetHeight);
}

export function buildOccupancySet(lattice) {
  return codexBuildOccupancySet(lattice);
}

export function resolveLatticeClick(clientX, clientY, rect, lattice, zoom, offsetX, offsetY) {
  return codexResolveLatticeClick(clientX, clientY, rect, lattice, zoom, offsetX, offsetY);
}

// --- SYMMETRY AMP EXPORTS ---

export function detectSymmetry(pixelData, dimensions) {
  return codexDetectSymmetry(pixelData, dimensions);
}

export function applySymmetryToLattice(lattice, symmetry) {
  return codexApplySymmetryToLattice(lattice, symmetry);
}

export function generateSymmetryOverlay(symmetry, width, height, zoom) {
  return codexGenerateSymmetryOverlay(symmetry, width, height, zoom);
}

// --- SYMMETRY AMP MICROPROCESSOR ---
/**
 * Run Symmetry AMP as a microprocessor stage
 * @param {Object} input - SymmetryAmpInput contract
 * @returns {SymmetryAmpOutput} SymmetryAmpOutput contract
 */
export function runSymmetryAmpProcessor(input) {
  return processorBridge.execute('amp.symmetry', input);
}

/**
 * Run Coord Symmetry AMP as a microprocessor stage
 * @param {Object} input - CoordSymmetryInput contract
 * @returns {CoordSymmetryOutput} CoordSymmetryOutput contract
 */
export function runCoordSymmetryAmp(input) {
  return processorBridge.execute('amp.coord-symmetry', input);
}

// Re-export transform functions for testing
export {
  verticalMirror,
  horizontalMirror,
  radialRotate,
  diagonalMirror,
} from '../../codex/core/pixelbrain/coord-symmetry-amp.js';
