/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * alert-dialog.jte -- structural + a11y contract assertions (spec §7).
 *
 * The alert-dialog is a presentational JTE partial compiled in the Java world, so -- as with
 * all static-partials suites -- this harness asserts on the PARTIAL SOURCE as text. It pins:
 *   - the param API (all documented params, types, defaults)
 *   - the mandatory ARIA contract: role="alertdialog" + aria-modal + aria-labelledby +
 *     aria-describedby (MANDATORY for alertdialog, an axe-core violation if missing)
 *   - the focus-trap enhancer protocol: data-lievit-focus-trap + data-lievit-escape-action
 *   - the alertdialog-specific data-* attributes: data-closable="false" + data-cancel-action
 *   - DOM structure: <h2> title (not a div), <p> description (not a div)
 *   - DOM order: cancel button FIRST in DOM (carries data-initial-focus), confirm SECOND
 *   - No close-X button (data-slot="alert-dialog-cancel" only, no close/dismiss-x element)
 *   - Variants: destructive/warning/default map to the correct token vars
 *   - Loading state: confirm button aria-busy + disabled; cancel button NOT disabled
 *   - Wire channels: confirmWireClick + cancelWireClick emitted as l:click; wireArgs use
 *     the SAFE Escape.htmlAttribute path (never attrs)
 *   - CSP hygiene: no inline <script>, no on*= handlers
 *   - Security hygiene: no $unsafe on user-facing content (title/description use ${})
 *   - data-slot topology: alert-dialog, alert-dialog-header, alert-dialog-title,
 *     alert-dialog-description, alert-dialog-actions, alert-dialog-confirm, alert-dialog-cancel
 *
 * Real render/runtime tests (keyboard trap, focus restore, round-trip IT) require the Java
 * LievitRuntime; those live in the lievit-kit integration test suite. This file covers the
 * structural golden the Java compiler enforces.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "alert-dialog.jte"), "utf8");

// Strip JTE doc-comment block so assertions do not fire on documentation prose.
// The <%-- ... --%> block at the top is stripped; inline comments inside the body are not
// (they are load-bearing structural markers and should be tested where relevant).
const markup = src.replace(/<%--[\s\S]*?--%>/g, "");

// ---------------------------------------------------------------------------
// Param API
// ---------------------------------------------------------------------------
describe("alert-dialog -- param API (spec §2)", () => {
  test("declares all required params (no default -- missing = broken a11y)", () => {
    expect(src).toContain("@param String title");
    expect(src).toContain("@param String description");
    expect(src).toContain("@param String confirmWireClick");
    expect(src).toContain("@param String cancelWireClick");
    // Required params must NOT have a default (they would silently pass a null/empty string)
    expect(src).not.toMatch(/@param String title\s*=/);
    expect(src).not.toMatch(/@param String description\s*=/);
    expect(src).not.toMatch(/@param String confirmWireClick\s*=/);
    expect(src).not.toMatch(/@param String cancelWireClick\s*=/);
  });

  test('variant param defaults to "destructive"', () => {
    expect(src).toContain('@param String variant = "destructive"');
  });

  test('confirmLabel defaults to "Confirm"', () => {
    expect(src).toContain('@param String confirmLabel = "Confirm"');
  });

  test('cancelLabel defaults to "Cancel"', () => {
    expect(src).toContain('@param String cancelLabel = "Cancel"');
  });

  test("confirmWireArgs and cancelWireArgs are safe-escaped Map params with empty-map defaults", () => {
    expect(src).toContain(
      "@param java.util.Map<String, String> confirmWireArgs = java.util.Map.of()",
    );
    expect(src).toContain(
      "@param java.util.Map<String, String> cancelWireArgs = java.util.Map.of()",
    );
  });

  test("loading param defaults to false", () => {
    expect(src).toContain("@param boolean loading = false");
  });

  test("iconSlot is an optional gg.jte.Content slot defaulting to null", () => {
    expect(src).toContain("@param gg.jte.Content iconSlot = null");
  });

  test('cssClass defaults to empty string', () => {
    expect(src).toContain('@param String cssClass = ""');
  });

  test('attrs is the TRUSTED raw channel defaulting to empty string', () => {
    expect(src).toContain('@param String attrs = ""');
  });

  test("no dev.lievit.* imports (JTE-compile gate constraint)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit\./);
  });

  test("only JTE-safe imports are present (gg.jte.* only)", () => {
    const imports = src.match(/@import\s+\S+/g) ?? [];
    for (const imp of imports) {
      expect(imp).toMatch(/@import\s+gg\.jte\./);
    }
  });

  test("usage doc uses @@template.lievit.alert-dialog( not bare @@template.alert-dialog(", () => {
    expect(src).toContain("@@template.lievit.alert-dialog(");
  });
});

