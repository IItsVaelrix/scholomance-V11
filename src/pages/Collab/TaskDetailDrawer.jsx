/**
 * TaskDetailDrawer — Right-side slide-in drawer for task inspection
 * 8 sections: Summary, Assignment, Files, Dependencies, Pipeline, Results, Activity, Locks
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CloseIcon,
  EditIcon,
  CheckIcon,
  LoadingIcon,
  WarningIcon,
  GridIcon,
  LayersIcon,
  ZapIcon
} from "../../components/Icons.jsx";

const DRAWER_SECTIONS = [
  { key: 'summary', label: 'Summary' },
  { key: 'assignment', label: 'Assignment' },
  { key: 'files', label: 'Files' },
  { key: 'dependencies', label: 'Dependencies' },
  { key: 'pipeline', label: 'Pipeline' },
  { key: 'results', label: 'Results' },
  { key: 'activity', label: 'Activity' },
  { key: 'locks', label: 'Locks' },
];

const STATUS_COLORS = {
  backlog: 'var(--color-collab-text-dim, #505070)',
  assigned: 'var(--color-collab-info, #60c0ff)',
  in_progress: 'var(--color-collab-warning, #ffc040)',
  review: 'var(--color-collab-info, #60c0ff)',
  testing: 'var(--color-collab-warning, #ffc040)',
  done: 'var(--color-collab-success, #40ff80)',
  blocked: 'var(--color-collab-error, #ff4060)',
};

const PRIORITY_LABELS = ['Low', 'Normal', 'High', 'Critical'];

export default function TaskDetailDrawer({ 
  task, 
  agents, 
  pipelines, 
  locks, 
  activity,
  isOpen, 
  onClose,
  onAssign,
  onStatusChange,
  onDelete,
}) {
  const [activeSection, setActiveSection] = useState('summary');
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [preflight, setPreflight] = useState(null);
  const [preflightLoading, setPreflightLoading] = useState(false);

  // Reset state when task changes
  useEffect(() => {
    if (task) {
      setSelectedAgent(task.assigned_agent || '');
      setActiveSection('summary');
      setPreflight(null);
    }
  }, [task]);

  // Fetch preflight when agent selection changes
  useEffect(() => {
    if (isAssigning && selectedAgent && task) {
      const fetchPreflight = async () => {
        setPreflightLoading(true);
        try {
          // Try to get preflight from backend (if endpoint exists)
          const response = await fetch(`/collab/tasks/${task.id}/preflight?agent_id=${selectedAgent}`);
          if (response.ok) {
            const data = await response.json();
            setPreflight(data);
          } else {
            // Fallback: basic client-side check
            setPreflight({
              valid: true,
              warnings: [],
              info: 'Assignment will proceed without ownership validation',
            });
          }
        } catch {
          setPreflight({
            valid: true,
            warnings: [],
            info: 'Assignment will proceed without ownership validation',
          });
        }
        setPreflightLoading(false);
      };
      fetchPreflight();
    }
  }, [isAssigning, selectedAgent, task]);

  // Handle assignment submission
  const handleAssign = useCallback(async () => {
    if (!selectedAgent || !task) return;
    
    try {
      const response = await fetch(`/collab/tasks/${task.id}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          agent_id: selectedAgent,
          override: preflight?.requires_override || false,
        }),
      });
      
      if (response.ok) {
        const result = await response.json();
        onAssign(result);
        setIsAssigning(false);
        setPreflight(null);
      } else {
        const error = await response.json();
        setPreflight({
          valid: false,
          error: error.error || 'Assignment failed',
          conflicts: error.conflicts,
        });
      }
    } catch (err) {
      setPreflight({
        valid: false,
        error: 'Assignment failed: Network error',
      });
    }
  }, [selectedAgent, task, preflight, onAssign]);

  // Handle status change
  const handleStatusChange = useCallback(async (newStatus) => {
    if (!task) return;
    await onStatusChange(task.id, newStatus);
  }, [task, onStatusChange]);

  if (!task) return null;

  const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
  const pipeline = pipelines.find(p => p.id === task.pipeline_run_id);
  const taskLocks = locks.filter(l => l.task_id === task.id);
  const taskActivity = activity.filter(a => 
    a.target_id === task.id || a.details?.title === task.title
  ).slice(0, 10);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Drawer */}
          <motion.aside
            className="task-detail-drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            role="dialog"
            aria-modal="true"
            aria-label="Task details"
          >
            {/* Header */}
            <div className="drawer-header">
              <div className="drawer-title-section">
                <h2 className="drawer-title">{task.title}</h2>
                <span 
                  className="drawer-status"
                  style={{ color: STATUS_COLORS[task.status] }}
                >
                  {task.status.replace(/_/g, ' ')}
                </span>
              </div>
              <button 
                className="drawer-close-btn"
                onClick={onClose}
                aria-label="Close drawer"
              >
                <CloseIcon size={16} />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="drawer-quick-actions">
              <select
                className="drawer-status-select"
                value={task.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={task.status === 'done'}
              >
                {Object.keys(STATUS_COLORS).map(status => (
                  <option key={status} value={status}>
                    {status.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
              
              {task.assigned_agent ? (
                <button
                  className="drawer-action-btn drawer-action-btn--assign"
                  onClick={() => setIsAssigning(true)}
                >
                  <EditIcon size={12} />
                  Reassign
                </button>
              ) : (
                <button
                  className="drawer-action-btn drawer-action-btn--assign"
                  onClick={() => setIsAssigning(true)}
                >
                  <ZapIcon size={12} />
                  Assign
                </button>
              )}
            </div>

            {/* Section Tabs */}
            <nav className="drawer-section-tabs">
              {DRAWER_SECTIONS.map(section => (
                <button
                  key={section.key}
                  className={`drawer-section-tab ${activeSection === section.key ? 'active' : ''}`}
                  onClick={() => setActiveSection(section.key)}
                >
                  {section.label}
                </button>
              ))}
            </nav>

            {/* Section Content */}
            <div className="drawer-content">
              {activeSection === 'summary' && (
                <TaskSummarySection 
                  task={task} 
                  agentMap={agentMap}
                />
              )}
              {activeSection === 'assignment' && (
                <TaskAssignmentSection
                  task={task}
                  agents={agents}
                  agentMap={agentMap}
                  selectedAgent={selectedAgent}
                  setSelectedAgent={setSelectedAgent}
                  isAssigning={isAssigning}
                  setIsAssigning={setIsAssigning}
                  preflight={preflight}
                  preflightLoading={preflightLoading}
                  setPreflight={setPreflight}
                  onAssign={handleAssign}
                />
              )}
              {activeSection === 'files' && (
                <TaskFilesSection 
                  files={task.file_paths || []}
                  locks={taskLocks}
                />
              )}
              {activeSection === 'dependencies' && (
                <TaskDependenciesSection 
                  dependencies={task.depends_on || []}
                />
              )}
              {activeSection === 'pipeline' && (
                <TaskPipelineSection 
                  pipeline={pipeline}
                  task={task}
                />
              )}
              {activeSection === 'results' && (
                <TaskResultsSection 
                  results={task.results}
                />
              )}
              {activeSection === 'activity' && (
                <TaskActivitySection 
                  activity={taskActivity}
                />
              )}
              {activeSection === 'locks' && (
                <TaskLocksSection 
                  locks={taskLocks}
                  agentMap={agentMap}
                />
              )}
            </div>

            {/* Footer Actions */}
            <div className="drawer-footer">
              <button
                className="drawer-delete-btn"
                onClick={() => onDelete(task.id)}
              >
                Delete Task
              </button>
              <span className="drawer-task-id">ID: {task.id.slice(0, 8)}...</span>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── Section Components ──────────────────────────────────────────────────────

function TaskSummarySection({ task, agentMap }) {
  return (
    <div className="task-section">
      <h3 className="section-title">Summary</h3>
      
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-label">Priority</span>
          <span className="summary-value">{PRIORITY_LABELS[task.priority ?? 0]}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Status</span>
          <span className="summary-value">{task.status.replace(/_/g, ' ')}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Assigned To</span>
          <span className="summary-value">{agentMap[task.assigned_agent] || 'Unassigned'}</span>
        </div>
        <div className="summary-item">
          <span className="summary-label">Created By</span>
          <span className="summary-value">{task.created_by || 'Unknown'}</span>
        </div>
      </div>

      {task.description && (
        <div className="summary-description">
          <h4>Description</h4>
          <p>{task.description}</p>
        </div>
      )}

      {task.file_paths && task.file_paths.length > 0 && (
        <div className="summary-files">
          <h4>Files</h4>
          <div className="file-list">
            {task.file_paths.map((fp, idx) => (
              <span key={idx} className="file-tag">{fp.split('/').pop()}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function TaskAssignmentSection({
  task,
  agents,
  agentMap,
  selectedAgent,
  setSelectedAgent,
  isAssigning,
  setIsAssigning,
  preflight,
  preflightLoading,
  setPreflight,
  onAssign,
}) {
  const onlineAgents = agents.filter(a => a.status !== 'offline');

  return (
    <div className="task-section">
      <h3 className="section-title">Assignment</h3>

      {isAssigning ? (
        <div className="assignment-flow">
          <label className="assignment-label" htmlFor="assignment-agent-select">Select Agent:</label>
          <select
            id="assignment-agent-select"
            className="assignment-agent-select"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">-- Select an agent --</option>
            {onlineAgents.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.name} ({agent.role})
              </option>
            ))}
          </select>

          {/* Preflight Results */}
          {preflightLoading && (
            <div className="preflight-loading">
              <LoadingIcon size={16} className="spinning" />
              <span>Checking assignment compatibility...</span>
            </div>
          )}

          {preflight && !preflightLoading && (
            <div className={`preflight-result ${preflight.valid ? 'valid' : 'invalid'}`}>
              {preflight.valid ? (
                <>
                  <CheckIcon size={16} className="success-icon" />
                  <span>{preflight.info || 'Assignment looks good'}</span>
                  {preflight.warnings && preflight.warnings.length > 0 && (
                    <ul className="preflight-warnings">
                      {preflight.warnings.map((w, i) => (
                        <li key={i}><WarningIcon size={12} /> {w}</li>
                      ))}
                    </ul>
                  )}
                </>
              ) : (
                <>
                  <ErrorIcon size={16} className="error-icon" />
                  <span>{preflight.error}</span>
                  {preflight.conflicts && (
                    <ul className="preflight-conflicts">
                      {preflight.conflicts.map((c, i) => (
                        <li key={i}>{c.file}: {c.reason}</li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          )}

          <div className="assignment-actions">
            <button
              className="assignment-submit-btn"
              onClick={onAssign}
              disabled={!selectedAgent || preflightLoading || (preflight && !preflight.valid && !preflight.requires_override)}
            >
              Confirm Assignment
            </button>
            <button
              className="assignment-cancel-btn"
              onClick={() => {
                setIsAssigning(false);
                setPreflight(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="assignment-summary">
          {task.assigned_agent ? (
            <>
              <p>Currently assigned to: <strong>{agentMap[task.assigned_agent] || task.assigned_agent}</strong></p>
              <p className="assignment-hint">Click &quot;Reassign&quot; to change the assigned agent.</p>
            </>
          ) : (
            <>
              <p>This task is unassigned.</p>
              <p className="assignment-hint">Click &quot;Assign&quot; to assign an agent based on role compatibility.</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TaskFilesSection({ files, locks }) {
  const lockMap = Object.fromEntries(locks.map(l => [l.file_path, l]));

  return (
    <div className="task-section">
      <h3 className="section-title">Files</h3>
      
      {files.length === 0 ? (
        <p className="files-empty">No files associated with this task.</p>
      ) : (
        <div className="file-table">
          <div className="file-row file-row--header">
            <span>File Path</span>
            <span>Lock Status</span>
          </div>
          {files.map((fp, idx) => {
            const lock = lockMap[fp];
            return (
              <div key={idx} className="file-row">
                <span className="file-path">{fp}</span>
                <span className={`lock-status ${lock ? 'locked' : 'unlocked'}`}>
                  {lock ? (
                    <>
                      <GridIcon size={12} />
                      Locked by {lock.agent_id?.slice(0, 8)}
                    </>
                  ) : (
                    <>
                      <CheckIcon size={12} />
                      Free
                    </>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskDependenciesSection({ dependencies }) {
  return (
    <div className="task-section">
      <h3 className="section-title">Dependencies</h3>
      
      {dependencies.length === 0 ? (
        <p className="deps-empty">No dependencies. This task can be started immediately.</p>
      ) : (
        <div className="dependency-list">
          {dependencies.map((depId, idx) => (
            <div key={idx} className="dependency-item">
              <LayersIcon size={12} />
              <span className="dependency-id">{depId.slice(0, 8)}...</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskPipelineSection({ pipeline, task: _task }) {
  if (!pipeline) {
    return (
      <div className="task-section">
        <h3 className="section-title">Pipeline</h3>
        <p className="pipeline-empty">This task is not part of a pipeline.</p>
      </div>
    );
  }

  return (
    <div className="task-section">
      <h3 className="section-title">Pipeline Context</h3>
      
      <div className="pipeline-summary">
        <div className="pipeline-info">
          <span className="pipeline-type">{pipeline.pipeline_type.replace(/_/g, ' ')}</span>
          <span className={`pipeline-status pipeline-status--${pipeline.status}`}>
            {pipeline.status}
          </span>
        </div>
        
        {pipeline.stages && pipeline.stages.length > 0 && (
          <div className="pipeline-stages-mini">
            {pipeline.stages.map((stage, idx) => (
              <div 
                key={idx} 
                className={`stage-dot ${idx < pipeline.current_stage ? 'completed' : ''} ${idx === pipeline.current_stage ? 'current' : ''}`}
                title={stage.name}
              />
            ))}
          </div>
        )}
        
        <p className="pipeline-stage-info">
          Current stage: {pipeline.current_stage !== undefined ? pipeline.stages[pipeline.current_stage]?.name : 'Unknown'}
        </p>
      </div>
    </div>
  );
}

function TaskResultsSection({ results }) {
  if (!results) {
    return (
      <div className="task-section">
        <h3 className="section-title">Results</h3>
        <p className="results-empty">No results recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="task-section">
      <h3 className="section-title">Results</h3>
      <pre className="results-json">{JSON.stringify(results, null, 2)}</pre>
    </div>
  );
}

function TaskActivitySection({ activity }) {
  return (
    <div className="task-section">
      <h3 className="section-title">Activity</h3>
      
      {activity.length === 0 ? (
        <p className="activity-empty">No activity recorded for this task.</p>
      ) : (
        <div className="task-activity-timeline">
          {activity.map((entry, idx) => (
            <div key={idx} className="activity-entry-mini">
              <span className="activity-agent">{entry.agent_id || 'system'}</span>
              <span className="activity-action">{entry.action}</span>
              <span className="activity-time">{new Date(entry.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskLocksSection({ locks, agentMap }) {
  return (
    <div className="task-section">
      <h3 className="section-title">File Locks</h3>
      
      {locks.length === 0 ? (
        <p className="locks-empty">No active locks for this task.</p>
      ) : (
        <div className="lock-table">
          <div className="lock-row lock-row--header">
            <span>File</span>
            <span>Locked By</span>
            <span>Expires</span>
          </div>
          {locks.map((lock, idx) => (
            <div key={idx} className="lock-row">
              <span className="lock-file">{lock.file_path.split('/').pop()}</span>
              <span className="lock-agent">{agentMap[lock.agent_id] || lock.agent_id}</span>
              <span className="lock-expires">{new Date(lock.expires_at).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Simple ErrorIcon for preflight errors
function ErrorIcon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}
