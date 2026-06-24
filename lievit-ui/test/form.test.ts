/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * form.jte (v-next) -- structural + a11y contract.
 *
 * Pins the v-next re-forged form partial. No JTE compiler: asserts on the partial
 * SOURCE as text. Shared tests (jte-static-partials) pin the back-compat surface
 * (method, data-slot=form-error, role=alert, aria-live=assertive, errorId, aria-describedby,
 * ${content}); this file pins the v-NEXT additions WITHOUT repeating those.
 *
 * What this file covers:
 *   - v-next param declarations (errors list, errorSummaryHeading, focusOnError, layout,
 *     size, labelWidth, autocomplete, novalidate, enctype, headingId, ariaLabel, footer).
 *   - Error summary always in DOM (hidden attr gates visibility).
 *   - hidden smart attr on error summary.
 *   - data-lv-autofocus when focusOnError && hasError.
 *   - role="alert" + aria-live="assertive" + aria-atomic="true" on error summary.
 *   - tabindex="-1" on error summary (focus target for enhancer).
 *   - data-form-layout on the <form> root.
 *   - Size + labelWidth propagation via inline style custom properties.
 *   - novalidate smart boolean attribute.
 *   - footer slot: data-slot=form-footer.
 *   - Error links: <a href="#fieldId"> for errors with fieldId, plain text for form-level.
 *   - data-slot=form-error (back-compat slot name preserved).
 *   - aria-describedby conditional wiring (back-compat).
 *   - No io.lievit.* imports.
 *   - No inline <script> / on* handlers (CSP).
 *   - No nested JTE comments.
 *   - Back-compat: error single-string + errorId derivation + data-slot=form-error.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "form.jte"), "utf8");

