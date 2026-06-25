/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * form.jte (v-next clean API) -- structural + a11y contract.
 *
 * Pins the v-next form partial after the back-compat single-string `error` alias was removed.
 * The clean API has ONE error surface: `errors` (List<Map<String,String>>) for the v-next
 * error-summary. Error reporting is NOT the field's job; the form owns the summary.
 *
 * What this file covers:
 *   - v-next param declarations (errors list, errorSummaryHeading, focusOnError, layout,
 *     size, labelWidth, autocomplete, novalidate, enctype, headingId, ariaLabel, footer).
 *   - Removed param absent: single-String error.
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
 *   - data-slot=form-error (slot name preserved).
 *   - aria-describedby conditional wiring.
 *   - No dev.lievit.* imports.
 *   - No inline <script> / on* handlers (CSP).
 *   - No nested JTE comments.
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
  test("never imports dev.lievit.* (presentational only)", () => {
    expect(src).not.toMatch(/@import dev\.lievit\./);
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
// §2 v-next param API (clean -- no back-compat aliases)
// ---------------------------------------------------------------------------
describe("form.jte -- v-next param declarations", () => {
  test("declares errors param as List<Map<String,String>>", () => {
    expect(src).toContain(
      "@param java.util.List<java.util.Map<String, String>> errors = java.util.List.of()"
    );
  });

  test("does NOT declare single-String error param (back-compat alias removed)", () => {
    expect(src).not.toMatch(/@param String error /);
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

  test("declares id, action, method, cssClass params", () => {
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

  test("data-controller=lv-form on root (Stimulus focus-on-error controller)", () => {
    expect(markup).toContain('data-controller="lv-form"');
  });

  test("data-form-layout on root (v-next layout propagation)", () => {
    expect(markup).toContain('data-form-layout="${layout}"');
  });

  test("method attribute present", () => {
    expect(markup).toContain('method="${method}"');
  });

  test("novalidate as smart boolean attribute", () => {
    expect(markup).toContain('novalidate="${novalidate}"');
  });

  test("aria-label attribute present", () => {
    expect(markup).toContain('aria-label="${ariaLabel}"');
  });

  test("aria-describedby conditional wiring", () => {
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

  test("error summary uses data-slot=form-error", () => {
    expect(markup).toContain('data-slot="form-error"');
  });

  test("error region has id=${errorId}", () => {
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
// §6 Error list rendering (v-next only)
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
    expect(markup).toContain('data-slot="form-error-heading"');
  });

  test("does NOT render back-compat single error string (error param removed)", () => {
    expect(src).not.toContain("_hasSingleError");
    expect(markup).not.toContain("${error}");
  });
});

// ---------------------------------------------------------------------------
// §7 hasError logic
// ---------------------------------------------------------------------------
describe("form.jte -- hasError derivation", () => {
  test("hasError is derived solely from errors list (no dual-path)", () => {
    // Clean API: hasError is a single boolean from the list, no back-compat split
    expect(src).toContain("var hasError = errors != null && !errors.isEmpty();");
    expect(src).not.toContain("_hasVnextErrors");
    expect(src).not.toContain("_hasSingleError");
  });

  test("errorId derived from id param with -errors suffix", () => {
    expect(src).toContain('formId + "-errors"');
  });
});

// ---------------------------------------------------------------------------
// §8 Content and footer slots
// ---------------------------------------------------------------------------
describe("form.jte -- content and footer slots", () => {
  test("content slot is rendered", () => {
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
