import { useState } from 'react';

const COLUMNS = [
    { key: 'backlog', label: 'Backlog' },
    { key: 'assigned', label: 'Assigned' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'review', label: 'Review' },
    { key: 'testing', label: 'Testing' },
    { key: 'done', label: 'Done' },
];

const PRIORITY_LABELS = ['Low', 'Normal', 'High', 'Critical'];
const PRIORITY_COLORS = [
    'var(--color-muted, #888)',
    'var(--color-text, #ccc)',
    'var(--color-warning, #ff9800)',
    'var(--color-error, #f44336)',
];

export default function TaskBoard({ tasks, agents, onRefresh }) {
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newPriority, setNewPriority] = useState(1);

    const tasksByStatus = {};
    for (const col of COLUMNS) {
        tasksByStatus[col.key] = tasks.filter(t => t.status === col.key);
    }

    const agentMap = {};
    for (const agent of agents) {
        agentMap[agent.id] = agent;
    }

    async function handleCreateTask(e) {
        e.preventDefault();
        if (!newTitle.trim()) return;

        await fetch('/collab/tasks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle, priority: newPriority, created_by: 'human' }),
        });
        setNewTitle('');
        setShowCreateForm(false);
        onRefresh();
    }

    return (
        <div className="collab-card collab-card--wide">
            <div className="collab-card__header-row">
                <h2 className="collab-card__title">Task Board ({tasks.length})</h2>
                <button
                    className="collab-btn collab-btn--small"
                    onClick={() => setShowCreateForm(!showCreateForm)}
                >
                    {showCreateForm ? 'Cancel' : '+ New Task'}
                </button>
            </div>

            <p className="collab-card__hint">
                Workflow: create tasks here, then agents run <code>node scripts/collab-client.js claim &lt;task-id&gt;</code> and mark done with <code>complete</code>.
            </p>

            {showCreateForm && (
                <form className="task-create-form" onSubmit={handleCreateTask}>
                    <input
                        className="task-create-form__input"
                        type="text"
                        placeholder="Task title..."
                        value={newTitle}
                        onChange={e => setNewTitle(e.target.value)}
                    />
                    <select
                        className="task-create-form__select"
                        value={newPriority}
                        onChange={e => setNewPriority(Number(e.target.value))}
                    >
                        {PRIORITY_LABELS.map((label, i) => (
                            <option key={i} value={i}>{label}</option>
                        ))}
                    </select>
                    <button className="collab-btn" type="submit">Create</button>
                </form>
            )}

            <div className="kanban">
                {COLUMNS.map(col => (
                    <div key={col.key} className="kanban__column">
                        <div className="kanban__column-header">
                            <span>{col.label}</span>
                            <span className="kanban__count">{tasksByStatus[col.key].length}</span>
                        </div>
                        <div className="kanban__cards">
                            {tasksByStatus[col.key].map(task => (
                                <div key={task.id} className="task-card">
                                    <div className="task-card__title">{task.title}</div>
                                    <div className="task-card__meta">
                                        <span
                                            className="task-card__priority"
                                            style={{ color: PRIORITY_COLORS[task.priority] }}
                                        >
                                            {PRIORITY_LABELS[task.priority]}
                                        </span>
                                        {task.assigned_agent && (
                                            <span className="task-card__agent">
                                                {agentMap[task.assigned_agent]?.name || task.assigned_agent}
                                            </span>
                                        )}
                                    </div>
                                    {task.file_paths.length > 0 && (
                                        <div className="task-card__files">
                                            {task.file_paths.map(fp => (
                                                <span key={fp} className="task-card__file">{fp.split('/').pop()}</span>
                                            ))}
                                        </div>
                                    )}
                                    {task.pipeline_run_id && (
                                        <span className="task-card__pipeline-tag">Pipeline</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
