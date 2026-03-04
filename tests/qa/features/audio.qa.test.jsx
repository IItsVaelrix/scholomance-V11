import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ListenPage from "../../../src/pages/Listen/ListenPage";
import { ProgressionProvider } from "../../../src/hooks/useProgression.jsx";
import { SongProvider } from "../../../src/hooks/useCurrentSong";

global.fetch = vi.fn();

const mockFetchResponse = (data, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
  });
};

const normalizeUrl = (url) => {
  if (typeof url === "string") return url;
  return String(url || "");
};

function renderListenPage(initialEntry = "/listen") {
  return render(
    <ProgressionProvider>
      <SongProvider>
        <MemoryRouter initialEntries={[initialEntry]}>
          <Routes>
            <Route path="/listen" element={<ListenPage />} />
          </Routes>
        </MemoryRouter>
      </SongProvider>
    </ProgressionProvider>
  );
}

describe("Listen Audio QA", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetch.mockImplementation((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse({});
    });
  });

  it("does not render upload or archive controls", async () => {
    renderListenPage("/listen");

    expect(screen.queryByText(/Chamber of Echoes/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Upload Audio/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /Archive/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Audio admin token/i)).not.toBeInTheDocument();
  });

  it("does not call audio upload/archive APIs", async () => {
    renderListenPage("/listen");

    await waitFor(() => {
      const hasAudioApiCalls = fetch.mock.calls.some(([url]) => {
        const normalizedUrl = normalizeUrl(url);
        return normalizedUrl.endsWith("/api/audio-files") || normalizedUrl.endsWith("/api/upload");
      });
      expect(hasAudioApiCalls).toBe(false);
    });
  });
});