// ---------------------------------------------------------------------------
// ARIA contract -- the heart (spec §4)
// ---------------------------------------------------------------------------
describe("alert-dialog -- ARIA contract (spec §4)", () => {
  test('panel root carries role="alertdialog" (NOT role="dialog")', () => {
    expect(markup).toContain('role="alertdialog"');
    expect(markup).not.toContain('role="dialog"');
  });

  test('panel root carries aria-modal="true"', () => {
    expect(markup).toContain('aria-modal="true"');
  });

  test("panel root carries aria-labelledby pointing to the title id", () => {
    // The titleId var must be derived and wired into the panel + the h2.
    expect(src).toContain('"lv-alert-dialog-title"');
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("${titleId}");
  });

  test("panel root carries aria-describedby pointing to the description id (MANDATORY for alertdialog)", () => {
    expect(src).toContain('"lv-alert-dialog-desc"');
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("${descId}");
  });

  test("title is rendered as a real <h2> element (not a div or p)", () => {
    expect(markup).toContain("<h2");
    expect(markup).not.toMatch(/data-slot="alert-dialog-title"[^>]*role="heading"/);
  });

  test("description is rendered as a real <p> element (not a div)", () => {
    expect(markup).toContain("<p");
    expect(markup).toContain('data-slot="alert-dialog-description"');
  });

  test("title element carries the derived titleId as its HTML id", () => {
    expect(markup).toContain('id="${titleId}"');
  });

  test("description element carries the derived descId as its HTML id", () => {
    expect(markup).toContain('id="${descId}"');
  });

  test("aria-modal is on the panel root, not on a child element", () => {
    // aria-modal="true" must appear on the same element as role="alertdialog"
    const panelRootAttrs = markup.match(/role="alertdialog"[\s\S]*?>/)?.[0] ?? "";
    expect(panelRootAttrs).toContain('aria-modal="true"');
  });
});

// ---------------------------------------------------------------------------
// No close-X button (spec §4 + §8 anti-patterns)
// ---------------------------------------------------------------------------
describe("alert-dialog -- no close-X, no light-dismiss (spec §4 anti-patterns)", () => {
  test('no element with aria-label="Close" (no close-X button present)', () => {
    expect(markup).not.toContain('aria-label="Close"');
    expect(markup).not.toContain('aria-label="Chiudi"');
  });

  test('data-closable="false" is hardcoded on the panel root (enhancer reads this)', () => {
    expect(markup).toContain('data-closable="false"');
  });

  test("data-cancel-action is wired to the cancelWireClick param (enhancer fires this on Esc)", () => {
    expect(markup).toContain('data-cancel-action="${cancelWireClick}"');
  });
});

// ---------------------------------------------------------------------------
// Focus-mechanics protocol: the lv-alert-dialog Stimulus controller (spec §4 + §6).
// The behaviour itself is proven against the real controller + real morph in
// test/lv-alert-dialog-controller.test.ts; this block pins the template contract the
// controller reads.
// ---------------------------------------------------------------------------
describe("alert-dialog -- focus-mechanics protocol (spec §4, §6)", () => {
  test("panel root carries data-controller=\"lv-alert-dialog\" (the Stimulus controller owns the trap)", () => {
    expect(markup).toContain('data-controller="lv-alert-dialog"');
  });

  test("panel root carries data-lv-wire-close wired to cancelWireClick (controlled-doctrine seam read by DismissableController)", () => {
    // Escape == cancel rides the wire ONLY because data-lv-wire-close is present (alert-dialog is
    // wire-CONTROLLED by definition); the base reads this attribute, never a hardcoded fallback.
    expect(markup).toContain('data-lv-wire-close="${cancelWireClick}"');
  });

  test("panel root keeps data-lievit-focus-trap for the shared-enhancer family golden (inert here via the coexistence guard)", () => {
    // The shared focus-trap enhancer skips any element carrying data-controller~="lv-alert-dialog",
    // so this attribute does not double-trap the converted instance; it stays for the family golden.
    expect(markup).toContain("data-lievit-focus-trap");
  });

  test("panel root keeps data-lievit-escape-action wired to cancelWireClick (family golden)", () => {
    expect(markup).toContain('data-lievit-escape-action="${cancelWireClick}"');
  });

  test("cancel button carries data-initial-focus (FocusTrap focuses it on open)", () => {
    // The cancel button must be the element with data-initial-focus so the trap
    // moves focus there first (APG: least-destructive action for irreversible steps).
    expect(markup).toContain("data-initial-focus");
    // And it must be on the cancel button specifically
    expect(markup).toMatch(/data-slot="alert-dialog-cancel"[\s\S]*?data-initial-focus|data-initial-focus[\s\S]*?data-slot="alert-dialog-cancel"/);
  });
});

