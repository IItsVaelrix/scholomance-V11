import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import { motion } from "framer-motion";

/**
 * Truesight analytics panel for vowel-family frequency breakdown.
 */
export default function VowelFamilyPanel({
  visible = true,
  families = [],
  totalWords = 0,
  uniqueWords = 0,
  onClose = null,
  isEmbedded = false,
}) {
  const [sortMode, setSortMode] = useState("count_desc");

  const sortedFamilies = useMemo(() => {
    const next = [...families];
    const compareText = (a, b) => String(a).localeCompare(String(b), undefined, { sensitivity: "base" });

    switch (sortMode) {
      case "count_asc":
        next.sort((a, b) => a.count - b.count || compareText(a.id, b.id));
        break;
      case "alpha_asc":
        next.sort((a, b) => compareText(a.id, b.id));
        break;
      case "alpha_desc":
        next.sort((a, b) => compareText(b.id, a.id));
        break;
      case "school_asc":
        next.sort((a, b) => compareText(a.schoolName, b.schoolName) || compareText(a.id, b.id));
        break;
      case "school_desc":
        next.sort((a, b) => compareText(b.schoolName, a.schoolName) || compareText(a.id, b.id));
        break;
      case "count_desc":
      default:
        next.sort((a, b) => b.count - a.count || compareText(a.id, b.id));
        break;
    }

    return next;
  }, [families, sortMode]);

  if (!visible) return null;

  const content = (
    <>
      {!isEmbedded && (
        <div className="vowel-family-header">
          <div className="vowel-family-header-main">
            <h3 className="vowel-family-title">Vowel Families</h3>
            <p className="vowel-family-meta">
              {totalWords} tokens - {uniqueWords} unique words
            </p>
          </div>
          <button
            type="button"
            className="panel-close-btn"
            onClick={onClose}
            aria-label="Close Truesight analytics"
          >
            &#x2715;
          </button>
        </div>
      )}

      {isEmbedded && (
        <div className="vowel-family-stats-summary">
          {totalWords} tokens &middot; {uniqueWords} unique
        </div>
      )}

      <div className="vowel-family-toolbar">
        <label className="vowel-family-sort-label" htmlFor="vowel-family-sort">
          Sort
        </label>
        <select
          id="vowel-family-sort"
          className="vowel-family-sort"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value)}
        >
          <option value="count_desc">Frequency (H-L)</option>
          <option value="count_asc">Frequency (L-H)</option>
          <option value="alpha_asc">Family (A-Z)</option>
          <option value="alpha_desc">Family (Z-A)</option>
          <option value="school_asc">School (A-Z)</option>
          <option value="school_desc">School (Z-A)</option>
        </select>
      </div>

      {families.length === 0 ? (
        <div className="vowel-family-empty">
          <p>No vowel-family data yet.</p>
          <span>Enable Truesight and add some verse.</span>
        </div>
      ) : (
        <div className="vowel-family-list">
          {sortedFamilies.map((family) => (
            <div key={family.id} className="vowel-family-row">
              <div className="vowel-family-left">
                <span
                  className="vowel-family-chip"
                  style={{
                    borderColor: family.color,
                    color: family.color,
                  }}
                >
                  <span
                    className="vowel-family-dot"
                    style={{ backgroundColor: family.color }}
                    aria-hidden="true"
                  />
                  {family.id}
                </span>
                <span className="vowel-family-school">
                  {family.schoolGlyph ? (
                    <span className="vowel-family-school-glyph" aria-hidden="true">
                      {family.schoolGlyph}
                    </span>
                  ) : null}
                  <span className="vowel-family-school-name" title={family.schoolName}>
                    {family.schoolName}
                  </span>
                </span>
              </div>
              <div className="vowel-family-right">
                <span className="vowel-family-count">{family.count}</span>
                <span className="vowel-family-percent">{family.percentLabel}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  if (isEmbedded) {
    return (
      <aside className="vowel-family-panel embedded">
        {content}
      </aside>
    );
  }

  return (
    <motion.aside
      className="vowel-family-panel"
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {content}
    </motion.aside>
  );
}

VowelFamilyPanel.propTypes = {
  visible: PropTypes.bool,
  totalWords: PropTypes.number,
  uniqueWords: PropTypes.number,
  onClose: PropTypes.func,
  isEmbedded: PropTypes.bool,
  families: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      count: PropTypes.number.isRequired,
      percentLabel: PropTypes.string.isRequired,
      color: PropTypes.string.isRequired,
      schoolName: PropTypes.string.isRequired,
      schoolGlyph: PropTypes.string.isRequired,
    })
  ),
};

VowelFamilyPanel.defaultProps = {
  visible: true,
  totalWords: 0,
  uniqueWords: 0,
  onClose: null,
  isEmbedded: false,
  families: [],
};
