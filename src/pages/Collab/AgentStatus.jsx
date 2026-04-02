/**
 * AgentStatus — Agent grid display (PixelBrain-inspired metric cards)
 */

const STATUS_COLORS = {
    online: 'var(--color-collab-success, #40ff80)',
    busy: 'var(--color-collab-warning, #ffc040)',
    idle: 'var(--color-collab-info, #60c0ff)',
    offline: 'var(--color-collab-text-dim, #505070)',
};

const ROLE_LABELS = {
    ui: 'UI / Visual',
    backend: 'Backend / Logic',
    qa: 'Testing / QA',
};

export default function AgentStatus({ agents }) {
    if (!agents || agents.length === 0) {
        return (
            <div className="agents-empty">
                <h3 className="agents-empty-title">No Agents Registered</h3>
                <p className="agents-empty-text">
                    Register agents via CLI to begin collaboration.
                </p>
                <code className="agents-empty-code">
                    node scripts/collab-client.js register --name &quot;Agent&quot; --role backend --capabilities node,fastify
                </code>
            </div>
        );
    }

    const onlineCount = agents.filter(a => a.status !== 'offline').length;

    return (
        <div className="agents-view">
            <h3 className="agents-title">
                Agents <span className="agents-count">({onlineCount}/{agents.length} online)</span>
            </h3>
            <div className="agents-grid">
                {agents.map(agent => (
                    <div key={agent.id} className="agent-card">
                        <div className="agent-card__header">
                            <span
                                className="agent-card__indicator"
                                style={{ backgroundColor: STATUS_COLORS[agent.status] || STATUS_COLORS.offline }}
                                aria-label={`Status: ${agent.status}`}
                            />
                            <span className="agent-card__name">{agent.name}</span>
                        </div>
                        <div className="agent-card__meta">
                            <span className="agent-card__role">{ROLE_LABELS[agent.role] || agent.role}</span>
                            <span className="agent-card__status">{agent.status}</span>
                        </div>
                        {agent.capabilities && agent.capabilities.length > 0 && (
                            <div className="agent-card__caps">
                                {agent.capabilities.map(cap => (
                                    <span key={cap} className="agent-card__cap-tag">{cap}</span>
                                ))}
                            </div>
                        )}
                        {agent.current_task_id && (
                            <div className="agent-card__task">
                                <span className="task-label">Working on:</span>
                                <span className="task-id">{agent.current_task_id.slice(0, 8)}...</span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