// ---------------------------------------------------------------------------
// DOM order: cancel first, confirm second (spec §6 key structural decisions)
// ---------------------------------------------------------------------------
describe("alert-dialog -- DOM order (spec §6)", () => {
  test("cancel button appears BEFORE confirm button in document order", () => {
    const cancelIdx = markup.indexOf('data-slot="alert-dialog-cancel"');
    const confirmIdx = markup.indexOf('data-slot="alert-dialog-confirm"');
    expect(cancelIdx).toBeGreaterThan(-1);
    expect(confirmIdx).toBeGreaterThan(-1);
    expect(cancelIdx).toBeLessThan(confirmIdx);
  });
});

// ---------------------------------------------------------------------------
// Variant token mapping (spec §3)
// ---------------------------------------------------------------------------
describe("alert-dialog -- variant token mapping (spec §3)", () => {
  test("destructive variant maps confirm button to --lv-color-destructive background", () => {
    expect(src).toContain('"destructive" -> "var(--lv-color-destructive)"');
    expect(src).toContain('"destructive" -> "var(--lv-color-destructive-fg)"');
  });

  test("warning variant maps confirm button to --lv-color-warning background", () => {
    expect(src).toContain('"warning"  -> "var(--lv-color-warning)"');
    expect(src).toContain('"warning"  -> "var(--lv-color-warning-fg)"');
  });

  test("default variant falls through to --lv-color-primary background", () => {
    // The switch default branch must resolve to primary
    expect(src).toContain('default         -> "var(--lv-color-primary)"');
    expect(src).toContain('default         -> "var(--lv-color-primary-fg)"');
  });

  test("icon tint switch covers destructive + warning + default", () => {
    // iconTint var mirrors the variant token mapping
    expect(src).toContain("iconTint");
    expect(src).toContain("var(--lv-color-destructive)");
    expect(src).toContain("var(--lv-color-warning)");
    expect(src).toContain("var(--lv-color-primary)");
  });

  test("cancel button is always ghost (no variant-driven fill)", () => {
    // The cancel class string must reference bg-transparent + accent hover, not a fill token
    expect(src).toContain("bg-transparent");
    expect(src).toContain("var(--lv-color-accent)");
  });

  test("data-variant is set on the panel root for CSS hooks and test targeting", () => {
    expect(markup).toContain('data-variant="${variant}"');
  });

  test("data-variant is set on the confirm button for CSS-driven hover tints", () => {
    expect(markup).toContain('data-slot="alert-dialog-confirm"');
    expect(markup).toContain('data-variant="${variant}"');
  });
});

// ---------------------------------------------------------------------------
// Loading state (spec §3 states)
// ---------------------------------------------------------------------------
describe("alert-dialog -- loading state (spec §3)", () => {
  test("loading=true sets aria-busy on the confirm button", () => {
    expect(markup).toContain('aria-busy="${loading ? "true" : null}"');
  });

  test("loading=true disables the confirm button", () => {
    expect(markup).toContain('disabled="${loading}"');
  });

  test("loading state renders a spinner inside the confirm button", () => {
    // The spinner element must be inside the confirm button region and gated on loading
    expect(src).toContain("@if(loading)");
    expect(src).toContain('data-slot="confirm-spinner"');
    expect(src).toContain("animate-spin");
  });

  test("cancel button does NOT carry disabled (always active regardless of loading)", () => {
    // The cancel button element must NOT have disabled="${loading}" on it.
    // Extract just the cancel button fragment and assert no disabled attr.
    const cancelFrag = markup.match(/data-slot="alert-dialog-cancel"[\s\S]*?<\/button>/)?.[0] ?? "";
    expect(cancelFrag).not.toContain("disabled=");
  });
});

