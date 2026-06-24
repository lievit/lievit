/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * separator.jte -- full structural + a11y contract (spec §7).
 *
 * The separator is a static JTE partial compiled in the Java world. This suite asserts
 * on the PARTIAL SOURCE as text. It pins: the param API, the three render paths
 * (horizontal <hr>, vertical <hr>, label variant <div>), the variant/orientation
 * data-slot topology, the a11y wiring (aria-orientation, role derivation, label
 * accessible name, decorative erasure), token-driven styling (no bare hex, all --lv-*),
 * the labelPosition flex-ratio control, XSS safety for the label channel (JTE auto-
 * escaping via ${}), the trusted-raw attrs channel, and CSP hygiene.
 *
 * A real-compiler smoke lives in test/jte-compile. This is the equivalent structural
 * golden; together they form the acceptance gate (spec §7).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "separator.jte"), "utf8");

// Strip JTE comments so assertions do not hit doc-comment prose.
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API (spec §2)
// ---------------------------------------------------------------------------
describe("separator -- param API", () => {
  test("declares orientation param with default horizontal", () => {
    expect(src).toContain('@param String orientation = "horizontal"');
  });

  test("declares variant param with default default", () => {
    expect(src).toContain('@param String variant = "default"');
  });

  test("declares decorative boolean param with default false (semantic by default, spec §3)", () => {
    expect(src).toContain("@param boolean decorative = false");
  });

  test("declares label String param with default null", () => {
    expect(src).toContain("@param String label = null");
  });

  test("declares labelPosition param with default center", () => {
    expect(src).toContain('@param String labelPosition = "center"');
  });

  test("declares cssClass param with default empty string", () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test("declares attrs param with default empty string (trusted raw channel)", () => {
    expect(src).toContain('@param String attrs = ""');
  });

  test("no Content or slot params (spec §2: no children, label is a typed String)", () => {
    expect(src).not.toContain("gg.jte.Content");
  });

  test("no size param (spec §3: separator has no size axis)", () => {
    expect(src).not.toMatch(/@param String size/);
  });

  test("usage doc carries @@template.lievit.separator call syntax", () => {
    expect(src).toContain("@@template.lievit.separator(");
  });
});

// ---------------------------------------------------------------------------
// Horizontal <hr> render path (spec §6)
// ---------------------------------------------------------------------------
describe("separator -- horizontal hr render path", () => {
  test("horizontal path renders an <hr> element (not a <div>)", () => {
    // The horizontal branch: <hr ... class="block w-full border-0 border-t
    expect(markup).toMatch(/<hr[\s\S]*?data-orientation="\$\{orientation\}"[\s\S]*?\/>|<hr[\s\S]*?data-orientation="horizontal"[\s\S]*?\/>/);
  });

  test("horizontal hr carries data-slot=separator", () => {
    expect(markup).toContain('data-slot="separator"');
  });

  test("horizontal hr carries data-orientation=horizontal (literal, since the @else branch is horizontal-only)", () => {
    // In the @else branch we statically know it is horizontal; the attribute is hardcoded.
    expect(markup).toContain('data-orientation="horizontal"');
  });

  test("horizontal hr carries data-variant set from variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("horizontal hr carries data-decorative set from decorative param", () => {
    expect(markup).toContain('data-decorative="${decorative}"');
  });

  test("horizontal hr emits aria-orientation=horizontal via smart attribute (null when decorative)", () => {
    // JTE source uses literal double-quotes inside ${}: aria-orientation="${decorative ? null : "horizontal"}"
    // JTE drops null attributes, so decorative=true omits aria-orientation entirely.
    expect(markup).toContain('aria-orientation="${decorative ? null : "horizontal"}"');
  });

  test("horizontal hr uses border-t (top border) as the stroke, not bg fill", () => {
    expect(markup).toContain("border-t");
    // Must NOT use the old bg-[var(--lv-color-border)] approach
    expect(markup).not.toContain("bg-[var(--lv-color-border)]");
  });

  test("horizontal hr uses w-full for full-width layout", () => {
    expect(markup).toContain("w-full");
  });

  test("horizontal hr reads --lv-color-border for the stroke colour", () => {
    expect(markup).toContain("var(--lv-color-border)");
  });

  test("horizontal hr reads --lv-border-width for the stroke thickness", () => {
    expect(markup).toContain("var(--lv-border-width");
  });

  test("horizontal hr reads --lv-space-4 for the block margin (my)", () => {
    expect(markup).toContain("my-[var(--lv-space-4)]");
  });
});

