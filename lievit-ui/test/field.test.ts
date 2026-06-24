/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * field.jte (v-next) -- structural + a11y contract.
 *
 * Pins the v-next re-forged field partial. No JTE compiler: asserts on the partial
 * SOURCE as text. Shared tests (formctl-compound + jte-static-partials) pin the back-compat
 * surface (forId, control, orientation, error/errors, data-invalid); this file pins the
 * v-NEXT additions WITHOUT repeating the shared golden assertions.
 *
 * What this file covers:
 *   - v-next param declarations (controlId, layout, size, status, message, hint,
 *     labelTooltip, htmlFor, labelWidth, cssClass, labelCssClass, attrs, dataAttrs,
 *     content slot, leading, extra).
 *   - data-slot topology: field (root), field-label-row, field-hint, field-control,
 *     field-message, field-extra, field-description (back-compat), field-error (back-compat).
 *   - aria-live="polite" on the message <p> (always in DOM).
 *   - id conventions: forId-hint, forId-msg, forId-error, forId-description.
 *   - data-status, data-layout, data-size on the root.
 *   - label NOT rendered when label param is null.
 *   - Required marker forwarded to label partial.
 *   - labelTooltip forwarded to label hint param.
 *   - No io.lievit.* imports (presentational-only contract).
 *   - No inline <script> / on* handlers (CSP).
 *   - No nested JTE comments.
 *   - dataAttrs safe-escape pattern present.
 *   - has-[:disabled]:opacity-50 on root (disabled cascade).
 *   - Back-compat: forId alias + control slot + orientation + errors/error paths preserved.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "field.jte"), "utf8");

/** Strip JTE doc-comments so assertions never accidentally match comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §1 Security / presentational contract
// ---------------------------------------------------------------------------
describe("field.jte -- security and presentational contract", () => {
  test("never imports io.lievit.* (presentational only -- no domain imports)", () => {
    expect(src).not.toMatch(/@import io\.lievit\./);
  });

  test("no inline <script> (CSP)", () => {
    expect(src).not.toMatch(/<script/i);
  });

  test("no on* inline handlers (CSP)", () => {
    const handlers = markup.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers).toEqual([]);
  });

  test("JTE comments use <%-- --%> syntax, not @* *@", () => {
    expect(src).not.toMatch(/@\*/);
  });

  test("no hardcoded hex colours in the markup body (tokens only)", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,6}\b/);
  });
});

// ---------------------------------------------------------------------------
// §2 v-next param API
// ---------------------------------------------------------------------------
describe("field.jte -- v-next param declarations", () => {
  test("declares controlId param (v-next primary id param)", () => {
    expect(src).toContain("@param String controlId = null");
  });

  test("declares forId param (back-compat alias)", () => {
    expect(src).toContain("@param String forId = null");
  });

  test("declares layout param (v-next layout mode, default vertical)", () => {
    expect(src).toContain('@param String layout = "vertical"');
  });

  test("declares size param (v-next size tier, default md)", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares status param (v-next status intent, default null)", () => {
    expect(src).toContain("@param String status = null");
  });

  test("declares message param (v-next aria-live message slot)", () => {
    expect(src).toContain("@param String message = null");
  });

  test("declares hint param (v-next hint text, separate from description)", () => {
    expect(src).toContain("@param String hint = null");
  });

  test("declares labelTooltip param (forwarded to label hint)", () => {
    expect(src).toContain("@param String labelTooltip = null");
  });

  test("declares htmlFor param (explicit label FOR override)", () => {
    expect(src).toContain("@param String htmlFor = null");
  });

  test("declares labelWidth param (horizontal layout column width)", () => {
    expect(src).toContain("@param String labelWidth = null");
  });

  test("declares cssClass and labelCssClass params", () => {
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String labelCssClass = ""');
  });

  test("declares attrs and dataAttrs params", () => {
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("@param java.util.Map<String, String> dataAttrs = java.util.Map.of()");
  });

  test("declares content param (v-next primary control slot)", () => {
    expect(src).toMatch(/@param gg\.jte\.Content content/);
  });

  test("declares leading and extra slot params", () => {
    expect(src).toMatch(/@param gg\.jte\.Content leading/);
    expect(src).toMatch(/@param gg\.jte\.Content extra/);
  });

  test("back-compat: declares control param alongside v-next content", () => {
    expect(src).toMatch(/@param gg\.jte\.Content control/);
  });

  test("back-compat: declares orientation param alias", () => {
    expect(src).toMatch(/@param String orientation/);
  });

  test("back-compat: declares description param", () => {
    expect(src).toContain("@param String description = null");
  });

  test("back-compat: declares single error String + List<String> errors", () => {
    expect(src).toContain("@param String error = null");
    expect(src).toMatch(/@param java\.util\.List<String> errors/);
  });
});

