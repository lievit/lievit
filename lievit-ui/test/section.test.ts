/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * v-next re-forge tests for section.jte.
 *
 * Tests assert on the partial SOURCE as text (the @param API, the data-slot set, the collapsible
 * details/summary branching, the Filament traits, the variant surface, the a11y labelling, the
 * two escaping channels, token-driven styling, and the CSP-clean rules).
 * The real JTE-compile + render gate lives in test/jte-compile.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "section.jte"), "utf8");

// ---- Registration --------------------------------------------------------

describe("section -- registration", () => {
  test("meta.json exists (registers as a registry:jte item)", () => {
    expect(existsSync(join(jteDir, "section", "meta.json")), "meta.json missing").toBe(true);
  });

  test("carries a JTE doc-comment block (not @* *@ syntax)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/);
  });

  test("doc-comment has a Usage: section with @template call example", () => {
    expect(src).toMatch(/Usage:/);
    expect(src).toContain("@@template.lievit.section(");
  });

  test("Apache copyright header is present", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain("Apache License");
  });
});

// ---- @param API ----------------------------------------------------------

describe("section -- @param API", () => {
  test("declares heading, headingId, description, content", () => {
    expect(src).toContain("@param String heading = null");
    expect(src).toContain("@param String headingId");
    expect(src).toContain("@param gg.jte.Content description = null");
    expect(src).toContain("@param gg.jte.Content content");
  });

  test("declares aside Content slot", () => {
    expect(src).toContain("@param gg.jte.Content aside = null");
  });

  test("declares the four Filament boolean traits", () => {
    expect(src).toContain("@param boolean collapsible = false");
    expect(src).toContain("@param boolean collapsed = false");
    expect(src).toContain("@param boolean compact = false");
    expect(src).toContain("@param boolean divided = false");
  });

  test("declares variant param (v-next addition)", () => {
    expect(src).toContain('@param String variant = "default"');
  });

  test("declares cssClass and the two escaping channels", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });
});

// ---- data-slot anatomy ---------------------------------------------------

describe("section -- data-slot anatomy", () => {
  test("root carries data-slot=section", () => {
    expect(src).toContain('data-slot="section"');
  });

  test("root carries data-variant", () => {
    expect(src).toContain('data-variant="${variant}"');
  });

  test("header region carries data-slot=section-header", () => {
    expect(src).toContain('data-slot="section-header"');
  });

  test("title span carries data-slot=section-title", () => {
    expect(src).toContain('data-slot="section-title"');
  });

  test("description span carries data-slot=section-description", () => {
    expect(src).toContain('data-slot="section-description"');
  });

  test("content region carries data-slot=section-content", () => {
    expect(src).toContain('data-slot="section-content"');
  });
});

// ---- Collapsible (native details/summary) --------------------------------

describe("section -- collapsible native details/summary", () => {
  test("asExpander flag: collapsible AND aside==null", () => {
    expect(src).toContain("var asExpander = collapsible && aside == null;");
  });

  test("startOpen flag is !collapsed", () => {
    expect(src).toContain("var startOpen = !collapsed;");
  });

  test("collapsible path renders a <details> element", () => {
    expect(src).toContain("<details");
  });

  test("details carries open attribute driven by startOpen (server fact)", () => {
    expect(src).toContain('open="${startOpen}"');
  });

  test("collapsible path renders a <summary> element (platform-native disclosure)", () => {
    expect(src).toContain("<summary");
  });

  test("chevron span carries lv-section-chevron class for the adopter CSS opt-in", () => {
    expect(src).toContain("lv-section-chevron");
  });

  test("chevron is aria-hidden (decorative; disclosure state is on the summary)", () => {
    // the chevron span must be aria-hidden
    expect(src).toMatch(/aria-hidden="true"[\s\S]*?lv-section-chevron|lv-section-chevron[\s\S]*?aria-hidden="true"/);
  });

  test("non-collapsible path renders a <section> element", () => {
    expect(src).toContain("<section");
  });
});

// ---- Filament traits -----------------------------------------------------

