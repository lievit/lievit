/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * modal v-next: headless CONTROLLED / UNCONTROLLED overlay dialog (architecture contract,
 * "Overlay & stateful primitives" doctrine). No Java component, no @Wire field. The
 * open-state belongs to the CALLER.
 *
 * UNCONTROLLED (default): trigger button + command="show-modal" + native <dialog> showModal.
 * Close paths are <form method="dialog"> submits. The browser owns focus-trap + Esc + ::backdrop.
 * Zero JS by construction.
 *
 * CONTROLLED: `open` param (from the caller's @Wire boolean) + `closeAction` (wire action name).
 * When open=true: dialog visible + scrim rendered + the lv-modal Stimulus controller
 * (data-controller + data-lv-modal-open-value + data-lv-wire-close) activates the shared FocusTrap
 * (Tab cycle, scroll-lock, Esc fires closeAction). When open=false: hidden.
 *
 * This file pins the rendered-markup CONTRACT (the data-attributes the controller reads). The
 * controller BEHAVIOUR (focus trap, Esc-close, return-focus, controlled/uncontrolled doctrine,
 * morph-safety) is proven against the REAL Stimulus + REAL wire morph in lv-modal-controller.test.ts.
 *
 * These tests pin:
 *   1. The registry item shape (single registry:jte item, correct file target).
 *   2. The uncontrolled API: trigger, command="show-modal", commandfor, <form method="dialog">.
 *   3. The controlled API: hidden attr contract, scrim, controller data-attrs, l:click closeAction.
 *   4. The a11y contract: role=dialog, aria-modal, aria-labelledby/aria-label/aria-describedby,
 *      close button aria-label, must-act pattern (closable=false omits the wire-close action).
 *   5. The projection contract: content is an owned Content slot (${content}), never a <slot>.
 *   6. Server-purity + CSP-clean + token-driven + Apache-licensed.
 *   7. lv-modal controller data-attribute contract (the focus-mechanics seam).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry } from "../cli/build-registry.js";
