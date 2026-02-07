/**
 * GrimoireScroll — Decorative grimoire wrapper.
 * Renders the leather-bound book chrome (texture, corners, spine)
 * around whatever children are passed in.
 */
export default function GrimoireScroll({
  children,
  className = "",
  text = "",
  onWordClick,
  isEngineReady = false,
}) {
  const renderText = typeof text === "string" && text.trim().length > 0;
  const handleWordClick = (word) => {
    if (!onWordClick) return;
    onWordClick(word);
  };

  const renderWords = () => {
    if (!renderText) return null;
    const parts = text.split(/(\s+)/);
    return parts.map((part, i) => {
      if (/^\s+$/.test(part)) {
        return (
          <span key={i} className="grimoire-space" aria-hidden="true">
            {part}
          </span>
        );
      }

      const clean = part.replace(/[^A-Za-z']/g, "").toUpperCase();
      return (
        <button
          key={i}
          type="button"
          className="grimoire-word"
          disabled={!isEngineReady || !clean}
          onClick={() => handleWordClick(clean)}
          aria-label={`Analyze word: ${clean || "word"}`}
        >
          {part}
        </button>
      );
    });
  };

  return (
    <div className={`grimoire-cover ${className}`} role="document">
      {/* Leather texture overlay */}
      <div className="leather-texture" aria-hidden="true" />

      {/* Corner flourishes */}
      <div className="grimoire-corner grimoire-corner--tl" aria-hidden="true" />
      <div className="grimoire-corner grimoire-corner--tr" aria-hidden="true" />
      <div className="grimoire-corner grimoire-corner--bl" aria-hidden="true" />
      <div className="grimoire-corner grimoire-corner--br" aria-hidden="true" />

      {/* Spine detail */}
      <div className="grimoire-spine" aria-hidden="true">
        <div className="spine-band" />
        <div className="spine-band" />
        <div className="spine-band" />
      </div>

      {/* The parchment page */}
      <div className="parchment">
        {/* Paper texture and aging effects */}
        <div className="parchment-texture" aria-hidden="true" />
        <div className="ink-stain ink-stain--1" aria-hidden="true" />
        <div className="ink-stain ink-stain--2" aria-hidden="true" />
        <div className="coffee-ring" aria-hidden="true" />

        {/* Margin symbols */}
        <div className="margin-symbols" aria-hidden="true">
          <span className="margin-symbol" style={{ top: "20%" }}>&#x2609;</span>
          <span className="margin-symbol" style={{ top: "40%" }}>&#x263D;</span>
          <span className="margin-symbol" style={{ top: "60%" }}>&#x2641;</span>
          <span className="margin-symbol" style={{ top: "80%" }}>&#x2644;</span>
        </div>

        {renderText && <div className="grimoire-text">{renderWords()}</div>}
        {children}
      </div>
    </div>
  );
}
