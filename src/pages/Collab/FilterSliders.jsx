/**
 * FilterSliders — Interactive filters for task/agent filtering
 * Adapted from PixelBrain ParameterSliders
 */

import { useCallback } from 'react';

const SLIDER_CONFIG = {
  minPriority: {
    label: 'Min Priority',
    min: 0,
    max: 3,
    step: 1,
    labels: ['Low', 'Normal', 'High', 'Critical']
  },
  maxAge: {
    label: 'Max Age (hours)',
    min: 1,
    max: 48,
    step: 1,
    labels: null
  },
  limit: {
    label: 'Show Tasks',
    min: 10,
    max: 100,
    step: 10,
    labels: null
  }
};

export default function FilterSliders({ filters, onChange }) {
  const handleChange = useCallback((key, value) => {
    onChange(key, Number(value));
  }, [onChange]);

  return (
    <div className="filter-sliders">
      <div className="slider-section-header">
        <span className="section-title">Filters</span>
      </div>
      
      {Object.entries(filters).map(([key, value]) => {
        const config = SLIDER_CONFIG[key];
        if (!config) return null;

        return (
          <div key={key} className="slider-group">
            <div className="slider-header">
              <span className="slider-label">{config.label}</span>
              <span className="slider-value">
                {config.labels ? config.labels[value] : value}
              </span>
            </div>
            <input
              type="range"
              className="slider-input"
              min={config.min}
              max={config.max}
              step={config.step || 1}
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              aria-label={config.label}
            />
            {config.description && (
              <p className="slider-description">{config.description}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
