/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * alert.jte -- full structural + a11y contract (spec §7).
 *
 * The alert is a static JTE partial compiled in the Java world, so -- as with every other
 * static-partials suite -- this harness asserts on the PARTIAL SOURCE as text.
 * It pins: the param API, role-by-intent derivation (info/success→status,
 * warning/destructive→alert), role override + "none" suppression, the slot topology
 * (data-slot="alert", alert-body, alert-title, alert-content, alert-action,
 * alert-dismiss"), the closable dismiss button (type="button" + aria-label="Dismiss"),
 * banner mode (border-radius:0 + left stripe), icon presence + aria-hidden contract,
 * token-driven styling (no bare hex, all --lv-* vars), security hygiene (no inline
 * script / on* handler), and the XSS trust split for the dataAttrs + attrs channels.
 * A render/golden in the Java runtime is out of scope for the JS suite; the real-compiler
 * smoke lives in test/jte-compile. This is the equivalent structural golden.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "alert.jte"), "utf8");

// ---------------------------------------------------------------------------
// Strip JTE comments so assertions do not hit doc-comment prose.
// ---------------------------------------------------------------------------
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API
// ---------------------------------------------------------------------------
describe("alert -- param API", () => {
  test("declares all documented params with their documented defaults", () => {
    expect(src).toContain('@param String variant = "info"');
    expect(src).toContain("@param String title = null");
    expect(src).toContain("@param boolean icon = true");
    expect(src).toContain("@param String iconName = null");
    expect(src).toContain("@param boolean closable = false");
    expect(src).toContain("@param boolean banner = false");
    expect(src).toContain("@param String role = null");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content action = null");
  });

  test("usage doc carries the @@template.lievit.alert call syntax (not bare @@template.alert)", () => {
    expect(src).toContain("@@template.lievit.alert(");
  });

  test("usage doc shows all four variants in examples", () => {
    expect(src).toContain('variant = "info"');
    expect(src).toContain('variant = "success"');
    expect(src).toContain('variant = "warning"');
    expect(src).toContain('variant = "destructive"');
  });
});

// ---------------------------------------------------------------------------
// Role derivation by intent (spec §4 + §7)
// ---------------------------------------------------------------------------
describe("alert -- role-by-intent derivation", () => {
  test("info and success map to the POLITE status role (not assertive)", () => {
    // The auto-role logic: warning/destructive → "alert"; everything else → "status".
    // Confirmed by reading the !{var _autoRole = ...} expression.
    expect(src).toContain(
      '("warning".equals(variant) || "destructive".equals(variant)) ? "alert" : "status"',
    );
  });

  test("warning maps to role=alert (assertive, interrupt)", () => {
    // The switch above means only warning+destructive go to "alert"; assert the exact branch.
    expect(src).toMatch(/"warning"\.equals\(variant\).*"alert"/);
  });

  test("destructive maps to role=alert (assertive, interrupt)", () => {
    expect(src).toMatch(/"destructive"\.equals\(variant\).*"alert"/);
  });

  test("the effectiveRole derivation: explicit role param wins over the auto-derived role", () => {
    // _effectiveRole = role param wins if non-blank, else _autoRole.
    expect(src).toMatch(/_effectiveRole\s*=\s*\(role != null && !role\.isBlank\(\)\)\s*\?\s*role\s*:\s*_autoRole/);
  });

  test('role="none" suppresses the role attribute entirely (_emitRole = false)', () => {
    // _emitRole = !"none".equals(_effectiveRole)
    expect(src).toMatch(/!"none"\.equals\(_effectiveRole\)/);
  });

  test("the role attribute is conditionally emitted: null when _emitRole is false", () => {
    // JTE drops a null attribute, so role="${_emitRole ? _effectiveRole : null}" is the suppression.
    expect(src).toContain('role="${_emitRole ? _effectiveRole : null}"');
  });
});