// ---------------------------------------------------------------------------
// Vertical <hr> render path (spec §3)
// ---------------------------------------------------------------------------
describe("separator -- vertical hr render path", () => {
  test("vertical path renders an <hr> with border-l (left border) as the stroke", () => {
    expect(markup).toContain("border-l");
  });

  test("vertical hr carries aria-orientation=vertical via smart attribute", () => {
    // JTE source literal: aria-orientation="${decorative ? null : "vertical"}"
    expect(markup).toContain('aria-orientation="${decorative ? null : "vertical"}"');
  });

  test("vertical hr carries self-stretch for full-height in a flex row", () => {
    expect(markup).toContain("self-stretch");
  });

  test("vertical hr reads --lv-space-2 for the inline margin (mx)", () => {
    expect(markup).toContain("mx-[var(--lv-space-2)]");
  });

  test("vertical hr is rendered with isVertical guard (not the label branch)", () => {
    expect(src).toContain("!{var isVertical = \"vertical\".equals(orientation);}");
  });
});

// ---------------------------------------------------------------------------
// Decorative role erasure (spec §3 + spec §4)
// ---------------------------------------------------------------------------
describe("separator -- decorative mode", () => {
  test("decorative=true emits role=presentation via smart attribute", () => {
    // JTE smart attribute: null drops the attribute; literal form in source:
    // role="${decorative ? "presentation" : null}"
    expect(markup).toContain('role="${decorative ? "presentation" : null}"');
  });

  test("decorative hr omits aria-orientation via smart attribute (null when decorative)", () => {
    // aria-orientation is null when decorative; JTE drops null attributes (spec §4)
    expect(markup).toContain("${decorative ? null");
  });

  test("no tabindex anywhere (separator is never focusable, spec §4)", () => {
    expect(markup).not.toContain("tabindex");
  });

  test("no aria-valuenow / aria-valuemin / aria-valuemax (those belong on resizable-panes only)", () => {
    expect(markup).not.toContain("aria-valuenow");
    expect(markup).not.toContain("aria-valuemin");
    expect(markup).not.toContain("aria-valuemax");
  });
});

// ---------------------------------------------------------------------------
// Variant classes (spec §3)
// ---------------------------------------------------------------------------
describe("separator -- variant stroke classes", () => {
  test("variant switch maps default to border-solid", () => {
    expect(src).toContain('"border-solid"');
    expect(src).toContain('default       -> "border-solid"');
  });

  test("variant switch maps dashed to border-dashed", () => {
    expect(src).toContain('"border-dashed"');
    expect(src).toContain('"dashed" -> "border-dashed"');
  });

  test("variant switch maps dotted to border-dotted", () => {
    expect(src).toContain('"border-dotted"');
    expect(src).toContain('"dotted" -> "border-dotted"');
  });

  test("variantClass variable is used in the template markup (border classes come from it)", () => {
    expect(markup).toContain("${variantClass}");
  });

  test("no hardcoded border-style property bypassing the variantClass switch", () => {
    // All border-style handling goes through variantClass; no literal border-style in markup.
    expect(markup).not.toContain("border-style:");
  });
});