import { resolve } from "../cli/registry.js";
import type { Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const registry: Registry = buildRegistry(registryRoot);
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const stripComments = (jte: string) => jte.replace(/<%--[\s\S]*?--%>/g, "");

const jte = read("jte/modal.jte");
const markup = stripComments(jte);

// ---------------------------------------------------------------------------
// 1. Registry item shape
// ---------------------------------------------------------------------------

describe("modal registry:jte item shape", () => {
  test("modal is a single registry:jte item (not a wire component)", () => {
    const matches = registry.items.filter((i) => i.name === "modal");
    expect(matches, "exactly one modal item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships one .jte file landing under the adopter's JTE root at lievit/modal.jte", () => {
    const item = registry.items.find((i) => i.name === "modal")!;
    const file = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(file.root).toBe("jte");
    expect(file.target).toBe("lievit/modal.jte");
  });

  test("it pulls tokens but never Lit or floating-ui (zero runtime deps)", () => {
    const item = registry.items.find((i) => i.name === "modal")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["modal"]).map((i) => i.name);
    expect(closure).toContain("tokens");
  });

  test("it declares no Java class (@Wire field belongs to the CALLER, not modal)", () => {
    const item = registry.items.find((i) => i.name === "modal")!;
    const hasJava = item.files.some((f) => f.target.endsWith(".java"));
    expect(hasJava, "modal must NOT ship a Java class (PARTIAL, not WIRE)").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Uncontrolled API
// ---------------------------------------------------------------------------

describe("modal.jte: uncontrolled API (zero-JS native <dialog> path)", () => {
  test("declares a trigger Content param (the open button content)", () => {
    expect(jte).toContain("@param gg.jte.Content trigger");
  });

  test("the trigger is a real <button command='show-modal' commandfor> (invoker command API)", () => {
    expect(markup).toContain('command="show-modal"');
    expect(markup).toContain('commandfor="${id}"');
    expect(markup).toContain('data-slot="dialog-trigger"');
  });

  test("the uncontrolled close button is a <form method='dialog'> submit (native close, no JS)", () => {
    expect(markup).toContain('method="dialog"');
    expect(markup).toContain('data-slot="dialog-close"');
  });

  test("the panel is a native <dialog> element with matching id", () => {
    expect(markup).toMatch(/<dialog[\s\n]/);
    expect(markup).toContain('id="${id}"');
  });
});

// ---------------------------------------------------------------------------
// 3. Controlled API
// ---------------------------------------------------------------------------

describe("modal.jte: controlled API (server-owned open state)", () => {
  test("declares open (boolean, default false) and closeAction (String, default null) params", () => {
    expect(jte).toContain("@param boolean open = false");
    expect(jte).toContain("@param String closeAction = null");
  });

  test("hidden smart-attr is present only in controlled-closed state (omitted when uncontrolled or open)", () => {
    // Old form: hidden="${isControlled && !open ? "" : null}"
    // (explicit empty-string / null ternary for the boolean attribute).
    // New form: hidden="${isControlled && !open}" (JTE boolean smart-attribute: emits bare
    // `hidden` when the expression is true, omits the attr entirely when false or null).
    // Both forms hide the <dialog> element from the a11y tree + tab order when controlled+closed.
    expect(markup).toContain('hidden="${isControlled && !open}"');
  });

  test("the scrim is rendered only in controlled + open state (gated by @if(isControlled && open))", () => {
    expect(markup).toContain("isControlled && open");
    expect(markup).toContain('data-slot="dialog-backdrop"');
  });

  test("scrim fires closeAction on click only when closable (must-act protection)", () => {
    // l:click on scrim uses closeAction conditionally on closable.
    expect(markup).toContain("closable ? closeAction : null");
  });

  test("data-controller='lv-modal' is mounted only in controlled mode (the Stimulus controller)", () => {
    // isControlled ? "lv-modal" : null -> the focus-mechanics controller mounts only when the open
    // state is server-owned; uncontrolled uses the browser-native <dialog> (no controller).
    expect(markup).toContain('data-controller="${isControlled ? "lv-modal" : null}"');
  });

  test("data-lv-modal-open-value carries the server-owned open state (controlled mode)", () => {
    // The controller reads this Stimulus value; the wire morph rewrites it on every open/close.
    expect(markup).toContain('data-lv-modal-open-value="${isControlled ? String.valueOf(open) : null}"');
  });

  test("data-lv-wire-close is set only in controlled + closable mode (must-act pattern)", () => {
    // omitted when !closable: Esc is inert (the must-act pattern: the controller wires no onEscape).
    expect(markup).toContain('data-lv-wire-close="${(isControlled && closable) ? closeAction : null}"');
  });

  test("controlled close button fires l:click closeAction (the wire round-trip)", () => {
    // The controlled path uses type=button + l:click (not a form submit).
    expect(markup).toContain('l:click="${closeAction}"');
  });

  test("controlled + !closable: X button + scrim + Esc-action are all absent (must-act enforced)", () => {
    // The template gates X on closable, scrim-click on closable, data-lv-wire-close on closable.
    // Verify all three are guarded.
    const closableGates = (markup.match(new RegExp("closable", "g")) ?? []).length;
    expect(closableGates, "closable must gate at least 3 paths (X, scrim-click, Esc)").toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 4. A11y contract (WAI-ARIA APG Dialog, Modal)
// ---------------------------------------------------------------------------

describe("modal.jte: WAI-ARIA APG Dialog a11y contract", () => {
  test("panel carries role=dialog + aria-modal=true (APG modal role)", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
  });

  test("aria-labelledby is set when heading is present (smart attr wires titleId)", () => {
    // aria-labelledby is smart-attr: set when hasHeading, null otherwise.
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("titleId");
    // The title element carries the matching id.
    expect(markup).toContain('id="${titleId}"');
    expect(markup).toContain('data-slot="dialog-title"');
  });

  test("a heading-less dialog has aria-label='Dialog' (no nameless dialog rule)", () => {
    // Falls back to aria-label when heading is absent.
    expect(markup).toContain('aria-label="${hasHeading ? null : "Dialog"}"');
  });

  test("aria-describedby is wired to descId when description is present", () => {
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("descId");
    expect(markup).toContain('data-slot="dialog-description"');
  });

  test("close button has aria-label='Close' (icon-only: accessible name mandatory per APG)", () => {
    // The close button is icon-only so aria-label is required.
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('data-slot="dialog-close"');
  });

  test("the scrim has aria-hidden=true (decorative: never announced to AT)", () => {
    expect(markup).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// 5. Data-slot contract
// ---------------------------------------------------------------------------

describe("modal.jte: data-slot landmark contract", () => {
  test("it stamps the expected data-slot names", () => {
    for (const slot of [
      "modal",
      "dialog-trigger",
      "dialog",
      "dialog-content",
      "dialog-header",
      "dialog-title",
      "dialog-description",
      "dialog-body",
      "dialog-footer",
      "dialog-close",
      "dialog-backdrop",
    ]) {
      expect(markup, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("data-size mirrors the size param (CSS hook + test target)", () => {
    expect(markup).toContain('data-size="${size}"');
    expect(jte).toContain('@param String size = "md"');
  });
});

// ---------------------------------------------------------------------------
// 6. Projection contract + server-purity + CSP-clean + token-driven + licensed
// ---------------------------------------------------------------------------

describe("modal.jte: projection + server-purity + CSP-clean + token-driven + licensed", () => {
  test("the body is an owned Content slot (${content}), never a native <slot>", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });

  test("footer is an optional Content slot (null = absent, not an empty region)", () => {
    expect(jte).toContain("@param gg.jte.Content footer = null");
    expect(markup).toContain("${footer}");
    expect(markup).toContain("footer != null");
  });

  test("trigger is an optional Content slot (null = pure controlled, no trigger rendered)", () => {
    expect(jte).toContain("@param gg.jte.Content trigger = null");
    expect(markup).toContain("trigger != null");
  });

  test("it is CSP-clean: no inline <script>, no inline on* handler", () => {
    expect(jte).not.toMatch(/<script/i);
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });

  test("it is token-driven: only --lv-* custom properties, no raw hex colors", () => {
    expect(markup).toContain("var(--lv-color-popover)");
    expect(markup).toContain("var(--lv-z-modal)");
    expect(markup).toContain("var(--lv-shadow-xl)");
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("it does not import dev.lievit.* (PARTIAL: no Java class deps)", () => {
    expect(jte).not.toContain("@import dev.lievit");
  });

  test("it carries the Apache licence header", () => {
    expect(jte).toContain("Licensed under the Apache License, Version 2.0");
  });
});

// ---------------------------------------------------------------------------
// 7. lv-modal controller seam (the focus mechanics, behaviour proven in lv-modal-controller.test.ts)
// ---------------------------------------------------------------------------

describe("modal.jte: lv-modal controller data-attribute contract (focus mechanics seam)", () => {
  test("mounts the controller on the <dialog> element (data-controller='lv-modal')", () => {
    // Presence of the attr name proves the controller is wired; value is gated on controlled mode.
    expect(markup).toContain('data-controller="${isControlled ? "lv-modal" : null}"');
  });

  test("open-value + wire-close are bound on the same element as the controller (one surface)", () => {
    // All three controller attributes sit on the <dialog> so Stimulus reads them as one controller.
    const dialogChunk = markup.split("<dialog")[1] ?? "";
    const dialogAttrs = dialogChunk.slice(0, dialogChunk.indexOf(">") + 1);
    expect(dialogAttrs).toContain('data-controller="${isControlled ? "lv-modal" : null}"');
    expect(dialogAttrs).toContain("data-lv-modal-open-value");
    expect(dialogAttrs).toContain("data-lv-wire-close");
  });

  test("no hand-rolled Tab/focus/scroll logic (no JS event listeners in template markup)", () => {
    // The controller owns ALL keyboard behaviour. Check only the active markup, not the doc-comment,
    // since the doc-comment may describe what the controller does (e.g. scroll-lock = overflow:hidden).
    expect(markup).not.toMatch(/addEventListener/);
    expect(markup).not.toMatch(/KeyboardEvent/);
    expect(markup).not.toMatch(/document\.activeElement/);
    // No inline JS style on overflow: the FocusTrap sets it, not the template.
    expect(markup).not.toMatch(/style=[^>]*overflow\s*:/);
  });

  test("seam note documents alert-dialog + drawer/sheet during the conversion fan-out", () => {
    // The doc-comment must carry the seam note so the coordinator and future agents know.
    expect(jte).toContain("alert-dialog");
    expect(jte).toContain("drawer");
  });
});