// ---------------------------------------------------------------------------
// §3 data-slot topology
// ---------------------------------------------------------------------------
describe("field.jte -- data-slot topology", () => {
  test("root carries data-slot=field", () => {
    expect(markup).toContain('data-slot="field"');
  });

  test("label row carries data-slot=field-label-row", () => {
    expect(markup).toContain('data-slot="field-label-row"');
  });

  test("hint region carries data-slot=field-hint with id convention", () => {
    expect(markup).toContain('data-slot="field-hint"');
    // v-next: internal var renamed _fid (avoids JTE name clash); tests assert the actual source text.
    expect(markup).toContain('id="${_fid}-hint"');
  });

  test("control wrapper carries data-slot=field-control", () => {
    expect(markup).toContain('data-slot="field-control"');
  });

  test("message region carries data-slot=field-message", () => {
    expect(markup).toContain('data-slot="field-message"');
  });

  test("extra slot carries data-slot=field-extra", () => {
    expect(markup).toContain('data-slot="field-extra"');
  });

  test("back-compat: description region carries data-slot=field-description with id", () => {
    expect(markup).toContain('data-slot="field-description"');
    // v-next: internal var _fid replaces forId in id expressions (coordinator JTE fix)
    expect(markup).toContain('id="${_fid}-description"');
  });

  test("back-compat: error region carries data-slot=field-error with id", () => {
    expect(markup).toContain('data-slot="field-error"');
    // v-next: internal var _fid replaces forId in id expressions (coordinator JTE fix)
    expect(markup).toContain('id="${_fid}-error"');
  });
});

// ---------------------------------------------------------------------------
// §4 aria-live message slot (v-next pre-registered live region)
// ---------------------------------------------------------------------------
describe("field.jte -- v-next aria-live message slot", () => {
  test("message <p> carries aria-live=polite (always in DOM, pre-registered)", () => {
    expect(markup).toContain('aria-live="polite"');
  });

  test("message <p> id follows the forId-msg convention", () => {
    // v-next: internal var _fid is used in id expressions; _fid resolves to controlId ?? forId
    expect(markup).toContain('id="${_fid}-msg"');
  });

  test("message content is rendered inside the aria-live region", () => {
    expect(markup).toContain("${message}");
  });

  test("message is sr-only when no status and no message (no reflow)", () => {
    expect(markup).toContain("sr-only");
  });
});

