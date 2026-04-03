import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  ChevronRight, 
  ChevronDown, 
  X, 
  Search, 
  Clock, 
  Cpu, 
  AlertTriangle, 
  Info,
  Terminal
} from 'lucide-react';
import { 
  getAllActiveAnimations, 
  getAmpStatus 
} from '../../../codex/animation/amp/runAnimationAmp.ts';
import { 
  ResolvedMotionOutput
} from '../../../codex/animation/contracts/animation.types.ts';
import './MotionInspector.css';

/**
 * MotionInspector Component
 * 
 * A developer tool for inspecting active animations, traces, and performance data.
 * Features:
 * - List of all active animations
 * - Detailed processor traces per animation
 * - Performance metrics (processing time, processor count)
 * - Diagnostic messages and warnings
 * - Bytecode preview
 */
export const MotionInspector: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [activeAnimations, setActiveAnimations] = useState<Map<string, ResolvedMotionOutput>>(new Map());
  const [status, setStatus] = useState(getAmpStatus());
  const [filter, setFilter] = useState('');

  // Poll for updates
  useEffect(() => {
    if (!isOpen) return;

    const interval = setInterval(() => {
      setActiveAnimations(getAllActiveAnimations());
      setStatus(getAmpStatus());
    }, 500);

    return () => clearInterval(interval);
  }, [isOpen]);

  const filteredAnimations = Array.from(activeAnimations.entries()).filter(
    ([id, output]) => 
      id.toLowerCase().includes(filter.toLowerCase()) || 
      output.renderer.toLowerCase().includes(filter.toLowerCase())
  );

  const selectedAnimation = selectedTargetId ? activeAnimations.get(selectedTargetId) : null;

  if (!isOpen) {
    return (
      <button 
        className="motion-inspector-toggle"
        onClick={() => setIsOpen(true)}
        title="Open Motion Inspector"
      >
        <Activity size={20} />
        {activeAnimations.size > 0 && (
          <span className="motion-badge-count">{activeAnimations.size}</span>
        )}
      </button>
    );
  }

  return (
    <div className="motion-inspector-overlay">
      <motion.div 
        className="motion-inspector-panel"
        initial={{ x: 300, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 300, opacity: 0 }}
      >
        <header className="motion-inspector-header">
          <div className="motion-inspector-title">
            <Activity size={18} className="motion-icon-active" />
            <span>Motion Inspector</span>
          </div>
          <div className="motion-inspector-actions">
            <button onClick={() => setIsOpen(false)} className="motion-close-btn">
              <X size={18} />
            </button>
          </div>
        </header>

        <div className="motion-inspector-status">
          <div className="status-item">
            <span className="status-label">Status:</span>
            <span className={`status-value ${status.isRunning ? 'running' : 'stopped'}`}>
              {status.isRunning ? 'Running' : 'Stopped'}
            </span>
          </div>
          <div className="status-item">
            <span className="status-label">Active:</span>
            <span className="status-value">{status.activeCount}</span>
          </div>
          <div className="status-item">
            <span className="status-label">Debug:</span>
            <span className={`status-value ${status.config.debug ? 'enabled' : 'disabled'}`}>
              {status.config.debug ? 'ON' : 'OFF'}
            </span>
          </div>
        </div>

        <div className="motion-inspector-search">
          <Search size={14} className="search-icon" />
          <input 
            type="text" 
            placeholder="Filter targetId..." 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>

        <div className="motion-inspector-content">
          <div className="motion-target-list">
            {filteredAnimations.length === 0 ? (
              <div className="empty-state">No active animations</div>
            ) : (
              filteredAnimations.map(([id, output]) => (
                <div 
                  key={id} 
                  className={`motion-target-item ${selectedTargetId === id ? 'selected' : ''}`}
                  onClick={() => setSelectedTargetId(id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedTargetId(id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                >
                  <div className="target-info">
                    <span className="target-id">{id}</span>
                    <span className="target-renderer">{output.renderer}</span>
                  </div>
                  <ChevronRight size={14} />
                </div>
              ))
            )}
          </div>

          <div className="motion-details-pane">
            {selectedAnimation ? (
              <AnimationDetails output={selectedAnimation} />
            ) : (
              <div className="details-placeholder">
                <Info size={32} />
                <span>Select an animation to inspect</span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

const AnimationDetails: React.FC<{ output: ResolvedMotionOutput }> = ({ output }) => {
  const [expandedSection, setExpandedSection] = useState<string | null>('trace');

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  return (
    <div className="animation-details">
      <div className="details-header">
        <h3>{output.targetId}</h3>
        <div className="performance-chips">
          {output.performance && (
            <>
              <span className="chip perf">
                <Clock size={12} /> {output.performance.processingTimeMs.toFixed(2)}ms
              </span>
              <span className="chip cpu">
                <Cpu size={12} /> {output.performance.processorCount} procs
              </span>
              {output.performance.reducedMotion && (
                <span className="chip warn">Reduced</span>
              )}
            </>
          )}
        </div>
      </div>

      <Section 
        title="Resolved Values" 
        id="values" 
        isOpen={expandedSection === 'values'} 
        onToggle={() => toggleSection('values')}
      >
        <div className="values-grid">
          {Object.entries(output.values).map(([key, value]) => (
            <div key={key} className="value-item">
              <span className="value-key">{key}:</span>
              <span className="value-val">
                {typeof value === 'number' ? value.toFixed(2) : String(value)}
              </span>
            </div>
          ))}
        </div>
      </Section>

      <Section 
        title={`Trace (${output.trace.length} steps)`} 
        id="trace" 
        isOpen={expandedSection === 'trace'} 
        onToggle={() => toggleSection('trace')}
      >
        <div className="trace-list">
          {output.trace.map((step, idx) => (
            <div key={`${step.processorId}-${idx}`} className="trace-step">
              <div className="step-header">
                <span className={`stage-tag ${step.stage}`}>{step.stage}</span>
                <span className="processor-name">{step.processorId}</span>
              </div>
              <div className="step-changes">
                {step.changed.map(c => (
                  <span key={c} className="change-tag">{c}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {output.diagnostics.length > 0 && (
        <Section 
          title={`Diagnostics (${output.diagnostics.length})`} 
          id="diagnostics" 
          isOpen={expandedSection === 'diagnostics'} 
          onToggle={() => toggleSection('diagnostics')}
          icon={<AlertTriangle size={14} className="text-warn" />}
        >
          <div className="diagnostics-list">
            {output.diagnostics.map((msg, idx) => (
              <div key={idx} className="diagnostic-item">
                <AlertTriangle size={12} />
                <span>{msg}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {output.bytecode && output.bytecode.length > 0 && (
        <Section 
          title="Bytecode" 
          id="bytecode" 
          isOpen={expandedSection === 'bytecode'} 
          onToggle={() => toggleSection('bytecode')}
          icon={<Terminal size={14} />}
        >
          <div className="bytecode-container">
            <pre>{output.bytecode.join('\n')}</pre>
          </div>
        </Section>
      )}
    </div>
  );
};

const Section: React.FC<{ 
  title: string; 
  id: string; 
  isOpen: boolean; 
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, isOpen, onToggle, icon, children }) => {
  return (
    <div className={`details-section ${isOpen ? 'open' : ''}`}>
      <button className="section-header" onClick={onToggle}>
        <div className="section-title">
          {icon}
          <span>{title}</span>
        </div>
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="section-content"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
