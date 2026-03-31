/**
 * ExportOptions — Export asset in various formats
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  DownloadIcon,
  CodeIcon,
  ImageIcon,
  LayersIcon,
  CheckIcon,
  PaletteIcon,
  LoadingIcon
} from "../../../components/Icons.jsx";

const EXPORT_PRESETS = {
  GODOT: {
    name: 'Godot Engine',
    format: 'PNG',
    scale: 1,
    metadata: true
  },
  UNITY: {
    name: 'Unity',
    format: 'PNG',
    scale: 2,
    metadata: true
  },
  WEB: {
    name: 'Web',
    format: 'PNG',
    scale: 1,
    metadata: false
  },
  FORMULA: {
    name: 'Formula Only',
    format: 'JSON',
    scale: 1,
    metadata: false
  }
};

export function ExportOptions({ onExport, formula, coordinates, palettes }) {
  const [selectedPreset, setSelectedPreset] = useState('GODOT');
  const [isExporting, setIsExporting] = useState(false);
  const [copiedFormula, setCopiedFormula] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      await onExport?.(selectedPreset);
    } finally {
      setIsExporting(false);
    }
  }, [onExport, selectedPreset]);

  const handleCopyFormula = useCallback(async () => {
    if (formula) {
      await navigator.clipboard.writeText(JSON.stringify(formula, null, 2));
      setCopiedFormula(true);
      setTimeout(() => setCopiedFormula(false), 2000);
    }
  }, [formula]);

  const preset = EXPORT_PRESETS[selectedPreset];

  return (
    <motion.div
      className="export-options"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h4 className="section-title">
        <DownloadIcon />
        Export
      </h4>

      {/* Export Summary */}
      <div className="export-summary">
        <div className="summary-item">
          <ImageIcon className="summary-icon" />
          <span>
            {coordinates?.length || 0} coordinates
          </span>
        </div>
        <div className="summary-item">
          <PaletteIcon className="summary-icon" />
          <span>
            {palettes?.[0]?.colors?.length || 0} colors
          </span>
        </div>
        <div className="summary-item">
          <LayersIcon className="summary-icon" />
          <span>
            {preset.scale}x scale
          </span>
        </div>
      </div>

      {/* Preset Selection */}
      <div className="preset-list">
        {Object.entries(EXPORT_PRESETS).map(([key, config]) => (
          <button
            key={key}
            className={`preset-item ${selectedPreset === key ? 'is-selected' : ''}`}
            onClick={() => setSelectedPreset(key)}
          >
            <span className="preset-name">{config.name}</span>
            <span className="preset-format">{config.format}</span>
            {selectedPreset === key && (
              <CheckIcon className="preset-check" />
            )}
          </button>
        ))}
      </div>

      {/* Export Actions */}
      <div className="export-actions">
        <button
          className="btn btn-primary btn-full"
          onClick={handleExport}
          disabled={isExporting || !coordinates?.length}
        >
          {isExporting ? (
            <>
              <LoadingIcon />
              Exporting...
            </>
          ) : (
            <>
              <DownloadIcon />
              Export {preset.format}
            </>
          )}
        </button>

        <button
          className="btn btn-secondary btn-full"
          onClick={handleCopyFormula}
        >
          <CodeIcon />
          {copiedFormula ? 'Copied!' : 'Copy Formula'}
        </button>
      </div>

      {/* Export Info */}
      <div className="export-info">
        <p>
          <strong>Note:</strong> {preset.metadata ? 'Includes' : 'Excludes'} bytecode metadata for future editing
        </p>
      </div>
    </motion.div>
  );
}

export default ExportOptions;
