/**
 * AgentStatus — live presence surface for connected and disconnected agents
 */

import { motion } from 'framer-motion';

const STALE_AFTER_MS = 5 * 60 * 1000;

const ROLE_LABELS = {
    ui: 'UI / Visual',
    backend: 'Backend / Logic',
    qa: 'Testing / QA',
    docs: 'Docs / Narrative',
};

const STATUS_LABELS = {
    connected: 'Connected',
    busy: 'Busy',
    idle: 'Idle',
    disconnected: 'Disconnected',
};

function parseAgentLastSeen(value) {
    const raw = String(value || '').trim();
    if (!raw) return null;
    const normalized = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
    const parsed = Date.parse(normalized);
    return Number.isFinite(parsed) ? parsed : null;
}

function getConnectionState(agent, nowMs) {
    const status = String(agent?.status || 'offline').toLowerCase();
    const lastSeenMs = parseAgentLastSeen(agent?.last_seen);
    const isStale = !lastSeenMs || (nowMs - lastSeenMs) > STALE_AFTER_MS;

    if (status === 'offline' || isStale) {
        return 'disconnected';
    }
    if (status === 'busy') {
        return 'busy';
    }
    if (status === 'idle') {
        return 'idle';
    }
    return 'connected';
}

function formatRelativeTime(lastSeenMs, nowMs) {
    if (!lastSeenMs) return 'no heartbeat';
    const diffMs = Math.max(0, nowMs - lastSeenMs);
    if (diffMs < 15_000) return 'just now';
    if (diffMs < 60_000) return `${Math.floor(diffMs / 1000)}s ago`;
    if (diffMs < 3_600_000) return `${Math.floor(diffMs / 60_000)}m ago`;
    return `${Math.floor(diffMs / 3_600_000)}h ago`;
}

function compareAgents(a, b) {
    const priority = {
        busy: 0,
        connected: 1,
        idle: 2,
        disconnected: 3,
    };
    const stateDelta = (priority[a.connectionState] ?? 99) - (priority[b.connectionState] ?? 99);
    if (stateDelta !== 0) return stateDelta;
    return (b.lastSeenMs || 0) - (a.lastSeenMs || 0);
}

function buildPresenceSummary(agents) {
    return agents.reduce((summary, agent) => {
        summary.total += 1;
        summary[agent.connectionState] += 1;
        return summary;
    }, {
        total: 0,
        connected: 0,
        busy: 0,
        idle: 0,
        disconnected: 0,
    });
}

function AgentSection({ title, subtitle, agents, emptyText }) {
    return (
        <section className="agents-section">
            <div className="agents-section__header">
                <h4 className="agents-section__title">{title}</h4>
                <span className="agents-section__subtitle">{subtitle}</span>
            </div>
            {agents.length === 0 ? (
                <p className="agents-section__empty">{emptyText}</p>
            ) : (
                <motion.div
                    className="agents-grid"
                    initial="hidden"
                    animate="visible"
                    variants={{
                        visible: {
                            transition: { staggerChildren: 0.04 },
                        },
                    }}
                >
                    {agents.map((agent) => (
                        <motion.article
                            key={agent.id}
                            className={`agent-card agent-card--${agent.connectionState}`}
                            variants={{
                                hidden: { opacity: 0, scale: 0.97 },
                                visible: { opacity: 1, scale: 1 },
                            }}
                            whileHover={{ y: -2 }}
                        >
                            <div className="agent-card__header">
                                <span
                                    className={`agent-card__indicator agent-card__indicator--${agent.connectionState}`}
                                    aria-label={`Presence: ${STATUS_LABELS[agent.connectionState] || agent.connectionState}`}
                                />
                                <div className="agent-card__identity">
                                    <span className="agent-card__name">{agent.name}</span>
                                    <span className="agent-card__presence">{STATUS_LABELS[agent.connectionState] || agent.connectionState}</span>
                                </div>
                            </div>

                            <div className="agent-card__meta">
                                <span className="agent-card__role">{ROLE_LABELS[agent.role] || agent.role}</span>
                                <span className="agent-card__heartbeat">{agent.freshnessText}</span>
                            </div>

                            {agent.capabilities && agent.capabilities.length > 0 && (
                                <div className="agent-card__caps">
                                    {agent.capabilities.map((cap) => (
                                        <span key={cap} className="agent-card__cap-tag">{cap}</span>
                                    ))}
                                </div>
                            )}

                            <div className="agent-card__footer">
                                <span className="agent-card__last-seen">
                                    Last heartbeat: {agent.lastSeenText}
                                </span>
                                {agent.current_task_id && (
                                    <span className="agent-card__task-id">
                                        Task {agent.current_task_id.slice(0, 8)}...
                                    </span>
                                )}
                            </div>
                        </motion.article>
                    ))}
                </motion.div>
            )}
        </section>
    );
}

export default function AgentStatus({ agents, nowMs = Date.now() }) {
    if (!agents || agents.length === 0) {
        return (
            <motion.div
                className="agents-empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
            >
                <h3 className="agents-empty-title">No Agents Registered</h3>
                <p className="agents-empty-text">
                    The ritual chamber is empty. Register agents via CLI to begin collaboration.
                </p>
                <code className="agents-empty-code">
                    node scripts/collab-client.js register --name &quot;Agent&quot; --role backend --capabilities node,fastify
                </code>
            </motion.div>
        );
    }

    const preparedAgents = agents
        .map((agent) => {
            const lastSeenMs = parseAgentLastSeen(agent.last_seen);
            const connectionState = getConnectionState(agent, nowMs);
            return {
                ...agent,
                lastSeenMs,
                connectionState,
                lastSeenText: formatRelativeTime(lastSeenMs, nowMs),
                freshnessText: connectionState === 'disconnected'
                    ? 'link severed'
                    : `heartbeat ${formatRelativeTime(lastSeenMs, nowMs)}`,
            };
        })
        .sort(compareAgents);

    const summary = buildPresenceSummary(preparedAgents);
    const connectedAgents = preparedAgents.filter((agent) => agent.connectionState !== 'disconnected');
    const disconnectedAgents = preparedAgents.filter((agent) => agent.connectionState === 'disconnected');

    return (
        <div className="agents-view">
            <div className="agents-header">
                <h3 className="agents-title">
                    Agent Presence <span className="agents-count">({summary.connected + summary.busy + summary.idle}/{summary.total} connected)</span>
                </h3>
                <div className="agents-summary" role="status" aria-live="polite">
                    <span className="agents-summary__chip agents-summary__chip--connected">Connected {summary.connected}</span>
                    <span className="agents-summary__chip agents-summary__chip--busy">Busy {summary.busy}</span>
                    <span className="agents-summary__chip agents-summary__chip--idle">Idle {summary.idle}</span>
                    <span className="agents-summary__chip agents-summary__chip--disconnected">Disconnected {summary.disconnected}</span>
                </div>
            </div>

            <AgentSection
                title="Connected Minds"
                subtitle={`${connectedAgents.length} agents responding to the chamber`}
                agents={connectedAgents}
                emptyText="No agents are actively responding right now."
            />

            <AgentSection
                title="Disconnected Echoes"
                subtitle={`${disconnectedAgents.length} agents have gone cold`}
                agents={disconnectedAgents}
                emptyText="No stale or disconnected agents."
            />
        </div>
    );
}
