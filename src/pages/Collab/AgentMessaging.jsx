/**
 * AgentMessaging — ritual channel for inter-agent communication
 * World-law connection: Agents are minds in the scholomance chamber.
 * Messages are "thought-threads" — ephemeral, glyph-tagged, broadcast to all present minds.
 * Not persisted — when the session ends, the thoughts dissolve back into the void.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const GLYPHS = ['✦', '◈', '⬡', '◎', '⟐', '⧫', '✧', '◉'];
const MAX_MESSAGES = 50;

function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function randomGlyph() {
    return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
}

/**
 * BroadcastChannel-based messaging for same-tab cross-component communication.
 * Messages are ephemeral — they live only in the current browser session.
 */
const CHANNEL_NAME = 'scholomance.collab.messaging';

let _channel = null;
function getChannel() {
    if (!_channel && typeof BroadcastChannel !== 'undefined') {
        _channel = new BroadcastChannel(CHANNEL_NAME);
    }
    return _channel;
}

export default function AgentMessaging({ agents, currentAgentId }) {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [selectedGlyph, setSelectedGlyph] = useState(GLYPHS[0]);
    const [targetAgent, setTargetAgent] = useState('all'); // 'all' or specific agent ID
    const messagesEndRef = useRef(null);
    const channelRef = useRef(null);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        if (messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages]);

    // Listen for messages from BroadcastChannel (cross-tab)
    useEffect(() => {
        const channel = getChannel();
        if (!channel) return;

        channelRef.current = channel;

        const handler = (event) => {
            const msg = event.data;
            if (msg?.type === 'collab_message') {
                setMessages(prev => {
                    const next = [...prev, msg];
                    return next.slice(-MAX_MESSAGES);
                });
            }
        };

        channel.addEventListener('message', handler);
        return () => {
            channel.removeEventListener('message', handler);
        };
    }, []);

    const sendMessage = useCallback(() => {
        const text = input.trim();
        if (!text) return;

        const senderName = agents.find(a => a.id === currentAgentId)?.name || 'Unknown Mind';
        const targetName = targetAgent === 'all' ? 'All Minds' : (agents.find(a => a.id === targetAgent)?.name || 'Unknown Mind');

        const message = {
            type: 'collab_message',
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            senderId: currentAgentId || 'anonymous',
            senderName,
            targetId: targetAgent,
            targetName,
            glyph: selectedGlyph,
            text,
            timestamp: new Date().toISOString(),
        };

        // Broadcast to all tabs
        const channel = getChannel();
        if (channel) {
            channel.postMessage(message);
        }

        // Also add to local state
        setMessages(prev => {
            const next = [...prev, message];
            return next.slice(-MAX_MESSAGES);
        });

        setInput('');
    }, [input, selectedGlyph, targetAgent, currentAgentId, agents]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    }, [sendMessage]);

    const connectedAgents = agents.filter(a => a.status !== 'offline');

    return (
        <div className="messaging-view">
            <div className="messaging-header">
                <h3 className="messaging-title">
                    <span className="messaging-title__glyph">⟐</span>
                    RITUAL CHANNEL
                </h3>
                <span className="messaging-subtitle">
                    {connectedAgents.length} minds present — thoughts dissolve on session end
                </span>
            </div>

            {/* Message stream */}
            <div className="messaging-stream" role="log" aria-live="polite" aria-label="Agent messages">
                <AnimatePresence initial={false}>
                    {messages.length === 0 ? (
                        <motion.div
                            className="messaging-empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                        >
                            <span className="messaging-empty__glyph">◈</span>
                            <p className="messaging-empty-text">The chamber is silent. Send a thought to begin.</p>
                        </motion.div>
                    ) : (
                        messages.map((msg) => (
                            <motion.div
                                key={msg.id}
                                className={`messaging-entry ${msg.senderId === currentAgentId ? 'messaging-entry--self' : ''}`}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <span className="messaging-entry__glyph" style={{ color: 'var(--color-collab-accent)' }}>
                                    {msg.glyph}
                                </span>
                                <div className="messaging-entry__body">
                                    <div className="messaging-entry__meta">
                                        <span className="messaging-entry__sender">{msg.senderName}</span>
                                        <span className="messaging-entry__arrow">→</span>
                                        <span className="messaging-entry__target">{msg.targetName}</span>
                                        <span className="messaging-entry__time">{formatTime(new Date(msg.timestamp))}</span>
                                    </div>
                                    <p className="messaging-entry__text">{msg.text}</p>
                                </div>
                            </motion.div>
                        ))
                    )}
                </AnimatePresence>
                <div ref={messagesEndRef} />
            </div>

            {/* Message input */}
            <div className="messaging-input">
                <div className="messaging-input__controls">
                    {/* Glyph selector */}
                    <div className="glyph-selector" role="radiogroup" aria-label="Message glyph">
                        {GLYPHS.map(g => (
                            <button
                                key={g}
                                className={`glyph-option ${selectedGlyph === g ? 'glyph-option--active' : ''}`}
                                onClick={() => setSelectedGlyph(g)}
                                role="radio"
                                aria-checked={selectedGlyph === g}
                                aria-label={`Glyph ${g}`}
                            >
                                {g}
                            </button>
                        ))}
                    </div>

                    {/* Target agent selector */}
                    <select
                        className="messaging-input__target"
                        value={targetAgent}
                        onChange={(e) => setTargetAgent(e.target.value)}
                        aria-label="Target agent"
                    >
                        <option value="all">All Minds</option>
                        {connectedAgents.map(agent => (
                            <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                    </select>
                </div>

                <textarea
                    className="messaging-input__textarea"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Send a thought to the chamber..."
                    rows={2}
                    aria-label="Message input"
                />

                <button
                    className="messaging-input__send"
                    onClick={sendMessage}
                    disabled={!input.trim()}
                    aria-label="Send message"
                >
                    {selectedGlyph} SEND
                </button>
            </div>
        </div>
    );
}
