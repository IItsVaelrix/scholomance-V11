import { useState, useEffect, useCallback } from 'react';
import { z } from 'zod';
import AgentStatus from './AgentStatus';
import TaskBoard from './TaskBoard';
import PipelineView from './PipelineView';
import ActivityFeed from './ActivityFeed';
import './CollabPage.css';

const POLL_INTERVAL = 5000;

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
}).passthrough();

const PipelineSchema = z.object({
    id: z.string(),
    name: z.string(),
    status: z.string(),
}).passthrough();

const ActivitySchema = z.object({
    id: z.string(),
    message: z.string(),
    timestamp: z.string().optional(),
}).passthrough();

export default function CollabPage() {
    const [agents, setAgents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [activity, setActivity] = useState([]);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const [agentsRaw, tasksRaw, pipelinesRaw, activityRaw] = await Promise.all([
                fetch('/collab/agents').then(r => r.json()),
                fetch('/collab/tasks').then(r => r.json()),
                fetch('/collab/pipelines').then(r => r.json()),
                fetch('/collab/activity?limit=30').then(r => r.json()),
            ]);

            const agentsParsed = z.array(AgentSchema).safeParse(agentsRaw);
            const tasksParsed = z.array(TaskSchema).safeParse(tasksRaw);
            const pipelinesParsed = z.array(PipelineSchema).safeParse(pipelinesRaw);
            const activityParsed = z.array(ActivitySchema).safeParse(activityRaw);

            if (agentsParsed.success) setAgents(agentsParsed.data);
            if (tasksParsed.success) setTasks(tasksParsed.data);
            if (pipelinesParsed.success) setPipelines(pipelinesParsed.data);
            if (activityParsed.success) setActivity(activityParsed.data);

            setError(null);
            setLastRefresh(new Date());
        } catch (err) {
            setError('Cannot reach collab server. Is it running? (npm run start)');
        }
    }, []);

    useEffect(() => {
        refresh();
        const interval = setInterval(refresh, POLL_INTERVAL);
        return () => clearInterval(interval);
    }, [refresh]);

    return (
        <div className="collab-page">
            <header className="collab-page__header">
                <h1 className="collab-page__title">Agent Collaboration</h1>
                <div className="collab-page__status">
                    {error ? (
                        <span className="collab-page__error">{error}</span>
                    ) : (
                        <span className="collab-page__connected">
                            Connected {lastRefresh && `- ${lastRefresh.toLocaleTimeString()}`}
                        </span>
                    )}
                    <button className="collab-btn collab-btn--small" onClick={refresh}>Refresh</button>
                </div>
            </header>

            <section className="collab-quickstart" aria-label="Collaboration Quick Start">
                <div className="collab-quickstart__header">
                    <h2 className="collab-card__title">Quick Start</h2>
                    <p className="collab-quickstart__subtitle">Use this order: server -&gt; agents -&gt; tasks -&gt; pipelines</p>
                </div>

                <ol className="collab-quickstart__steps">
                    <li>Run the backend server: <code>npm run start</code></li>
                    <li>
                        Register each agent session:
                        <code>$env:AGENT_ID=&apos;agent-ui&apos;; node scripts/collab-client.js register --name &quot;Frontend Agent&quot; --role ui --capabilities jsx,css</code>
                    </li>
                    <li>Create work from <code>+ New Task</code> below or via <code>POST /collab/tasks</code>.</li>
                    <li>Let agents claim and complete tasks with <code>claim</code> and <code>complete</code> commands.</li>
                    <li>Start orchestration flows with <code>POST /collab/pipelines</code> (for example <code>code_review_test</code>).</li>
                </ol>
            </section>

            <div className="collab-page__grid">
                <AgentStatus agents={agents} />
                <PipelineView pipelines={pipelines} />
                <TaskBoard tasks={tasks} agents={agents} onRefresh={refresh} />
                <ActivityFeed activity={activity} />
            </div>
        </div>
    );
}
