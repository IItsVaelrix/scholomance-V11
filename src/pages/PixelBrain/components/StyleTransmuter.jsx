/**
 * STYLE TRANSMUTER — Neural Style Transfer for External AI Art
 * 
 * Re-skins reference images using school color laws and retro era constraints.
 */

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { processorBridge } from '../../../lib/processor-bridge.js';
import { SCHOOLS } from '../../../../codex/core/constants/schools.js';

export function StyleTransmuter({ referenceFile, onTransmute, isProcessing }) {
  const [selectedSchool, setSelectedSchool] = useState('VOID');
  const [selectedStyle, setSelectedStyle] = useState('none');
  
  const ERA_STYLES = [
    { id: 'none', label: 'MODERN (1:1)' },
    { id: 'gameboy', label: 'GAMEBOY (4-COLOR)' },
    { id: 'nes', label: '8-BIT (NES)' },
    { id: 'vga', label: '16-BIT (VGA)' },
  ];

  const handleTransmute = useCallback(async () => {
    if (!referenceFile) return;

    try {
      // 1. Read file as buffer
      const buffer = await referenceFile.arrayBuffer();
      
      // 2. Execute Transmutation via Bridge (Worker-safe)
      const result = await processorBridge.execute('pixel.transmute', {
        buffer: Buffer.from(buffer),
        mimetype: referenceFile.type,
        schoolId: selectedSchool,
        styleId: selectedStyle
      });

      onTransmute(result);
    } catch (error) {
      console.error('Transmutation failed:', error);
    }
  }, [referenceFile, selectedSchool, selectedStyle, onTransmute]);

  return (
    <div className="style-transmuter grimoire-panel">
      <div className="section-header">
        <span className="header-icon">✦</span>
        <span>VOID ECHO: NEURAL TRANSMUTATION</span>
      </div>

      <div className="transmuter-options">
        {/* School Dominions */}
        <div className="option-group">
          <label>Target School Dominion</label>
          <div className="school-grid-mini">
            {Object.keys(SCHOOLS).map(schoolId => (
              <button
                key={schoolId}
                className={`mini-school-btn ${selectedSchool === schoolId ? 'active' : ''}`}
                onClick={() => setSelectedSchool(schoolId)}
                style={{ '--school-color': SCHOOLS[schoolId].color }}
              >
                {SCHOOLS[schoolId].glyph}
              </button>
            ))}
          </div>
        </div>

        {/* Retro Era Constraints */}
        <div className="option-group">
          <label>Temporal Era Constraints</label>
          <div className="style-list">
            {ERA_STYLES.map(style => (
              <button
                key={style.id}
                className={`style-btn ${selectedStyle === style.id ? 'active' : ''}`}
                onClick={() => setSelectedStyle(style.id)}
              >
                {style.label}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          className="transmute-ignite-btn"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          disabled={!referenceFile || isProcessing}
          onClick={handleTransmute}
        >
          {isProcessing ? 'TRANSMUTING...' : 'INITIATE NEURAL ECHO'}
        </motion.button>
      </div>
    </div>
  );
}
