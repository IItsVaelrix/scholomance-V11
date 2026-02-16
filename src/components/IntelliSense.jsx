import { useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';

const BADGE_ICONS = {
  RHYME: '\u266B',  // musical note
  METER: '\u2263',  // strictly equivalent
  COLOR: '\u25C9',  // fisheye
};

/**
 * IntelliSense-style autocomplete dropdown with ghost-line preview.
 * Renders at the cursor position with keyboard navigation support.
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

  useEffect(() => {
    if (!listRef.current) return;
    const item = listRef.current.children[selectedIndex];
    if (item?.scrollIntoView) item.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!suggestions || suggestions.length === 0) return null;

  const hasGhost = ghostLine && ghostLine.length > 0;
  const ghostHeight = hasGhost ? 32 : 0;
  const dropdownHeight = Math.min(suggestions.length * 30 + 8, 220) + ghostHeight;
  const dropdownWidth = 280;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

  let x = position.x;
  let y = position.y;
  if (y + dropdownHeight > vh - 8) y = position.y - dropdownHeight - 24;
  if (x + dropdownWidth > vw - 8) x = vw - dropdownWidth - 8;
  x = Math.max(8, x);
  y = Math.max(8, y);

  return (
    <motion.div
      className="intellisense"
      style={{ left: x, top: y, position: 'fixed', zIndex: 9999 }}
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.1, ease: 'easeOut' }}
    >
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

      <div className="intellisense-list" ref={listRef} role="listbox">
        {suggestions.map((s, i) => {
          const itemBadges = s.badges || [];
          const hasItemBadges = itemBadges.length > 0;

          return (
            <button
              key={`${s.token}-${i}`}
              type="button"
              role="option"
              aria-selected={i === selectedIndex}
              tabIndex={i === selectedIndex ? 0 : -1}
              className={`intellisense-item${i === selectedIndex ? ' intellisense-item--active' : ''}${s.isRhyme ? ' intellisense-item--rhyme' : ''}${s.type === 'correction' ? ' intellisense-item--correction' : ''}`}
              onMouseDown={(e) => { e.preventDefault(); onAccept?.(s.token); }}
              onMouseEnter={() => onHover?.(i)}
            >
              <span className="intellisense-icon" aria-hidden="true">
                {s.type === 'correction' ? '\u2691' : s.isRhyme ? '\u266B' : '\u22B3'}
              </span>
              <span className="intellisense-token">{s.token}</span>
              {/* Multi-badge tags from PLS */}
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
                  {s.type === 'correction' && <span className="intellisense-tag intellisense-tag--fix">fix</span>}
                </>
              )}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
});

export default IntelliSense;
