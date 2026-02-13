import { expect } from "vitest";

export function getColoredWordTexts(container) {
  return Array.from(container.querySelectorAll(".grimoire-word"))
    .map((node) => node.textContent?.trim())
    .filter(Boolean);
}

export function expectColoredWords(container, expectedWords) {
  expect(getColoredWordTexts(container)).toEqual(expectedWords);
}

export function expectWordsShareColor(container, charStarts) {
  const nodes = charStarts.map((charStart) =>
    container.querySelector(`[data-char-start="${charStart}"]`)
  );

  nodes.forEach((node) => expect(node).toBeTruthy());
  const referenceColor = window.getComputedStyle(nodes[0]).color;

  nodes.forEach((node) => {
    expect(window.getComputedStyle(node).color).toBe(referenceColor);
  });

  return referenceColor;
}

export function expectWordsShareClusterColor(container, charStarts) {
  const nodes = charStarts.map((cs) =>
    container.querySelector(`[data-char-start="${cs}"]`)
  );
  nodes.forEach((node) => expect(node).toBeTruthy());

  const colors = nodes.map((node) => node.style.color);
  const referenceColor = colors[0];
  expect(referenceColor).toBeTruthy();

  colors.forEach((c) => {
    expect(c).toBe(referenceColor);
  });
}

export function expectWordOpacityAbove(container, charStart, minOpacity) {
  const node = container.querySelector(`[data-char-start="${charStart}"]`);
  expect(node).toBeTruthy();
  const opacity = parseFloat(node.style.opacity);
  expect(opacity).toBeGreaterThanOrEqual(minOpacity);
}
