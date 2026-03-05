import { describe, expect, it } from "vitest";
import { z } from "zod";
import { configureZodForCsp } from "../../src/lib/config/zod.config.js";

describe("zod.config bootstrap", () => {
  it("forces jitless mode for CSP-safe parsing", () => {
    z.config({ jitless: false });
    configureZodForCsp();
    expect(z.config().jitless).toBe(true);
  });
});

