import { vi } from "vitest";

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
  await Promise.resolve();
  await Promise.resolve();
}
