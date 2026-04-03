/**
 * BugDetailDrawer — Specialized drawer for bug report inspection
 */

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CloseIcon, ZapIcon, CheckIcon, ErrorIcon, LoadingIcon } from "../../components/Icons.jsx";
import BugSeverityChips from './BugSeverityChips.jsx';
import BugBytecodePanel from './BugBytecodePanel.jsx';

const BUG_STATUS_COLORS = {
    new: 'var(--color-collab-info, #60c0ff)',
    triaged: 'var(--color-collab-warning, #ffc040)',
    assigned: 'var(--color-collab-warning, #ffc040)',
    in_progress: 'var(--color-collab-warning, #ffc040)',
    fixed: 'var(--color-collab-success, #40ff80)',
    verified: 'var(--color-collab-success, #40ff80)',
    closed: 'var(--color-collab-text-dim, #505070)',
    duplicate: 'var(--color-collab-text-dim, #505070)',
};

const SECTIONS = [
    { key: 'summary', label: 'Summary' },
    { key: 'bytecode', label: 'Bytecode' },
    { key: 'repro', label: 'Reproduction' },
    { key: 'activity', label: 'Activity' },
];

export default function BugDetailDrawer({ bug, isOpen, onClose, onUpdate, onRefresh }) {
    const [activeSection, setActiveSection] = useState('summary');
    const [isProcessing, setIsSubmitting] = useState(false);

    const handleStatusChange = async (newStatus) => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`/collab/bugs/${bug.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus }),
            });
            if (response.ok) {
                const updated = await response.json();
                onUpdate?.(updated);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCreateTask = async () => {
        setIsSubmitting(true);
        try {
            const response = await fetch(`/collab/bugs/${bug.id}/create-task`, {
                method: 'POST',
            });
            if (response.ok) {
                onRefresh?.();
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!bug) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        className="drawer-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000 }}
                    />
                    <motion.aside
                        className="bug-detail-drawer"
                        initial={{ x: '100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        style={{
                            position: 'fixed',
                            top: 0,
                            right: 0,
                            width: '480px',
                            height: '100vh',
                            background: 'var(--color-collab-surface)',
                            borderLeft: '1px solid var(--border-collab-chrome)',
                            zIndex: 1001,
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                        }}
                    >
                        {/* Header */}
                        <header style={{ padding: '24px', borderBottom: '1px solid var(--border-collab-chrome)', background: 'rgba(255,255,255,0.02)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <BugSeverityChips severity={bug.severity} />
                                    <span style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', fontFamily: 'var(--font-collab-mono)' }}>BUG-{bug.id.slice(0, 8)}</span>
                                </div>
                                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-collab-text-dim)', cursor: 'pointer' }}><CloseIcon size={20} /></button>
                            </div>
                            <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--color-collab-text)', lineHeight: 1.4 }}>{bug.title}</h2>
                            <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ 
                                    width: '8px', 
                                    height: '8px', 
                                    borderRadius: '50%', 
                                    background: BUG_STATUS_COLORS[bug.status] || '#888' 
                                }} />
                                <span style={{ fontSize: '11px', textTransform: 'uppercase', fontWeight: 'bold', color: BUG_STATUS_COLORS[bug.status] }}>{bug.status}</span>
                            </div>
                        </header>

                        {/* Actions */}
                        <div style={{ padding: '12px 24px', borderBottom: '1px solid var(--border-collab-chrome)', display: 'flex', gap: '8px' }}>
                            <select 
                                value={bug.status}
                                onChange={(e) => handleStatusChange(e.target.value)}
                                style={{ background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', color: 'var(--color-collab-text)', padding: '4px 8px', borderRadius: '4px', fontSize: '11px' }}
                            >
                                {Object.keys(BUG_STATUS_COLORS).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                            </select>

                            {!bug.related_task_id && (
                                <button 
                                    onClick={handleCreateTask}
                                    disabled={isProcessing}
                                    style={{ 
                                        background: 'var(--color-collab-gold)', 
                                        border: 'none', 
                                        borderRadius: '4px', 
                                        color: '#000', 
                                        padding: '4px 12px', 
                                        fontSize: '11px', 
                                        fontWeight: 'bold', 
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px'
                                    }}
                                >
                                    <ZapIcon size={12} /> CREATE FIX TASK
                                </button>
                            )}
                        </div>

                        {/* Nav */}
                        <nav style={{ display: 'flex', padding: '0 24px', borderBottom: '1px solid var(--border-collab-chrome)' }}>
                            {SECTIONS.map(s => (
                                <button
                                    key={s.key}
                                    onClick={() => setActiveSection(s.key)}
                                    style={{
                                        padding: '12px 16px',
                                        background: 'none',
                                        border: 'none',
                                        borderBottom: activeSection === s.key ? '2px solid var(--color-collab-gold)' : '2px solid transparent',
                                        color: activeSection === s.key ? 'var(--color-collab-text)' : 'var(--color-collab-text-dim)',
                                        fontSize: '11px',
                                        textTransform: 'uppercase',
                                        cursor: 'pointer',
                                        fontWeight: activeSection === s.key ? 'bold' : 'normal'
                                    }}
                                >
                                    {s.label}
                                </button>
                            ))}
                        </nav>

                        {/* Content */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
                            {activeSection === 'summary' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Summary</h4>
                                        <p style={{ fontSize: '13px', color: 'var(--color-collab-text)', margin: 0, lineHeight: 1.6 }}>{bug.summary || 'No summary provided.'}</p>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div>
                                            <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Source</h4>
                                            <div style={{ fontSize: '12px' }}>{bug.source_type.toUpperCase()}</div>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Reporter</h4>
                                            <div style={{ fontSize: '12px' }}>{bug.reporter_agent_id || 'system'}</div>
                                        </div>
                                    </div>
                                    {bug.related_task_id && (
                                        <div style={{ padding: '12px', background: 'rgba(64, 255, 128, 0.05)', border: '1px solid rgba(64, 255, 128, 0.2)', borderRadius: '4px' }}>
                                            <h4 style={{ fontSize: '10px', color: 'var(--color-collab-success)', textTransform: 'uppercase', margin: '0 0 4px 0' }}>Linked Fix Task</h4>
                                            <div style={{ fontSize: '12px', fontFamily: 'var(--font-collab-mono)' }}>TASK-{bug.related_task_id.slice(0, 8)}</div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {activeSection === 'bytecode' && (
                                <BugBytecodePanel bug={bug} />
                            )}

                            {activeSection === 'repro' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                                    <div>
                                        <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Reproduction Steps</h4>
                                        {bug.repro_steps && bug.repro_steps.length > 0 ? (
                                            <ol style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--color-collab-text)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {bug.repro_steps.map((step, i) => <li key={i}>{step}</li>)}
                                            </ol>
                                        ) : <p style={{ fontSize: '12px', fontStyle: 'italic', color: 'var(--color-collab-text-dim)' }}>No steps provided.</p>}
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                                        <div>
                                            <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Expected Behavior</h4>
                                            <p style={{ fontSize: '13px', color: 'var(--color-collab-text)', margin: 0 }}>{bug.expected_behavior || 'Not specified.'}</p>
                                        </div>
                                        <div>
                                            <h4 style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', margin: '0 0 8px 0' }}>Observed Behavior</h4>
                                            <p style={{ fontSize: '13px', color: 'var(--color-collab-text)', margin: 0 }}>{bug.observed_behavior || 'Not specified.'}</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeSection === 'activity' && (
                                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-collab-text-dim)', fontSize: '12px' }}>
                                    Triage history coming in Phase 2.
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <footer style={{ padding: '16px 24px', borderTop: '1px solid var(--border-collab-chrome)', fontSize: '10px', color: 'var(--color-collab-text-dim)', textAlign: 'right' }}>
                            Last updated: {new Date(bug.updated_at).toLocaleString()}
                        </footer>
                    </motion.aside>
                </>
            )}
        </AnimatePresence>
    );
}
