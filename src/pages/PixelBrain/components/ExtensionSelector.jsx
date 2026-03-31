/**
 * ExtensionSelector — Select and configure PixelBrain extensions
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ZapIcon, 
  PaletteIcon, 
  TvIcon,
  CheckIcon 
} from "../../../components/Icons.jsx";

const EXTENSIONS = [
  {
    id: 'style-8bit',
    name: '8-Bit Style',
    description: 'Snap to classic 8-bit aesthetic',
    icon: PaletteIcon,
    type: 'STYLE'
  },
  {
    id: 'style-crt',
    name: 'CRT Scanlines',
    description: 'Add retro CRT monitor effect',
    icon: TvIcon,
    type: 'STYLE'
  },
  {
    id: 'physics-stretch-squash',
    name: 'Stretch & Squash',
    description: 'Add cartoon physics exaggeration',
    icon: ZapIcon,
    type: 'PHYSICS'
  },
  {
    id: 'physics-gravity',
    name: 'Gravity',
    description: 'Apply gravitational pull effect',
    icon: ZapIcon,
    type: 'PHYSICS'
  }
];

export function ExtensionSelector({ selectedExtensions, onChange }) {
  const [expandedType, setExpandedType] = useState(null);

  const toggleExtension = useCallback((extId) => {
    if (selectedExtensions?.includes(extId)) {
      onChange?.(selectedExtensions.filter(id => id !== extId));
    } else {
      onChange?.([...(selectedExtensions || []), extId]);
    }
  }, [selectedExtensions, onChange]);

  const toggleType = useCallback((type) => {
    setExpandedType(prev => prev === type ? null : type);
  }, []);

  // Group extensions by type
  const groupedExtensions = EXTENSIONS.reduce((groups, ext) => {
    const type = ext.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(ext);
    return groups;
  }, {});

  return (
    <motion.div
      className="extension-selector"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <h4 className="section-title">Extensions</h4>
      
      {Object.entries(groupedExtensions).map(([type, extensions]) => (
        <div key={type} className="extension-group">
          <button
            className="extension-type-header"
            onClick={() => toggleType(type)}
            aria-expanded={expandedType === type}
          >
            <span className="type-name">{type}</span>
            <span className={`type-arrow ${expandedType === type ? 'is-open' : ''}`}>
              ▼
            </span>
          </button>
          
          <AnimatePresence>
            {expandedType === type && (
              <motion.div
                className="extension-list"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
              >
                {extensions.map((ext) => {
                  const Icon = ext.icon;
                  const isSelected = selectedExtensions?.includes(ext.id);
                  
                  return (
                    <button
                      key={ext.id}
                      className={`extension-item ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => toggleExtension(ext.id)}
                      role="checkbox"
                      aria-checked={isSelected}
                    >
                      <div className="extension-icon">
                        <Icon />
                      </div>
                      <div className="extension-info">
                        <span className="extension-name">{ext.name}</span>
                        <span className="extension-description">{ext.description}</span>
                      </div>
                      {isSelected && (
                        <CheckIcon className="extension-check" />
                      )}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </motion.div>
  );
}

export default ExtensionSelector;
