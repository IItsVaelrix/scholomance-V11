import { memo, useMemo, useRef, useState, useEffect, useCallback } from "react";

const VIRTUALIZE_AFTER_COUNT = 12;
const LIST_ROW_HEIGHT = 120;
const LIST_OVERSCAN = 6;

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

const ScrollItem = memo(function ScrollItem({ scroll, isActive, onSelect, onDelete }) {
  const wordCount = Number.isFinite(scroll.wordCount) ? scroll.wordCount : 0;
  const preview = scroll.preview || truncate(scroll.content || "");

  const formattedDate = useMemo(() => {
    return formatDate(scroll.updatedAt);
  }, [scroll.updatedAt]);

  return (
    <div
      className={`scroll-item ${isActive ? "scroll-item--active" : ""}`}
      role="listitem"
    >
      <button
        type="button"
        className="scroll-item-main"
        onClick={() => onSelect(scroll.id)}
        aria-current={isActive ? "true" : undefined}
      >
        <div className="scroll-item-title">
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
      <button
        type="button"
        className="scroll-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Delete this scroll permanently?")) {
            onDelete(scroll.id);
          }
        }}
        title="Delete scroll"
        aria-label="Delete scroll"
      >
        &#x2715;
      </button>
    </div>
  );
});

const ScrollList = memo(function ScrollList({
  scrolls,
  activeScrollId,
  onSelect,
  onDelete,
  onNewScroll,
}) {
  const listBodyRef = useRef(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const useVirtualization = scrolls.length >= VIRTUALIZE_AFTER_COUNT;

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
        endIndex: scrolls.length,
        topPadding: 0,
        bottomPadding: 0,
      };
    }

    const effectiveViewportHeight = Math.max(viewportHeight, LIST_ROW_HEIGHT);
    const visibleCount = Math.ceil(effectiveViewportHeight / LIST_ROW_HEIGHT);
    const startIndex = Math.max(0, Math.floor(scrollTop / LIST_ROW_HEIGHT) - LIST_OVERSCAN);
    const endIndex = Math.min(
      scrolls.length,
      startIndex + visibleCount + LIST_OVERSCAN * 2
    );

    return {
      startIndex,
      endIndex,
      topPadding: startIndex * LIST_ROW_HEIGHT,
      bottomPadding: Math.max(0, (scrolls.length - endIndex) * LIST_ROW_HEIGHT),
    };
  }, [scrollTop, scrolls.length, useVirtualization, viewportHeight]);

  const visibleScrolls = useMemo(() => {
    return scrolls.slice(windowRange.startIndex, windowRange.endIndex);
  }, [scrolls, windowRange.startIndex, windowRange.endIndex]);

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
        {scrolls.length === 0 ? (
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
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default ScrollList;
