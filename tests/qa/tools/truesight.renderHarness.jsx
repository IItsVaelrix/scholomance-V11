import { render } from "@testing-library/react";
import ScrollEditor from "../../../src/pages/Read/ScrollEditor.jsx";

export function renderTruesightEditor({
  title = "Truesight QA",
  content = "",
  isEditable = false,
  isTruesight = true,
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  highlightedLines = [],
  vowelColors = null,
  colorMap = null,
} = {}) {
  return render(
    <ScrollEditor
      initialTitle={title}
      initialContent={content}
      isEditable={isEditable}
      isTruesight={isTruesight}
      analyzedWords={analyzedWords}
      analyzedWordsByIdentity={analyzedWordsByIdentity}
      analyzedWordsByCharStart={analyzedWordsByCharStart}
      activeConnections={activeConnections}
      highlightedLines={highlightedLines}
      vowelColors={vowelColors}
      colorMap={colorMap}
    />
  );
}
