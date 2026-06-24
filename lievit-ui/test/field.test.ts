/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * field.jte (v-next clean API) -- structural + a11y contract.
 *
 * Pins the v-next field partial after the back-compat alias layer was removed.
 * The clean API has ONE name per concept: controlId (not forId), layout (not orientation),
 * hint (not description), content (not control). Error signalling is via status + message;
 * the field is NOT an error-summary (that's form's job).
 *
 * What this file covers:
 *   - param declarations: controlId, layout, size, status, message, hint,
 *     labelTooltip, htmlFor, labelWidth, cssClass, labelCssClass, attrs, dataAttrs,
 *     content slot, leading, extra.
 *   - Removed params absent: forId, orientation, description, control, fieldContent,
 *     error, errors.
 *   - data-slot topology: field (root), field-label-row, field-hint, field-control,
 *     field-message, field-extra.
 *   - aria-live="polite" on the message <p> (always in DOM).
 *   - id conventions: controlId-hint, controlId-msg (via _cid var).
 *   - data-status, data-layout, data-size on the root.
 *   - label NOT rendered when label param is null.
 *   - Required marker forwarded to label partial.
 *   - labelTooltip forwarded to label hint param.
 *   - No io.lievit.* imports (presentational-only contract).
 *   - No inline <script> / on* handlers (CSP).
 *   - No nested JTE comments.
 *   - dataAttrs safe-escape pattern present.
 *   - has-[:disabled]:opacity-50 on root (disabled cascade).
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
// §2 v-next param API (clean -- no back-compat aliases)
// ---------------------------------------------------------------------------
describe("field.jte -- v-next param declarations", () => {
  test("declares controlId param (primary id param)", () => {
    expect(src).toContain("@param String controlId = null");
  });

  test("does NOT declare forId param (back-compat alias removed)", () => {
    expect(src).not.toMatch(/@param String forId/);
  });

  test("declares layout param (v-next layout mode, default vertical)", () => {
    expect(src).toContain('@param String layout = "vertical"');
  });

  test("does NOT declare orientation param (back-compat alias removed)", () => {
    expect(src).not.toMatch(/@param String orientation/);
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

  test("declares hint param (v-next hint text)", () => {
    expect(src).toContain("@param String hint = null");
  });

  test("does NOT declare description param (back-compat alias removed)", () => {
    expect(src).not.toMatch(/@param String description/);
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

  test("declares content param (primary control slot)", () => {
    expect(src).toMatch(/@param gg\.jte\.Content content/);
  });

  test("does NOT declare control param (back-compat slot removed)", () => {
    expect(src).not.toMatch(/@param gg\.jte\.Content control/);
  });

  test("does NOT declare fieldContent param (back-compat slot removed)", () => {
    expect(src).not.toMatch(/@param gg\.jte\.Content fieldContent/);
  });

  test("declares leading and extra slot params", () => {
    expect(src).toMatch(/@param gg\.jte\.Content leading/);
    expect(src).toMatch(/@param gg\.jte\.Content extra/);
  });

  test("does NOT declare single error String param (error reporting via status+message)", () => {
    expect(src).not.toMatch(/@param String error /);
  });

  test("does NOT declare List<String> errors param (error reporting via status+message)", () => {
    expect(src).not.toMatch(/@param java\.util\.List<String> errors/);
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
    expect(markup).toContain('id="${_cid}-hint"');
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

  test("does NOT have field-description slot (back-compat description removed)", () => {
    expect(markup).not.toContain('data-slot="field-description"');
  });

  test("does NOT have field-error slot (error reporting via status+message)", () => {
    expect(markup).not.toContain('data-slot="field-error"');
  });

  test("does NOT have field-content sub-slot (fieldContent param removed)", () => {
    expect(markup).not.toContain('data-slot="field-content"');
  });
});

// ---------------------------------------------------------------------------
// §4 aria-live message slot (v-next pre-registered live region)
// ---------------------------------------------------------------------------
describe("field.jte -- v-next aria-live message slot", () => {
  test("message <p> carries aria-live=polite (always in DOM, pre-registered)", () => {
    expect(markup).toContain('aria-live="polite"');
  });

  test("message <p> id follows the controlId-msg convention (via _cid var)", () => {
    expect(markup).toContain('id="${_cid}-msg"');
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
  test("root carries data-layout driven by layout param", () => {
    expect(markup).toContain('data-layout="${layout}"');
  });

  test("root carries data-size", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("root carries data-status (empty string when null)", () => {
    expect(markup).toContain('data-status="${status != null ? status : ""}"');
  });

  test("does NOT carry data-orientation (orientation param removed)", () => {
    expect(markup).not.toContain("data-orientation=");
  });

  test("does NOT carry data-invalid (error-path removed; status drives intent)", () => {
    expect(markup).not.toContain("data-invalid=");
  });

  test("disabled cascade: has-[:disabled]:opacity-50 on root", () => {
    expect(markup).toContain("has-[:disabled]:opacity-50");
  });
});

// ---------------------------------------------------------------------------
// §6 Label rendering
// ---------------------------------------------------------------------------
describe("field.jte -- label rendering", () => {
  test("composes @template.lievit.label with _effectiveFor (derived from htmlFor ?? controlId)", () => {
    expect(src).toContain("@template.lievit.label(forId = _effectiveFor, content = @`${label}`");
  });

  test("label is NOT rendered when label param is null (conditional)", () => {
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
// §7 Control slot (single clean slot)
// ---------------------------------------------------------------------------
describe("field.jte -- control slot resolution", () => {
  test("v-next content slot is rendered when provided", () => {
    expect(markup).toContain("${content}");
  });

  test("does NOT render a fallback control slot (back-compat control removed)", () => {
    expect(markup).not.toContain("${control}");
  });
});

// ---------------------------------------------------------------------------
// §8 dataAttrs safe-escape pattern
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
// §9 Layout classes (data-layout driven, clean)
// ---------------------------------------------------------------------------
describe("field.jte -- layout classes", () => {
  test("horizontal flex-row class via data-layout", () => {
    expect(markup).toContain("data-[layout=horizontal]:flex-row");
  });

  test("vertical flex-col class via data-layout", () => {
    expect(markup).toContain("data-[layout=vertical]:flex-col");
  });
});