// ---------------------------------------------------------------------------
// §5 Root attribute contract
// ---------------------------------------------------------------------------
describe("field.jte -- root attribute contract", () => {
  test("root carries data-layout (v-next layout)", () => {
    expect(markup).toContain('data-layout="${_layout}"');
  });

  test("root carries data-size", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("root carries data-status (empty string when null)", () => {
    expect(markup).toContain('data-status="${status != null ? status : ""}"');
  });

  test("back-compat: root carries data-orientation (resolved via _layout which merges layout + orientation)", () => {
    // v-next: data-orientation is set to ${_layout} (the merged layout/orientation value);
    // the param `orientation` still exists as a back-compat alias, but the attribute now
    // reads the resolved _layout variable so both callers see the same cascade.
    expect(markup).toContain('data-orientation="${_layout}"');
  });

  test("back-compat: root carries data-invalid driven by hasError", () => {
    expect(markup).toContain('data-invalid="${hasError ? "true" : null}"');
  });

  test("back-compat: root carries data-[invalid=true] destructive cascade class", () => {
    expect(src).toContain("data-[invalid=true]:text-[var(--lv-color-destructive)]");
  });

  test("disabled cascade: has-[:disabled]:opacity-50 on root", () => {
    expect(markup).toContain("has-[:disabled]:opacity-50");
  });
});

// ---------------------------------------------------------------------------
// §6 Label rendering
// ---------------------------------------------------------------------------
describe("field.jte -- label rendering", () => {
  test("composes @template.lievit.label with back-compat exact invocation (pinned by shared tests)", () => {
    expect(src).toContain("@template.lievit.label(forId = forId, content = @`${label}`, required = required");
  });

  test("label is NOT rendered when label param is null (conditional)", () => {
    // The label row is gated on label != null && !label.isBlank()
    expect(markup).toContain("@if(label != null && !label.isBlank())");
  });

  test("labelTooltip is forwarded to label hint param", () => {
    expect(markup).toContain("hint = labelTooltip");
  });

  test("labelCssClass is forwarded to label cssClass param", () => {
    expect(markup).toContain("cssClass = labelCssClass");
  });

  test("leading slot is forwarded to label leading param", () => {
    expect(markup).toContain("leading = leading");
  });
});

// ---------------------------------------------------------------------------
// §7 Control slot
// ---------------------------------------------------------------------------
describe("field.jte -- control slot resolution", () => {
  test("v-next content slot is rendered when provided", () => {
    expect(markup).toContain("${content}");
  });

  test("back-compat control slot is rendered when content is null", () => {
    expect(markup).toContain("${control}");
  });

  test("content slot takes priority over control slot (@if content != null)", () => {
    // content branch comes before control fallback
    const contentIdx = markup.indexOf("${content}");
    const controlIdx = markup.indexOf("${control}");
    expect(contentIdx).toBeGreaterThanOrEqual(0);
    expect(controlIdx).toBeGreaterThanOrEqual(0);
    // content first, then control as fallback
    expect(contentIdx).toBeLessThan(controlIdx);
  });
});

// ---------------------------------------------------------------------------
// §8 Back-compat error region
// ---------------------------------------------------------------------------
describe("field.jte -- back-compat error region", () => {
  test("multi-error renders a <ul> with list-disc inside one role=alert region", () => {
    expect(markup).toContain('role="alert"');
    expect(markup).toContain("list-disc");
    expect(markup).toContain("@for(String msg : errorList)");
    expect(markup).toContain("<li>${msg}</li>");
  });

  test("single-element errorList collapses to text (no <ul>)", () => {
    expect(markup).toContain("@if(errorList.size() == 1)");
  });

  test("single-String error path: a <p> with role=alert (back-compat)", () => {
    // v-next: id uses _fid (the resolved controlId ?? forId variable)
    expect(markup).toContain('<p data-slot="field-error" id="${_fid}-error" role="alert"');
    expect(markup).toContain("@elseif(hasSingleError)");
  });

  test("hasError combines list and single error", () => {
    expect(src).toContain("var hasError = hasErrorList || hasSingleError");
  });

  test("errors list is deduped (distinct + blanks dropped)", () => {
    expect(src).toContain(".filter(e -> e != null && !e.isBlank())");
    expect(src).toContain(".distinct()");
  });
});

// ---------------------------------------------------------------------------
// §9 dataAttrs safe-escape pattern
// ---------------------------------------------------------------------------
describe("field.jte -- dataAttrs safe-escape pattern", () => {
  test("uses StringOutput + Escape.htmlAttribute for dynamic data-* (mirrors alert.jte)", () => {
    expect(src).toContain("new StringOutput()");
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("_dataAttrsMarkup");
  });

  test("emits _dataAttrsMarkup via $unsafe (safe because value is self-escaped)", () => {
    expect(markup).toContain("$unsafe{_dataAttrsMarkup}");
  });
});

// ---------------------------------------------------------------------------
// §10 back-compat orientation classes
// ---------------------------------------------------------------------------
describe("field.jte -- back-compat layout/orientation classes", () => {
  test("horizontal flex-row class via data-orientation", () => {
    expect(markup).toContain("data-[orientation=horizontal]:flex-row");
  });

  test("responsive variant present", () => {
    expect(markup).toContain("data-[orientation=responsive]");
  });

  test("field-content sub-slot present for horizontal helper text", () => {
    expect(markup).toContain('data-slot="field-content"');
  });
});
