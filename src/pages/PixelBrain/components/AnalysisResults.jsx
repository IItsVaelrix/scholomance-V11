/**
 * AnalysisResults — Display image analysis results
 */

import { motion } from 'framer-motion';
import { 
  TrendingUpIcon, 
  PaletteIcon, 
  GridIcon, 
  SymmetryIcon 
} from "../../../components/Icons.jsx";

export function AnalysisResults({ analysis }) {
  if (!analysis) return null;

  const { composition, colors, dimensions } = analysis;

  return (
    <motion.div
      className="analysis-results"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
    >
      <h4 className="section-title">
        <TrendingUpIcon />
        Analysis Results
      </h4>

      <div className="analysis-grid">
        {/* Dimensions */}
        <div className="analysis-card">
          <GridIcon className="card-icon" />
          <div className="card-content">
            <span className="card-label">Dimensions</span>
            <span className="card-value">
              {dimensions?.original?.width} × {dimensions?.original?.height}
            </span>
          </div>
        </div>

        {/* Dominant Axis */}
        <div className="analysis-card">
          <TrendingUpIcon className="card-icon" />
          <div className="card-content">
            <span className="card-label">Dominant Axis</span>
            <span className="card-value">
              {composition?.dominantAxis || 'Horizontal'}
            </span>
          </div>
        </div>

        {/* Symmetry */}
        <div className="analysis-card">
          <SymmetryIcon className="card-icon" />
          <div className="card-content">
            <span className="card-label">Symmetry</span>
            <span className="card-value">
              {composition?.hasSymmetry ? composition.symmetryType : 'None'}
            </span>
          </div>
        </div>

        {/* Colors */}
        <div className="analysis-card">
          <PaletteIcon className="card-icon" />
          <div className="card-content">
            <span className="card-label">Dominant Colors</span>
            <span className="card-value">{colors?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Color Palette Preview */}
      {colors && colors.length > 0 && (
        <div className="color-palette">
          <span className="palette-label">Extracted Palette</span>
          <div className="palette-swatches">
            {colors.slice(0, 8).map((color, index) => (
              <div
                key={index}
                className="palette-swatch"
                style={{ backgroundColor: color.hex }}
                title={`${color.hex} (${Math.round(color.percentage)}%)`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Complexity Meter */}
      {composition && (
        <div className="complexity-meter">
          <span className="meter-label">Complexity</span>
          <div className="meter-track">
            <div
              className="meter-fill"
              style={{ width: `${(composition.complexity || 0.5) * 100}%` }}
            />
          </div>
          <span className="meter-value">
            {Math.round((composition.complexity || 0.5) * 100)}%
          </span>
        </div>
      )}
    </motion.div>
  );
}

export default AnalysisResults;
