const STATUS_COLORS = {
    online: 'var(--color-success, #4caf50)',
    busy: 'var(--color-warning, #ff9800)',
    offline: 'var(--color-muted, #666)',
};

const ROLE_LABELS = {
    ui: 'UI / Visual',
    backend: 'Backend / Logic',
    qa: 'Testing / QA',
};

export default function AgentStatus({ agents }) {
    if (!agents.length) {
        return (
            <div className="collab-card">
                <h2 className="collab-card__title">Agents</h2>
                <p className="collab-card__empty">No agents registered. Start an AI session and register it.</p>
            </div>
        );
    }

    return (
        <div className="collab-card">
            <h2 className="collab-card__title">Agents ({agents.filter(a => a.status !== 'offline').length} online)</h2>
            <div className="agent-grid">
                {agents.map(agent => (
                    <div key={agent.id} className="agent-card">
                        <div className="agent-card__header">
                            <span
                                className="agent-card__indicator"
                                style={{ backgroundColor: STATUS_COLORS[agent.status] || STATUS_COLORS.offline }}
                            />
                            <span className="agent-card__name">{agent.name}</span>
                        </div>
                        <div className="agent-card__meta">
                            <span className="agent-card__role">{ROLE_LABELS[agent.role] || agent.role}</span>
                            <span className="agent-card__status">{agent.status}</span>
                        </div>
                        {agent.capabilities.length > 0 && (
                            <div className="agent-card__caps">
                                {agent.capabilities.map(cap => (
                                    <span key={cap} className="agent-card__cap-tag">{cap}</span>
                                ))}
                            </div>
                        )}
                        {agent.current_task_id && (
                            <div className="agent-card__task">Working on: {agent.current_task_id.slice(0, 8)}...</div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
