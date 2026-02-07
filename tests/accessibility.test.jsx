// tests/accessibility.test.js
import { render, screen } from "@testing-library/react";
import { axe, toHaveNoViolations } from "jest-axe";
import { MemoryRouter } from "react-router-dom";
import { vi } from 'vitest';
import { PhonemeEngine } from '../src/lib/phoneme.engine';

// Mocked Providers & Components
import App from "../src/App";
import GrimoireScroll from "../src/pages/Read/GrimoireScroll";
import ScrollEditor from "../src/pages/Read/ScrollEditor";
import Navigation from "../src/components/Navigation/Navigation";
import { PhonemeEngineProvider } from "../src/hooks/usePhonemeEngine.jsx";
import { ProgressionProvider } from "../src/hooks/useProgression.jsx";
import { SongProvider } from "../src/hooks/useCurrentSong.jsx";
import { ThemeProvider } from "../src/hooks/useTheme.jsx";
import ListenPage from "../src/pages/Listen/ListenPage";


vi.spyOn(PhonemeEngine, 'init').mockResolvedValue(14);
vi.mock('../src/pages/Listen/HolographicEmbed.jsx', () => ({
  default: () => <div>Holographic Embed Mock</div>,
}));

vi.mock('../src/hooks/useCurrentSong', async () => ({
  ...await vi.importActual('../src/hooks/useCurrentSong'),
  useCurrentSong: () => ({
    currentKey: 'SONG_1',
    currentSong: { school: 'ABJURATION', title: 'Aegis of the Fifth Moon' },
    setCurrentKey: vi.fn(),
    library: {
      SONG_1: { school: 'ABJURATION', title: 'Aegis of the Fifth Moon' },
    },
  }),
}));
vi.mock('../src/hooks/useProgression', async () => ({
  ...await vi.importActual('../src/hooks/useProgression'),
  useProgression: () => ({
    progression: { xp: 1000, unlockedSchools: ['ABJURATION', 'SONIC'] },
    checkUnlocked: (id) => ['ABJURATION', 'SONIC'].includes(id),
    addXp: vi.fn(),
  }),
}));

vi.mock('../src/hooks/useAmbientPlayer', () => ({
  useAmbientPlayer: () => ({
    status: 'PLAYING',
    currentSchoolId: 'SONIC',
    isPlaying: true,
    isPaused: false,
    isTuning: false,
    volume: 0.5,
    setVolume: vi.fn(),
    autoplayAmbient: false,
    cyclingEnabled: true,
    playableSchools: ['SONIC'],
    tuneToSchool: vi.fn(),
    tuneNextSchool: vi.fn(),
    tunePreviousSchool: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    togglePlayPause: vi.fn(),
    toggleAutoplayAmbient: vi.fn(),
    toggleCyclingEnabled: vi.fn(),
    unlockAudio: vi.fn(),
  }),
}));

expect.extend(toHaveNoViolations);

describe("Accessibility Suite", () => {
  it("should have no accessibility violations in the main App layout", async () => {
    const { container } = render(
      <ThemeProvider>
        <ProgressionProvider>
          <PhonemeEngineProvider>
            <SongProvider>
              <MemoryRouter>
                <App />
              </MemoryRouter>
            </SongProvider>
          </PhonemeEngineProvider>
        </ProgressionProvider>
      </ThemeProvider>
    );
    // Wait for the app to render something, e.g., the navigation
    await screen.findByRole('navigation');
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it("GrimoireScroll should be keyboard accessible", async () => {
    const { container } = render(
      <GrimoireScroll 
        text="The quick brown fox" 
        onWordClick={() => {}} 
        isEngineReady={true} 
      />
    );
    
    // Check for violations
    const results = await axe(container);
    expect(results).toHaveNoViolations();
    
    // Ensure words are buttons
    const buttons = container.querySelectorAll('.grimoire-word');
    expect(buttons.length).toBeGreaterThan(0);
    buttons.forEach(btn => {
      expect(btn.tagName).toBe('BUTTON');
      expect(btn).toHaveAttribute('aria-label');
    });
  });

  describe("ScrollEditor", () => {
    it("should have no axe violations", async () => {
      const { container } = render(
        <ProgressionProvider>
          <PhonemeEngineProvider>
            <ScrollEditor onSave={() => {}} />
          </PhonemeEngineProvider>
        </ProgressionProvider>
      );
      expect(await axe(container)).toHaveNoViolations();
    });
  
    it("should connect labels to inputs", () => {
      render(
        <ProgressionProvider>
          <PhonemeEngineProvider>
            <ScrollEditor onSave={() => {}} />
          </PhonemeEngineProvider>
        </ProgressionProvider>
      );
      expect(screen.getByLabelText(/scroll title/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/scroll content/i)).toBeInTheDocument();
    });
  });

  describe("Navigation", () => {
    it("should have no axe violations", async () => {
        const { container } = render(
            <ThemeProvider>
                <MemoryRouter>
                    <Navigation />
                </MemoryRouter>
            </ThemeProvider>
        );
        expect(await axe(container)).toHaveNoViolations();
    });

    it("should have a primary navigation landmark", () => {
        render(
            <ThemeProvider>
                <MemoryRouter>
                    <Navigation />
                </MemoryRouter>
            </ThemeProvider>
        );
        expect(screen.getByRole('navigation', {name: /primary navigation/i })).toBeInTheDocument();
    });
  });
  
  describe("ListenPage", () => {
    it("should have no axe violations", async () => {
      const { container } = render(
        <ProgressionProvider>
          <MemoryRouter>
              <ListenPage />
          </MemoryRouter>
        </ProgressionProvider>
      );
      // Wait for async content
      await screen.findByRole('heading', { name: 'Sonic Thaumaturgy' });
      expect(await axe(container)).toHaveNoViolations();
    });

    it("should have a live region for announcements", () => {
        render(
            <MemoryRouter>
                <ListenPage />
            </MemoryRouter>
        );
        expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});
