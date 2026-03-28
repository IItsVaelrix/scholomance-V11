import { useRef, useEffect, useState, useCallback, memo } from 'react';
import { motion } from 'framer-motion';

const BADGE_ICONS = {
  RHYME: '\u266B',
  METER: '\u2263',
  COLOR: '\u25C9',
};

const TYPE_ICONS = {
  correction: '\u2691',
  rhyme: '\u266B',
  default: '\u22B3',
};

const MIN_WIDTH = 220;
const MIN_HEIGHT = 120;
const DEFAULT_WIDTH = 300;

/**
 * IntelliSense — Grimoire-styled autocomplete with resize support.
 * Floating enchanted parchment fragment with gold-leaf edges.
 */
const IntelliSense = memo(function IntelliSense({
  suggestions,
  selectedIndex,
  position,
  onAccept,
  onHover,
  ghostLine = null,
  badges = [],
}) {
  const listRef = useRef(null);
  const panelRef = useRef(null);
  const [size, setSize] = useState({ width: DEFAULT_WIDTH, height: 0 });

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex];
    if (item?.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  // Resize drag handler
  const onResizeStart = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const panel = panelRef.current;
    if (!panel) return;
    const startW = panel.offsetWidth;
    const startH = panel.offsetHeight;

    const onMove = (ev) => {
      const newW = Math.max(MIN_WIDTH, startW + (ev.clientX - startX));
      const newH = Math.max(MIN_HEIGHT, startH + (ev.clientY - startY));
      setSize({ width: newW, height: newH });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, []);

  if (!suggestions || suggestions.length === 0) return null;

  const hasGhost = ghostLine && ghostLine.length > 0;
  const ghostHeight = hasGhost ? 36 : 0;
  const autoHeight = Math.min(suggestions.length * 34 + 12, 260) + ghostHeight;
  const dropdownWidth = size.width || DEFAULT_WIDTH;
  const dropdownHeight = size.height || autoHeight;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let x = position.x;
  let y = position.y;
  if (y + dropdownHeight > vh - 12) y = position.y - dropdownHeight - 24;
  if (x + dropdownWidth > vw - 12) x = vw - dropdownWidth - 12;
  x = Math.max(8, x);
  y = Math.max(8, y);

  const listMaxHeight = size.height
    ? size.height - ghostHeight - 48
    : 240;

  return (
    <motion.div
      ref={panelRef}
      className="intellisense"
      style={{
        left: x,
        top: y,
        position: 'fixed',
        zIndex: 9999,
        width: dropdownWidth,
        ...(size.height ? { height: size.height } : {}),
      }}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.34, 1.56, 0.64, 1] }}
    >
      {/* Decorative top edge — gold leaf line */}
      <div className="intellisense-gilding" aria-hidden="true" />

      {/* Ghost-line preview */}
      {hasGhost && (
        <div className="intellisense-ghost">
          <span className="intellisense-ghost-text">{ghostLine}</span>
          {badges.length > 0 && (
            <span className="intellisense-ghost-badges">
              {badges.map(b => (
                <span
                  key={b}
                  className={`intellisense-badge intellisense-badge--${b.toLowerCase()}`}
                  title={b}
                >
                  {BADGE_ICONS[b] || b}
                </span>
              ))}
            </span>
          )}
        </div>
      )}

      <div
        className="intellisense-list"
        ref={listRef}
        role="listbox"
        style={{ maxHeight: listMaxHeight }}
      >
        {suggestions.map((s, i) => {
          const itemBadges = s.badges || [];
          const hasItemBadges = itemBadges.length > 0;
          const icon = s.type === 'correction'
            ? TYPE_ICONS.correction
            : s.isRhyme ? TYPE_ICONS.rhyme : TYPE_ICONS.default;

          return (
            <button
              key={`${s.token}-${i}`}
              type="button"
              role="option"
              aria-selected={i === selectedIndex}
              tabIndex={i === selectedIndex ? 0 : -1}
              className={[
                'intellisense-item',
                i === selectedIndex && 'intellisense-item--active',
                s.isRhyme && 'intellisense-item--rhyme',
                s.type === 'correction' && 'intellisense-item--correction',
              ].filter(Boolean).join(' ')}
              onMouseDown={(e) => { e.preventDefault(); onAccept?.(s.token); }}
              onMouseEnter={() => onHover?.(i)}
            >
              <span className="intellisense-icon" aria-hidden="true">{icon}</span>
              <span className="intellisense-token">{s.token}</span>
              {hasItemBadges ? (
                <span className="intellisense-tags">
                  {itemBadges.map(b => (
                    <span key={b} className={`intellisense-tag intellisense-tag--${b.toLowerCase()}`}>
                      {b.toLowerCase()}
                    </span>
                  ))}
                </span>
              ) : (
                <>
                  {s.isRhyme && <span className="intellisense-tag intellisense-tag--rhyme">rhyme</span>}
                  {s.type === 'correction'
                    ? <span className="intellisense-tag intellisense-tag--fix">fix</span>
                    : !s.isRhyme && <span className="intellisense-tag intellisense-tag--recommend">recommend</span>
                  }
                </>
              )}
            </button>
          );
        })}
      </div>

      {/* Resize handle — styled as corner flourish */}
      <div
        className="intellisense-resize"
        onMouseDown={onResizeStart}
        aria-hidden="true"
        title="Drag to resize"
      />
    </motion.div>
  );
});

export default IntelliSense;
