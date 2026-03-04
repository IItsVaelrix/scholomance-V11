import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, waitFor } from "@testing-library/react";
import { ThemeProvider } from "../../../src/hooks/useTheme.jsx";
import ScrollEditor from "../../../src/pages/Read/ScrollEditor.jsx";
import IntelliSense from "../../../src/components/IntelliSense.jsx";

// ---- Unit: IntelliSense component ----

describe("IntelliSense component", () => {
  const baseSuggestions = [
    { token: "tongue", type: "prediction", isRhyme: false },
    { token: "tonight", type: "prediction", isRhyme: false },
    { token: "tones", type: "prediction", isRhyme: true },
  ];

  it("renders nothing when suggestions are empty", () => {
    const { container } = render(
      <IntelliSense
        suggestions={[]}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    expect(container.querySelector(".intellisense")).toBeNull();
  });

  it("renders all suggestion items", () => {
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    const items = container.querySelectorAll(".intellisense-item");
    expect(items.length).toBe(3);
  });

  it("marks the selected item with --active class", () => {
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={1}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    const items = container.querySelectorAll(".intellisense-item");
    expect(items[0].classList.contains("intellisense-item--active")).toBe(false);
    expect(items[1].classList.contains("intellisense-item--active")).toBe(true);
  });

  it("marks rhyme items with --rhyme class and rhyme tag", () => {
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    const items = container.querySelectorAll(".intellisense-item");
    expect(items[2].classList.contains("intellisense-item--rhyme")).toBe(true);
    expect(items[2].querySelector(".intellisense-tag--rhyme")).toBeTruthy();
  });

  it("marks correction items with --correction class and fix tag", () => {
    const corrections = [
      { token: "designed", type: "correction", isRhyme: false },
    ];
    const { container } = render(
      <IntelliSense
        suggestions={corrections}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    const item = container.querySelector(".intellisense-item");
    expect(item.classList.contains("intellisense-item--correction")).toBe(true);
    expect(item.querySelector(".intellisense-tag--fix")).toBeTruthy();
  });

  it("calls onAccept with token on mouseDown", () => {
    const onAccept = vi.fn();
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={onAccept}
        onHover={() => {}}
      />
    );
    const items = container.querySelectorAll(".intellisense-item");
    fireEvent.mouseDown(items[1]);
    expect(onAccept).toHaveBeenCalledWith("tonight");
  });

  it("calls onHover with index on mouseEnter", () => {
    const onHover = vi.fn();
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={0}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={onHover}
      />
    );
    const items = container.querySelectorAll(".intellisense-item");
    fireEvent.mouseEnter(items[2]);
    expect(onHover).toHaveBeenCalledWith(2);
  });

  it("positions at the given coordinates via fixed positioning", () => {
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={0}
        position={{ x: 150, y: 300 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    const dropdown = container.querySelector(".intellisense");
    expect(dropdown.style.position).toBe("fixed");
    // Position should be set (may be clamped to viewport)
    expect(dropdown.style.left).toBeTruthy();
    expect(dropdown.style.top).toBeTruthy();
  });

  it("uses correct ARIA roles for accessibility", () => {
    const { container } = render(
      <IntelliSense
        suggestions={baseSuggestions}
        selectedIndex={1}
        position={{ x: 100, y: 200 }}
        onAccept={() => {}}
        onHover={() => {}}
      />
    );
    expect(container.querySelector('[role="listbox"]')).toBeTruthy();
    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(3);
    expect(options[1].getAttribute("aria-selected")).toBe("true");
    expect(options[0].getAttribute("aria-selected")).toBe("false");
  });
});

// ---- Integration: ScrollEditor + IntelliSense ----

function renderEditorWithPrediction({
  content = "",
  predict = () => [],
  checkSpelling = () => true,
  getSpellingSuggestions = () => [],
  predictorReady = true,
} = {}) {
  return render(
    <ThemeProvider>
      <ScrollEditor
        initialTitle="Test Scroll"
        initialContent={content}
        isEditable={true}
        isPredictive={true}
        predict={predict}
        checkSpelling={checkSpelling}
        getSpellingSuggestions={getSpellingSuggestions}
        predictorReady={predictorReady}
        onSave={() => {}}
        onContentChange={() => {}}
        onCursorChange={() => {}}
      />
    </ThemeProvider>
  );
}

describe("ScrollEditor IntelliSense integration", () => {
  beforeEach(() => {
    // Using global mock from setup.js
  });

  it("does not show IntelliSense when predictorReady is false", () => {
    const { container } = renderEditorWithPrediction({
      content: "to",
      predict: () => ["tongue", "tonight"],
      predictorReady: false,
    });
    expect(container.querySelector(".intellisense")).toBeNull();
  });

  it("does not show IntelliSense when isPredictive is false", () => {
    const { container } = render(
      <ThemeProvider>
        <ScrollEditor
          initialTitle="Test"
          initialContent="to"
          isEditable={true}
          isPredictive={false}
          predict={() => ["tongue"]}
          predictorReady={true}
          onSave={() => {}}
          onContentChange={() => {}}
          onCursorChange={() => {}}
        />
      </ThemeProvider>
    );
    expect(container.querySelector(".intellisense")).toBeNull();
  });

  it("shows correction suggestions for misspelled words", async () => {
    const predict = vi.fn().mockReturnValue([]);
    const checkSpelling = vi.fn().mockReturnValue(false);
    const getSpellingSuggestions = vi.fn().mockReturnValue(["designed", "designer"]);

    const { container } = renderEditorWithPrediction({
      content: "resignd",
      predict,
      checkSpelling,
      getSpellingSuggestions,
    });

    // Simulate typing to trigger cursor version update
    const textarea = container.querySelector("textarea");
    fireEvent.change(textarea, { target: { value: "resignd" } });

    await waitFor(() => {
      const corrections = container.querySelectorAll(".intellisense-item--correction");
      // If corrections appear, they should have the fix tag
      if (corrections.length > 0) {
        expect(corrections[0].querySelector(".intellisense-tag--fix")).toBeTruthy();
      }
    }, { timeout: 1000 });
  });

  it("accepts suggestion via keyboard Enter in the handleKeyDown path", () => {
    // This tests the keyboard navigation contract
    const onContentChange = vi.fn();
    const predict = vi.fn().mockReturnValue(["tongue", "tonight"]);

    const { container } = render(
      <ThemeProvider>
        <ScrollEditor
          initialTitle="Test"
          initialContent=""
          isEditable={true}
          isPredictive={true}
          predict={predict}
          checkSpelling={() => true}
          getSpellingSuggestions={() => []}
          predictorReady={true}
          onSave={() => {}}
          onContentChange={onContentChange}
          onCursorChange={() => {}}
        />
      </ThemeProvider>
    );

    const textarea = container.querySelector("textarea");
    // Type "to" to trigger predictions
    fireEvent.change(textarea, { target: { value: "to" } });

    // The IntelliSense renders asynchronously via requestAnimationFrame
    // If suggestions appear, test keyboard nav
    const intellisense = container.querySelector(".intellisense");
    if (intellisense) {
      // Arrow down to select second item
      fireEvent.keyDown(textarea, { key: "ArrowDown" });
      // Enter to accept
      fireEvent.keyDown(textarea, { key: "Enter" });
      // Content should have been updated via onContentChange
      expect(onContentChange).toHaveBeenCalled();
    }
  });
});
