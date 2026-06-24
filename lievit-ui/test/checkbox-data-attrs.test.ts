/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui checkbox.jte -- the SAFE escaped dataAttrs channel. A checkbox in a reactive list (a
 * calendar filter row, a per-row selector) needs a dynamic data-* the wire runtime reads (a filter
 * key, a row id), a value that is DB/user-derived. gest's calendar filter checkboxes routed such a
 * value through a hand-rolled `attrs` $unsafe (XSS surface); this gives them the escaped channel.
 * This focused suite lives in its OWN file (the shared static-partials suite already pins the
 * checkbox's other contracts) and asserts ONLY the dataAttrs delta, mirroring button.jte exactly:
 * the param exists, the value is escaped, keys are allowlisted, and the escaped fragment lands on
 * the native <input>. Source-as-text assertions; the real-compiler golden runs out of band.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "checkbox.jte"), "utf8");

describe("checkbox -- SAFE escaped dataAttrs channel (mirrors button.jte)", () => {
  test("declares the dataAttrs Map param defaulting to an empty map", () => {
    expect(src, "safe dataAttrs param missing").toContain(
      "@param java.util.Map<String, String> dataAttrs = java.util.Map.of()",
    );
  });

  test("imports the StringOutput + the attribute escaper used to build the fragment", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("each VALUE is escaped via Escape.htmlAttribute, never emitted raw", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are validated as simple identifiers (a non-identifier key cannot inject markup)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("the escaped fragment lands on the native <input> control (exactly two $unsafe sinks: dataAttrsMarkup + attrs)", () => {
    // The new checkbox has TWO trusted/$unsafe sinks: `dataAttrsMarkup` (the SAFE escaped channel)
    // and `attrs` (the TRUSTED raw channel for l:model and other static author strings).
    // The model param was REMOVED: l:model now travels via the `attrs` channel, not a dedicated param.
    const unsafeSinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `expected [$unsafe{dataAttrsMarkup}, $unsafe{attrs}], got: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{dataAttrsMarkup}",
      "$unsafe{attrs}",
    ]);
    // Both sinks sit inside the <input ...> open tag.
    expect(src).toMatch(/\$unsafe\{dataAttrsMarkup\}/);
    expect(src).toMatch(/\$unsafe\{attrs\}/);
  });

  test("usage doc shows a reactive-list filter checkbox carrying a SAFE escaped key", () => {
    expect(src).toContain("dataAttrs = java.util.Map.of(");
  });

  test("still no inline on* handler on the native control (CSP-clean, FORM_CONTROLS rule)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});
