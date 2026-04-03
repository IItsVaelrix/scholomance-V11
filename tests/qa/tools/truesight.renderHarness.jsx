import { render, act } from "@testing-library/react";
import { vi } from "vitest";
import ScrollEditor from "../../../src/pages/Read/ScrollEditor.jsx";
import { ThemeProvider } from "../../../src/hooks/useTheme.jsx";

/**
 * High-fidelity rendering harness for TrueSight tests.
 * Standardizes the viewport and layout detection logic for JSDOM.
 */

// Mock dimensions for JSDOM
if (typeof window !== 'undefined') {
  Object.defineProperty(window.HTMLElement.prototype, 'clientWidth', {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(window.HTMLElement.prototype, 'clientHeight', {
    configurable: true,
    value: 1000,
  });
}

export async function renderTruesightEditor({
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
  let result;
  
  await act(async () => {
    result = render(
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
  });

  // Trigger resize and wait for debounce to ensure TrueSight layer computes
  // World-Law: The eyes must adjust to the light before the colors are seen.
  await act(async () => {
    window.dispatchEvent(new Event('resize'));
    // Debounce in ScrollEditor is 100ms
    await vi.advanceTimersByTimeAsync(200);
  });

  return result;
}