describe("section -- Filament traits (server-pure)", () => {
  test("compact maps to --lv-space-3; not-compact maps to --lv-space-4", () => {
    expect(src).toContain('var pad = compact ? "var(--lv-space-3)" : "var(--lv-space-4)";');
  });

  test("divided adds a border-top between header and body", () => {
    expect(src).toContain("border-top:1px solid var(--lv-color-border)");
    expect(src).toContain("var contentBorderTop = divided ?");
  });

  test("aside triggers a two-column grid layout (side rail)", () => {
    expect(src).toContain("display:grid;grid-template-columns:minmax(12rem");
  });
});

// ---- Variant surface (v-next addition) -----------------------------------

describe("section -- variant token mapping", () => {
  test("default variant uses --lv-color-card background", () => {
    expect(src).toContain("var(--lv-color-card)");
  });

  test("elevated variant uses --lv-color-popover background", () => {
    expect(src).toContain("var(--lv-color-popover)");
  });

  test("elevated variant uses --lv-shadow-md", () => {
    expect(src).toContain("var(--lv-shadow-md)");
  });

  test("ghost variant emits no border and no shadow", () => {
    expect(src).toMatch(/case "ghost"\s*->\s*"none"/);
  });

  test("outlined variant emits --lv-color-border border", () => {
    expect(src).toMatch(/case "outlined"\s*->\s*"1px solid var\(--lv-color-border\)"/);
  });
});

// ---- Token fidelity ------------------------------------------------------

describe("section -- token fidelity", () => {
  test("reads --lv-color-card-fg for foreground", () => {
    expect(src).toContain("var(--lv-color-card-fg)");
  });

  test("reads --lv-radius-lg for corner radius (v-next: was radius-xl)", () => {
    expect(src).toContain("var(--lv-radius-lg)");
  });

  test("reads --lv-color-border for dividers", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("reads --lv-color-muted-fg for description text", () => {
    expect(src).toContain("var(--lv-color-muted-fg)");
  });

  test("reads --lv-font-sans for font-family", () => {
    expect(src).toContain("var(--lv-font-sans)");
  });

  test("reads --lv-font-medium for title font-weight", () => {
    expect(src).toContain("var(--lv-font-medium)");
  });

  test("no hardcoded hex colours (outside comment blocks)", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup, "hardcoded hex in template body").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---- a11y ----------------------------------------------------------------

describe("section -- a11y labelling", () => {
  test("hasTitle computed from heading", () => {
    expect(src).toContain("var hasTitle = heading != null && !heading.isBlank();");
  });

  test("aria-labelledby wired to headingId when hasTitle is true", () => {
    expect(src).toContain('aria-labelledby="${hasTitle ? headingId : null}"');
  });

  test("section-title span carries the headingId as id", () => {
    expect(src).toContain('id="${headingId}"');
  });
});

// ---- Escaping channels + safe data-* ------------------------------------

describe("section -- escaping channels (v-next addition)", () => {
  test("dataAttrs built via StringOutput + Escape.htmlAttribute (safe channel)", () => {
    expect(src).toContain("import gg.jte.output.StringOutput");
    expect(src).toContain("import gg.jte.html.escape.Escape");
    expect(src).toContain("Escape.htmlAttribute(");
    expect(src).toContain("$unsafe{_daMarkup}");
  });

  test("attrs emitted via $unsafe (trusted raw channel)", () => {
    expect(src).toContain("$unsafe{attrs}");
    expect(src).toContain("TRUSTED raw");
  });

  test("data-* key guard: only [A-Za-z][A-Za-z0-9-]* keys pass", () => {
    expect(src).toContain('.matches("[A-Za-z][A-Za-z0-9-]*")');
  });
});

// ---- CSP-clean -----------------------------------------------------------

describe("section -- CSP-clean + JTE hygiene", () => {
  test("no inline <script> tag", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<script/i);
  });

  test("no <style> block", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<style[\s>]/i);
  });

  test("no inline on* handlers", () => {
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("no dev.lievit import (JTE-compile gate classpath rule)", () => {
    expect(src).not.toMatch(/import dev\.lievit\./);
  });

  test("no nested JTE comment closes in doc-comment", () => {
    const commentBlock = src.match(/<%--[\s\S]*?--%>/)?.[0] ?? "";
    const innerCloses = (commentBlock.slice(4, -4).match(/--%>/g) ?? []).length;
    expect(innerCloses, "nested --%> inside doc-comment block").toBe(0);
  });
});
