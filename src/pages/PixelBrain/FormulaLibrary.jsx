/**
 * FORMULA LIBRARY — Registry of mathematical visual sigils
 *
 * Browses, saves, and applies formula presets for infinite asset generation.
 * Organizes formulas by arcane school and complexity.
 */

import { motion } from 'framer-motion';
import { FORMULA_TYPES } from '../../lib/pixelbrain.adapter.js';

const FORMULA_PRESETS = [
  {
    id: 'harmonic_bloom',
    name: 'Harmonic Bloom',
    type: FORMULA_TYPES.PARAMETRIC_CURVE,
    school: 'SONIC',
    description: 'Expanding radial harmonics driven by sine-summation.',
    bytecode: '0xFP_32x32_8c_d1_gg4',
    formula: {
      type: FORMULA_TYPES.PARAMETRIC_CURVE,
      parameters: { cx: 80, cy: 72, a: 60, b: 0.05, c: 0, n: 128 }
    }
  },
  {
    id: 'void_lattice',
    name: 'Void Lattice',
    type: FORMULA_TYPES.GRID_PROJECTION,
    school: 'VOID',
    description: 'Isometric subdivision of the entropy field.',
    bytecode: '0xFG_16x16_4c_d0_gg2',
    formula: {
      type: FORMULA_TYPES.GRID_PROJECTION,
      gridType: 'isometric',
      cellSize: 16,
      snapStrength: 0.9
    }
  },
  {
    id: 'alchemy_recursion',
    name: 'Alchemical Recursion',
    type: FORMULA_TYPES.FRACTAL_ITER,
    school: 'ALCHEMY',
    description: 'Self-similar transmutative structures.',
    bytecode: '0xFF_64x64_16c_d2_gg6',
    formula: {
      type: FORMULA_TYPES.FRACTAL_ITER,
      iterations: 4,
      seed: 0.618
    }
  },
  {
    id: 'neural_spiral',
    name: 'Neural Spiral',
    type: FORMULA_TYPES.PARAMETRIC_CURVE,
    school: 'PSYCHIC',
    description: 'Divergent thought-spiral mapped to logarithmic curves.',
    bytecode: '0xFP_48x48_6c_d1_gg8',
    formula: {
      type: FORMULA_TYPES.PARAMETRIC_CURVE,
      parameters: { cx: 80, cy: 72, a: 40, b: 0.12, c: 1.5, n: 96 }
    }
  },
  {
    id: 'golden_sigil',
    name: 'Golden Sigil',
    type: 'fibonacci',
    school: 'ALCHEMY',
    description: 'Recursive golden subdivision following the Phi constant.',
    bytecode: '0xFT_160x144_4c_d0_gg1',
    formula: {
      type: 'fibonacci',
      iterations: 8,
      scale: 1,
      coordinateFormula: {
        type: 'fibonacci',
        parameters: { iterations: 8, scale: 1 }
      },
      template: {
        gridWidth: 160,
        gridHeight: 144,
        cellSize: 8,
      }
    }
  }
];

export function FormulaLibrary({ onSelect, currentFormulaId }) {
  return (
    <div className="formula-library">
      <div className="section-header">
        <span className="header-icon">◈</span>
        <span>FORMULA REGISTRY</span>
      </div>

      <div className="formula-grid">
        {FORMULA_PRESETS.map((preset) => (
          <motion.button
            key={preset.id}
            className={`formula-card ${currentFormulaId === preset.id ? 'active' : ''}`}
            onClick={() => onSelect(preset)}
            whileHover={{ scale: 1.02, x: 4 }}
            whileTap={{ scale: 0.98 }}
          >
            <div className="formula-card__header">
              <span className="formula-name">{preset.name}</span>
              <span className={`school-badge school-${preset.school.toLowerCase()}`}>
                {preset.school}
              </span>
            </div>
            
            <p className="formula-desc">{preset.description}</p>
            
            <div className="formula-card__footer">
              <code className="bytecode-preview">{preset.bytecode}</code>
              <span className="type-label">{preset.type.split('_')[0]}</span>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

export default FormulaLibrary;
