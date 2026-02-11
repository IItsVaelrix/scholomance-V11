import { render } from "@testing-library/react";
import { vi } from "vitest";

vi.mock("../../src/hooks/usePhonemeEngine.jsx", () => ({
  usePhonemeEngine: () => ({ engine: null }),
}));

import ScrollEditor from "../../src/pages/Read/ScrollEditor.jsx";

describe("ScrollEditor Truesight overlay", () => {
  it("renders one overlay row per document line, including blank lines", () => {
    const content = [
      "The freedom of Defiance",
      "is freedom of a God",
      "",
      "Liberation...",
      "We really need it now",
    ].join("\n");

    const { container } = render(
      <ScrollEditor
        initialTitle="Line mapping"
        initialContent={content}
        isEditable={false}
        isTruesight={true}
        analyzedWords={new Map()}
        activeConnections={[]}
        highlightedLines={[]}
      />
    );

    const overlayLines = container.querySelectorAll(".truesight-line");
    expect(overlayLines.length).toBe(content.split("\n").length);
  });
});
