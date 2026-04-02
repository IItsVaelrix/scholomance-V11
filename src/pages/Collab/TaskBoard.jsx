/**
 * TaskBoard — Kanban board for task management
 */

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
    'var(--color-collab-text-dim, #505070)',
    'var(--color-collab-text, #e0e0ff)',
    'var(--color-collab-warning, #ffc040)',
    'var(--color-collab-error, #ff4060)',
];

export default function TaskBoard({ 
    tasks, 
    agents, 
    onRefresh: _onRefresh,
    showCreateForm,
    onToggleCreate,
    newTitle,
    onTitleChange,
    newPriority,
    onPriorityChange,
    onCreateTask,
    onTaskClick,
}) {
    const tasksByStatus = {};
    for (const col of COLUMNS) {
        tasksByStatus[col.key] = tasks.filter(t => t.status === col.key);
    }

    const agentMap = {};
    for (const agent of agents) {
        agentMap[agent.id] = agent;
    }

    return (
        <div className="task-board">
            {showCreateForm && (
                <form className="task-create-form" onSubmit={onCreateTask}>
                    <input
                        className="task-create-form__input"
                        type="text"
                        placeholder="Task title..."
                        value={newTitle}
                        onChange={e => onTitleChange(e.target.value)}
                    />
                    <select
                        className="task-create-form__select"
                        value={newPriority}
                        onChange={e => onPriorityChange(Number(e.target.value))}
                    >
                        {PRIORITY_LABELS.map((label, i) => (
                            <option key={i} value={i}>{label}</option>
                        ))}
                    </select>
                    <button className="task-create-form__submit" type="submit">Create</button>
                    <button 
                        className="task-create-form__cancel" 
                        type="button"
                        onClick={onToggleCreate}
                    >
                        Cancel
                    </button>
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
                                <div 
                                    key={task.id} 
                                    className="task-card"
                                    onClick={() => onTaskClick && onTaskClick(task)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' || e.key === ' ') {
                                            e.preventDefault();
                                            onTaskClick && onTaskClick(task);
                                        }
                                    }}
                                >
                                    <div className="task-card__title">{task.title}</div>
                                    <div className="task-card__meta">
                                        <span
                                            className="task-card__priority"
                                            style={{ color: PRIORITY_COLORS[task.priority ?? 0] }}
                                        >
                                            {PRIORITY_LABELS[task.priority ?? 0]}
                                        </span>
                                        {task.assigned_agent && (
                                            <span className="task-card__agent">
                                                {agentMap[task.assigned_agent]?.name || task.assigned_agent}
                                            </span>
                                        )}
                                    </div>
                                    {task.file_paths && task.file_paths.length > 0 && (
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
                            {tasksByStatus[col.key].length === 0 && (
                                <div className="kanban__empty">No tasks</div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
