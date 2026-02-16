import { render } from "@testing-library/react";
import ScrollEditor from "../../../src/pages/Read/ScrollEditor.jsx";
import { ThemeProvider } from "../../../src/hooks/useTheme.jsx";

export function renderTruesightEditor({
  title = "Truesight QA",
  content = "",
  isEditable = false,
  isTruesight = true,
  analysisMode = "none",
  analyzedWords = new Map(),
  analyzedWordsByIdentity = new Map(),
  analyzedWordsByCharStart = new Map(),
  activeConnections = [],
  highlightedLines = [],
  vowelColors = null,
  colorMap = null,
} = {}) {
  return render(
    <ThemeProvider>
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
        analysisMode={analysisMode}
      />
    </ThemeProvider>
  );
}
