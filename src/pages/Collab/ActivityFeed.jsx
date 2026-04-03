/**
 * ActivityFeed — Chronological activity timeline
 */

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const ACTION_LABELS = {
    agent_registered: 'registered',
    agent_heartbeat: 'sent heartbeat',
    task_created: 'created task',
    task_assigned: 'claimed task',
    task_updated: 'updated task',
    task_deleted: 'deleted task',
    pipeline_started: 'started pipeline',
    pipeline_advanced: 'advanced pipeline',
    pipeline_completed: 'completed pipeline',
    pipeline_failed: 'pipeline failed',
    bug_report_created: 'filed bug',
    bug_report_updated: 'updated bug',
    bug_report_deleted: 'deleted bug',
    bug_task_created: 'linked bug to task',
};

const HEARTBEAT_ACTIONS = new Set(['agent_heartbeat', 'heartbeat']);

function formatTime(dateStr) {
    if (!dateStr) return 'unknown';
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

/**
 * HeartbeatPulse — animated heart that pulses for 1.5s
 */
function HeartbeatPulse({ agentId }) {
    return (
        <motion.div
            className="heartbeat-pulse"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{
                scale: [0.5, 1.2, 0.9, 1.1, 0.95, 1],
                opacity: [0, 1, 0.8, 0.6, 0.3, 0],
            }}
            transition={{
                duration: 1.5,
                times: [0, 0.15, 0.3, 0.5, 0.75, 1],
                ease: "easeInOut",
            }}
            aria-label={`${agentId} heartbeat`}
        >
            <motion.div
                className="heartbeat-pulse__aura"
                initial={{ scale: 0.8, opacity: 0.6 }}
                animate={{
                    scale: [0.8, 2.5, 3.5],
                    opacity: [0.6, 0.3, 0],
                }}
                transition={{
                    duration: 1.5,
                    times: [0, 0.5, 1],
                    ease: "easeOut",
                }}
            />
            <span className="heartbeat-pulse__icon">♥</span>
        </motion.div>
    );
}

export default function ActivityFeed({ activity }) {
    const [recentHeartbeats, setRecentHeartbeats] = useState([]);
    const [isLive, setIsLive] = useState(true);
    const timelineRef = useRef(null);

    // Auto-scroll to bottom when new entries arrive
    useEffect(() => {
        if (timelineRef.current && isLive) {
            timelineRef.current.scrollTop = timelineRef.current.scrollHeight;
        }
    }, [activity, isLive]);

    // Detect new heartbeat entries and trigger pulse animation
    useEffect(() => {
        if (!activity || activity.length === 0) return;

        const heartbeats = activity
            .filter(entry => HEARTBEAT_ACTIONS.has(entry.action))
            .slice(0, 3) // Show max 3 concurrent pulses
            .map(entry => ({
                id: entry.id,
                agentId: entry.agent_id || 'system',
                key: `hb-${entry.id}-${Date.now()}`,
            }));

        setRecentHeartbeats(heartbeats);

        // Clear pulses after animation completes
        const timers = heartbeats.map(hb =>
            setTimeout(() => {
                setRecentHeartbeats(prev => prev.filter(p => p.key !== hb.key));
            }, 1500)
        );

        return () => timers.forEach(clearTimeout);
    }, [activity]);

    if (!activity || activity.length === 0) {
        return (
            <div className="activity-empty">
                <h3 className="activity-empty-title">No Activity Yet</h3>
                <p className="activity-empty-text">
                    Create a task or send an agent heartbeat to start the event stream.
                </p>
            </div>
        );
    }

    return (
        <div className="activity-view">
            <div className="activity-view__header">
                <h3 className="activity-title">Activity Feed</h3>
                <button
                    className={`activity-live-toggle ${isLive ? 'activity-live-toggle--active' : ''}`}
                    onClick={() => setIsLive(prev => !prev)}
                    aria-label={isLive ? 'Pause live updates' : 'Resume live updates'}
                    title={isLive ? 'Live updates active — click to pause' : 'Live updates paused — click to resume'}
                >
                    <span className="activity-live__dot" />
                    {isLive ? 'LIVE' : 'PAUSED'}
                </button>
                <AnimatePresence>
                    {recentHeartbeats.map(hb => (
                        <HeartbeatPulse key={hb.key} agentId={hb.agentId} />
                    ))}
                </AnimatePresence>
            </div>
            <div className="activity-timeline" ref={timelineRef}>
                {activity.map(entry => {
                    const isHeartbeat = HEARTBEAT_ACTIONS.has(entry.action);
                    return (
                        <div
                            key={entry.id}
                            className={`activity-entry ${isHeartbeat ? 'activity-entry--heartbeat' : ''}`}
                        >
                            {isHeartbeat && (
                                <span className="activity-entry__heart-icon">♥</span>
                            )}
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
                    );
                })}
            </div>
        </div>
    );
}
