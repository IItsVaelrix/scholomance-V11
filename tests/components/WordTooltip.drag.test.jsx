import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import WordTooltip from "../../src/components/WordTooltip.jsx";
import { ThemeProvider } from "../../src/hooks/useTheme.jsx";

function renderTooltip(props = {}) {
  return render(
    <ThemeProvider>
      <WordTooltip
        wordData={{ word: "dragon" }}
        analysis={null}
        isLoading={false}
        error={null}
        x={100}
        y={100}
        onDrag={() => {}}
        onClose={() => {}}
        {...props}
      />
    </ThemeProvider>
  );
}

describe("WordTooltip drag", () => {
  it("moves when dragging from the card frame", () => {
    const onDrag = vi.fn();
    const { container } = renderTooltip({ onDrag });

    const frame = container.querySelector(".card-frame");
    expect(frame).toBeTruthy();

    fireEvent.pointerDown(frame, { button: 0, pointerId: 1, clientX: 160, clientY: 160 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 240, clientY: 210 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 240, clientY: 210 });

    expect(onDrag).toHaveBeenCalledTimes(1);
    expect(onDrag).toHaveBeenCalledWith({ x: 180, y: 150 });
  });

  it("close button pointer-down does not start drag", () => {
    const onDrag = vi.fn();
    const { container } = renderTooltip({ onDrag });

    const closeBtn = container.querySelector(".card-close-btn");
    expect(closeBtn).toBeTruthy();

    fireEvent.pointerDown(closeBtn, { button: 0, pointerId: 1, clientX: 160, clientY: 160 });
    fireEvent.pointerMove(window, { pointerId: 1, clientX: 240, clientY: 210 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 240, clientY: 210 });

    expect(onDrag).not.toHaveBeenCalled();
  });

  it("closes when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderTooltip({ onClose });

    const closeBtn = container.querySelector(".card-close-btn");
    expect(closeBtn).toBeTruthy();
    fireEvent.click(closeBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
