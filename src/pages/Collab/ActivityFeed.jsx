const ACTION_LABELS = {
    agent_registered: 'registered',
    task_created: 'created task',
    task_assigned: 'claimed task',
    task_updated: 'updated task',
    task_deleted: 'deleted task',
    pipeline_started: 'started pipeline',
    pipeline_advanced: 'advanced pipeline',
    pipeline_completed: 'completed pipeline',
    pipeline_failed: 'pipeline failed',
};

function formatTime(dateStr) {
    const date = new Date(dateStr + 'Z');
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return date.toLocaleDateString();
}

export default function ActivityFeed({ activity }) {
    if (!activity.length) {
        return (
            <div className="collab-card">
                <h2 className="collab-card__title">Activity</h2>
                <p className="collab-card__empty">No activity yet.</p>
                <p className="collab-card__hint">Create a task or send an agent heartbeat to start the event stream.</p>
            </div>
        );
    }

    return (
        <div className="collab-card">
            <h2 className="collab-card__title">Activity</h2>
            <div className="activity-feed">
                {activity.map(entry => (
                    <div key={entry.id} className="activity-entry">
                        <span className="activity-entry__agent">{entry.agent_id || 'system'}</span>
                        <span className="activity-entry__action">
                            {ACTION_LABELS[entry.action] || entry.action}
                        </span>
                        {entry.details?.title && (
                            <span className="activity-entry__detail">&quot;{entry.details.title}&quot;</span>
                        )}
                        {entry.details?.name && (
                            <span className="activity-entry__detail">{entry.details.name}</span>
                        )}
                        <span className="activity-entry__time">{formatTime(entry.created_at)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
