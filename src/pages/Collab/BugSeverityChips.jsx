/**
 * BugSeverityChips — Visual chips for bug severity
 */

const SEVERITY_COLORS = {
    INFO: 'var(--color-collab-info, #60c0ff)',
    WARN: 'var(--color-collab-warning, #ffc040)',
    CRIT: 'var(--color-collab-error, #ff4060)',
    FATAL: 'var(--color-collab-void, #06060c)',
};

const SEVERITY_BG = {
    INFO: 'rgba(96, 192, 255, 0.1)',
    WARN: 'rgba(255, 192, 64, 0.1)',
    CRIT: 'rgba(255, 64, 96, 0.1)',
    FATAL: 'var(--color-collab-error, #ff4060)',
};

export default function BugSeverityChips({ severity }) {
    const color = SEVERITY_COLORS[severity] || SEVERITY_COLORS.INFO;
    const background = SEVERITY_BG[severity] || SEVERITY_BG.INFO;
    const isFatal = severity === 'FATAL';

    return (
        <span
            className={`bug-severity-chip ${isFatal ? 'bug-severity-chip--fatal' : ''}`}
            style={{
                color: isFatal ? '#fff' : color,
                backgroundColor: background,
                border: isFatal ? 'none' : `1px solid ${color}`,
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: isFatal ? '0 0 10px rgba(255, 64, 96, 0.5)' : 'none',
            }}
        >
            {severity || 'INFO'}
        </span>
    );
}
