/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";
// All disclosure / toggle primitives are now server-first (ADR-0012); this file no longer mounts a
// Lit island. Where the behaviour lives now:
//   - collapsible  -> WIRE (Wave 0): registry/wire/collapsible; tests in test/wire-collapsible.test.ts
//     (registry resolution) + lievit-kit CollapsibleComponentIT (render + server state).
//   - toggle       -> JTE partial (Wave 1b); tests in test/jte-static-partials.test.ts.
//   - accordion    -> WIRE (Wave 2): registry/wire/accordion; tests in test/wire-disclosure.test.ts
//     + lievit-kit AccordionComponentIT (open-set transition + per-item aria-expanded/hidden render).
//   - tabs         -> WIRE (Wave 2): registry/wire/tabs; tests in test/wire-disclosure.test.ts +
//     lievit-kit TabsComponentIT (active-tab transition + only-active-panel render).
//   - toggle-group -> WIRE (Wave 2): registry/wire/toggle-group; tests in test/wire-disclosure.test.ts
//     + lievit-kit ToggleGroupComponentIT (selected-set transition + Radix radio/aria-checked render).
// The render-asserting tests run through the REAL lievit runtime (the slot-bug lesson: assert the
// rendered DOM, not client structure).

const registryRoot = join(import.meta.dirname, "..", "registry");

describe("disclosure primitives are server-first (no Lit island)", () => {
  test("the accordion / tabs / toggle-group Lit island trees no longer exist", () => {
    // The island dirs are gone, the wire components (Java + JTE) are the only form. The structural
    // backstop for the ADR-0012 Wave 2 purge.
    for (const name of ["accordion", "tabs", "toggle-group"]) {
      expect(existsSync(join(registryRoot, "components", name)), `island ${name} removed`).toBe(false);
      expect(existsSync(join(registryRoot, "wire", name)), `wire ${name} present`).toBe(true);
    }
  });
});
