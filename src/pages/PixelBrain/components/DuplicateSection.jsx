import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { TextureSelector } from './TextureSelector';
import { DuplicatePreviewGrid } from './DuplicatePreviewGrid';
import { SCHOOLS } from '../../../../codex/core/constants/schools.js';

export function DuplicateSection({ referenceFile, isProcessing, onProcessingChange }) {
  const [selectedTextures, setSelectedTextures] = useState(['parchment']);
  const [selectedSchools, setSelectedSchools] = useState([]);
  const [duplicates, setDuplicates] = useState([]);
  const [blendMode, setBlendMode] = useState('multiply');
  const [opacity, setOpacity] = useState(0.7);

  const toggleTexture = useCallback((id) => {
    setSelectedTextures(prev => 
      prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]
    );
  }, []);

  const toggleSchool = useCallback((id) => {
    setSelectedSchools(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  }, []);

  const handleInitiateEcho = useCallback(async () => {
    if (!referenceFile) return;
    
    onProcessingChange(true);
    try {
      const formData = new FormData();
      formData.append('image', referenceFile);
      formData.append('textures', JSON.stringify(selectedTextures));
      formData.append('schools', JSON.stringify(selectedSchools));
      formData.append('blendMode', blendMode);
      formData.append('opacity', opacity.toString());
      formData.append('count', '5');

      const response = await fetch('/api/image/duplicate', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (result.success) {
        setDuplicates(result.duplicates);
      }
    } catch (error) {
      console.error('[DuplicateSection] Echo failed:', error);
    } finally {
      onProcessingChange(false);
    }
  }, [referenceFile, selectedTextures, selectedSchools, blendMode, opacity, onProcessingChange]);

  const handleDownload = useCallback((dup) => {
    const link = document.createElement('a');
    link.href = dup.url;
    link.download = `echo_${dup.id}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  return (
    <div className="duplicate-section grimoire-panel">
      <div className="section-header">
        <span className="header-icon">✦</span>
        <span>ECHO CHAMBER: TEXTURE DUPLICATION</span>
      </div>

      <div className="duplicate-options">
        <TextureSelector 
          selectedTextures={selectedTextures}
          onToggleTexture={toggleTexture}
        />

        <div className="school-overlay-picker">
          <label className="section-label telemetry-text">School Overlays</label>
          <div className="school-grid-mini">
            {Object.keys(SCHOOLS).map(schoolId => (
              <button
                key={schoolId}
                className={`mini-school-btn ${selectedSchools.includes(schoolId) ? 'active' : ''}`}
                onClick={() => toggleSchool(schoolId)}
                style={{ '--school-color': SCHOOLS[schoolId].color }}
              >
                {SCHOOLS[schoolId].glyph}
              </button>
            ))}
          </div>
        </div>

        <div className="slider-group">
          <div className="slider-item">
            <label className="telemetry-text">OPACITY: {Math.round(opacity * 100)}%</label>
            <input 
              type="range" 
              min="0" max="1" step="0.1" 
              value={opacity} 
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
            />
          </div>
        </div>

        <motion.button
          className="transmute-ignite-btn"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!referenceFile || isProcessing}
          onClick={handleInitiateEcho}
        >
          {isProcessing ? 'INITIATING ECHO...' : 'INITIATE VOID ECHO'}
        </motion.button>
      </div>

      <DuplicatePreviewGrid 
        duplicates={duplicates}
        onDownload={handleDownload}
      />
    </div>
  );
}
