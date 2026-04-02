/**
 * CollabPage — Agent Collaboration Console
 * Sacred Geometry Layout: Left Panel (Input) | Center (Viewport) | Right Panel (Telemetry)
 * Adapted from PixelBrain architecture
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useCallback, useRef } from 'react';
import { z } from 'zod';

// New components
import CollabStatusDisplay from './CollabStatusDisplay.jsx';
import MetricsGrid from './MetricsGrid.jsx';
import FilterSliders from './FilterSliders.jsx';
import TaskDetailDrawer from './TaskDetailDrawer.jsx';
import PipelineTerminal from './PipelineTerminal.jsx';

// Existing components (to be refactored)
import AgentStatus from './AgentStatus.jsx';
import TaskBoard from './TaskBoard.jsx';
import PipelineView from './PipelineView.jsx';
import ActivityFeed from './ActivityFeed.jsx';

import './CollabPage.css';

const POLL_INTERVAL = 15000; // 15s — calm, not rushed

// Zod schemas (enhanced from original)
const AgentSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
    role: z.string(),
    capabilities: z.array(z.string()),
    current_task_id: z.string().nullable().optional(),
}).passthrough();

const TaskSchema = z.object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.number().optional(),
    assigned_agent: z.string().nullable().optional(),
    file_paths: z.array(z.string()).optional(),
    pipeline_run_id: z.string().nullable().optional(),
}).passthrough();

const PipelineSchema = z.object({
    id: z.string(),
    pipeline_type: z.string(),
    status: z.string(),
    current_stage: z.number().optional(),
    stages: z.array(z.object({
        name: z.string(),
        role: z.string().nullable().optional(),
    })).optional(),
    results: z.object({
        failure_reason: z.string().nullable().optional(),
    }).optional(),
}).passthrough();

const ActivitySchema = z.object({
    id: z.string(),
    agent_id: z.string().nullable().optional(),
    action: z.string(),
    details: z.object({
        title: z.string().optional(),
        name: z.string().optional(),
    }).optional(),
    created_at: z.string(),
}).passthrough();

const TABS = [
    { key: 'overview', label: 'OVERVIEW' },
    { key: 'tasks', label: 'TASKS' },
    { key: 'agents', label: 'AGENTS' },
    { key: 'pipelines', label: 'PIPELINES' },
    { key: 'locks', label: 'LOCKS' },
    { key: 'activity', label: 'ACTIVITY' },
];

export default function CollabPage() {
    // Core state
    const [agents, setAgents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [activity, setActivity] = useState([]);
    const [locks, setLocks] = useState([]);
    
    // UI state
    const [activeTab, setActiveTab] = useState('overview');
    const [status, setStatus] = useState('idle'); // 'idle' | 'syncing' | 'ready' | 'conflict' | 'error'
    const [conflict, setConflict] = useState(null);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);
    
    // Drawer state
    const [selectedTask, setSelectedTask] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    
    // Pipeline terminal state
    const [selectedPipeline, setSelectedPipeline] = useState(null);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    
    // Filters
    const [filters, setFilters] = useState({
        minPriority: 0,
        maxAge: 24,
        limit: 50,
    });

    // Task creation state
    const [showCreateTask, setShowCreateTask] = useState(false);
    const [newTaskTitle, setNewTaskTitle] = useState('');
    const [newTaskPriority, setNewTaskPriority] = useState(1);

    // Pipeline creation state
    const [showCreatePipeline, setShowCreatePipeline] = useState(false);
    const [newPipelineType, setNewPipelineType] = useState('code_review_test');

    const canvasRef = useRef(null);

    // Refresh all data
    const refresh = useCallback(async () => {
        setStatus('syncing');
        setError(null);
        setConflict(null);

        try {
            const [agentsRaw, tasksRaw, pipelinesRaw, activityRaw, locksRaw] = await Promise.all([
                fetch('/collab/agents').then(r => r.json()),
                fetch('/collab/tasks').then(r => r.json()),
                fetch('/collab/pipelines').then(r => r.json()),
                fetch('/collab/activity?limit=30').then(r => r.json()),
                fetch('/collab/locks').then(r => r.json()),
            ]);

            const agentsParsed = z.array(AgentSchema).safeParse(agentsRaw);
            const tasksParsed = z.array(TaskSchema).safeParse(tasksRaw);
            const pipelinesParsed = z.array(PipelineSchema).safeParse(pipelinesRaw);
            const activityParsed = z.array(ActivitySchema).safeParse(activityRaw);
            const locksParsed = z.array(z.any()).safeParse(locksRaw);

            if (agentsParsed.success) setAgents(agentsParsed.data);
            if (tasksParsed.success) setTasks(tasksParsed.data);
            if (pipelinesParsed.success) setPipelines(pipelinesParsed.data);
            if (activityParsed.success) setActivity(activityParsed.data);
            if (locksParsed.success) setLocks(locksParsed.data);

            setStatus('ready');
            setLastRefresh(new Date());
        } catch (err) {
            setError('Cannot reach collab server. Is it running?');
            setStatus('error');
        }
    }, []);

    // Polling effect
    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [refresh]);

    // Handle filter change
    const handleFilterChange = useCallback((key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    }, []);

    // Handle task creation
    const handleCreateTask = useCallback(async (e) => {
        e.preventDefault();
        if (!newTaskTitle.trim()) return;

        setStatus('processing');
        try {
            await fetch('/collab/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    title: newTaskTitle, 
                    priority: newTaskPriority, 
                    created_by: 'human' 
                }),
            });
            setNewTaskTitle('');
            setShowCreateTask(false);
            refresh();
        } catch (err) {
            setError('Task creation failed');
            setStatus('error');
        }
    }, [newTaskTitle, newTaskPriority, refresh]);

    // Handle task click (open drawer)
    const handleTaskClick = useCallback((task) => {
        setSelectedTask(task);
        setIsDrawerOpen(true);
    }, []);

    // Handle task assignment
    const handleTaskAssign = useCallback((updatedTask) => {
        setTasks(prev => prev.map(t => t.id === updatedTask.id ? updatedTask : t));
        setSelectedTask(updatedTask);
        refresh();
    }, [refresh]);

    // Handle task status change
    const handleTaskStatusChange = useCallback(async (taskId, newStatus) => {
        try {
            const response = await fetch(`/collab/tasks/${taskId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (response.ok) {
                const updated = await response.json();
                setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
                setSelectedTask(updated);
                refresh();
            }
        } catch (err) {
            setError('Failed to update task status');
            setStatus('error');
        }
    }, [refresh]);

    // Handle task delete
    const handleTaskDelete = useCallback(async (taskId) => {
        if (!confirm('Are you sure you want to delete this task?')) return;
        
        try {
            await fetch(`/collab/tasks/${taskId}`, {
                method: 'DELETE',
            });
            setIsDrawerOpen(false);
            setSelectedTask(null);
            refresh();
        } catch (err) {
            setError('Failed to delete task');
            setStatus('error');
        }
    }, [refresh]);

    // Handle pipeline advance
    const handlePipelineAdvance = useCallback(async (result) => {
        if (!selectedPipeline) return;
        
        const response = await fetch(`/collab/pipelines/${selectedPipeline.id}/advance`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ result }),
        });
        if (response.ok) {
            refresh();
            setIsTerminalOpen(false);
            setSelectedPipeline(null);
        } else {
            const error = await response.json();
            throw new Error(error.error || 'Failed to advance pipeline');
        }
    }, [selectedPipeline, refresh]);

    // Handle pipeline fail
    const handlePipelineFail = useCallback(async (reason) => {
        if (!selectedPipeline) return;
        
        try {
            await fetch(`/collab/pipelines/${selectedPipeline.id}/fail`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
            });
            refresh();
            setIsTerminalOpen(false);
            setSelectedPipeline(null);
        } catch (err) {
            setError('Failed to fail pipeline');
            setStatus('error');
        }
    }, [selectedPipeline, refresh]);

    // Handle pipeline click (open terminal)
    const handlePipelineClick = useCallback((pipeline) => {
        setSelectedPipeline(pipeline);
        setIsTerminalOpen(true);
    }, []);

    // Handle pipeline creation
    const handleCreatePipeline = useCallback(async (e) => {
        e.preventDefault();
        
        setStatus('processing');
        try {
            await fetch('/collab/pipelines', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pipeline_type: newPipelineType }),
            });
            setShowCreatePipeline(false);
            refresh();
        } catch (err) {
            setError('Pipeline creation failed');
            setStatus('error');
        }
    }, [newPipelineType, refresh]);

    // Compute metrics for Overview tab
    const metrics = {
        agents: {
            total: agents.length,
            online: agents.filter(a => a.status !== 'offline').length,
        },
        tasks: {
            total: tasks.length,
            active: tasks.filter(t => t.status !== 'done' && t.status !== 'backlog').length,
        },
        pipelines: {
            running: pipelines.filter(p => p.status === 'running').length,
        },
        locks: {
            active: locks.length,
        },
        blocked: {
            count: tasks.filter(t => t.status === 'blocked').length,
        },
        completed: {
            count: tasks.filter(t => t.status === 'done').length,
        },
    };

    // Filter tasks by priority
    const filteredTasks = tasks.filter(t => 
        (t.priority ?? 0) >= filters.minPriority
    );

    // Render tab content
    const renderTabContent = () => {
        switch (activeTab) {
            case 'overview':
                return (
                    <div className="viewport-content viewport-content--overview">
                        <MetricsGrid metrics={metrics} />
                        <div className="overview-quickstart">
                            <h3 className="quickstart-title">Quick Start</h3>
                            <ol className="quickstart-steps">
                                <li>Register agents: <code>node scripts/collab-client.js register --name &quot;Agent&quot; --role backend</code></li>
                                <li>Create tasks from the Tasks tab or <code>POST /collab/tasks</code></li>
                                <li>Agents claim tasks: <code>node scripts/collab-client.js claim &lt;id&gt;</code></li>
                                <li>Start pipelines: <code>POST /collab/pipelines</code> with type <code>code_review_test</code></li>
                            </ol>
                        </div>
                    </div>
                );
            
            case 'tasks':
                return (
                    <div className="viewport-content viewport-content--tasks">
                        <TaskBoard
                            tasks={filteredTasks}
                            agents={agents}
                            onRefresh={refresh}
                            showCreateForm={showCreateTask}
                            onToggleCreate={() => setShowCreateTask(!showCreateTask)}
                            newTitle={newTaskTitle}
                            onTitleChange={setNewTaskTitle}
                            newPriority={newTaskPriority}
                            onPriorityChange={setNewTaskPriority}
                            onCreateTask={handleCreateTask}
                            onTaskClick={handleTaskClick}
                        />
                    </div>
                );
            
            case 'agents':
                return (
                    <div className="viewport-content viewport-content--agents">
                        <AgentStatus agents={agents} />
                    </div>
                );
            
            case 'pipelines':
                return (
                    <div className="viewport-content viewport-content--pipelines">
                        <PipelineView
                            pipelines={pipelines}
                            showCreateForm={showCreatePipeline}
                            onToggleCreate={() => setShowCreatePipeline(!showCreatePipeline)}
                            pipelineType={newPipelineType}
                            onTypeChange={setNewPipelineType}
                            onCreatePipeline={handleCreatePipeline}
                            onPipelineClick={handlePipelineClick}
                        />
                    </div>
                );
            
            case 'locks':
                return (
                    <div className="viewport-content viewport-content--locks">
                        <LocksView locks={locks} agents={agents} tasks={tasks} />
                    </div>
                );
            
            case 'activity':
                return (
                    <div className="viewport-content viewport-content--activity">
                        <ActivityFeed activity={activity} />
                    </div>
                );
            
            default:
                return null;
        }
    };

    return (
        <div className="collab-page">
            {/* Topbar */}
            <motion.header 
                className="collab-topbar"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
            >
                <div className="topbar-left">
                    <span className="topbar-title">COLLAB CONSOLE // AGENT_ORCHESTRATION</span>
                    <span className="topbar-subtitle">
                        [STATUS: {status.toUpperCase()}] 
                        {lastRefresh && ` [SYNC: ${lastRefresh.toLocaleTimeString()}]`}
                    </span>
                </div>
                <div className="topbar-right">
                    <span className="topbar-agents-online">
                        {metrics.agents.online}/{metrics.agents.total} AGENTS ONLINE
                    </span>
                    <button
                        className="topbar-btn"
                        onClick={refresh}
                        aria-label="Refresh all data"
                    >
                        REFRESH
                    </button>
                </div>
            </motion.header>

            {/* Main 3-Panel Layout */}
            <div className="collab-main">
                {/* LEFT PANEL: Navigation + Context */}
                <motion.aside 
                    className="collab-panel collab-panel--left"
                    initial={{ x: -30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
                >
                    {/* Tab Navigation */}
                    <div className="collab-tabs" role="tablist" aria-label="Collaboration views">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                className={`collab-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                                role="tab"
                                aria-selected={activeTab === tab.key}
                                aria-controls={`tab-panel-${tab.key}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content Area */}
                    <div className="collab-tab-content">
                        {activeTab === 'tasks' && (
                            <div className="quick-actions">
                                <button
                                    className="quick-action-btn"
                                    onClick={() => setShowCreateTask(!showCreateTask)}
                                >
                                    {showCreateTask ? 'CANCEL' : '+ NEW TASK'}
                                </button>
                            </div>
                        )}
                        
                        {activeTab === 'pipelines' && (
                            <div className="quick-actions">
                                <button
                                    className="quick-action-btn"
                                    onClick={() => setShowCreatePipeline(!showCreatePipeline)}
                                >
                                    {showCreatePipeline ? 'CANCEL' : '+ NEW PIPELINE'}
                                </button>
                            </div>
                        )}

                        {/* Filters (shown on relevant tabs) */}
                        {(activeTab === 'tasks' || activeTab === 'overview') && (
                            <FilterSliders filters={filters} onChange={handleFilterChange} />
                        )}

                        {/* Context help based on tab */}
                        <div className="context-help">
                            <h4 className="context-title">OPERATIONAL CONTEXT</h4>
                            {activeTab === 'overview' && (
                                <p className="context-text">
                                    Overview provides real-time metrics across all collaboration surfaces.
                                </p>
                            )}
                            {activeTab === 'tasks' && (
                                <p className="context-text">
                                    Tasks are work packets. Agents claim tasks based on role compatibility and file ownership.
                                </p>
                            )}
                            {activeTab === 'agents' && (
                                <p className="context-text">
                                    Agents are registered via CLI. Status updates via heartbeat every 30s.
                                </p>
                            )}
                            {activeTab === 'pipelines' && (
                                <p className="context-text">
                                    Pipelines orchestrate multi-stage workflows. Each stage auto-creates tasks.
                                </p>
                            )}
                            {activeTab === 'locks' && (
                                <p className="context-text">
                                    File locks prevent concurrent modification. Locks auto-release when tasks complete.
                                </p>
                            )}
                            {activeTab === 'activity' && (
                                <p className="context-text">
                                    Activity is the system memory. All agent actions are logged here.
                                </p>
                            )}
                        </div>
                    </div>
                </motion.aside>

                {/* CENTER PANEL: Viewport */}
                <motion.section 
                    className="collab-panel collab-panel--center" 
                    ref={canvasRef}
                    initial={{ scale: 0.98, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                >
                    <div className="viewport-container">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeTab}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                                transition={{ duration: 0.3 }}
                                className="viewport-motion-wrapper"
                                style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}
                            >
                                {renderTabContent()}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                    
                    {/* Status Display (below viewport) */}
                    <CollabStatusDisplay 
                        status={status}
                        conflict={conflict}
                        context={error || null}
                    />
                </motion.section>

                {/* RIGHT PANEL: Telemetry */}
                <motion.aside 
                    className="collab-panel collab-panel--right"
                    initial={{ x: 30, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
                >
                    {/* Live Metrics */}
                    <div className="telemetry-section">
                        <div className="telemetry-header">LIVE METRICS</div>
                        <div className="telemetry-metrics">
                            <div className="telemetry-row">
                                <span className="telemetry-label">Agents</span>
                                <span className="telemetry-value">{metrics.agents.online}/{metrics.agents.total}</span>
                            </div>
                            <div className="telemetry-row">
                                <span className="telemetry-label">Active Tasks</span>
                                <span className="telemetry-value">{metrics.tasks.active}</span>
                            </div>
                            <div className="telemetry-row">
                                <span className="telemetry-label">Pipelines</span>
                                <span className="telemetry-value">{metrics.pipelines.running}</span>
                            </div>
                            <div className="telemetry-row">
                                <span className="telemetry-label">File Locks</span>
                                <span className="telemetry-value">{metrics.locks.active}</span>
                            </div>
                            <div className="telemetry-row">
                                <span className="telemetry-label">Blocked</span>
                                <span className="telemetry-value telemetry-value--warning">{metrics.blocked.count}</span>
                            </div>
                        </div>
                    </div>

                    {/* Recent Activity */}
                    <div className="telemetry-section">
                        <div className="telemetry-header">RECENT ACTIVITY</div>
                        <div className="telemetry-activity">
                            {activity.slice(0, 5).map(entry => (
                                <div key={entry.id} className="telemetry-activity-entry">
                                    <span className="activity-agent">{entry.agent_id || 'system'}</span>
                                    <span className="activity-action">{entry.action}</span>
                                </div>
                            ))}
                            {activity.length === 0 && (
                                <p className="telemetry-empty">No activity yet</p>
                            )}
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="telemetry-section">
                        <div className="telemetry-header">QUICK ACTIONS</div>
                        <div className="quick-actions-vertical">
                            <button className="quick-action-btn--vertical" onClick={() => {
                                setActiveTab('tasks');
                                setShowCreateTask(true);
                            }}>
                                CREATE TASK
                            </button>
                            <button className="quick-action-btn--vertical" onClick={() => {
                                setActiveTab('pipelines');
                                setShowCreatePipeline(true);
                            }}>
                                START PIPELINE
                            </button>
                        </div>
                    </div>
                </aside>
            </div>

            {/* Task Detail Drawer */}
            <TaskDetailDrawer
                task={selectedTask}
                agents={agents}
                pipelines={pipelines}
                locks={locks}
                activity={activity}
                isOpen={isDrawerOpen}
                onClose={() => {
                    setIsDrawerOpen(false);
                    setSelectedTask(null);
                }}
                onAssign={handleTaskAssign}
                onStatusChange={handleTaskStatusChange}
                onDelete={handleTaskDelete}
            />

            {/* Pipeline Terminal Modal */}
            {isTerminalOpen && selectedPipeline && (
                <PipelineTerminal
                    pipeline={selectedPipeline}
                    tasks={tasks}
                    agents={agents}
                    onAdvance={handlePipelineAdvance}
                    onFail={handlePipelineFail}
                    onClose={() => {
                        setIsTerminalOpen(false);
                        setSelectedPipeline(null);
                    }}
                />
            )}
        </div>
    );
}

// Simple LocksView component (inline for now)
function LocksView({ locks, agents, tasks }) {
    if (!locks || locks.length === 0) {
        return (
            <div className="locks-empty">
                <h3>No Active Locks</h3>
                <p>File locks are acquired when agents claim tasks. They auto-release when tasks complete.</p>
            </div>
        );
    }

    const agentMap = Object.fromEntries(agents.map(a => [a.id, a.name]));
    const taskMap = Object.fromEntries(tasks.map(t => [t.id, t.title]));

    return (
        <div className="locks-view">
            <h3 className="locks-title">Active File Locks ({locks.length})</h3>
            <table className="locks-table">
                <thead>
                    <tr>
                        <th>File Path</th>
                        <th>Locked By</th>
                        <th>Task</th>
                        <th>Expires</th>
                    </tr>
                </thead>
                <tbody>
                    {locks.map((lock, idx) => (
                        <tr key={idx}>
                            <td className="locks-file">{lock.file_path}</td>
                            <td className="locks-agent">{agentMap[lock.agent_id] || lock.agent_id}</td>
                            <td className="locks-task">{taskMap[lock.task_id]?.slice(0, 30) || lock.task_id}</td>
                            <td className="locks-expires">{new Date(lock.expires_at).toLocaleTimeString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
