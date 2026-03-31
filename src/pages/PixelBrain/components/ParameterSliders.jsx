/**
 * ParameterSliders — Real-time parameter adjustment with visual feedback
 */

import { useCallback } from 'react';
import { motion } from 'framer-motion';

export function ParameterSliders({ parameters, onChange, school }) {
  const handleChange = useCallback((key, value) => {
    onChange?.(key, parseFloat(value));
  }, [onChange]);

  const paramConfigs = {
    amplitude: {
      label: 'Amplitude',
      min: 0,
      max: 100,
      step: 1,
      unit: 'px',
      description: 'Controls the size/radius of the pattern'
    },
    frequency: {
      label: 'Frequency',
      min: 0.01,
      max: 1,
      step: 0.01,
      unit: '',
      description: 'Controls how many loops/iterations'
    },
    phase: {
      label: 'Phase',
      min: 0,
      max: Math.PI * 2,
      step: 0.1,
      unit: 'rad',
      description: 'Rotation offset in radians'
    },
    points: {
      label: 'Points',
      min: 8,
      max: 256,
      step: 8,
      unit: '',
      description: 'Number of coordinate points to generate'
    },
    scale: {
      label: 'Scale',
      min: 0.5,
      max: 2,
      step: 0.1,
      unit: 'x',
      description: 'Overall size multiplier'
    },
    complexity: {
      label: 'Complexity',
      min: 0,
      max: 1,
      step: 0.05,
      unit: '',
      description: 'Pattern complexity level'
    }
  };

  return (
    <motion.div
      className="parameter-sliders"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h4 className="section-title">Parameters</h4>
      
      {Object.entries(parameters).map(([key, value]) => {
        const config = paramConfigs[key] || {
          label: key,
          min: 0,
          max: 100,
          step: 1,
          unit: ''
        };

        return (
          <div key={key} className="slider-group">
            <div className="slider-header">
              <label htmlFor={`slider-${key}`} className="slider-label">
                {config.label}
              </label>
              <span className="slider-value">
                {typeof value === 'number' ? value.toFixed(2) : value}
                {config.unit}
              </span>
            </div>
            
            <input
              id={`slider-${key}`}
              type="range"
              min={config.min}
              max={config.max}
              step={config.step}
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className="slider-input"
              style={{
                '--school-primary': `var(--${school?.toLowerCase() || 'void'}-primary)`
              }}
            />
            
            <p className="slider-description">{config.description}</p>
          </div>
        );
      })}
    </motion.div>
  );
}

export default ParameterSliders;