// ---------------------------------------------------------------------------
// Label variant: flex [line][text][line] (spec §3 + spec §6)
// ---------------------------------------------------------------------------
describe("separator -- label variant", () => {
  test("label variant uses a <div> container (not <hr>), because <hr> is void", () => {
    // The hasLabel branch renders <div ... role="separator"...>
    expect(markup).toContain("<div");
    expect(src).toContain("!{var hasLabel = label != null && !isVertical;}");
  });

  test("label variant container carries role=separator (explicit, since it is not an <hr>)", () => {
    // role="${decorative ? "presentation" : "separator"}" on the <div>
    expect(markup).toContain('"separator"');
  });

  test("label variant container carries aria-orientation=horizontal", () => {
    // The label variant is horizontal-only; it emits aria-orientation="horizontal" via smart attr.
    // JTE source literal: aria-orientation="${decorative ? null : "horizontal"}"
    expect(markup).toContain('aria-orientation="${decorative ? null : "horizontal"}"');
  });

  test("label variant container carries aria-label set to the label param (accessible name)", () => {
    expect(markup).toContain('aria-label="${decorative ? null : label}"');
  });

  test("label text is rendered via ${label} (JTE auto-escaped -- XSS safety, spec §7.1)", () => {
    // JTE auto-escaping: ${label} in HTML context is escaped; no $unsafe on the label value.
    expect(markup).toContain("${label}");
    // Confirm the label text span never uses $unsafe.
    const labelSpanIdx = markup.lastIndexOf("${label}");
    const surroundingSlice = markup.slice(Math.max(0, labelSpanIdx - 200), labelSpanIdx + 20);
    expect(surroundingSlice).not.toContain("$unsafe");
  });

  test("two flanking <span aria-hidden=true> elements flank the label text", () => {
    // Both flanking spans carry aria-hidden="true" (decorative lines, spec §6).
    const ariaHiddenSpans = (markup.match(/<span[^>]*aria-hidden="true"[^>]*>/g) ?? []);
    expect(
      ariaHiddenSpans.length,
      "expected at least two aria-hidden=true spans (the two flanking lines in the label variant)",
    ).toBeGreaterThanOrEqual(2);
  });

  test("label variant reads --lv-space-3 for the gap between line and label text", () => {
    expect(markup).toContain("var(--lv-space-3)");
  });

  test("label variant reads --lv-text-sm for the label text size", () => {
    expect(markup).toContain("var(--lv-text-sm)");
  });

  test("label variant reads --lv-color-muted for the label text colour", () => {
    expect(markup).toContain("var(--lv-color-muted)");
  });

  test("label variant reads --lv-font-sans for the label font family", () => {
    expect(markup).toContain("var(--lv-font-sans)");
  });

  test("label variant reads --lv-space-4 for the block margin (my)", () => {
    // The label <div> carries the same my-[var(--lv-space-4)] as the plain <hr>.
    expect(markup).toContain("my-[var(--lv-space-4)]");
  });

  test("label variant is guarded by hasLabel (label non-null and orientation not vertical)", () => {
    expect(src).toContain("@if(hasLabel)");
  });
});

// ---------------------------------------------------------------------------
// labelPosition flex-ratio control (spec §3)
// ---------------------------------------------------------------------------
describe("separator -- labelPosition", () => {
  test("left position hides the left flanking line (hidden class or zero flex)", () => {
    // leftClass = "hidden" when labelPosition=left
    expect(src).toContain('"left".equals(labelPosition) ? "hidden"');
  });

  test("right position hides the right flanking line (hidden class or zero flex)", () => {
    // rightClass = "hidden" when labelPosition=right
    expect(src).toContain('"right".equals(labelPosition) ? "hidden"');
  });

  test("center (default) gives both flanking spans flex-1", () => {
    // When neither left nor right, both leftClass and rightClass include flex-1.
    expect(src).toContain('"flex-1 border-t "');
  });

  test("leftClass variable is used in the left flanking span", () => {
    expect(markup).toContain("${leftClass}");
  });

  test("rightClass variable is used in the right flanking span", () => {
    expect(markup).toContain("${rightClass}");
  });
});