// ---------------------------------------------------------------------------
// Wire channels (spec §6 + the SAFE escaped channel contract)
// ---------------------------------------------------------------------------
describe("alert-dialog -- wire channels (spec §6)", () => {
  test("confirm button emits l:click wired to confirmWireClick", () => {
    expect(markup).toContain('l:click="${confirmWireClick}"');
  });

  test("cancel button emits l:click wired to cancelWireClick", () => {
    expect(markup).toContain('l:click="${cancelWireClick}"');
  });

  test("confirmWireArgs are built via the SAFE Escape.htmlAttribute path", () => {
    expect(src).toContain("confirmWireArgs");
    expect(src).toContain("Escape.htmlAttribute");
    // The data-* fragment must be emitted via $unsafe on the already-escaped string
    expect(src).toContain("confirmDataAttrsMarkup");
    expect(markup).toContain("$unsafe{confirmDataAttrsMarkup}");
  });

  test("cancelWireArgs are built via the SAFE Escape.htmlAttribute path", () => {
    expect(src).toContain("cancelWireArgs");
    expect(src).toContain("cancelDataAttrsMarkup");
    expect(markup).toContain("$unsafe{cancelDataAttrsMarkup}");
  });

  test("confirmWireArgs key allowlist is enforced ([A-Za-z][A-Za-z0-9-]* regex)", () => {
    // The key regex guard from button.jte is replicated for both confirm + cancel arg sets
    expect(src).toMatch(/e\.getKey\(\)\.matches\("\[A-Za-z\]\[A-Za-z0-9-\]\*"\)/);
  });

  test("title and description use the default JTE ${} escaped channel (not $unsafe)", () => {
    // title and description are user/DB-derived; they must go through JTE's default escaping.
    expect(markup).toContain("${title}");
    expect(markup).toContain("${description}");
    // And they must NOT appear after $unsafe
    expect(markup).not.toContain("$unsafe{title}");
    expect(markup).not.toContain("$unsafe{description}");
  });

  test("attrs is emitted via $unsafe (TRUSTED raw channel for static author strings)", () => {
    expect(markup).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// data-slot topology (spec §3 + §6)
// ---------------------------------------------------------------------------
describe("alert-dialog -- data-slot topology (spec §3, §6)", () => {
  test('panel root carries data-slot="alert-dialog"', () => {
    expect(markup).toContain('data-slot="alert-dialog"');
  });

  test('header wrapper carries data-slot="alert-dialog-header"', () => {
    expect(markup).toContain('data-slot="alert-dialog-header"');
  });

  test('title element carries data-slot="alert-dialog-title"', () => {
    expect(markup).toContain('data-slot="alert-dialog-title"');
  });

  test('description element carries data-slot="alert-dialog-description"', () => {
    expect(markup).toContain('data-slot="alert-dialog-description"');
  });

  test('action pair wrapper carries data-slot="alert-dialog-actions"', () => {
    expect(markup).toContain('data-slot="alert-dialog-actions"');
  });

  test('confirm button carries data-slot="alert-dialog-confirm"', () => {
    expect(markup).toContain('data-slot="alert-dialog-confirm"');
  });

  test('cancel button carries data-slot="alert-dialog-cancel"', () => {
    expect(markup).toContain('data-slot="alert-dialog-cancel"');
  });
});

// ---------------------------------------------------------------------------
// Icon slot (spec §2 iconSlot)
// ---------------------------------------------------------------------------
describe("alert-dialog -- iconSlot (spec §2)", () => {
  test("iconSlot is rendered inside an aria-hidden container (icon is decorative)", () => {
    expect(src).toContain("@if(iconSlot != null)");
    // The wrapper that contains the iconSlot must carry aria-hidden="true"
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain('data-slot="alert-dialog-icon"');
  });

  test("icon slot container is inside the header region", () => {
    const headerFrag = markup.match(/data-slot="alert-dialog-header"[\s\S]*?<\/div>/)?.[0] ?? "";
    expect(headerFrag).toContain("iconSlot");
  });

  test("icon tint is applied via inline style referencing an --lv-* token var", () => {
    // The icon slot wrapper must have style="color:var(--lv-color-...)"
    expect(markup).toContain("color:${iconTint}");
    expect(src).toContain("iconTint");
  });
});

// ---------------------------------------------------------------------------
// CSP + security hygiene (spec §8 + architecture contract §3)
// ---------------------------------------------------------------------------
describe("alert-dialog -- CSP + security hygiene", () => {
  test("no inline <script> tags", () => {
    expect(markup).not.toMatch(/<script[\s>]/i);
  });

  test("no inline on*= event handler attributes", () => {
    // JTE hard rule: no on*= handlers (strict CSP refuses them)
    expect(markup).not.toMatch(/\bon[a-z]+=["']/i);
  });

  test("no hardcoded hex or rgb colour literals (all colours via --lv-* tokens)", () => {
    // v-next requirement: no literal colour values, only var(--lv-*)
    // Strip the doc-comment block to avoid false positives in prose.
    const bodyOnly = markup;
    expect(bodyOnly).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(bodyOnly).not.toMatch(/rgb\(/i);
    // oklch() literals are also not permitted in components (must use var())
    expect(bodyOnly).not.toMatch(/oklch\(/i);
  });

  test("$unsafe is only used for pre-escaped output (dataAttrsMarkup) or trusted attrs", () => {
    const unsafeCalls = markup.match(/\$unsafe\{([^}]+)\}/g) ?? [];
    const allowed = ["$unsafe{confirmDataAttrsMarkup}", "$unsafe{cancelDataAttrsMarkup}", "$unsafe{attrs}"];
    for (const call of unsafeCalls) {
      expect(allowed, `unexpected $unsafe usage: ${call}`).toContain(call);
    }
  });

  test("no @import dev.lievit.* (JTE classpath does not include dev.lievit at compile time)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit\./);
  });
});

// ---------------------------------------------------------------------------
// Buttons are real <button type="button"> elements (spec §4 a11y)
// ---------------------------------------------------------------------------
describe("alert-dialog -- button semantics (spec §4)", () => {
  test("confirm and cancel buttons are real <button type=\"button\"> elements", () => {
    // Both buttons must use type="button" (not type="submit", which would form-submit on Enter)
    const typeButtonCount = (markup.match(/type="button"/g) ?? []).length;
    expect(typeButtonCount).toBeGreaterThanOrEqual(2);
  });

  test("no <form method=\"dialog\"> wrapping either button (alert-dialog does not use native <dialog>)", () => {
    expect(markup).not.toContain('method="dialog"');
  });

  test("no <dialog> element (alert-dialog uses the WIRE dialog shell, not native <dialog>)", () => {
    expect(markup).not.toMatch(/<dialog[\s>]/i);
  });
});

// ---------------------------------------------------------------------------
// Focus ring on buttons (spec §5 --lv-ring token)
// ---------------------------------------------------------------------------
describe("alert-dialog -- focus ring (spec §5)", () => {
  test("cancel button carries focus-visible:shadow-[var(--lv-ring)] focus ring", () => {
    expect(src).toContain("focus-visible:shadow-[var(--lv-ring)]");
  });
});

// ---------------------------------------------------------------------------
// Panel token usage (spec §5)
// ---------------------------------------------------------------------------
describe("alert-dialog -- panel token usage (spec §5)", () => {
  test("panel uses --lv-color-popover for background", () => {
    expect(markup).toContain("var(--lv-color-popover)");
  });

  test("panel uses --lv-color-popover-fg for text", () => {
    expect(markup).toContain("var(--lv-color-popover-fg)");
  });

  test("panel uses --lv-color-border for border", () => {
    expect(markup).toContain("var(--lv-color-border)");
  });

  test("panel uses --lv-shadow-xl for elevation (dialog-grade shadow)", () => {
    expect(markup).toContain("var(--lv-shadow-xl)");
  });

  test("panel uses --lv-radius-lg for border-radius", () => {
    expect(markup).toContain("var(--lv-radius-lg)");
  });

  test("panel uses --lv-z-modal for z-index", () => {
    expect(markup).toContain("var(--lv-z-modal)");
  });

  test("description uses --lv-color-muted-fg for subdued text", () => {
    expect(markup).toContain("var(--lv-color-muted-fg)");
  });

  test("panel uses --lv-font-sans for font family", () => {
    expect(markup).toContain("var(--lv-font-sans)");
  });
});
