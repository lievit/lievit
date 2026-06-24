/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * v-next structural golden for infolist-entry.jte.
 *
 * The partial compiles in the Java world; this harness asserts on the partial SOURCE as text,
 * pinning the full v-next API (label+value slot model, not the old type switch), all variant/
 * size/orientation/state contracts, the a11y requirements, the escaping channels, and CSP
 * cleanliness. The real JTE-compile + render gate is the jte-compile suite (coordinator-run);
 * these structural checks mirror what that gate proves on the Node CI path.
 *
 * The spec: planning/v-next/specs/infolist-entry.md
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "infolist-entry.jte"), "utf8");

// ---------------------------------------------------------------------------
// Cross-cutting invariants
// ---------------------------------------------------------------------------
describe("infolist-entry — cross-cutting invariants", () => {
  test("carries the Apache header", () => {
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain('Licensed under the Apache License, Version 2.0 (the "License").');
  });

  test("does NOT import io.lievit (JTE classpath has no io.lievit on the gate)", () => {
    expect(src).not.toContain("import io.lievit");
  });

  test("is CSP-clean: no inline <script>, no on* HTML handler", () => {
    expect(src).not.toMatch(/<script/i);
    expect(src).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test("uses only --lv-* token references; no hardcoded hex colour", () => {
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("uses JTE comment syntax (not Java @* *@ block comments)", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/);
  });

  test("no nested --%> inside a doc-comment block (JTE comment nesting is illegal)", () => {
    // The outer doc-comment must close once; look for the section after the first --%> close
    // and confirm no further --%> appears inside a longer outer comment block.
    // Simple heuristic: count --%> occurrences -- legal JTE has one close per open.
    const opens = (src.match(/<%--/g) ?? []).length;
    const closes = (src.match(/--%>/g) ?? []).length;
    expect(opens).toBe(closes);
  });

  test("declares @param cssClass passthrough", () => {
    expect(src).toContain("@param String cssClass");
  });

  test("declares the two escaping channels: trusted attrs + safe dataAttrs", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs");
  });

  test("emits data-slot=infolist-entry on the root", () => {
    expect(src).toContain('data-slot="infolist-entry"');
  });

  test("root is a literal tag name -- no expression in tag name position", () => {
    // Guard against the JTE illegal-tag-name hazard.
    expect(src).not.toMatch(/<\$\{/);
  });

  test("no @if across element open+close split (every @if contains balanced tags)", () => {
    // Heuristic: the root <div> appears in the source without a conditional split
    // (the hard-rule: never open a tag in one branch and close in another).
    expect(src).toMatch(/<div\b[^>]*data-slot="infolist-entry"/);
  });
});

// ---------------------------------------------------------------------------
// @param API contract (v-next spec §2)
// ---------------------------------------------------------------------------
describe("infolist-entry — @param API (v-next spec §2)", () => {
  test("declares label (required, no default)", () => {
    // v-next: label is required (no default); old type/value/icon params are gone.
    expect(src).toContain("@param String label");
    expect(src).not.toContain('@param String label =');
  });

  test("declares variant with default 'default'", () => {
    expect(src).toContain('@param String variant = "default"');
  });

  test("declares size with default 'md'", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares orientation with default 'vertical'", () => {
    expect(src).toContain('@param String orientation = "vertical"');
  });

  test("declares bordered (boolean, default false)", () => {
    expect(src).toContain("@param boolean bordered = false");
  });

  test("declares colon (boolean, default true)", () => {
    expect(src).toContain("@param boolean colon = true");
  });

  test("declares colspan (int, default 1)", () => {
    expect(src).toContain("@param int colspan = 1");
  });

  test("declares empty (String, default em-dash fallback)", () => {
    expect(src).toContain("@param String empty");
  });

  test("declares copyable (boolean, default false)", () => {
    expect(src).toContain("@param boolean copyable = false");
  });

  test("declares loading (boolean, default false)", () => {
    expect(src).toContain("@param boolean loading = false");
  });

  test("declares leading slot (gg.jte.Content, nullable)", () => {
    expect(src).toContain("@param gg.jte.Content leading = null");
  });

  test("declares value slot (gg.jte.Content, nullable)", () => {
    expect(src).toContain("@param gg.jte.Content value = null");
  });

  test("old type-switch API params (type/icon/color/alt/width/height/circular/language/lineNumbers) are gone", () => {
    expect(src).not.toContain('@param String type = "text"');
    expect(src).not.toContain("@param String icon = null");
    expect(src).not.toContain("@param boolean circular = false");
    expect(src).not.toContain("@param String language = null");
    expect(src).not.toContain("@param boolean lineNumbers = false");
  });
});

// ---------------------------------------------------------------------------
// Semantic HTML structure (native <dt>/<dd> description list)
// ---------------------------------------------------------------------------
describe("infolist-entry — semantic structure (<dt>+<dd>, no role override)", () => {
  test("renders a <dt> for the label", () => {
    expect(src).toMatch(/<dt\b/);
    expect(src).toContain('data-slot="infolist-entry-label"');
  });

  test("renders a <dd> for the value region", () => {
    expect(src).toMatch(/<dd\b/);
    expect(src).toContain('data-slot="infolist-entry-value"');
  });

  test("label text inside <dt>; no literal colon in the DOM (colon via CSS only)", () => {
    // The colon is driven by data-colon on the root and CSS ::after -- the spec forbids a
    // literal ":" between the label and value (it would be read by screen readers as punctuation).
    // Test: the label param is rendered as ${label} not "${label}:".
    expect(src).toContain("${label}");
    expect(src).not.toContain('"${label}:"');
    expect(src).not.toContain("${label + ");
  });

  test("data-colon attribute driven by colon param (for CSS ::after toggle)", () => {
    expect(src).toContain('data-colon=');
    // The data-colon value is driven by the colon boolean, not a hardcoded literal.
    // JTE expression: ${colon ? "true" : "false"}
    expect(src).toContain('colon ? "true" : "false"');
  });

  test("data-colspan on root for parent grid consumption", () => {
    expect(src).toContain("data-colspan=");
    expect(src).toContain("${colspan}");
  });

  test("data-orientation on root", () => {
    expect(src).toContain('data-orientation=');
  });

  test("data-size on root", () => {
    expect(src).toContain('data-size=');
  });

  test("data-variant on root", () => {
    expect(src).toContain('data-variant=');
  });

  test("no role override on <dt> or <dd> (native implicit roles are correct)", () => {
    // role override on dt/dd is an anti-pattern listed in spec §8.
    expect(src).not.toMatch(/<dt[^>]+role=/);
    expect(src).not.toMatch(/<dd[^>]+role=/);
  });
});

// ---------------------------------------------------------------------------
// Variants (spec §3: value-region ink + tint background)
// ---------------------------------------------------------------------------
describe("infolist-entry — variants (spec §3)", () => {
  test("default variant uses --lv-color-fg as value ink", () => {
    expect(src).toContain("var(--lv-color-fg)");
  });

  test("highlight variant uses --lv-color-primary as value ink", () => {
    expect(src).toContain("var(--lv-color-primary)");
  });

  test("destructive variant uses --lv-color-destructive as value ink", () => {
    expect(src).toContain("var(--lv-color-destructive)");
  });

  test("success variant uses --lv-color-success as value ink", () => {
    expect(src).toContain("var(--lv-color-success)");
  });

  test("warning variant uses --lv-color-warning as value ink", () => {
    expect(src).toContain("var(--lv-color-warning)");
  });

  test("label (<dt>) stays muted in all variants (--lv-color-muted not conditional)", () => {
    // The muted token must be unconditionally applied to <dt>, not inside a variant switch.
    expect(src).toContain("var(--lv-color-muted)");
  });

  test("tinted background applied to non-default variants via color-mix", () => {
    // color-mix is the pattern used (same as alert.jte) to produce an 8% tint without a new token.
    expect(src).toContain("color-mix(in srgb,");
  });
});

// ---------------------------------------------------------------------------
// Sizes (spec §3: label font, value font, padding-y)
// ---------------------------------------------------------------------------
describe("infolist-entry — sizes (spec §3)", () => {
  test("sm: --lv-text-xs label, --lv-text-sm value, --lv-space-1 padding-y", () => {
    expect(src).toContain("var(--lv-text-xs)");
    expect(src).toContain("var(--lv-text-sm)");
    expect(src).toContain("var(--lv-space-1)");
  });

  test("md: --lv-text-sm label, --lv-text-base value, --lv-space-2 padding-y", () => {
    expect(src).toContain("var(--lv-text-base)");
    expect(src).toContain("var(--lv-space-2)");
  });

  test("lg: --lv-text-sm label, --lv-text-lg value, --lv-space-3 padding-y", () => {
    expect(src).toContain("var(--lv-text-lg)");
    expect(src).toContain("var(--lv-space-3)");
  });
});

// ---------------------------------------------------------------------------
// Orientation (spec §3: vertical vs horizontal)
// ---------------------------------------------------------------------------
describe("infolist-entry — orientation (spec §3)", () => {
  test("orientation is data-attributed on the root", () => {
    expect(src).toContain('data-orientation=');
    expect(src).toContain('"horizontal"');
    expect(src).toContain('"vertical"');
  });

  test("horizontal orientation sets a label-column width via --lv-infolist-label-w", () => {
    // The layout custom property (defaulting to 8rem) is the adopter's override seam.
    expect(src).toContain("--lv-infolist-label-w");
    expect(src).toContain("8rem");
  });
});

// ---------------------------------------------------------------------------
// Bordered (spec §3: --lv-color-border ring)
// ---------------------------------------------------------------------------
describe("infolist-entry — bordered (spec §3)", () => {
  test("bordered uses --lv-color-border for the cell ring", () => {
    expect(src).toContain("var(--lv-color-border)");
  });

  test("bordered uses --lv-radius-sm on the ring", () => {
    expect(src).toContain("var(--lv-radius-sm)");
  });
});

// ---------------------------------------------------------------------------
// Loading state (spec §3: skeleton pulse + aria-busy)
// ---------------------------------------------------------------------------
describe("infolist-entry — loading state (spec §3 + a11y §4)", () => {
  test("loading=true emits aria-busy='true' on root via conditional expression", () => {
    expect(src).toContain('aria-busy=');
    expect(src).toContain('"true"');
    // Smart attribute: aria-busy is null when not loading (JTE omits the attribute).
    expect(src).toContain('loading ? "true" : null');
  });

  test("loading branch emits a skeleton span with role=status aria-label=Loading", () => {
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-label="Loading"');
  });

  test("skeleton uses --lv-skeleton-bg / --lv-skeleton-shimmer tokens (not --lv-color-skeleton)", () => {
    // The existing token is --lv-skeleton-bg (loading-section spec); the proposed --lv-color-skeleton
    // is NOT yet in the token file, so we use --lv-skeleton-bg + --lv-skeleton-shimmer.
    expect(src).toContain("var(--lv-skeleton-bg)");
    expect(src).toContain("var(--lv-skeleton-shimmer)");
  });

  test("skeleton uses lv-skeleton-shimmer @keyframes animation", () => {
    expect(src).toContain("lv-skeleton-shimmer");
  });

  test("skeleton uses --lv-radius-sm for the pulse bar radius", () => {
    expect(src).toContain("var(--lv-radius-sm)");
  });

  test("data-slot=infolist-entry-skeleton on the skeleton span", () => {
    expect(src).toContain('data-slot="infolist-entry-skeleton"');
  });
});

// ---------------------------------------------------------------------------
// Copyable button (spec §3 + a11y §4)
// ---------------------------------------------------------------------------
describe("infolist-entry — copyable button (spec §3 + a11y §4)", () => {
  test("copyable button is a real native <button type='button'>", () => {
    expect(src).toContain('type="button"');
  });

  test("copyable button has aria-label containing the label param (accessible name)", () => {
    // "Copy <label>" is the accessible name contract from spec §4.
    expect(src).toContain('"Copy " + label');
  });

  test("copyable button uses runtime directive data-lievit-action='copy' (no inline JS)", () => {
    expect(src).toContain('data-lievit-action="copy"');
  });

  test("copyable button has data-slot=infolist-entry-copy", () => {
    expect(src).toContain('data-slot="infolist-entry-copy"');
  });

  test("copyable button gets focus-visible ring via --lv-ring", () => {
    expect(src).toContain("var(--lv-ring)");
  });

  test("copy icon: @template.lievit.icon called with ONLY valid params (name, size, cssClass, label)", () => {
    // Guard: icon partial accepts ONLY name/size/cssClass/label. No ariaHidden param exists.
    expect(src).toContain('@template.lievit.icon(name = "copy"');
    expect(src).not.toContain("ariaHidden");
  });
});

// ---------------------------------------------------------------------------
// Leading slot (spec §2 + a11y §4)
// ---------------------------------------------------------------------------
describe("infolist-entry — leading slot (spec §2 + a11y §4)", () => {
  test("leading slot is projected inside <dt>", () => {
    // The leading slot is wrapped in an aria-hidden span (decorative; label text is the name).
    expect(src).toContain("leading != null");
    expect(src).toContain("${leading}");
  });

  test("leading slot wrapper is aria-hidden (decorative icon/avatar)", () => {
    expect(src).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// Value slot and empty fallback (spec §2 + a11y §4)
// ---------------------------------------------------------------------------
describe("infolist-entry — value slot + empty fallback (spec §2)", () => {
  test("value slot is projected inside <dd> when provided", () => {
    expect(src).toContain("value != null");
    expect(src).toContain("${value}");
  });

  test("empty fallback is rendered when value slot is absent", () => {
    expect(src).toContain("${empty}");
  });

  test("data-slot=infolist-entry-empty on the fallback span", () => {
    expect(src).toContain('data-slot="infolist-entry-empty"');
  });

  test("empty fallback uses muted colour (--lv-color-muted)", () => {
    // The fallback is structurally de-emphasised but readable; muted colour signals absence.
    expect(src).toContain("var(--lv-color-muted)");
  });

  test("data-slot=infolist-entry-value-content on the value slot wrapper", () => {
    expect(src).toContain('data-slot="infolist-entry-value-content"');
  });
});

// ---------------------------------------------------------------------------
// Safe escaping channels (spec §2 attrs/dataAttrs + a11y §4)
// ---------------------------------------------------------------------------
describe("infolist-entry — escaping channels (XSS decision rule)", () => {
  test("dataAttrs uses Escape.htmlAttribute per value (SAFE channel)", () => {
    expect(src).toContain("Escape.htmlAttribute");
  });

  test("dataAttrs key filter: only [A-Za-z][A-Za-z0-9-]* keys emitted", () => {
    expect(src).toContain('matches("[A-Za-z][A-Za-z0-9-]*")');
  });

  test("dataAttrs markup emitted via $unsafe (safe because values are already escaped)", () => {
    expect(src).toContain("$unsafe{");
    expect(src).toContain("_dataAttrsMarkup");
  });

  test("attrs emitted via $unsafe (TRUSTED static strings only, documented as such)", () => {
    // The doc-comment must warn that attrs is TRUSTED/STATIC.
    expect(src).toContain("TRUSTED");
    expect(src).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// Usage examples and doc-comment structure (architecture contract §3)
// ---------------------------------------------------------------------------
describe("infolist-entry — doc-comment + usage examples", () => {
  test("doc-comment block is present with TIER, STRUCTURE, A11y, Params, Usage sections", () => {
    expect(src).toContain("TIER:");
    expect(src).toContain("STRUCTURE");
    expect(src).toContain("A11y");
    expect(src).toContain("Params:");
    expect(src).toContain("Usage:");
  });

  test("usage examples use @@ prefix (not @template. directly — doc-comment escaping convention)", () => {
    expect(src).toContain("@@template.lievit.infolist-entry(");
  });

  test("no raw generic type in the doc-comment (Map<String,String> crashes the JTE parser comment)", () => {
    // The doc-comment must write 'Map of String to String' or similar, not a raw <> generic.
    // The @param outside the comment may contain the Java type; check only inside the comment block.
    const docCommentEnd = src.indexOf("--%>");
    const docComment = src.slice(0, docCommentEnd);
    expect(docComment).not.toContain("Map<String,String>");
  });
});
