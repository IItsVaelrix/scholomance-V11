/**
 * BugCreateModal — Modal for filing new bug reports
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback, useEffect } from 'react';
import { LoadingIcon, CheckIcon, ErrorIcon } from "../../components/Icons.jsx";

const SOURCE_TYPES = ['human', 'runtime', 'qa', 'pipeline', 'agent'];
const SEVERITIES = ['INFO', 'WARN', 'CRIT', 'FATAL'];

export default function BugCreateModal({ isOpen, onClose, onSuccess }) {
    const [formData, setFormData] = useState({
        title: '',
        summary: '',
        source_type: 'human',
        severity: 'WARN',
        priority: 1,
        bytecode: '',
        repro_steps: '',
        expected_behavior: '',
        observed_behavior: '',
    });

    const [isParsing, setIsParsing] = useState(false);
    const [parseResult, setParseResult] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setFormData({
                title: '',
                summary: '',
                source_type: 'human',
                severity: 'WARN',
                priority: 1,
                bytecode: '',
                repro_steps: '',
                expected_behavior: '',
                observed_behavior: '',
            });
            setParseResult(null);
            setError(null);
        }
    }, [isOpen]);

    // Parse bytecode when it changes
    useEffect(() => {
        const timeoutId = setTimeout(async () => {
            if (formData.bytecode && formData.bytecode.startsWith('PB-ERR-v1')) {
                setIsParsing(true);
                try {
                    const response = await fetch('/collab/bugs/parse', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ bytecode: formData.bytecode }),
                    });
                    if (response.ok) {
                        const result = await response.json();
                        setParseResult(result);
                        if (result.parseable) {
                            setFormData(prev => ({
                                ...prev,
                                severity: result.severity || prev.severity,
                                title: prev.title || `[${result.category}] ${result.module_id}-${result.error_code_hex}`,
                            }));
                        }
                    }
                } catch (e) {
                    console.error('Bytecode parse failed', e);
                } finally {
                    setIsParsing(false);
                }
            } else {
                setParseResult(null);
            }
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [formData.bytecode]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            const payload = {
                ...formData,
                repro_steps: formData.repro_steps.split('\n').filter(Boolean),
            };

            const response = await fetch('/collab/bugs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Failed to create bug report');
            }

            const bug = await response.json();
            onSuccess?.(bug);
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div 
                className="modal-backdrop" 
                role="button"
                tabIndex={-1}
                onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
                style={{
                    position: 'fixed',
                    inset: 0,
                    background: 'rgba(0,0,0,0.8)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2000,
                    backdropFilter: 'blur(4px)'
                }} 
                onClick={onClose}
            >
                <motion.div 
                    className="bug-create-modal"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 20 }}
                    onClick={e => e.stopPropagation()}
                    style={{
                        background: 'var(--color-collab-surface)',
                        border: '1px solid var(--border-collab-gold)',
                        borderRadius: '8px',
                        width: '600px',
                        maxWidth: '90vw',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.5)'
                    }}
                >
                    <header style={{ padding: '16px', borderBottom: '1px solid var(--border-collab-chrome)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h2 style={{ margin: 0, fontSize: '16px', color: 'var(--color-collab-gold)', fontFamily: 'var(--font-collab-display)' }}>REPORT BUG // NEW_ARTIFACT</h2>
                        <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-collab-text-dim)', cursor: 'pointer', fontSize: '20px' }}>×</button>
                    </header>

                    <form onSubmit={handleSubmit} style={{ padding: '20px', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {/* Bytecode Input (Auto-fill trigger) */}
                        <div className="form-group">
                            <label htmlFor="bug-bytecode" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Bytecode Payload (Optional)</label>
                            <div style={{ position: 'relative' }}>
                                <textarea 
                                    id="bug-bytecode"
                                    value={formData.bytecode}
                                    onChange={e => setFormData({ ...formData, bytecode: e.target.value })}
                                    placeholder="PASTE PB-ERR-v1-... bytecode here for auto-parsing"
                                    style={{
                                        width: '100%',
                                        background: 'var(--color-collab-void)',
                                        border: '1px solid var(--border-collab-chrome)',
                                        borderRadius: '4px',
                                        color: 'var(--color-collab-info)',
                                        padding: '10px',
                                        fontSize: '11px',
                                        fontFamily: 'var(--font-collab-mono)',
                                        minHeight: '60px'
                                    }}
                                />
                                {isParsing && (
                                    <div style={{ position: 'absolute', right: '10px', top: '10px' }}>
                                        <LoadingIcon size={16} className="spinning" />
                                    </div>
                                )}
                                {parseResult && parseResult.parseable && (
                                    <div style={{ position: 'absolute', right: '10px', bottom: '10px', color: 'var(--color-collab-success)' }}>
                                        <CheckIcon size={16} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label htmlFor="bug-source-type" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Source Type</label>
                                <select 
                                    id="bug-source-type"
                                    value={formData.source_type}
                                    onChange={e => setFormData({ ...formData, source_type: e.target.value })}
                                    style={{ width: '100%', background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '8px' }}
                                >
                                    {SOURCE_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="bug-severity" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Severity</label>
                                <select 
                                    id="bug-severity"
                                    value={formData.severity}
                                    onChange={e => setFormData({ ...formData, severity: e.target.value })}
                                    style={{ width: '100%', background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '8px' }}
                                >
                                    {SEVERITIES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="bug-title" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Bug Title</label>
                            <input 
                                id="bug-title"
                                type="text"
                                value={formData.title}
                                onChange={e => setFormData({ ...formData, title: e.target.value })}
                                placeholder="Concise summary of the failure"
                                required
                                style={{ width: '100%', background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '10px' }}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="bug-summary" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Summary / Impact</label>
                            <textarea 
                                id="bug-summary"
                                value={formData.summary}
                                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                placeholder="Describe what is broken and why it matters"
                                style={{ width: '100%', background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '10px', minHeight: '80px' }}
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="bug-repro" style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }}>Reproduction Steps</label>
                            <textarea 
                                id="bug-repro"
                                value={formData.repro_steps}
                                onChange={e => setFormData({ ...formData, repro_steps: e.target.value })}
                                placeholder="1. Action\n2. Action\n..."
                                style={{ width: '100%', background: 'var(--color-collab-void)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '10px', minHeight: '60px', fontFamily: 'var(--font-collab-mono)', fontSize: '11px' }}
                            />
                        </div>

                        {error && (
                            <div style={{ color: 'var(--color-collab-error)', fontSize: '12px', padding: '10px', background: 'rgba(255, 64, 96, 0.1)', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <ErrorIcon size={16} /> {error}
                            </div>
                        )}

                        <footer style={{ marginTop: 'auto', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button 
                                type="button" 
                                onClick={onClose}
                                style={{ background: 'none', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text-dim)', padding: '10px 20px', cursor: 'pointer' }}
                            >
                                CANCEL
                            </button>
                            <button 
                                type="submit" 
                                disabled={isSubmitting}
                                style={{ background: 'var(--color-collab-gold)', border: 'none', borderRadius: '4px', color: '#000', padding: '10px 30px', fontWeight: 'bold', cursor: 'pointer' }}
                            >
                                {isSubmitting ? 'SUBMITTING...' : 'SUBMIT BUG ARTIFACT'}
                            </button>
                        </footer>
                    </form>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
