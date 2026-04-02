import React from 'react';
import { motion } from 'framer-motion';

const TEXTURE_PRESETS = [
  { id: 'parchment', label: 'PARCHMENT', description: 'Aged fiber grain' },
  { id: 'leather', label: 'LEATHER', description: 'Dark tooled grain' },
  { id: 'gold_leaf', label: 'GOLD_LEAF', description: 'Metallic shimmer' },
  { id: 'stone', label: 'STONE_RUNE', description: 'Carved glyphs' },
  { id: 'aurora', label: 'AURORA', description: 'Ethereal curtains' },
  { id: 'void', label: 'VOID_ENTROPY', description: 'Zinc decay' },
];

export function TextureSelector({ selectedTextures, onToggleTexture }) {
  return (
    <div className="texture-selector">
      <div className="section-label telemetry-text">Select Texture Overlays</div>
      <div className="texture-grid">
        {TEXTURE_PRESETS.map((tex) => (
          <motion.button
            key={tex.id}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`texture-btn ${selectedTextures.includes(tex.id) ? 'active' : ''}`}
            onClick={() => onToggleTexture(tex.id)}
          >
            <div className="tex-label">{tex.label}</div>
            <div className="tex-desc telemetry-text">{tex.description}</div>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