// ---------------------------------------------------------------------------
// data-slot topology (spec §6 data-* hooks)
// ---------------------------------------------------------------------------
describe("alert -- data-slot topology", () => {
  test('root carries data-slot="alert"', () => {
    expect(markup).toContain('data-slot="alert"');
  });

  test("root carries data-variant set to the variant param", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test('body wrapper carries data-slot="alert-body"', () => {
    expect(markup).toContain('data-slot="alert-body"');
  });

  test('title element carries data-slot="alert-title" (rendered only when title is set)', () => {
    expect(markup).toContain('data-slot="alert-title"');
    // The title element must be inside an @if(title != null ...) guard.
    expect(src).toMatch(/@if\(title != null[^)]*\)/);
  });

  test('content wrapper carries data-slot="alert-content"', () => {
    expect(markup).toContain('data-slot="alert-content"');
  });

  test('action wrapper carries data-slot="alert-action" (rendered only when action slot is set)', () => {
    expect(markup).toContain('data-slot="alert-action"');
    // action slot must be guarded by @if(action != null)
    expect(src).toContain("@if(action != null)");
  });

  test('dismiss button carries data-slot="alert-dismiss" (rendered only when closable=true)', () => {
    expect(markup).toContain('data-slot="alert-dismiss"');
    // The dismiss button must be inside an @if(closable) guard.
    expect(src).toContain("@if(closable)");
  });
});

// ---------------------------------------------------------------------------
// Slots: title, content, action
// ---------------------------------------------------------------------------
describe("alert -- slots", () => {
  test("content slot is rendered via ${content} (the gg.jte.Content JTE interpolation)", () => {
    expect(markup).toContain("${content}");
  });

  test("title is rendered as a <p> element (NOT a heading — spec §4 + §8 anti-pattern)", () => {
    // The title element is a <p>, never <h1>-<h6>.
    expect(markup).toMatch(/<p\s[^>]*data-slot="alert-title"/);
    expect(markup).not.toMatch(/<h[1-6]\s[^>]*data-slot="alert-title"/);
  });

  test("action slot is rendered via ${action} inside the alert-action wrapper", () => {
    expect(markup).toContain("${action}");
    // The action wrapper encloses the slot.
    const actionIdx = markup.indexOf('data-slot="alert-action"');
    const actionClose = markup.indexOf("</div>", actionIdx);
    expect(markup.slice(actionIdx, actionClose)).toContain("${action}");
  });
});

// ---------------------------------------------------------------------------
// Icon: decorative, aria-hidden, default per variant, iconName override
// ---------------------------------------------------------------------------
describe("alert -- icon slot", () => {
  test("icon region is guarded by @if(_hasIcon) / icon param", () => {
    expect(src).toMatch(/@if\(_hasIcon\)/);
  });

  test('icon span carries aria-hidden="true" (purely decorative)', () => {
    expect(markup).toContain('aria-hidden="true"');
  });

  test("icon is rendered via @template.lievit.icon (never raw <svg>)", () => {
    expect(markup).toContain("@template.lievit.icon(");
    const rawSvg = markup.match(/<svg\b/gi) ?? [];
    expect(rawSvg, "raw <svg> found; icons must go through @template.icon").toEqual([]);
  });

  test("default icon for info variant is 'info' (the switch default branch)", () => {
    // The icon switch uses a `default -> "info"` branch (info is the fallback, not a named case).
    expect(src).toMatch(/default\s*->\s*"info"/);
  });

  test("default icon for success variant is 'circle-check'", () => {
    expect(src).toContain('"circle-check"');
  });

  test("default icon for warning variant is 'triangle-alert'", () => {
    expect(src).toContain('"triangle-alert"');
  });

  test("default icon for destructive variant is 'circle-x'", () => {
    expect(src).toContain('"circle-x"');
  });

  test("iconName override: resolvedIconName = iconName if provided, else defaultIconName", () => {
    expect(src).toMatch(
      /_resolvedIconName\s*=\s*\(iconName != null && !iconName\.isBlank\(\)\)\s*\?\s*iconName\s*:\s*_defaultIconName/,
    );
  });

  test("the icon uses the resolved name (not hardcoded default name)", () => {
    expect(markup).toContain("_resolvedIconName");
  });
});