// ---------------------------------------------------------------------------
// data-slot topology (spec §6)
// ---------------------------------------------------------------------------
describe("separator -- data-slot topology", () => {
  test('root element always carries data-slot="separator"', () => {
    expect(markup).toContain('data-slot="separator"');
  });

  test("root always carries data-orientation from the orientation param", () => {
    // Three branches: horizontal <hr>, vertical <hr>, label <div>. All carry data-orientation.
    const count = (markup.match(/data-orientation=/g) ?? []).length;
    expect(count, "data-orientation must appear on every branch (3 branches)").toBeGreaterThanOrEqual(3);
  });

  test("root always carries data-variant from the variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("root always carries data-decorative from the decorative param", () => {
    expect(markup).toContain('data-decorative="${decorative}"');
  });
});

// ---------------------------------------------------------------------------
// cssClass + attrs forwarding (spec §2)
// ---------------------------------------------------------------------------
describe("separator -- cssClass and attrs forwarding", () => {
  test("cssClass is forwarded to the root element on the horizontal <hr>", () => {
    expect(markup).toContain("${cssClass}");
  });

  test("attrs is forwarded via $unsafe (trusted raw channel, static author-typed only)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });

  test("only one $unsafe sink: the trusted attrs channel (no other unsafe emission)", () => {
    // The label param goes through ${label} (JTE auto-escaped), not $unsafe.
    // The only $unsafe in markup should be attrs.
    const unsafeSinks = markup.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(unsafeSinks).toEqual(["$unsafe{attrs}", "$unsafe{attrs}", "$unsafe{attrs}"]);
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: no bare hex (spec §5 + architecture contract §4)
// ---------------------------------------------------------------------------
describe("separator -- token-driven styling", () => {
  test("no bare hex colour literals in the markup", () => {
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("no literal border-color colour values (all from --lv-color-border token)", () => {
    // Every border-color value must reference var(--lv-color-border).
    const borderColorValues = markup.match(/border-color:\s*(?!var\(--lv)/g) ?? [];
    expect(borderColorValues, "hardcoded border-color found").toEqual([]);
  });

  test("no hardcoded h-px or bg approach for the line (must use border-t / border-l)", () => {
    expect(markup).not.toContain("h-px");
    expect(markup).not.toContain("bg-[var(--lv-color-border)]");
  });

  test("io.lievit is never imported (JTE-compile-gate classpath rule)", () => {
    expect(src).not.toContain("@import io.lievit");
  });
});

// ---------------------------------------------------------------------------
// Security + CSP hygiene (spec §6 + architecture contract §3)
// ---------------------------------------------------------------------------
describe("separator -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("JTE comment syntax <%-- --%> used (not @* *@)", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });

  test("no nested --%> inside the doc-comment block (would close the comment early)", () => {
    // Locate the outer doc-comment block and confirm its content doesn't contain --%>
    const commentMatch = src.match(/<%--[\s\S]*?--%>/);
    if (commentMatch) {
      const inner = commentMatch[0].slice(4, -3); // strip outer <%-- and --%>
      expect(inner).not.toContain("--%>");
    }
  });

  test("no @if(...) in attribute name position (smart attributes used instead)", () => {
    // The hard JTE rule: @if inside an HTML attribute NAME is illegal.
    // All conditional attributes use smart-attribute ${cond ? value : null} form.
    expect(src).not.toMatch(/\s@if\([^)]*\)\s*\w+=/);
  });
});

// ---------------------------------------------------------------------------
// No JS / no enhancer / no wire surface (spec §6)
// ---------------------------------------------------------------------------
describe("separator -- no JS no wire surface", () => {
  test("no l: wire directives (separator is fully static)", () => {
    expect(markup).not.toContain("l:click");
    expect(markup).not.toContain("l:submit");
    expect(markup).not.toContain("l:model");
  });

  test("no data-lievit-component attribute (not a wire component)", () => {
    expect(markup).not.toContain("data-lievit-component");
  });

  test("no @import io.lievit anywhere (presentation-only, no Java domain objects)", () => {
    expect(src).not.toContain("@import io.lievit");
  });
});
