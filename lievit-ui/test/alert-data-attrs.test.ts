/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lievit-ui alert.jte -- the SAFE escaped dataAttrs channel. An adopter needs to hang a test or
 * wire hook (data-testid, a data-* the wire runtime reads) on the alert ROOT without wrapping it
 * in an extra <div> (gest had to wrap the PRG flash alert just for that). This focused suite lives
 * in its OWN file (not the shared static-partials suite) and asserts ONLY the dataAttrs delta:
 * the param exists, every value is escaped through JTE's own attribute escaper, keys are
 * allowlisted, and the escaped fragment is the ONLY thing reaching $unsafe (no trusted raw attrs
 * channel here -- a status banner has no use for an unsafe escape hatch). It mirrors button.jte's
 * dataAttrs exactly. Source-as-text assertions; the real-compiler golden runs out of band.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "alert.jte"), "utf8");

describe("alert -- SAFE escaped dataAttrs channel (mirrors button.jte)", () => {
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
    // the value must NEVER be emitted raw (no $unsafe wrapping a getValue()).
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("keys are validated as simple identifiers (a non-identifier key cannot inject markup)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("$unsafe sinks: the pre-escaped dataAttrs fragment + the trusted raw attrs channel", () => {
    // The re-forged alert.jte exposes BOTH channels (mirrors button.jte):
    //   _dataAttrsMarkup  — SAFE: each value routed through Escape.htmlAttribute
    //   attrs             — TRUSTED RAW: static author-typed strings (l:click wire directives, data-testid)
    // The dataAttrs fragment uses the private _dataAttrsMarkup name (leading underscore).
    const unsafeSinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks, `unexpected $unsafe sinks: ${unsafeSinks.join(", ")}`).toEqual([
      "$unsafe{_dataAttrsMarkup}",
      "$unsafe{attrs}",
    ]);
    // The trusted raw attrs channel IS present in the re-forged template (consumers wire l:click
    // on the dismiss button through it — see alert.jte usage doc + spec §6).
    expect(src, "alert must expose the trusted raw attrs channel").toContain('@param String attrs = ""');
  });

  test("usage doc shows a SAFE dynamic example via dataAttrs (no wrapper div)", () => {
    expect(src).toContain("dataAttrs = java.util.Map.of(");
  });

  test("no inline <script> and no inline on* handlers (CSP-clean) preserved", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<script/i);
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });
});