// ---------------------------------------------------------------------------
// Closable dismiss button (spec §4 + §7)
// ---------------------------------------------------------------------------
describe("alert -- closable dismiss button", () => {
  test('dismiss button is a real <button type="button"> (platform keyboard for free)', () => {
    expect(markup).toMatch(/<button[\s\S]*?type="button"/);
    // it is NOT a div-with-role hand-roll
    expect(markup).not.toMatch(/<div[^>]*role="button"/);
  });

  test('dismiss button carries aria-label="Dismiss" (icon-only: accessible name is mandatory)', () => {
    expect(markup).toContain('aria-label="Dismiss"');
  });

  test("dismiss button carries data-slot=alert-dismiss", () => {
    expect(markup).toContain('data-slot="alert-dismiss"');
  });

  test("dismiss button focus-visible ring via the --lv-ring token", () => {
    expect(markup).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });

  test("dismiss button icon uses neutral fg token (--lv-color-fg), not the variant tone", () => {
    // The button color is var(--lv-color-fg) — confirmed from line 170 of alert.jte.
    const dismissButton = markup.slice(markup.indexOf('data-slot="alert-dismiss"'));
    const closingButton = dismissButton.indexOf("</button>");
    const buttonSlice = dismissButton.slice(0, closingButton + 9);
    expect(buttonSlice).toContain("var(--lv-color-fg)");
  });

  test("dismiss button renders @template.lievit.icon(name = \"x\") for the close glyph", () => {
    expect(markup).toContain('@template.lievit.icon(name = "x"');
  });
});

// ---------------------------------------------------------------------------
// Banner mode (spec §3 states + §6 structure)
// ---------------------------------------------------------------------------
describe("alert -- banner mode", () => {
  test("banner=true sets border-radius:0 (suppresses the default --lv-radius-md)", () => {
    // _radiusStyle = banner ? "border-radius:0;" : "border-radius:var(--lv-radius-md);"
    expect(src).toContain('"border-radius:0;"');
    expect(src).toContain('"border-radius:var(--lv-radius-md);"');
  });

  test("banner=false uses the standard --lv-radius-md token for the corner radius", () => {
    expect(src).toContain("var(--lv-radius-md)");
  });

  test("banner=true replaces the full border with a thick left stripe", () => {
    // _borderStyle banner branch: border:0;border-left:4px solid <tone>
    expect(src).toContain('"border:0;border-left:4px solid "');
  });

  test("banner=false uses the standard 1px full border", () => {
    // _borderStyle non-banner: border:1px solid <tone>
    expect(src).toContain('"border:1px solid "');
  });

  test("banner and non-banner radius+border expressions are derived as Java strings and interpolated into the style attribute", () => {
    // Both are composed into the style attribute via _borderStyle + _radiusStyle.
    expect(src).toContain("${_borderStyle}${_radiusStyle}");
  });
});

// ---------------------------------------------------------------------------
// Grid layout: icon col / body col / dismiss col
// ---------------------------------------------------------------------------
describe("alert -- grid layout", () => {
  test("root uses CSS grid with grid-template-columns derived from icon + closable state", () => {
    expect(src).toContain("grid-template-columns:");
    expect(markup).toContain("${_gridCols}");
  });

  test("icon column is 1.25rem when icon=true, 0 otherwise", () => {
    expect(src).toContain('"1.25rem"');
    expect(src).toMatch(/_iconCol\s*=\s*_hasIcon\s*\?\s*"1\.25rem"\s*:\s*"0"/);
  });

  test("dismiss column is var(--lv-space-6) when closable, 0 otherwise", () => {
    expect(src).toMatch(/_dismissCol\s*=\s*closable\s*\?\s*"var\(--lv-space-6\)"\s*:\s*"0"/);
  });

  test("icon span occupies grid-column:1 / grid-row:1", () => {
    expect(markup).toContain("grid-column:1;grid-row:1");
  });

  test("body wrapper occupies grid-column:2 / grid-row:1", () => {
    // alert-body is in column 2
    const bodyIdx = markup.indexOf('data-slot="alert-body"');
    const bodyStyle = markup.slice(bodyIdx - 200, bodyIdx + 50);
    expect(bodyStyle).toContain("grid-column:2");
  });

  test("dismiss button occupies grid-column:3 / grid-row:1", () => {
    // alert-dismiss is in column 3
    const dismissIdx = markup.indexOf('data-slot="alert-dismiss"');
    const dismissStyle = markup.slice(dismissIdx - 300, dismissIdx + 100);
    expect(dismissStyle).toContain("grid-column:3");
  });
});

