import { memo, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

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

// Memoized scroll item to avoid recomputing word count and date on every render
const ScrollItem = memo(forwardRef(function ScrollItem(
  { scroll, isActive, onSelect, onDelete },
  ref
) {
  // Memoize derived values
  const wordCount = useMemo(() => {
    return scroll.content.trim().split(/\s+/).length;
  }, [scroll.content]);

  const formattedDate = useMemo(() => {
    return formatDate(scroll.updatedAt);
  }, [scroll.updatedAt]);

  return (
    <motion.div
      ref={ref}
      className={`scroll-item ${isActive ? "scroll-item--active" : ""}`}
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ duration: 0.15 }}
      layout
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
          {truncate(scroll.content)}
        </div>
        <div className="scroll-item-meta">
          <span className="scroll-word-count">
            {wordCount} words
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
    </motion.div>
  );
}));
ScrollItem.displayName = "ScrollItem";

const ScrollList = memo(function ScrollList({
  scrolls,
  activeScrollId,
  onSelect,
  onDelete,
  onNewScroll,
}) {
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

      <div className="scroll-list-body" role="list">
        <AnimatePresence mode="popLayout">
          {scrolls.length === 0 ? (
            <motion.div
              className="scroll-empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="empty-sigil">&#x2728;</div>
              <p>No scrolls yet</p>
              <span>Begin thy first inscription above</span>
            </motion.div>
          ) : (
            scrolls.map((scroll) => (
              <ScrollItem
                key={scroll.id}
                scroll={scroll}
                isActive={activeScrollId === scroll.id}
                onSelect={onSelect}
                onDelete={onDelete}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
});

export default ScrollList;
