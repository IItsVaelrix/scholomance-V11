// @vitest-environment node

import { beforeAll, describe, expect, it } from "vitest";
import { CmuPhonemeEngine } from "../../src/lib/phonology/cmu.phoneme.engine.js";
import { PhonemeEngine } from "../../src/lib/phonology/phoneme.engine.js";

describe("CMUDICT integration", () => {
  beforeAll(async () => {
    await CmuPhonemeEngine.init();
    await PhonemeEngine.init();
  });

  it("loads CMUDICT in node runtime", () => {
    expect(CmuPhonemeEngine.isAvailable()).toBe(true);
  });

  it("returns authoritative CMU pronunciations for irregular words", () => {
    const result = CmuPhonemeEngine.analyzeWord("colonel");

    expect(result).toBeTruthy();
    expect(result.phonemes).toEqual(["K", "ER1", "N", "AH0", "L"]);
    expect(result.vowelFamily).toBe("IH");
  });

  it('uses CMU output through the main phoneme engine', () => {
    const result = PhonemeEngine.analyzeWord('kernel');
    expect(result).toBeTruthy();
    expect(result.phonemes).toEqual(["K", "ER1", "N", "AH0", "L"]);
    expect(result.rhymeKey).toBe("IH-L");
  });
});
