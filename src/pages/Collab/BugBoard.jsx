/**
 * BugBoard — High-fidelity bug orchestration surface
 */

import { motion } from 'framer-motion';
import BugSeverityChips from './BugSeverityChips.jsx';
import { CheckIcon, CodeIcon, WarningIcon } from "../../components/Icons.jsx";

export default function BugBoard({ bugs, onBugClick, onReportClick }) {
    const handleImportQa = async () => {
        const payload = prompt('Paste QA Result JSON (single or array):');
        if (!payload) return;

        try {
            const data = JSON.parse(payload);
            const response = await fetch('/collab/bugs/import-qa', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            if (response.ok) {
                alert('QA Results imported successfully.');
                onReportClick?.(); // Trigger refresh in parent
            } else {
                const err = await response.json();
                alert(`Import failed: ${err.error}`);
            }
        } catch (e) {
            alert('Invalid JSON payload.');
        }
    };

    if (!bugs || bugs.length === 0) {
        return (
            <div className="bug-board-empty" style={{ textAlign: 'center', padding: '60px 20px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px dashed var(--border-collab-chrome)' }}>
                <h3 style={{ color: 'var(--color-collab-gold)', fontFamily: 'var(--font-collab-display)', fontSize: '18px' }}>THE CHAMBER IS STABLE</h3>
                <p style={{ color: 'var(--color-collab-text-dim)', fontSize: '12px' }}>No active bug artifacts detected in the current session.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', marginTop: '20px' }}>
                    <button 
                        onClick={handleImportQa}
                        style={{ background: 'transparent', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text-dim)', padding: '8px 24px', fontSize: '11px', cursor: 'pointer' }}
                    >
                        IMPORT QA
                    </button>
                    <button 
                        onClick={onReportClick}
                        style={{ background: 'var(--color-collab-gold)', border: 'none', borderRadius: '4px', color: '#000', padding: '8px 24px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        REPORT BUG
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bug-board">
            <div className="bug-board-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: 'var(--color-collab-info)', fontFamily: 'var(--font-collab-mono)', textTransform: 'uppercase' }}>BUG ARTIFACTS // {bugs.length} ACTIVE</h3>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                        onClick={handleImportQa}
                        style={{ background: 'transparent', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text-dim)', padding: '6px 16px', fontSize: '11px', cursor: 'pointer' }}
                    >
                        IMPORT QA
                    </button>
                    <button 
                        onClick={onReportClick}
                        style={{ background: 'var(--color-collab-chrome)', border: '1px solid var(--border-collab-chrome)', borderRadius: '4px', color: 'var(--color-collab-text)', padding: '6px 16px', fontSize: '11px', cursor: 'pointer' }}
                    >
                        + REPORT BUG
                    </button>
                </div>
            </div>

            <div className="bug-table-container" style={{ background: 'var(--color-collab-surface-elevated)', borderRadius: '8px', border: '1px solid var(--border-collab-chrome)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                        <tr style={{ background: 'rgba(0,0,0,0.3)', borderBottom: '1px solid var(--border-collab-chrome)' }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Severity</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Artifact</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Category</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Status</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Source</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--color-collab-text-dim)', fontWeight: 'normal', fontSize: '10px', textTransform: 'uppercase' }}>Integrity</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bugs.map((bug) => (
                            <motion.tr 
                                key={bug.id}
                                onClick={() => onBugClick(bug)}
                                whileHover={{ background: 'rgba(255,255,255,0.03)' }}
                                style={{ borderBottom: '1px solid var(--border-collab-chrome)', cursor: 'pointer', transition: 'background 0.2s' }}
                            >
                                <td style={{ padding: '12px 16px' }}><BugSeverityChips severity={bug.severity} /></td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span style={{ fontWeight: '500', color: 'var(--color-collab-text)' }}>{bug.title}</span>
                                        <span style={{ fontSize: '10px', color: 'var(--color-collab-text-dim)', fontFamily: 'var(--font-collab-mono)' }}>BUG-{bug.id.slice(0, 8)}</span>
                                    </div>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--color-collab-text-muted)', fontFamily: 'var(--font-collab-mono)', fontSize: '11px' }}>{bug.category || 'GENERAL'}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <span style={{ 
                                        padding: '2px 8px', 
                                        borderRadius: '10px', 
                                        background: 'rgba(255,255,255,0.05)', 
                                        fontSize: '10px', 
                                        textTransform: 'uppercase', 
                                        fontWeight: 'bold',
                                        color: bug.status === 'new' ? 'var(--color-collab-info)' : 'var(--color-collab-text-dim)'
                                    }}>
                                        {bug.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px 16px', color: 'var(--color-collab-text-dim)', fontSize: '11px' }}>{bug.source_type.toUpperCase()}</td>
                                <td style={{ padding: '12px 16px' }}>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {bug.checksum_verified ? (
                                            <CheckIcon size={14} style={{ color: 'var(--color-collab-success)' }} title="Checksum Verified" />
                                        ) : bug.bytecode ? (
                                            <WarningIcon size={14} style={{ color: 'var(--color-collab-error)' }} title="Checksum Mismatch" />
                                        ) : null}
                                        {bug.parseable ? (
                                            <CodeIcon size={14} style={{ color: 'var(--color-collab-info)' }} title="Parsable Payload" />
                                        ) : null}
                                    </div>
                                </td>
                            </motion.tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
