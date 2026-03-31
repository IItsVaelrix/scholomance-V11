import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface OutputDevice {
  deviceId: string;
  label: string;
}

interface OutputDeviceSelectorProps {
  devices: OutputDevice[];
  currentSinkId: string;
  onSelect: (deviceId: string) => void;
  onRefresh: () => void;
  color: string;
}

export const OutputDeviceSelector: React.FC<OutputDeviceSelectorProps> = ({
  devices,
  currentSinkId,
  onSelect,
  onRefresh,
  color,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Auto-refresh devices when opening
  useEffect(() => {
    if (isOpen) {
      onRefresh();
    }
  }, [isOpen, onRefresh]);

  const currentDevice = (devices && devices.length > 0) 
    ? (devices.find(d => d.deviceId === currentSinkId) ||
       devices.find(d => d.deviceId === 'default') ||
       { label: 'System Default', deviceId: '' })
    : { label: 'System Default', deviceId: '' };

  const getDeviceIcon = (label: string) => {
    const l = label.toLowerCase();
    if (l.includes('bluetooth')) return 'bluetooth';
    if (l.includes('headphone') || l.includes('headset')) return 'headphones';
    if (l.includes('speaker')) return 'speaker';
    if (l.includes('usb')) return 'usb';
    return 'settings_input_component';
  };

  return (
    <div className="output-device-selector">
      <div className="param-label">
        <span>SIGNAL_OUTPUT</span>
        <button 
          className="refresh-btn" 
          onClick={(e) => { e.stopPropagation(); onRefresh(); }}
          aria-label="Refresh devices"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '12px' }}>refresh</span>
        </button>
      </div>
      
      <button 
        className={`device-toggle ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ '--device-accent': color } as any}
      >
        <span className="material-symbols-outlined device-icon">
          {getDeviceIcon(currentDevice.label)}
        </span>
        <span className="device-label">{currentDevice.label}</span>
        <span className="material-symbols-outlined chevron">
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            className="device-dropdown"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ '--device-accent': color } as any}
          >
            <div className="device-list">
              {devices.length === 0 ? (
                <div className="device-item disabled">No devices detected</div>
              ) : (
                devices.map((device) => (
                  <button
                    key={device.deviceId}
                    className={`device-item ${device.deviceId === currentSinkId ? 'is-active' : ''}`}
                    onClick={() => {
                      onSelect(device.deviceId);
                      setIsOpen(false);
                    }}
                  >
                    <span className="material-symbols-outlined">
                      {getDeviceIcon(device.label)}
                    </span>
                    <span>{device.label}</span>
                    {device.deviceId === currentSinkId && (
                      <span className="material-symbols-outlined check">check</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
