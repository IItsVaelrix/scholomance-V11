const STATUS_COLORS = {
    running: 'var(--color-warning, #ff9800)',
    completed: 'var(--color-success, #4caf50)',
    failed: 'var(--color-error, #f44336)',
    pending: 'var(--color-muted, #666)',
};

export default function PipelineView({ pipelines }) {
    if (!pipelines.length) {
        return (
            <div className="collab-card">
                <h2 className="collab-card__title">Pipelines</h2>
                <p className="collab-card__empty">No pipelines running. Start one via the API.</p>
            </div>
        );
    }

    return (
        <div className="collab-card">
            <h2 className="collab-card__title">Pipelines ({pipelines.filter(p => p.status === 'running').length} active)</h2>
            <div className="pipeline-list">
                {pipelines.map(pipeline => (
                    <div key={pipeline.id} className="pipeline-card">
                        <div className="pipeline-card__header">
                            <span className="pipeline-card__type">{pipeline.pipeline_type.replace(/_/g, ' ')}</span>
                            <span
                                className="pipeline-card__status"
                                style={{ color: STATUS_COLORS[pipeline.status] }}
                            >
                                {pipeline.status}
                            </span>
                        </div>
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
                        {pipeline.results.failure_reason && (
                            <div className="pipeline-card__error">{pipeline.results.failure_reason}</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
