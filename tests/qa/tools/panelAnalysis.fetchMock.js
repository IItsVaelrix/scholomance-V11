import { expect, vi } from "vitest";
import { createPanelAnalysisData } from "./panelAnalysis.fixture.js";

export const PANEL_ANALYSIS_ENDPOINT = "/api/analysis/panels";

function isNormalizedPanelData(payload) {
  return Boolean(payload && typeof payload === "object" && payload.analysis);
}

export function installPanelAnalysisFetchMock() {
  const originalFetch = global.fetch;
  const fetchMock = vi.fn();
  global.fetch = fetchMock;

  return {
    fetchMock,
    restoreFetch: () => {
      global.fetch = originalFetch;
    },
  };
}

export function queuePanelAnalysisSuccess(fetchMock, payload = {}, options = {}) {
  const status = Number.isInteger(options.status) ? options.status : 200;
  const source = String(options.source || "server-analysis");
  const cache = String(options.cache || "MISS");
  const normalizedData = isNormalizedPanelData(payload)
    ? payload
    : createPanelAnalysisData(payload);

  fetchMock.mockResolvedValueOnce({
    ok: true,
    status,
    headers: new Headers({ "x-cache": cache }),
    json: async () => ({
      source,
      data: normalizedData,
    }),
  });
}

export function queuePanelAnalysisFailure(fetchMock, options = {}) {
  const status = Number.isInteger(options.status) ? options.status : 500;
  const message = String(options.message || "Internal Server Error");

  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers({ "x-cache": "MISS" }),
    json: async () => ({ message }),
  });
}

export function expectPanelAnalysisRequest(fetchMock, expectedText) {
  expect(fetchMock).toHaveBeenCalled();

  const lastCall = fetchMock.mock.calls.at(-1);
  expect(lastCall).toBeTruthy();

  const [url, options] = lastCall;
  const normalizedUrl = String(url || "");
  expect(normalizedUrl).toContain(PANEL_ANALYSIS_ENDPOINT);

  expect(options).toEqual(
    expect.objectContaining({
      method: "POST",
      credentials: "include",
    })
  );

  const contentType = options?.headers?.["Content-Type"] ?? options?.headers?.["content-type"];
  expect(contentType).toBe("application/json");

  if (expectedText !== undefined) {
    const parsedBody = JSON.parse(String(options?.body || "{}"));
    expect(parsedBody.text).toBe(expectedText);
  }
}
