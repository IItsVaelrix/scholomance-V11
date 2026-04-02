import React, { useState, useEffect } from 'react';
import { getAmpStatus } from '../../../codex/animation/amp/runAnimationAmp.ts';
import './MotionDebugBadge.css';

/**
 * MotionDebugBadge Component
 * 
 * A compact status badge for the Animation AMP system.
 * Shows active animation count and performance warnings.
 */
export const MotionDebugBadge: React.FC = () => {
  const [status, setStatus] = useState(getAmpStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(getAmpStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!status.isRunning && !status.config.debug) return null;

  return (
    <div className={`motion-debug-badge ${status.activeCount > 0 ? 'active' : ''}`}>
      <div className="badge-indicator" />
      <span className="badge-text">AMP: {status.activeCount}</span>
    </div>
  );
};
