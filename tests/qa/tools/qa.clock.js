import { vi } from "vitest";

// Keep in sync with src/hooks/usePanelAnalysis.js (ANALYSIS_DEBOUNCE_MS).
export const ANALYSIS_DEBOUNCE_MS = 500;

export function useFakeClock() {
  vi.useFakeTimers();
}

export function restoreClock() {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
}

export async function flushAnalysisCycle(durationMs = ANALYSIS_DEBOUNCE_MS) {
  await vi.advanceTimersByTimeAsync(durationMs);
  // Flush multiple rounds of microtasks to ensure all async steps 
  // (imports, analysis, state transitions) complete.
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}
