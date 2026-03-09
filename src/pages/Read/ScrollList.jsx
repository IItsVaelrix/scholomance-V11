import { memo, useMemo, useRef, useState, useEffect, useCallback } from "react";

const VIRTUALIZE_AFTER_COUNT = 12;
const LIST_ROW_HEIGHT = 120;
const LIST_OVERSCAN = 6;
const PINNED_STORAGE_KEY = "scholomance-pinned-scrolls";
const MAX_PINS = 5;

function loadPinnedIds() {
  try {
    const raw = localStorage.getItem(PINNED_STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function savePinnedIds(ids) {
  try {
    localStorage.setItem(PINNED_STORAGE_KEY, JSON.stringify([...ids]));
  } catch { /* ignore quota errors */ }
}

function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function truncate(text, maxLen = 80) {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trim() + "...";
}

/* Inline SVG icons */
function PinIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 17v5" />
      <path d="M9 2h6l-1 7h4l-5 6H9l-1-6H4l5-7z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

const ScrollItem = memo(function ScrollItem({ scroll, isActive, isPinned, onSelect, onDelete, onEdit, onTogglePin }) {
  const wordCount = Number.isFinite(scroll.wordCount) ? scroll.wordCount : 0;
  const preview = scroll.preview || truncate(scroll.content || "");

  const formattedDate = useMemo(() => {
    return formatDate(scroll.updatedAt);
  }, [scroll.updatedAt]);

  return (
    <div
      className={`scroll-item ${isActive ? "scroll-item--active" : ""}${isPinned ? " scroll-item--pinned" : ""}`}
      role="listitem"
    >
      <button
        type="button"
        className="scroll-item-main"
        onClick={() => onSelect(scroll.id)}
        aria-current={isActive ? "true" : undefined}
      >
        <div className="scroll-item-title">
          {isPinned && <span className="scroll-pin-indicator" aria-label="Pinned">&#x1F4CC;</span>}
          {scroll.title || "Untitled Scroll"}
        </div>
        <div className="scroll-item-preview">
          {preview}
        </div>
        <div className="scroll-item-meta">
          <span className="scroll-word-count">
            {wordCount} words
          </span>
          <span className="scroll-char-count">
            {scroll.charCount || 0} chars
          </span>
          <span className="scroll-date">
            {formattedDate}
          </span>
        </div>
      </button>
      <div className="scroll-item-actions">
        <button
          type="button"
          className={`scroll-action-btn scroll-action-pin${isPinned ? " scroll-action-pin--active" : ""}`}
          onClick={(e) => { e.stopPropagation(); onTogglePin(scroll.id); }}
          title={isPinned ? "Unpin scroll" : "Pin to top"}
          aria-label={isPinned ? "Unpin scroll" : "Pin scroll to top"}
        >
          <PinIcon filled={isPinned} />
        </button>
        <button
          type="button"
          className="scroll-action-btn scroll-action-edit"
          onClick={(e) => { e.stopPropagation(); onEdit(scroll.id); }}
          title="Edit scroll"
          aria-label="Edit scroll"
        >
          <EditIcon />
        </button>
        <button
          type="button"
          className="scroll-action-btn scroll-action-delete"
          onClick={(e) => {
            e.stopPropagation();
            if (confirm("Delete this scroll permanently?")) {
              onDelete(scroll.id);
            }
          }}
          title="Delete scroll"
          aria-label="Delete scroll"
        >
          <TrashIcon />
        </button>
      </div>
    </div>
  );
});

const ScrollList = memo(function ScrollList({
  scrolls,
  activeScrollId,
  onSelect,
  onDelete,
  onNewScroll,
  onEdit,
}) {
  const listBodyRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [pinnedIds, setPinnedIds] = useState(loadPinnedIds);

  const handleTogglePin = useCallback((id) => {
    setPinnedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= MAX_PINS) return prev; // Enforce max
        next.add(id);
      }
      savePinnedIds(next);
      return next;
    });
  }, []);

  // Sort scrolls: pinned first, then by original order
  const sortedScrolls = useMemo(() => {
    if (pinnedIds.size === 0) return scrolls;
    const pinned = [];
    const unpinned = [];
    for (const s of scrolls) {
      if (pinnedIds.has(s.id)) {
        pinned.push(s);
      } else {
        unpinned.push(s);
      }
    }
    return [...pinned, ...unpinned];
  }, [scrolls, pinnedIds]);

  const useVirtualization = sortedScrolls.length >= VIRTUALIZE_AFTER_COUNT;

  const syncViewport = useCallback(() => {
    const node = listBodyRef.current;
    if (!node) return;
    setViewportHeight(node.clientHeight);
  }, []);

  useEffect(() => {
    const node = listBodyRef.current;
    if (!node) return undefined;

    syncViewport();
    const onScroll = () => setScrollTop(node.scrollTop);
    node.addEventListener("scroll", onScroll, { passive: true });

    let resizeObserver = null;
    const onWindowResize = () => syncViewport();

    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => syncViewport());
      resizeObserver.observe(node);
    } else {
      window.addEventListener("resize", onWindowResize);
    }

    return () => {
      node.removeEventListener("scroll", onScroll);
      if (resizeObserver) {
        resizeObserver.disconnect();
      } else {
        window.removeEventListener("resize", onWindowResize);
      }
    };
  }, [syncViewport]);

  const windowRange = useMemo(() => {
    if (!useVirtualization) {
      return {
        startIndex: 0,
        endIndex: sortedScrolls.length,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const effectiveViewportHeight = Math.max(viewportHeight, LIST_ROW_HEIGHT);
    const visibleCount = Math.ceil(effectiveViewportHeight / LIST_ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / LIST_ROW_HEIGHT) - LIST_OVERSCAN);
    const endIndex = Math.min(
      sortedScrolls.length,
      startIndex + visibleCount + LIST_OVERSCAN * 2
    );

    return {
      startIndex,
      endIndex,
      topPadding: startIndex * LIST_ROW_HEIGHT,
      bottomPadding: Math.max(0, (sortedScrolls.length - endIndex) * LIST_ROW_HEIGHT),
    };
  }, [scrollTop, sortedScrolls.length, useVirtualization, viewportHeight]);

  const visibleScrolls = useMemo(() => {
    return sortedScrolls.slice(windowRange.startIndex, windowRange.endIndex);
  }, [sortedScrolls, windowRange.startIndex, windowRange.endIndex]);

  return (
    <div className="scroll-list">
      <div className="scroll-list-header">
        <h3 className="scroll-list-title">
          <span className="title-sigil">&#x1F4DC;</span>
          Scrolls
          <span className="scroll-count">{scrolls.length}</span>
        </h3>
      </div>

      <button
        type="button"
        className="new-scroll-btn"
        onClick={onNewScroll}
        title="Create new scroll"
      >
        <span aria-hidden="true">&#x271A;</span> New Scroll
      </button>

      <div className="scroll-list-body" role="list" ref={listBodyRef}>
        {sortedScrolls.length === 0 ? (
          <div className="scroll-empty">
            <div className="empty-sigil">&#x2728;</div>
            <p>No scrolls yet</p>
            <span>Begin thy first inscription above</span>
          </div>
        ) : (
          <div
            style={useVirtualization
              ? {
                  paddingTop: `${windowRange.topPadding}px`,
                  paddingBottom: `${windowRange.bottomPadding}px`,
                }
              : undefined}
          >
            {visibleScrolls.map((scroll) => (
              <ScrollItem
                key={scroll.id}
                scroll={scroll}
                isActive={activeScrollId === scroll.id}
                isPinned={pinnedIds.has(scroll.id)}
                onSelect={onSelect}
                onDelete={onDelete}
                onEdit={onEdit}
                onTogglePin={handleTogglePin}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ScrollList;
