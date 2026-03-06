import { vi } from "vitest";

// Keep in sync with src/hooks/usePanelAnalysis.js (ANALYSIS_DEBOUNCE_MS).
export const ANALYSIS_DEBOUNCE_MS = 2500;

export function useFakeClock() {
  vi.useFakeTimers();
}

export function restoreClock() {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
}

export async function flushAnalysisCycle(durationMs = ANALYSIS_DEBOUNCE_MS) {
  await vi.advanceTimersByTimeAsync(durationMs);
  await Promise.resolve();
  await Promise.resolve();
}
