/**
 * StatusDisplay — Display generation status with bytecode error integration
 */

import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckIcon, 
  LoadingIcon, 
  WarningIcon, 
  ErrorIcon,
  CodeIcon 
} from "../../../components/Icons.jsx";
import { parseErrorForAI } from "../../../../codex/core/pixelbrain/bytecode-error.js";

const STATUS_CONFIG = {
  idle: {
    label: 'Ready',
    icon: CheckIcon,
    className: 'status-idle'
  },
  analyzing: {
    label: 'Analyzing...',
    icon: LoadingIcon,
    className: 'status-analyzing'
  },
  generating: {
    label: 'Generating...',
    icon: LoadingIcon,
    className: 'status-generating'
  },
  ready: {
    label: 'Ready to Export',
    icon: CheckIcon,
    className: 'status-ready'
  },
  error: {
    label: 'Error',
    icon: ErrorIcon,
    className: 'status-error'
  },
  warning: {
    label: 'Warning',
    icon: WarningIcon,
    className: 'status-warning'
  }
};

export function StatusDisplay({ status, error, bytecode }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const Icon = config.icon;

  // Parse bytecode error if present
  const errorData = error ? parseErrorForAI(error) : null;

  return (
    <motion.div
      className={`status-display ${config.className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      role="status"
      aria-live="polite"
    >
      <Icon className="status-icon" />
      <span className="status-label">{config.label}</span>
      
      {errorData && (
        <div className="error-details">
          <div className="error-header">
            <span className="error-category">{errorData.category}</span>
            <span className="error-severity">{errorData.severity}</span>
          </div>
          
          {errorData.context && (
            <p className="error-message">
              {errorData.context.parameterName && (
                <>
                  <strong>{errorData.context.parameterName}</strong>
                  {' '}
                  {errorData.context.expectedType && (
                    <>must be {errorData.context.expectedType}</>
                  )}
                </>
              )}
            </p>
          )}
          
          {errorData.recoveryHints?.suggestions && (
            <ul className="error-hints">
              {errorData.recoveryHints.suggestions.map((hint, index) => (
                <li key={index}>→ {hint}</li>
              ))}
            </ul>
          )}
          
          {errorData.recoveryHints?.invariants && (
            <div className="error-invariants">
              <span className="invariants-label">Invariants:</span>
              <code>
                {errorData.recoveryHints.invariants.join('; ')}
              </code>
            </div>
          )}
          
          {bytecode && (
            <div className="error-bytecode">
              <CodeIcon className="bytecode-icon" />
              <code className="bytecode-string">{bytecode}</code>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => navigator.clipboard.writeText(bytecode)}
              >
                Copy
              </button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default StatusDisplay;
