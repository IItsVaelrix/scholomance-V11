import { z } from "zod";

export function configureZodForCsp() {
  // Disable Zod JIT schema compilation in the browser to remain CSP-compatible.
  z.config({ jitless: true });
}

configureZodForCsp();
