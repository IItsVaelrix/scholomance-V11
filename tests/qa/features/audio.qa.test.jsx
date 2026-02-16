import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ListenPage from "../../../src/pages/Listen/ListenPage";
import { ProgressionProvider } from "../../../src/hooks/useProgression.jsx";
import { SongProvider } from "../../../src/hooks/useCurrentSong";

// Mock fetch
global.fetch = vi.fn();

// Helper to create a successful fetch response
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

const renderListenPage = (initialEntry = "/listen") => {
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
};

describe("Audio Management QA Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    fetch.mockImplementation((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/audio-files")) {
        return mockFetchResponse([]);
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse({});
    });
  });

  it("should display the Chamber of Echoes without URL admin params", async () => {
    renderListenPage("/listen");

    expect(screen.getByText(/Chamber of Echoes/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Audio/i)).toBeInTheDocument();
  });

  it("should disable upload until an admin token is entered", async () => {
    renderListenPage("/listen");

    const uploadButton = screen.getByRole("button", { name: /Upload Audio/i });
    const tokenInput = screen.getByLabelText(/Audio admin token/i);

    expect(uploadButton).toBeDisabled();

    fireEvent.change(tokenInput, { target: { value: "secret-token" } });

    await waitFor(() => {
      expect(uploadButton).not.toBeDisabled();
    });
  });

  it("should fetch and display dynamic audio files in the Archive section", async () => {
    const mockFiles = [
      { name: "spell_of_resonance.mp3", url: "/audio/spell_of_resonance.mp3" },
      { name: "ancient_echo.wav", url: "/audio/ancient_echo.wav" }
    ];

    fetch.mockImplementation((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/audio-files")) {
        return mockFetchResponse(mockFiles);
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse({});
    });

    renderListenPage("/listen");

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Archive/i })).toBeInTheDocument();
      expect(screen.getByText(/spell of resonance/i)).toBeInTheDocument();
      expect(screen.getByText(/ancient echo/i)).toBeInTheDocument();
    });
  });

  it("should send x-audio-admin-token header when uploading and refresh archive", async () => {
    const mockFilesInitial = [];
    const mockFilesAfter = [
      { name: "new_ritual.mp3", url: "/audio/new_ritual.mp3" }
    ];

    let fetchCount = 0;
    fetch.mockImplementation((url, _options) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/audio-files")) {
        fetchCount++;
        return mockFetchResponse(fetchCount > 1 ? mockFilesAfter : mockFilesInitial);
      }
      if (normalizedUrl.endsWith("/api/upload") && _options?.method === "POST") {
        return mockFetchResponse({ message: "Uploaded" });
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse({});
    });

    renderListenPage("/listen");
    const tokenInput = screen.getByLabelText(/Audio admin token/i);
    fireEvent.change(tokenInput, { target: { value: "my-secret-token" } });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy content"], "new_ritual.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Uploaded successfully!/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/new ritual/i)).toBeInTheDocument();
    });

    const uploadCall = fetch.mock.calls.find(([url, options]) => {
      return normalizeUrl(url).endsWith("/api/upload") && options?.method === "POST";
    });

    expect(uploadCall).toBeTruthy();
    const uploadHeaders = uploadCall[1].headers;
    expect(uploadHeaders.get("x-audio-admin-token")).toBe("my-secret-token");
  });

  it("should send x-audio-admin-token header when fetching audio files after token entry", async () => {
    fetch.mockImplementation((url, _options) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/audio-files")) {
        return mockFetchResponse([]);
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse({});
    });

    renderListenPage("/listen");
    const tokenInput = screen.getByLabelText(/Audio admin token/i);
    fireEvent.change(tokenInput, { target: { value: "header-token" } });

    await waitFor(() => {
      const audioFileCalls = fetch.mock.calls.filter(([url]) => normalizeUrl(url).endsWith("/api/audio-files"));
      expect(audioFileCalls.length).toBeGreaterThan(1);
    });

    const tokenizedAudioCall = fetch.mock.calls.find(([url, options]) => {
      if (!normalizeUrl(url).endsWith("/api/audio-files")) {
        return false;
      }
      const headers = options?.headers;
      return headers && typeof headers.get === "function" && headers.get("x-audio-admin-token") === "header-token";
    });

    expect(tokenizedAudioCall).toBeTruthy();
  });

  it("should handle upload failure gracefully", async () => {
    fetch.mockImplementation((url, _options) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/upload")) {
        return Promise.resolve({ ok: false });
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse([]);
    });

    renderListenPage("/listen");
    const tokenInput = screen.getByLabelText(/Audio admin token/i);
    fireEvent.change(tokenInput, { target: { value: "secret-token" } });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy content"], "fail.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it("should show reason-aware error for invalid token", async () => {
    fetch.mockImplementation((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/upload")) {
        return Promise.resolve({
          status: 401,
          ok: false,
          json: () => Promise.resolve({ message: "Unauthorized", reason: "invalid_admin_token" }),
        });
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse([]);
    });

    renderListenPage("/listen");
    const tokenInput = screen.getByLabelText(/Audio admin token/i);
    fireEvent.change(tokenInput, { target: { value: "bad-token" } });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy"], "unauth.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/invalid admin token/i)).toBeInTheDocument();
    });
  });

  it("should handle 429 Rate Limit during upload", async () => {
    fetch.mockImplementation((url) => {
      const normalizedUrl = normalizeUrl(url);
      if (normalizedUrl.endsWith("/api/upload")) {
        return Promise.resolve({ status: 429, ok: false });
      }
      if (normalizedUrl.endsWith("/api/progression")) {
        return mockFetchResponse({ message: "Unauthorized" }, 401);
      }
      return mockFetchResponse([]);
    });

    renderListenPage("/listen");
    const tokenInput = screen.getByLabelText(/Audio admin token/i);
    fireEvent.change(tokenInput, { target: { value: "secret-token" } });

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy"], "ratelimit.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });
});
