/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Structural golden for the bk-display reconcile primitives: key-value (the read-only two-column
 * table Filament's KeyValueEntry needs, the lievit-ui gap the kit infolist was composing inline) and
 * loading-section (the Filament loading-section equivalent: a centred spinner + caption region,
 * which lievit-ui lacked despite shipping the bare spinner).
 *
 * As with the other JTE suites these partials compile in the Java world, so the harness asserts on
 * the partial SOURCE as text: the data-slot, the WAI-ARIA semantics, token-driven styling (every
 * colour/space/radius reads a --lv-* var, never a literal hex), the Apache header, the declared
 * @param API, the composition (loading-section composes the spinner), and strict-CSP cleanliness.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

const ALL_SOURCES = ["key-value.jte", "loading-section.jte"] as const;

describe("bk-display primitives: cross-cutting invariants", () => {
  test.each(ALL_SOURCES)("%s carries the Apache header", (rel) => {
    const src = read(rel);
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain('Licensed under the Apache License, Version 2.0 (the "License").');
  });

  test.each(ALL_SOURCES)("%s is token-driven: no hardcoded hex colour", (rel) => {
    expect(read(rel)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test.each(ALL_SOURCES)("%s is CSP-clean: no inline <script> and no on* handler", (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/<script/i);
    expect(src).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test.each(ALL_SOURCES)("%s declares a cssClass passthrough (className parity)", (rel) => {
    expect(read(rel)).toContain("@param String cssClass");
  });

  test.each(ALL_SOURCES)("%s uses the <%-- --%> comment syntax with a Usage doc", (rel) => {
    const src = read(rel);
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/);
    expect(src).toMatch(/Usage:/);
  });
});

describe("key-value — read-only two-column table (Filament KeyValueEntry)", () => {
  const src = read("key-value.jte");
  test("is a real <table> stamped data-slot with thead column headers", () => {
    expect(src).toMatch(/<table\b/);
    expect(src).toContain('data-slot="key-value"');
    expect(src).toContain('data-slot="key-value-key-head"');
    expect(src).toContain('data-slot="key-value-value-head"');
  });
  test("iterates the ordered pair map into rows keyed by the pair key", () => {
    expect(src).toContain("@param Map<String, String> pairs");
    expect(src).toContain("@for(Map.Entry<String, String> pair : pairs.entrySet())");
    expect(src).toContain('data-slot="key-value-row"');
    expect(src).toContain('data-key="${pair.getKey()}"');
  });
  test("exposes configurable column header labels", () => {
    expect(src).toContain('@param String keyLabel = "Key"');
    expect(src).toContain('@param String valueLabel = "Value"');
  });
});

describe("loading-section — centred spinner + caption (Filament loading-section)", () => {
  const src = read("loading-section.jte");
  test("is an aria-busy live region announcing the loading state", () => {
    expect(src).toContain('data-slot="loading-section"');
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-busy="true"');
    expect(src).toContain('aria-live="polite"');
  });
  test("composes the lievit-ui spinner primitive (not a bespoke ring)", () => {
    expect(src).toContain("@template.lievit.spinner(");
    expect(src).not.toMatch(/<script/i);
  });
  test("renders an optional caption gated by the caption flag", () => {
    expect(src).toContain("@param boolean caption = true");
    expect(src).toContain("@if(caption)");
    expect(src).toContain('data-slot="loading-section-caption"');
  });
  test("reserves height so the box does not collapse / jump", () => {
    expect(src).toContain('@param String minHeight = "12rem"');
    expect(src).toContain("min-height: ${minHeight}");
  });
});
