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
  test("iterates the ordered pair map into rows (v-next: no data-key attr; key rendered as td text)", () => {
    // v-next: the row no longer emits a data-key attribute on the <tr>; the key is rendered as
    // the first <td> text content via ${pair.getKey()}. The row is identified by data-slot=key-value-row.
    expect(src).toContain("@param Map<String, String> pairs");
    expect(src).toContain("@for(Map.Entry<String, String> pair : pairs.entrySet())");
    expect(src).toContain('data-slot="key-value-row"');
    expect(src).toContain("${pair.getKey()}");
    expect(src).toContain("${pair.getValue()}");
    // old data-key attr on the <tr> is gone (key is the cell content, not a data attribute)
    expect(src).not.toContain('data-key="${pair.getKey()}"');
  });
  test("exposes configurable column header labels", () => {
    expect(src).toContain('@param String keyLabel = "Key"');
    expect(src).toContain('@param String valueLabel = "Value"');
  });
});

describe("loading-section — unified loading state component (v-next re-forge)", () => {
  const src = read("loading-section.jte");
  test("is a live region announcing the loading state; data-slot=loading-section present in all modes", () => {
    expect(src).toContain('data-slot="loading-section"');
    expect(src).toContain('role="status"');
    // spinner + skeleton modes emit aria-live=polite; section mode emits aria-busy=true on role=region
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-busy="true"');
  });
  test("inlines the SVG spinner ring directly (self-contained; no @template.lievit.spinner cross-call)", () => {
    // v-next: loading-section is SELF-CONTAINED: the SVG ring is inlined in both spinner mode
    // and section-overlay mode. The old @template.lievit.spinner composition is gone (avoids
    // circular-reference risk + keeps the file deployable as a single file).
    // The standalone spinner.jte is still available; this partial intentionally duplicates the ring.
    expect(src).toContain("stroke-dasharray");
    expect(src).toContain("stroke-dashoffset");
    expect(src).toContain("lv-spinner__ring");
    // no cross-partial call to spinner (self-contained by design)
    expect(src).not.toContain("@template.lievit.spinner(");
    expect(src).not.toMatch(/<script/i);
  });
  test("mode=section: optional visible tip gated by showTip param (v-next replaces caption=true)", () => {
    // v-next: OLD @param boolean caption=true / @if(caption) / data-slot=loading-section-caption
    // → NEW @param boolean showTip=false / @if(showTip) / data-slot=loading-section-tip (section mode).
    expect(src).toContain("@param boolean showTip = false");
    expect(src).toContain("@if(showTip)");
    expect(src).toContain('data-slot="loading-section-tip"');
    // old caption API is gone
    expect(src).not.toContain("@param boolean caption");
    expect(src).not.toContain('data-slot="loading-section-caption"');
  });
  test("mode param selects the loading variant (spinner/skeleton/section); minHeight replaced by mode=section overlay", () => {
    // v-next: OLD minHeight param (reserved fixed height) → REMOVED (section mode overlays the
    // existing content slot instead of reserving empty space; spinner/skeleton modes are inline).
    expect(src).toContain('@param String mode = "spinner"');
    expect(src).toContain('"skeleton".equals(mode)');
    // old minHeight param is gone (no fixed-height reservation in v-next)
    expect(src).not.toContain("@param String minHeight");
    expect(src).not.toContain("min-height: ${minHeight}");
  });
});