// ---------------------------------------------------------------------------
// Token-driven styling: no bare hex, all colours from --lv-* (spec §5 + §7)
// ---------------------------------------------------------------------------
describe("alert -- token-driven styling", () => {
  test("info uses the --lv-color-info token as the tone", () => {
    expect(src).toContain('"var(--lv-color-info)"');
  });

  test("success uses the --lv-color-success token as the tone", () => {
    expect(src).toContain('"var(--lv-color-success)"');
  });

  test("warning uses the --lv-color-warning token as the tone", () => {
    expect(src).toContain('"var(--lv-color-warning)"');
  });

  test("destructive uses the --lv-color-destructive token as the tone", () => {
    expect(src).toContain('"var(--lv-color-destructive)"');
  });

  test("surface background uses a 10% tint of the tone via color-mix (not a hardcoded value)", () => {
    expect(markup).toContain("color-mix(in srgb,${_tone} 10%,var(--lv-color-bg))");
  });

  test("padding uses --lv-space-3 (vertical) and --lv-space-4 (horizontal) tokens", () => {
    expect(markup).toContain("padding:var(--lv-space-3) var(--lv-space-4)");
  });

  test("body font family reads --lv-font-sans, not a hardcoded font stack", () => {
    expect(markup).toContain("font-family:var(--lv-font-sans)");
  });

  test("title font-weight reads --lv-font-medium token", () => {
    expect(markup).toContain("font-weight:var(--lv-font-medium)");
  });

  test("no bare hex colour leaks into the markup", () => {
    // Strip the doc comment block so the legacy comment prose does not trigger.
    expect(markup, "leaked a hardcoded hex colour").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// Security / CSP hygiene (spec §1 + house rule)
// ---------------------------------------------------------------------------
describe("alert -- security and CSP hygiene", () => {
  test("no inline <script> tag", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    const inlineHandlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(inlineHandlers, `unexpected inline handlers: ${inlineHandlers.join(", ")}`).toEqual([]);
  });

  test("never reaches for Font Awesome / wa-icon", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
  });

  test("uses JTE comment syntax <%-- --%>, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no em-dash (house rule)", () => {
    expect(src).not.toContain("—"); // U+2014 EM DASH
  });
});

// ---------------------------------------------------------------------------
// XSS trust split: attrs (trusted raw) + dataAttrs (safe escaped)
// ---------------------------------------------------------------------------
describe("alert -- XSS trust split: attrs + dataAttrs channels", () => {
  test("imports StringOutput and the Escape.htmlAttribute escaper for the dataAttrs channel", () => {
    expect(src).toContain("@import gg.jte.output.StringOutput");
    expect(src).toContain("@import gg.jte.html.escape.Escape");
  });

  test("dataAttrs VALUE is routed through Escape.htmlAttribute (never emitted raw)", () => {
    expect(src).toMatch(/Escape\.htmlAttribute\(\s*e\.getValue\(\)/);
    expect(src, "dataAttrs value must not be $unsafe").not.toMatch(/\$unsafe\{[^}]*getValue/);
  });

  test("dataAttrs KEY is allowlisted to simple identifiers (key in NAME position, unescaped)", () => {
    expect(src).toMatch(/getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("exactly two $unsafe sinks: the pre-escaped dataAttrs fragment + the trusted attrs string", () => {
    // The escaped dataAttrs fragment is _dataAttrsMarkup (underscore prefix, private derived var).
    // The trusted attrs string is attrs (the param, static author-typed strings only).
    const sinks = src.match(/\$unsafe\{[^}]*\}/g) ?? [];
    expect(sinks).toEqual(["$unsafe{_dataAttrsMarkup}", "$unsafe{attrs}"]);
  });

  test("attrs param is declared as a trusted raw channel (doc comment + @param)", () => {
    expect(src).toContain('@param String attrs = ""');
    // The doc comment must call out the TRUSTED RAW nature of attrs.
    expect(src.toLowerCase()).toMatch(/trusted/);
  });
});
