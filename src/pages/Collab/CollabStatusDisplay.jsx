/**
 * CollabStatusDisplay — Display sync status with conflict integration
 * Adapted from PixelBrain StatusDisplay
 */

import { motion } from 'framer-motion';
import {
  CheckIcon,
  LoadingIcon,
  WarningIcon,
  ErrorIcon,
  CodeIcon
} from "../../components/Icons.jsx";

const STATUS_CONFIG = {
  idle: {
    label: 'Ready',
    icon: CheckIcon,
    className: 'status-idle'
  },
  syncing: {
    label: 'Syncing...',
    icon: LoadingIcon,
    className: 'status-syncing'
  },
  processing: {
    label: 'Processing...',
    icon: LoadingIcon,
    className: 'status-processing'
  },
  ready: {
    label: 'Ready',
    icon: CheckIcon,
    className: 'status-ready'
  },
  conflict: {
    label: 'Conflict Detected',
    icon: WarningIcon,
    className: 'status-conflict'
  },
  error: {
    label: 'Error',
    icon: ErrorIcon,
    className: 'status-error'
  }
};

export default function CollabStatusDisplay({ status, conflict, context, bugs = [] }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = config.icon;

  const criticalBugs = bugs.filter(b => b.severity === 'CRIT' || b.severity === 'FATAL');
  const hasFatal = bugs.some(b => b.severity === 'FATAL');

  return (
    <>
      {criticalBugs.length > 0 && (
        <motion.div 
            className={`incident-banner ${hasFatal ? 'incident-banner--fatal' : ''}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            style={{
                background: hasFatal ? 'var(--color-collab-error)' : 'var(--color-collab-warning)',
                color: '#000',
                padding: '8px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: '12px',
                fontWeight: 'bold',
                fontFamily: 'var(--font-collab-mono)',
                zIndex: 100,
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)'
            }}
        >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <motion.span 
                    animate={{ opacity: [1, 0.4, 1] }} 
                    transition={{ duration: 1, repeat: Infinity }}
                    style={{ fontSize: '16px' }}
                >
                    ⚠️
                </motion.span>
                <span>{`${hasFatal ? 'VOID COLLAPSE DETECTED' : 'SYSTEM INCIDENT DETECTED'} // ${criticalBugs.length} CRITICAL ARTIFACTS`}</span>
            </div>
            <button 
                onClick={() => window.dispatchEvent(new CustomEvent('collab:switch-tab', { detail: 'bugs' }))}
                style={{ background: '#000', color: '#fff', border: 'none', padding: '4px 12px', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}
            >
                VIEW ARTIFACTS
            </button>
        </motion.div>
      )}
      <motion.div
        className={`collab-status-display ${config.className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
    >
      <Icon className="status-icon" />
      <span className="status-label">{config.label}</span>

      {context && (
        <span className="status-context">{context}</span>
      )}

      {conflict && (
        <div className="conflict-details">
          <div className="conflict-header">
            <span className="conflict-type">{conflict.type}</span>
            <span className="conflict-severity">{conflict.severity}</span>
          </div>

          {conflict.message && (
            <p className="conflict-message">
              {conflict.message}
            </p>
          )}

          {conflict.affected_files && (
            <div className="conflict-files">
              <span className="files-label">Affected Files:</span>
              <code className="files-list">
                {conflict.affected_files.join(', ')}
              </code>
            </div>
          )}

          {conflict.locked_by && (
            <div className="conflict-lock">
              <CodeIcon className="lock-icon" />
              <span className="lock-text">
                Locked by <strong>{conflict.locked_by}</strong>
                {conflict.task_id && ` (Task: ${conflict.task_id.slice(0, 8)}...)`}
              </span>
            </div>
          )}

          {conflict.recovery_hints && (
            <ul className="conflict-hints">
              {conflict.recovery_hints.map((hint, index) => (
                <li key={index}>→ {hint}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </motion.div>
    </>
  );
}
