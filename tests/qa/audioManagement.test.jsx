
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ListenPage from "../../src/pages/Listen/ListenPage";
import { ProgressionProvider } from "../../src/hooks/useProgression";
import { SongProvider } from "../../src/hooks/useCurrentSong";

// Mock fetch
global.fetch = vi.fn();

// Helper to create a successful fetch response
const mockFetchResponse = (data) => {
  return Promise.resolve({
    ok: true,
    json: () => Promise.resolve(data),
  });
};

describe("Audio Management QA Suite", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default mock for audio-files
    fetch.mockImplementation((url) => {
      if (url === "/api/audio-files") {
        return mockFetchResponse([]);
      }
      return mockFetchResponse({});
    });
  });

  it("should not display the Chamber of Echoes by default", async () => {
    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    expect(screen.queryByText(/Chamber of Echoes/i)).not.toBeInTheDocument();
  });

  it("should display the Chamber of Echoes when admin=echo is in URL", async () => {
    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen?admin=echo"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    expect(screen.getByText(/Chamber of Echoes/i)).toBeInTheDocument();
    expect(screen.getByText(/Upload Audio/i)).toBeInTheDocument();
  });

  it("should fetch and display dynamic audio files in the Archive section", async () => {
    const mockFiles = [
      { name: "spell_of_resonance.mp3", url: "/audio/spell_of_resonance.mp3" },
      { name: "ancient_echo.wav", url: "/audio/ancient_echo.wav" }
    ];

    fetch.mockImplementation((url) => {
      if (url === "/api/audio-files") {
        return mockFetchResponse(mockFiles);
      }
      return mockFetchResponse({});
    });

    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /Archive/i })).toBeInTheDocument();
      expect(screen.getByText(/spell of resonance/i)).toBeInTheDocument();
      expect(screen.getByText(/ancient echo/i)).toBeInTheDocument();
    });
  });

  it("should handle file upload and refresh the list", async () => {
    const mockFilesInitial = [];
    const mockFilesAfter = [
      { name: "new_ritual.mp3", url: "/audio/new_ritual.mp3" }
    ];

    let fetchCount = 0;
    fetch.mockImplementation((url, options) => {
      if (url === "/api/audio-files") {
        fetchCount++;
        return mockFetchResponse(fetchCount > 1 ? mockFilesAfter : mockFilesInitial);
      }
      if (url === "/api/upload" && options.method === "POST") {
        return mockFetchResponse({ message: "Uploaded" });
      }
      return mockFetchResponse({});
    });

    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen?admin=echo"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    const uploadBtn = screen.getByText(/Upload Audio/i);
    const fileInput = document.querySelector('input[type="file"]');
    
    // Create a mock file
    const file = new File(["dummy content"], "new_ritual.mp3", { type: "audio/mpeg" });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Uploaded successfully!/i)).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/new ritual/i)).toBeInTheDocument();
    });
  });

  it("should handle upload failure gracefully", async () => {
    fetch.mockImplementation((url, options) => {
      if (url === "/api/upload") {
        return Promise.resolve({ ok: false });
      }
      return mockFetchResponse([]);
    });

    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen?admin=echo"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy content"], "fail.mp3", { type: "audio/mpeg" });
    
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it("should handle 401 Unauthorized during upload", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/upload") {
        return Promise.resolve({ status: 401, ok: false });
      }
      return mockFetchResponse([]);
    });

    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen?admin=echo"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy"], "unauth.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });

  it("should handle 429 Rate Limit during upload", async () => {
    fetch.mockImplementation((url) => {
      if (url === "/api/upload") {
        return Promise.resolve({ status: 429, ok: false });
      }
      return mockFetchResponse([]);
    });

    render(
      <ProgressionProvider>
        <SongProvider>
          <MemoryRouter initialEntries={["/listen?admin=echo"]}>
            <Routes>
              <Route path="/listen" element={<ListenPage />} />
            </Routes>
          </MemoryRouter>
        </SongProvider>
      </ProgressionProvider>
    );

    const fileInput = document.querySelector('input[type="file"]');
    const file = new File(["dummy"], "ratelimit.mp3", { type: "audio/mpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(/Upload failed/i)).toBeInTheDocument();
    });
  });
});
