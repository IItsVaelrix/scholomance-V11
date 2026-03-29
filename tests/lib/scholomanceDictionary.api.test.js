import { afterEach, describe, expect, it } from "vitest";
import { ScholomanceDictionaryAPI } from "../../src/lib/scholomanceDictionary.api.js";

const originalViteUrl = process.env.VITE_SCHOLOMANCE_DICT_API_URL;
const originalServerUrl = process.env.SCHOLOMANCE_DICT_API_URL;

function restoreEnv() {
  if (originalViteUrl === undefined) {
    delete process.env.VITE_SCHOLOMANCE_DICT_API_URL;
  } else {
    process.env.VITE_SCHOLOMANCE_DICT_API_URL = originalViteUrl;
  }

  if (originalServerUrl === undefined) {
    delete process.env.SCHOLOMANCE_DICT_API_URL;
  } else {
    process.env.SCHOLOMANCE_DICT_API_URL = originalServerUrl;
  }
}

describe("ScholomanceDictionaryAPI", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("appends the lexicon path for a bare local dictionary host", () => {
    process.env.VITE_SCHOLOMANCE_DICT_API_URL = "http://127.0.0.1:8787";
    delete process.env.SCHOLOMANCE_DICT_API_URL;

    expect(ScholomanceDictionaryAPI.getBaseUrl()).toBe("http://127.0.0.1:8787/api/lexicon");
  });

  it("preserves an explicit lexicon path", () => {
    process.env.VITE_SCHOLOMANCE_DICT_API_URL = "http://127.0.0.1:8787/api/lexicon/";
    delete process.env.SCHOLOMANCE_DICT_API_URL;

    expect(ScholomanceDictionaryAPI.getBaseUrl()).toBe("http://127.0.0.1:8787/api/lexicon");
  });
});
