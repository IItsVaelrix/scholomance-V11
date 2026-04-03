/**
 * BugBytecodePanel — Specialized view for bytecode verification and decode
 */

import { CheckIcon, WarningIcon, ErrorIcon, CodeIcon, CopyIcon } from "../../components/Icons.jsx";

export default function BugBytecodePanel({ bug }) {
    const {
        bytecode,
        checksum_verified,
        parseable,
        auto_fixable,
        decoded_context,
        category,
        severity,
        module_id,
        error_code_hex,
        recovery_hints
    } = bug;

    if (!bytecode && !category) {
        return (
            <div className="bytecode-empty">
                <p>No bytecode payload associated with this report.</p>
            </div>
        );
    }

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
    };

    return (
        <div className="bytecode-panel">
            {/* Header / Status */}
            <div className="bytecode-status-bar" style={{
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                padding: '8px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '4px',
                alignItems: 'center'
            }}>
                {checksum_verified ? (
                    <span className="badge badge--success" style={{ color: 'var(--color-collab-success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        <CheckIcon size={12} /> CHECKSUM VERIFIED
                    </span>
                ) : (
                    <span className="badge badge--error" style={{ color: 'var(--color-collab-error)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        <ErrorIcon size={12} /> CHECKSUM INVALID
                    </span>
                )}

                {parseable ? (
                    <span className="badge badge--info" style={{ color: 'var(--color-collab-info)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        <CodeIcon size={12} /> PARSEABLE
                    </span>
                ) : (
                    <span className="badge badge--warning" style={{ color: 'var(--color-collab-warning)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        <WarningIcon size={12} /> PARTIAL PARSE
                    </span>
                )}

                {auto_fixable && (
                    <span className="badge badge--gold" style={{ color: 'var(--color-collab-gold)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                        ✦ AUTO-FIXABLE
                    </span>
                )}
            </div>

            {/* Metadata Grid */}
            <div className="bytecode-meta-grid" style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '12px',
                marginBottom: '16px'
            }}>
                <div className="meta-item">
                    <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Category</span>
                    <div style={{ fontFamily: 'var(--font-collab-mono)', fontSize: '12px' }}>{category || 'UNKNOWN'}</div>
                </div>
                <div className="meta-item">
                    <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Module</span>
                    <div style={{ fontFamily: 'var(--font-collab-mono)', fontSize: '12px' }}>{module_id || 'UNKNOWN'}</div>
                </div>
                <div className="meta-item">
                    <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Error Code</span>
                    <div style={{ fontFamily: 'var(--font-collab-mono)', fontSize: '12px' }}>{error_code_hex || '0x????'}</div>
                </div>
                <div className="meta-item">
                    <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Severity</span>
                    <div style={{ fontFamily: 'var(--font-collab-mono)', fontSize: '12px' }}>{severity || 'INFO'}</div>
                </div>
            </div>

            {/* Raw Bytecode */}
            {bytecode && (
                <div className="bytecode-raw" style={{ marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Raw Bytecode</span>
                        <button 
                            onClick={() => copyToClipboard(bytecode)}
                            className="icon-btn"
                            title="Copy Bytecode"
                            style={{ background: 'none', border: 'none', color: 'var(--color-collab-text-muted)', cursor: 'pointer' }}
                        >
                            <CopyIcon size={12} />
                        </button>
                    </div>
                    <code style={{
                        display: 'block',
                        padding: '8px',
                        background: 'var(--color-collab-void)',
                        border: '1px solid var(--border-collab-chrome)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        wordBreak: 'break-all',
                        maxHeight: '60px',
                        overflowY: 'auto'
                    }}>
                        {bytecode}
                    </code>
                </div>
            )}

            {/* Decoded Context */}
            {decoded_context && (
                <div className="bytecode-context" style={{ marginBottom: '16px' }}>
                    <span style={{ fontSize: '9px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block', marginBottom: '4px' }}>Decoded Context</span>
                    <pre style={{
                        padding: '8px',
                        background: 'var(--color-collab-void)',
                        border: '1px solid var(--border-collab-chrome)',
                        borderRadius: '4px',
                        fontSize: '10px',
                        color: 'var(--color-collab-info)',
                        overflowX: 'auto'
                    }}>
                        {JSON.stringify(decoded_context, null, 2)}
                    </pre>
                </div>
            )}

            {/* Recovery Hints */}
            {recovery_hints && (recovery_hints.suggestions?.length > 0 || recovery_hints.invariants?.length > 0) && (
                <div className="bytecode-hints" style={{
                    padding: '12px',
                    background: 'rgba(197, 160, 89, 0.05)',
                    border: '1px solid rgba(197, 160, 89, 0.2)',
                    borderRadius: '4px'
                }}>
                    <h4 style={{ fontSize: '10px', color: 'var(--color-collab-gold)', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Recovery Intelligence</h4>
                    
                    {recovery_hints.suggestions?.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                            <span style={{ fontSize: '8px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Suggestions</span>
                            <ul style={{ margin: '4px 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--color-collab-text-muted)' }}>
                                {recovery_hints.suggestions.map((s, i) => <li key={i}>{s}</li>)}
                            </ul>
                        </div>
                    )}

                    {recovery_hints.invariants?.length > 0 && (
                        <div>
                            <span style={{ fontSize: '8px', color: 'var(--color-collab-text-dim)', textTransform: 'uppercase', display: 'block' }}>Invariants</span>
                            <ul style={{ margin: '4px 0', paddingLeft: '16px', fontSize: '11px', color: 'var(--color-collab-text-muted)' }}>
                                {recovery_hints.invariants.map((s, i) => <li key={i}><code>{s}</code></li>)}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
