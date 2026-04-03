/**
 * PipelineView — Pipeline visualization with create form
 */

const STATUS_COLORS = {
    running: 'var(--color-collab-warning, #ffc040)',
    completed: 'var(--color-collab-success, #40ff80)',
    failed: 'var(--color-collab-error, #ff4060)',
    pending: 'var(--color-collab-text-dim, #505070)',
};

const PIPELINE_TYPES = [
    { value: 'code_review_test', label: 'Code Review + Test' },
    { value: 'bug_fix', label: 'Bug Fix' },
    { value: 'feature', label: 'Feature Development' },
    { value: 'refactor', label: 'Refactoring' },
];

export default function PipelineView({ 
    pipelines,
    showCreateForm,
    onToggleCreate,
    pipelineType,
    onTypeChange,
    onCreatePipeline,
    onPipelineClick,
}) {
    if (!pipelines || pipelines.length === 0) {
        return (
            <div className="pipelines-empty">
                <h3 className="pipelines-empty-title">No Active Pipelines</h3>
                <p className="pipelines-empty-text">
                    Start a pipeline to orchestrate multi-stage workflows.
                </p>
                {showCreateForm ? (
                    <form className="pipeline-create-form" onSubmit={onCreatePipeline}>
                        <select
                            className="pipeline-create-form__select"
                            value={pipelineType}
                            onChange={e => onTypeChange(e.target.value)}
                        >
                            {PIPELINE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                        <button className="pipeline-create-form__submit" type="submit">Start Pipeline</button>
                        <button 
                            className="pipeline-create-form__cancel" 
                            type="button"
                            onClick={onToggleCreate}
                        >
                            Cancel
                        </button>
                    </form>
                ) : (
                    <button className="pipeline-create-btn" onClick={onToggleCreate}>
                        + NEW PIPELINE
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className="pipelines-view">
            <div className="pipelines-header">
                <h3 className="pipelines-title">
                    Pipelines <span className="pipelines-count">({pipelines.filter(p => p.status === 'running').length} active)</span>
                </h3>
                {showCreateForm && (
                    <form className="pipeline-create-form--inline" onSubmit={onCreatePipeline}>
                        <select
                            className="pipeline-create-form__select"
                            value={pipelineType}
                            onChange={e => onTypeChange(e.target.value)}
                        >
                            {PIPELINE_TYPES.map(type => (
                                <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                        </select>
                        <button className="pipeline-create-form__submit" type="submit">Start</button>
                        <button 
                            className="pipeline-create-form__cancel" 
                            type="button"
                            onClick={onToggleCreate}
                        >
                            Cancel
                        </button>
                    </form>
                )}
                {!showCreateForm && (
                    <button className="pipeline-add-btn" onClick={onToggleCreate}>
                        + NEW
                    </button>
                )}
            </div>

            <div className="pipeline-list">
                {pipelines.map(pipeline => (
                    <div 
                        key={pipeline.id} 
                        className="pipeline-card"
                        onClick={() => onPipelineClick && onPipelineClick(pipeline)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onPipelineClick && onPipelineClick(pipeline);
                            }
                        }}
                    >
                        <div className="pipeline-card__header">
                            <span className="pipeline-card__type">
                                {pipeline.pipeline_type.replace(/_/g, ' ')}
                            </span>
                            <span
                                className="pipeline-card__status"
                                style={{ color: STATUS_COLORS[pipeline.status] }}
                            >
                                {pipeline.status}
                            </span>
                        </div>
                        {pipeline.stages && pipeline.stages.length > 0 && (
                            <div className="pipeline-card__stages">
                                {pipeline.stages.map((stage, idx) => {
                                    let stageStatus = 'pending';
                                    if (idx < pipeline.current_stage) stageStatus = 'completed';
                                    else if (idx === pipeline.current_stage && pipeline.status === 'running') stageStatus = 'running';
                                    else if (pipeline.status === 'completed') stageStatus = 'completed';
                                    else if (pipeline.status === 'failed' && idx === pipeline.current_stage) stageStatus = 'failed';

                                    return (
                                        <div key={idx} className={`pipeline-stage pipeline-stage--${stageStatus}`}>
                                            <span className="pipeline-stage__dot" />
                                            <span className="pipeline-stage__name">{stage.name}</span>
                                            {stage.role && <span className="pipeline-stage__role">{stage.role}</span>}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {pipeline.results?.failure_reason && (
                            <div className="pipeline-card__error">{pipeline.results.failure_reason}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
