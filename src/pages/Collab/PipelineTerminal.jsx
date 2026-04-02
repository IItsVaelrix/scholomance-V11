/**
 * PipelineTerminal — Pipeline visualization with stage rail and result editor
 * Adapted from PixelBrain's terminal aesthetic
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckIcon,
  LoadingIcon,
  WarningIcon,
  ErrorIcon,
  CloseIcon,
  EditIcon
} from "../../components/Icons.jsx";

const STAGE_STATUS = {
  pending: { label: 'Pending', color: 'var(--color-collab-text-dim, #505070)' },
  running: { label: 'Running', color: 'var(--color-collab-warning, #ffc040)' },
  completed: { label: 'Completed', color: 'var(--color-collab-success, #40ff80)' },
  failed: { label: 'Failed', color: 'var(--color-collab-error, #ff4060)' },
  blocked: { label: 'Blocked', color: 'var(--color-collab-error, #ff4060)' },
};

const ROLE_COLORS = {
  ui: 'var(--color-collab-info, #60c0ff)',
  backend: 'var(--color-collab-success, #40ff80)',
  qa: 'var(--color-collab-warning, #ffc040)',
  default: 'var(--color-collab-text, #e0e0ff)',
};

export default function PipelineTerminal({
  pipeline,
  tasks,
  agents,
  onAdvance,
  onFail,
  onClose,
}) {
  const [showResultEditor, setShowResultEditor] = useState(false);
  const [currentStageResult, setCurrentStageResult] = useState('');
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [error, setError] = useState(null);

  const currentStage = pipeline?.stages?.[pipeline.current_stage] || null;
  const isComplete = pipeline?.status === 'completed';
  const isFailed = pipeline?.status === 'failed';
  const isRunning = pipeline?.status === 'running';

  // Get tasks associated with this pipeline
  const pipelineTasks = (pipeline && tasks) ? tasks.filter(t => t.pipeline_run_id === pipeline.id) : [];

  // Get task for current stage
  const currentStageTask = pipelineTasks.find(t =>
    t.title?.includes(currentStage?.name)
  );

  // Handle advance with result
  const handleAdvance = useCallback(async () => {
    if (!currentStageResult.trim() && currentStage?.requires_result) {
      setError('Result required for this stage');
      return;
    }

    setIsAdvancing(true);
    setError(null);

    try {
      const result = currentStageResult.trim() 
        ? JSON.parse(currentStageResult) 
        : {};

      await onAdvance(result);
      setCurrentStageResult('');
      setShowResultEditor(false);
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError('Invalid JSON in result editor');
      } else {
        setError(err.message || 'Failed to advance pipeline');
      }
    } finally {
      setIsAdvancing(false);
    }
  }, [currentStageResult, currentStage, onAdvance]);

  // Handle fail
  const handleFail = useCallback(async (reason) => {
    setIsAdvancing(true);
    await onFail(reason);
    setIsAdvancing(false);
  }, [onFail]);

  if (!pipeline) return null;

  return (
    <div className="pipeline-terminal">
      {/* Header */}
      <div className="pipeline-terminal-header">
        <div className="pipeline-terminal-title">
          <span className="terminal-prefix">PIPELINE:</span>
          <span className="pipeline-name">{pipeline.pipeline_type.replace(/_/g, ' ').toUpperCase()}</span>
        </div>
        <div className="pipeline-terminal-actions">
          <span className={`pipeline-status-badge pipeline-status-badge--${pipeline.status}`}>
            {STAGE_STATUS[pipeline.status]?.label || pipeline.status}
          </span>
          {onClose && (
            <button className="terminal-close-btn" onClick={onClose}>
              <CloseIcon size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Stage Rail */}
      <div className="stage-rail">
        {pipeline.stages?.map((stage, idx) => {
          const stageState = getStageState(idx, pipeline.current_stage, pipeline.status);
          const stageTask = pipelineTasks.find(t => t.title?.includes(stage.name));
          
          return (
            <StageNode
              key={idx}
              stage={stage}
              state={stageState}
              task={stageTask}
              isCurrent={idx === pipeline.current_stage && isRunning}
              onClick={() => idx === pipeline.current_stage && setShowResultEditor(true)}
            />
          );
        })}
      </div>

      {/* Current Stage Panel */}
      {currentStage && isRunning && (
        <div className="current-stage-panel">
          <div className="stage-info-header">
            <h4 className="stage-name">{currentStage.name}</h4>
            {currentStage.role && (
              <span 
                className="stage-role-badge"
                style={{ backgroundColor: ROLE_COLORS[currentStage.role] || ROLE_COLORS.default }}
              >
                {currentStage.role.toUpperCase()}
              </span>
            )}
          </div>

          <p className="stage-description">{currentStage.description}</p>

          {/* Routing Explanation */}
          <RoutingExplanation 
            stage={currentStage} 
            task={currentStageTask}
            agents={agents}
          />

          {/* Stage Actions */}
          <div className="stage-actions">
            <button
              className="stage-action-btn stage-action-btn--advance"
              onClick={() => setShowResultEditor(true)}
              disabled={isAdvancing}
            >
              <EditIcon size={12} />
              Enter Result
            </button>
            
            <button
              className="stage-action-btn stage-action-btn--fail"
              onClick={() => handleFail('Manual failure')}
              disabled={isAdvancing}
            >
              <ErrorIcon size={12} />
              Fail Stage
            </button>
          </div>

          {/* Error Display */}
          {error && (
            <div className="stage-error">
              <ErrorIcon size={14} />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}

      {/* Pipeline Result Summary */}
      {(isComplete || isFailed) && (
        <div className={`pipeline-result-summary ${isFailed ? 'failed' : 'completed'}`}>
          <h4 className="result-title">
            {isComplete ? 'Pipeline Completed Successfully' : 'Pipeline Failed'}
          </h4>
          {isFailed && pipeline.results?.failure_reason && (
            <p className="failure-reason">{pipeline.results.failure_reason}</p>
          )}
          {isComplete && pipeline.results && (
            <pre className="result-json">{JSON.stringify(pipeline.results, null, 2)}</pre>
          )}
        </div>
      )}

      {/* Result Editor Modal */}
      <AnimatePresence>
        {showResultEditor && (
          <ResultEditorModal
            stage={currentStage}
            value={currentStageResult}
            onChange={setCurrentStageResult}
            onSubmit={handleAdvance}
            onCancel={() => {
              setShowResultEditor(false);
              setError(null);
            }}
            isSubmitting={isAdvancing}
            error={error}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Stage Node Component ────────────────────────────────────────────────────

function StageNode({ stage, state, task, isCurrent, onClick }) {
  const statusConfig = STAGE_STATUS[state];
  const roleColor = ROLE_COLORS[stage.role] || ROLE_COLORS.default;
  const handleKeyDown = (event) => {
    if (!isCurrent || typeof onClick !== 'function') return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={`stage-node stage-node--${state} ${isCurrent ? 'stage-node--current' : ''}`}
      onClick={isCurrent ? onClick : undefined}
      role={isCurrent ? 'button' : undefined}
      tabIndex={isCurrent ? 0 : undefined}
      onKeyDown={isCurrent ? handleKeyDown : undefined}
    >
      {/* Connection Line */}
      <div className="stage-connection" />
      
      {/* Node Circle */}
      <div 
        className="stage-node-circle"
        style={{ 
          borderColor: statusConfig.color,
          backgroundColor: state === 'completed' ? statusConfig.color : 'transparent',
        }}
      >
        {state === 'completed' && <CheckIcon size={10} style={{ color: '#000' }} />}
        {state === 'running' && <LoadingIcon size={10} className="spinning" />}
        {state === 'failed' && <ErrorIcon size={10} />}
      </div>

      {/* Node Content */}
      <div className="stage-node-content">
        <span className="stage-node-name">{stage.name}</span>
        {stage.role && (
          <span 
            className="stage-node-role"
            style={{ color: roleColor }}
          >
            {stage.role.toUpperCase()}
          </span>
        )}
        {task && (
          <span className="stage-node-task">
            Task: {task.id.slice(0, 6)}...
          </span>
        )}
        {isCurrent && (
          <span className="stage-node-hint">Click to enter result</span>
        )}
      </div>
    </div>
  );
}

// ─── Routing Explanation Panel ──────────────────────────────────────────────

function RoutingExplanation({ stage, task, agents }) {
  if (!stage.role && !task) return null;

  const assignedAgent = agents.find(a => a.id === task?.assigned_agent);

  return (
    <div className="routing-explanation">
      <div className="routing-header">
        <span className="routing-icon">→</span>
        <span className="routing-title">ROUTING</span>
      </div>
      
      <div className="routing-content">
        {stage.role && (
          <p className="routing-text">
            Stage requires <strong>{stage.role.toUpperCase()}</strong> role
          </p>
        )}
        
        {task?.assigned_agent ? (
          <p className="routing-text">
            Assigned to <strong>{assignedAgent?.name || task.assigned_agent}</strong>
            {assignedAgent?.role && ` (${assignedAgent.role})`}
          </p>
        ) : (
          <div className="routing-text routing-text--warning">
            <WarningIcon size={12} />
            No agent assigned — waiting for claim
          </div>
        )}

        {!stage.role && task?.file_paths?.length > 0 && (
          <p className="routing-text">
            Auto-routed based on file ownership: <code>{task.file_paths[0].split('/').pop()}</code>
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Result Editor Modal ─────────────────────────────────────────────────────

function ResultEditorModal({ stage, value, onChange, onSubmit, onCancel, isSubmitting, error }) {
  const template = stage.result_template || '{}';
  const editorId = `result-editor-${String(stage?.name || 'stage').replace(/\s+/g, '-').toLowerCase()}`;

  return (
    <>
      <button
        type="button"
        className="modal-backdrop"
        onClick={onCancel}
        aria-label="Close result editor"
      />
      <motion.div 
        className="result-editor-modal"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        role="dialog"
        aria-modal="true"
        aria-label="Enter stage result"
      >
        <div className="modal-header">
          <h3 className="modal-title">
            <EditIcon size={16} />
            Enter Result: {stage.name}
          </h3>
          <button className="modal-close-btn" onClick={onCancel}>
            <CloseIcon size={16} />
          </button>
        </div>

        <div className="modal-content">
          <label className="editor-label" htmlFor={editorId}>
            Result JSON (must be valid):
          </label>
          <textarea
            id={editorId}
            className="result-editor-textarea"
            value={value || template}
            onChange={(e) => onChange(e.target.value)}
            placeholder='{"status": "success", "data": {...}}'
          />
          
          {error && (
            <div className="modal-error">
              <ErrorIcon size={14} />
              <span>{error}</span>
            </div>
          )}

          <div className="editor-hints">
            <h5>Result Guidelines:</h5>
            <ul>
              <li>Must be valid JSON</li>
              <li>Include status: &quot;success&quot; or &quot;failure&quot;</li>
              <li>Add relevant data payload</li>
              <li>Next stage will receive this as input</li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-btn modal-btn--cancel" onClick={onCancel}>
            Cancel
          </button>
          <button 
            className="modal-btn modal-btn--submit" 
            onClick={onSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? <LoadingIcon size={14} className="spinning" /> : <CheckIcon size={14} />}
            {isSubmitting ? 'Submitting...' : 'Submit & Advance'}
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function getStageState(index, currentStageIndex, pipelineStatus) {
  if (pipelineStatus === 'completed') return 'completed';
  if (pipelineStatus === 'failed') {
    return index < currentStageIndex ? 'completed' : 'failed';
  }
  if (index < currentStageIndex) return 'completed';
  if (index === currentStageIndex && pipelineStatus === 'running') return 'running';
  return 'pending';
}
