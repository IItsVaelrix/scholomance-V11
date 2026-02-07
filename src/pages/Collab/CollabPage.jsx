import { useState, useEffect, useCallback } from 'react';
import AgentStatus from './AgentStatus';
import TaskBoard from './TaskBoard';
import PipelineView from './PipelineView';
import ActivityFeed from './ActivityFeed';
import './CollabPage.css';

const POLL_INTERVAL = 5000;

export default function CollabPage() {
    const [agents, setAgents] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [activity, setActivity] = useState([]);
    const [error, setError] = useState(null);
    const [lastRefresh, setLastRefresh] = useState(null);

    const refresh = useCallback(async () => {
        try {
            const [agentsRes, tasksRes, pipelinesRes, activityRes] = await Promise.all([
                fetch('/collab/agents').then(r => r.json()),
                fetch('/collab/tasks').then(r => r.json()),
                fetch('/collab/pipelines').then(r => r.json()),
                fetch('/collab/activity?limit=30').then(r => r.json()),
            ]);
            setAgents(agentsRes);
            setTasks(tasksRes);
            setPipelines(pipelinesRes);
            setActivity(activityRes);
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

            <div className="collab-page__grid">
                <AgentStatus agents={agents} />
                <PipelineView pipelines={pipelines} />
                <TaskBoard tasks={tasks} agents={agents} onRefresh={refresh} />
                <ActivityFeed activity={activity} />
            </div>
        </div>
    );
}