/** Strip JTE doc-comments so assertions never accidentally match comment prose. */
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// §1 Security / presentational contract
// ---------------------------------------------------------------------------
describe("form.jte -- security and presentational contract", () => {
  test("never imports io.lievit.* (presentational only)", () => {
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
});

// ---------------------------------------------------------------------------
// §2 v-next param API
// ---------------------------------------------------------------------------
describe("form.jte -- v-next param declarations", () => {
  test("declares errors param as List<Map<String,String>>", () => {
    expect(src).toContain(
      "@param java.util.List<java.util.Map<String, String>> errors = java.util.List.of()"
    );
  });

  test("declares errorSummaryHeading param with Italian default", () => {
    expect(src).toContain(
      '@param String errorSummaryHeading = "Correggi gli errori prima di procedere"'
    );
  });

  test("declares focusOnError boolean param (default false)", () => {
    expect(src).toContain("@param boolean focusOnError = false");
  });

  test("declares layout param (default stacked)", () => {
    expect(src).toContain('@param String layout = "stacked"');
  });

  test("declares size param (default md)", () => {
    expect(src).toContain('@param String size = "md"');
  });

  test("declares labelWidth param (default null)", () => {
    expect(src).toContain("@param String labelWidth = null");
  });

  test("declares autocomplete param", () => {
    expect(src).toContain("@param String autocomplete = null");
  });

  test("declares novalidate boolean param (default true)", () => {
    expect(src).toContain("@param boolean novalidate = true");
  });

  test("declares enctype param", () => {
    expect(src).toContain("@param String enctype = null");
  });

  test("declares headingId param", () => {
    expect(src).toContain("@param String headingId = null");
  });

  test("declares ariaLabel param", () => {
    expect(src).toContain("@param String ariaLabel = null");
  });

  test("declares footer slot param", () => {
    expect(src).toMatch(/@param gg\.jte\.Content footer/);
  });

  test("back-compat: declares single-String error param", () => {
    expect(src).toContain("@param String error = null");
  });

  test("back-compat: declares id, action, method, cssClass params", () => {
    expect(src).toContain("@param String id = null");
    expect(src).toContain("@param String action = null");
    expect(src).toContain('@param String method = "post"');
    expect(src).toContain('@param String cssClass = ""');
  });
});

// ---------------------------------------------------------------------------
// §3 Form root attributes
// ---------------------------------------------------------------------------
describe("form.jte -- form root attributes", () => {
  test("renders a native <form> element", () => {
    expect(markup).toMatch(/<form[\s\n]/);
  });

  test("data-slot=form on root", () => {
    expect(markup).toContain('data-slot="form"');
  });

  test("data-form-layout on root (v-next layout propagation)", () => {
    expect(markup).toContain('data-form-layout="${layout}"');
  });

  test("method attribute present (back-compat, pinned by shared tests)", () => {
    expect(markup).toContain('method="${method}"');
  });

  test("novalidate as smart boolean attribute", () => {
    expect(markup).toContain('novalidate="${novalidate}"');
  });

  test("aria-label attribute present", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("back-compat: aria-describedby conditional wiring", () => {
    expect(src).toContain('aria-describedby="${hasError ? errorId : null}"');
  });
});

// ---------------------------------------------------------------------------
// §4 Size + labelWidth propagation (v-next CSS custom property cascade)
// ---------------------------------------------------------------------------
describe("form.jte -- size and labelWidth CSS propagation", () => {
  test("size propagated via --lv-form-size custom property in inline style", () => {
    expect(src).toContain("--lv-form-size");
  });

  test("labelWidth propagated via --lv-form-label-width custom property in inline style", () => {
    expect(src).toContain("--lv-form-label-width");
  });

  test("labelWidth is conditional (only added when non-null)", () => {
    expect(src).toContain("labelWidth != null");
  });
});

// ---------------------------------------------------------------------------
// §5 Error summary: always in DOM, hidden attr, a11y
// ---------------------------------------------------------------------------
describe("form.jte -- error summary a11y and visibility", () => {
  test("error summary has role=alert (assertive live region, WAI-ARIA Alert)", () => {
    expect(markup).toContain('role="alert"');
  });

  test("error summary has aria-live=assertive (explicit, for engine compat)", () => {
    expect(markup).toContain('aria-live="assertive"');
  });

  test("error summary has aria-atomic=true", () => {
    expect(markup).toContain('aria-atomic="true"');
  });

  test("error summary has tabindex=-1 (focus target for enhancer)", () => {
    expect(markup).toContain('tabindex="-1"');
  });

  test("back-compat: error summary uses data-slot=form-error (pinned by shared tests)", () => {
    expect(markup).toContain('data-slot="form-error"');
  });

  test("back-compat: error region has id=${errorId} (pinned by shared tests)", () => {
    expect(src).toContain('id="${errorId}"');
  });

  test("hidden smart attr on error summary (hidden when no errors)", () => {
    expect(markup).toContain('hidden="${!hasError}"');
  });

  test("data-lv-autofocus on error summary when focusOnError && hasError", () => {
    expect(markup).toContain('data-lv-autofocus="${focusOnError && hasError ? "true" : null}"');
  });
});

// ---------------------------------------------------------------------------
// §6 Error list rendering (v-next)
// ---------------------------------------------------------------------------
describe("form.jte -- v-next error list rendering", () => {
  test("iterates errors list with @for", () => {
    expect(markup).toContain('@for(java.util.Map<String, String> err : errors)');
  });

  test("renders error message via err.get(message)", () => {
    expect(markup).toContain('${err.get("message")}');
  });

  test("renders an anchor link when fieldId is non-null", () => {
    expect(markup).toContain('href="#${err.get("fieldId")}"');
  });

  test("error list uses @if for fieldId null check", () => {
    expect(markup).toContain('err.get("fieldId") != null');
  });

  test("errorSummaryHeading is rendered when non-blank", () => {
    expect(markup).toContain("${errorSummaryHeading}");
    expect(markup).toContain("data-slot=\"form-error-heading\"");
  });

  test("back-compat: single error string rendered when v-next list is empty", () => {
    expect(markup).toContain("_hasSingleError");
    expect(markup).toContain("${error}");
  });
});

// ---------------------------------------------------------------------------
// §7 Content and footer slots
// ---------------------------------------------------------------------------
describe("form.jte -- content and footer slots", () => {
  test("content slot is rendered (back-compat, pinned by shared tests)", () => {
    expect(markup).toContain("${content}");
  });

  test("footer slot rendered in data-slot=form-footer wrapper", () => {
    expect(markup).toContain('data-slot="form-footer"');
    expect(markup).toContain("${footer}");
  });

  test("header slot rendered when non-null", () => {
    expect(markup).toContain("${header}");
  });
});

// ---------------------------------------------------------------------------
// §8 hasError logic
// ---------------------------------------------------------------------------
describe("form.jte -- hasError derivation", () => {
  test("hasError combines v-next errors list AND back-compat single error", () => {
    expect(src).toContain("_hasVnextErrors");
    expect(src).toContain("_hasSingleError");
    expect(src).toContain("var hasError = _hasVnextErrors || _hasSingleError");
  });

  test("errorId derived from id param with -errors suffix", () => {
    expect(src).toContain('formId + "-errors"');
  });
});
