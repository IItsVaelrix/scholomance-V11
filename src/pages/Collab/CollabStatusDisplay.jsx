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

export default function CollabStatusDisplay({ status, conflict, context }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = config.icon;

  return (
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
  );
}
