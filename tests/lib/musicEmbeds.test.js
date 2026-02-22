import { describe, it, expect } from "vitest";
import {
  getMusicProvider,
  getSunoAudioUrl,
  getSunoEmbedUrl,
  getTrackEmbedConfig,
} from "../../src/lib/musicEmbeds.js";

describe("musicEmbeds", () => {
  it("detects provider by URL", () => {
    expect(getMusicProvider("https://suno.com/song/12345678-1234-1234-1234-123456789abc")).toBe("suno");
    expect(getMusicProvider("https://example.com/track")).toBe("unknown");
    expect(getMusicProvider("/audio/1.mp3")).toBe("direct");
  });

  it("converts suno song URLs to embed URLs", () => {
    const songUrl = "https://suno.com/song/12345678-1234-1234-1234-123456789abc";
    const embedUrl = getSunoEmbedUrl(songUrl, { autoPlay: true });
    const audioUrl = getSunoAudioUrl(songUrl);
    const config = getTrackEmbedConfig(songUrl);

    expect(embedUrl).toBe("https://suno.com/embed/12345678-1234-1234-1234-123456789abc?autoplay=1");
    expect(audioUrl).toBe("https://cdn1.suno.ai/12345678-1234-1234-1234-123456789abc.mp3");
    expect(config.audioUrl).toBe("https://cdn1.suno.ai/12345678-1234-1234-1234-123456789abc.mp3");
  });

  it("returns null source for unsupported providers", () => {
    const embed = getTrackEmbedConfig("https://example.com/track");
    expect(embed.provider).toBe("unknown");
    expect(embed.src).toBeNull();
  });
});
