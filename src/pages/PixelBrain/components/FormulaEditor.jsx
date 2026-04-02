/**
 * FormulaEditor — Display and edit bytecode formulas
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  CopyIcon, 
  RefreshIcon, 
  CheckIcon, 
  EditIcon,
  CodeIcon 
} from "../../../components/Icons.jsx";

export function FormulaEditor({ formula, onUpdate, onRegenerate }) {
  const [isEditing, setIsEditing] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (formula?.bytecode) {
      await navigator.clipboard.writeText(formula.bytecode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [formula?.bytecode]);

  const handleParamChange = useCallback((key, value) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      onUpdate?.({
        ...formula,
        coordinateFormula: {
          ...formula.coordinateFormula,
          parameters: { ...formula.coordinateFormula.parameters, [key]: numValue }
        }
      });
    }
  }, [formula, onUpdate]);

  if (!formula) {
    return (
      <div className="formula-editor formula-empty">
        <CodeIcon className="empty-icon" />
        <p>No formula generated yet</p>
        <p className="hint">Upload an image to generate a bytecode formula</p>
      </div>
    );
  }

  const { bytecode, formulaType, coordinateFormula } = formula;
  const params = coordinateFormula?.parameters || {};

  return (
    <motion.div
      className="formula-editor"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="formula-header">
        <h4 className="section-title">
          <CodeIcon />
          Bytecode Formula
        </h4>
        <div className="formula-actions">
          <button
            className="btn btn-icon"
            onClick={handleCopy}
            title="Copy bytecode"
            aria-label="Copy bytecode"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button
            className="btn btn-icon"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? 'View mode' : 'Edit mode'}
            aria-label={isEditing ? 'View mode' : 'Edit mode'}
          >
            <EditIcon />
          </button>
          <button
            className="btn btn-icon"
            onClick={onRegenerate}
            title="Regenerate formula"
            aria-label="Regenerate formula"
          >
            <RefreshIcon />
          </button>
        </div>
      </div>

      {/* Bytecode Display */}
      <div className="formula-bytecode">
        <code className="bytecode-string">
          {bytecode?.substring(0, 60)}...
        </code>
        <button
          className="btn btn-sm btn-ghost"
          onClick={handleCopy}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Formula Info */}
      <div className="formula-info">
        <span className="info-label">Type:</span>
        <span className="info-value">{formulaType || 'parametric_curve'}</span>
      </div>

      {/* Parameter Editors */}
      <div className="formula-params">
        <h5>Parameters</h5>
        {Object.entries(params).map(([key, value]) => (
          <div key={key} className="param-row">
            <label htmlFor={`param-${key}`} className="param-label">
              {key}
            </label>
            {isEditing ? (
              <input
                id={`param-${key}`}
                type="number"
                value={value}
                onChange={(e) => handleParamChange(key, e.target.value)}
                className="param-input"
                step="0.1"
              />
            ) : (
              <span className="param-value">{value}</span>
            )}
          </div>
        ))}
      </div>

      {/* Validation Status */}
      {formula.validation && (
        <div className={`formula-status formula-status--${formula.validation.status}`}>
          {formula.validation.status === 'valid' ? (
            <CheckIcon className="status-icon" />
          ) : (
            <span className="status-icon">!</span>
          )}
          <span>{formula.validation.message}</span>
        </div>
      )}
    </motion.div>
  );
}

export default FormulaEditor;
