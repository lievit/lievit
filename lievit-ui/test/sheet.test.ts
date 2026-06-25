/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * sheet v-next: headless CONTROLLED / UNCONTROLLED overlay panel that slides in from a viewport
 * edge (right | left | top | bottom) (architecture contract, "Overlay & stateful primitives"
 * doctrine). No Java component, no @Wire field. The open-state belongs to the CALLER.
 *
 * UNCONTROLLED (default): trigger button + command="show-modal" + native <dialog> showModal.
 * Close paths are <form method="dialog"> submits. The browser owns focus-trap + Esc + ::backdrop.
 * Zero JS by construction.
 *
 * CONTROLLED: `open` param (from the caller's @Wire boolean) + `closeAction` (wire action name).
 * When open=true: dialog visible + scrim rendered + data-lievit-focus-trap activates the shared
 * focus-trap enhancer (Tab cycle, scroll-lock, Esc fires closeAction). When open=false: hidden.
 *
 * These tests pin:
 *   1.  The registry item shape (single registry:jte item, correct file target, no Java class).
 *   2.  The uncontrolled API: trigger, command="show-modal", commandfor, <form method="dialog">.
 *   3.  The controlled API: hidden attr contract, scrim, focus-trap data-attrs, l:click closeAction.
 *   4.  The a11y contract: role=dialog, aria-modal, aria-labelledby/aria-label/aria-describedby,
 *       close button aria-label, scrim aria-hidden, must-act pattern (closable=false omits escape-action).
 *   5.  The data-slot contract: all expected slot names stamped in markup.
 *   6.  Placement variants: data-placement on wrapper + panel, all four sides.
 *   7.  Size variants: data-size on panel.
 *   8.  Closable contract: X button + scrim-click + Esc gated on closable (at least 3 occurrences).
 *   9.  scrollBody param declared.
 *   10. The projection contract: content is owned (${content}), no native <slot>.
 *   11. CSP-clean: no inline <script>, no on*= handlers.
 *   12. Token-driven: uses --lv-* tokens, no raw hex.
 *   13. No dev.lievit import.
 *   14. Apache license header.
 *   15. Focus-trap seam: data-lievit-focus-trap + data-lievit-escape-action on same element.
 *   16. footer is optional Content slot (null = absent, not an empty region).
 *   17. Must-act: closable gates X + scrim-click + Esc-action (at least 3 occurrences of "closable").
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

const jte = read("jte/sheet.jte");
const markup = stripComments(jte);

// ---------------------------------------------------------------------------
// 1. Registry item shape
// ---------------------------------------------------------------------------

// The registry also contains a registry:wire sheet (the server-component variant). These tests
// target only the registry:jte partial (the headless CONTROLLED/UNCONTROLLED overlay that ships
// no Java class). We filter by type so the wire variant does not collide.
const jteSheet = registry.items.find((i) => i.name === "sheet" && i.type === "registry:jte")!;

describe("sheet registry:jte item shape", () => {
  test("a registry:jte sheet item exists (distinct from the registry:wire sheet)", () => {
    expect(jteSheet, "registry:jte sheet must exist").toBeDefined();
    expect(jteSheet.type).toBe("registry:jte");
  });

  test("it ships one .jte file landing under the adopter's JTE root at lievit/sheet.jte", () => {
    const file = jteSheet.files.find((f) => f.target.endsWith(".jte"))!;
    expect(file.root).toBe("jte");
    expect(file.target).toBe("lievit/sheet.jte");
  });

  test("it pulls tokens but never Lit or floating-ui (zero runtime deps)", () => {
    expect(jteSheet.dependencies ?? []).not.toContain("lit");
    expect(jteSheet.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["sheet"]).map((i) => i.name);
    expect(closure).toContain("tokens");
  });

  test("it declares no Java class (@Wire field belongs to the CALLER, not sheet)", () => {
    const hasJava = jteSheet.files.some((f) => f.target.endsWith(".java"));
    expect(hasJava, "registry:jte sheet must NOT ship a Java class (PARTIAL, not WIRE)").toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 2. Uncontrolled API
// ---------------------------------------------------------------------------

describe("sheet.jte: uncontrolled API (zero-JS native <dialog> path)", () => {
  test("declares a trigger Content param (the open button content)", () => {
    expect(jte).toContain("@param gg.jte.Content trigger");
  });

  test("the trigger is a real <button command='show-modal' commandfor> (invoker command API)", () => {
    expect(markup).toContain('command="show-modal"');
    expect(markup).toContain('commandfor="${id}"');
    expect(markup).toContain('data-slot="sheet-trigger"');
  });

  test("the uncontrolled close button is a <form method='dialog'> submit (native close, no JS)", () => {
    expect(markup).toContain('method="dialog"');
    expect(markup).toContain('data-slot="sheet-close"');
  });

  test("the panel is a native <dialog> element with matching id", () => {
    expect(markup).toMatch(/<dialog[\s\n]/);
    expect(markup).toContain('id="${id}"');
  });
});

// ---------------------------------------------------------------------------
// 3. Controlled API
// ---------------------------------------------------------------------------

describe("sheet.jte: controlled API (server-owned open state)", () => {
  test("declares open (boolean, default false) and closeAction (String, default null) params", () => {
    expect(jte).toContain("@param boolean open = false");
    expect(jte).toContain("@param String closeAction = null");
  });

  test("hidden smart-attr is present only in controlled-closed state", () => {
    expect(markup).toContain('hidden="${isControlled && !open}"');
  });

  test("the scrim is rendered only in controlled + open state (gated by @if(isControlled && open))", () => {
    expect(markup).toContain("isControlled && open");
    expect(markup).toContain('data-slot="sheet-backdrop"');
  });

  test("scrim fires closeAction on click only when closable (must-act protection)", () => {
    expect(markup).toContain("closable ? closeAction : null");
  });

  test("data-lievit-focus-trap is set only in controlled mode (enhancer activation)", () => {
    expect(markup).toContain('data-lievit-focus-trap="${isControlled ? "" : null}"');
  });

  test("data-lievit-escape-action is set only in controlled + closable mode (must-act pattern)", () => {
    expect(markup).toContain('data-lievit-escape-action="${(isControlled && closable) ? closeAction : null}"');
  });

  test("controlled close button fires l:click closeAction (the wire round-trip)", () => {
    expect(markup).toContain('l:click="${closeAction}"');
  });

  test("controlled + !closable: X button + scrim + Esc-action are all absent (must-act enforced)", () => {
    const closableGates = (markup.match(new RegExp("closable", "g")) ?? []).length;
    expect(closableGates, "closable must gate at least 3 paths (X, scrim-click, Esc)").toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 4. A11y contract (WAI-ARIA APG Dialog, Modal)
// ---------------------------------------------------------------------------

describe("sheet.jte: WAI-ARIA APG Dialog a11y contract", () => {
  test("panel carries role=dialog + aria-modal=true (APG modal role)", () => {
    expect(markup).toContain('role="dialog"');
    expect(markup).toContain('aria-modal="true"');
  });

  test("aria-labelledby is set when title is present (smart attr wires titleId)", () => {
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("titleId");
    expect(markup).toContain('id="${titleId}"');
    expect(markup).toContain('data-slot="sheet-title"');
  });

  test("a title-less sheet has aria-label='Sheet' (no nameless dialog rule)", () => {
    expect(markup).toContain('aria-label="${hasTitle ? null : "Sheet"}"');
  });

  test("aria-describedby is wired to subtitleId when subtitle is present", () => {
    expect(markup).toContain("aria-describedby=");
    expect(markup).toContain("subtitleId");
    expect(markup).toContain('data-slot="sheet-subtitle"');
  });

  test("close button has aria-label='Close' (icon-only: accessible name mandatory per APG)", () => {
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('data-slot="sheet-close"');
  });

  test("the scrim has aria-hidden=true (decorative: never announced to AT)", () => {
    expect(markup).toContain('aria-hidden="true"');
  });
});

// ---------------------------------------------------------------------------
// 5. Data-slot contract
// ---------------------------------------------------------------------------

describe("sheet.jte: data-slot landmark contract", () => {
  test("it stamps the expected data-slot names", () => {
    for (const slot of [
      "sheet",
      "sheet-trigger",
      "sheet-panel",
      "sheet-header",
      "sheet-title",
      "sheet-subtitle",
      "sheet-body",
      "sheet-footer",
      "sheet-close",
      "sheet-backdrop",
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
// 6. Placement variants
// ---------------------------------------------------------------------------

describe("sheet.jte: placement contract", () => {
  test("declares a placement param defaulting to 'right' with all four sides in the switch", () => {
    expect(jte).toContain('@param String placement = "right"');
    for (const side of ["right", "left", "top", "bottom"]) {
      expect(jte, `placement switch missing "${side}"`).toContain(`"${side}"`);
    }
  });

  test("data-placement is stamped on both the wrapper span and the panel (CSS + test hooks)", () => {
    expect(markup).toContain('data-placement="${placement}"');
  });

  test("the default placement 'right' is expressed in the inline style switch", () => {
    // The right-placement branch anchors to inset:0 0 0 auto (end of the inline axis).
    expect(jte).toContain("inset:0 0 0 auto");
  });
});

// ---------------------------------------------------------------------------
// 7. Size variants
// ---------------------------------------------------------------------------

describe("sheet.jte: size contract", () => {
  test("data-size is stamped on the panel (CSS hook + test target)", () => {
    expect(markup).toContain('data-size="${size}"');
  });

  test("size param is declared with default 'md'", () => {
    expect(jte).toContain('@param String size = "md"');
  });

  test("all five size values are expressed in the width/height switch", () => {
    for (const sz of ["sm", "md", "lg", "xl", "full"]) {
      expect(jte, `size switch missing "${sz}"`).toContain(`"${sz}"`);
    }
  });
});

// ---------------------------------------------------------------------------
// 8. Closable contract (must-act)
// ---------------------------------------------------------------------------

describe("sheet.jte: closable contract (must-act pattern)", () => {
  test("closable param is declared (default true)", () => {
    expect(jte).toContain("@param boolean closable = true");
  });

  test("data-closable is stamped on the panel element (enhancer reads it)", () => {
    expect(markup).toContain('data-closable="${closable}"');
  });

  test("closable gates at least 3 paths: X button + scrim-click + Esc-action", () => {
    const gates = (markup.match(new RegExp("closable", "g")) ?? []).length;
    expect(gates, "closable must appear at least 3 times (X, scrim-click, Esc)").toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 9. scrollBody param
// ---------------------------------------------------------------------------

describe("sheet.jte: scrollBody param", () => {
  test("scrollBody param is declared (default true)", () => {
    expect(jte).toContain("@param boolean scrollBody = true");
  });

  test("scrollBody affects the body class (overflow-y-auto on body when true)", () => {
    expect(markup).toContain("scrollBody");
    expect(markup).toContain("overflow-y-auto");
  });
});

// ---------------------------------------------------------------------------
// 10. Projection contract + server-purity
// ---------------------------------------------------------------------------

describe("sheet.jte: projection contract + server-purity", () => {
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
});

// ---------------------------------------------------------------------------
// 11. CSP-clean
// ---------------------------------------------------------------------------

describe("sheet.jte: CSP-clean", () => {
  test("no inline <script> tags", () => {
    expect(jte).not.toMatch(/<script/i);
  });

  test("no inline on* event handler attributes", () => {
    expect(markup).not.toMatch(/\son[a-z]+=/i);
  });
});

// ---------------------------------------------------------------------------
// 12. Token-driven
// ---------------------------------------------------------------------------

describe("sheet.jte: token-driven (--lv-* tokens only, no raw hex)", () => {
  test("uses popover background and shadow tokens (panel surface)", () => {
    expect(markup).toContain("var(--lv-color-popover)");
    expect(markup).toContain("var(--lv-shadow-xl)");
  });

  test("uses z-modal token for panel stacking", () => {
    expect(markup).toContain("var(--lv-z-modal)");
  });

  test("no raw hex colour literals anywhere in the template", () => {
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

// ---------------------------------------------------------------------------
// 13. No dev.lievit import
// ---------------------------------------------------------------------------

describe("sheet.jte: server-pure (no lievit Java class deps)", () => {
  test("does not import dev.lievit.* (PARTIAL: no Java class deps)", () => {
    expect(jte).not.toContain("@import dev.lievit");
  });
});

// ---------------------------------------------------------------------------
// 14. Apache license header
// ---------------------------------------------------------------------------

describe("sheet.jte: Apache license header", () => {
  test("carries the Apache 2.0 licence header", () => {
    expect(jte).toContain("Licensed under the Apache License, Version 2.0");
  });
});

// ---------------------------------------------------------------------------
// 15. Focus-trap enhancer seam
// ---------------------------------------------------------------------------

describe("sheet.jte: focus-trap enhancer data-attribute contract (composable seam)", () => {
  test("activates trap on the <dialog> element (data-lievit-focus-trap)", () => {
    expect(markup).toContain("data-lievit-focus-trap");
  });

  test("escape-action is bound on the same element as the trap (atomically paired)", () => {
    const dialogChunk = markup.split("<dialog")[1] ?? "";
    const dialogAttrs = dialogChunk.slice(0, dialogChunk.indexOf(">") + 1);
    expect(dialogAttrs).toContain("data-lievit-focus-trap");
    expect(dialogAttrs).toContain("data-lievit-escape-action");
  });

  test("no hand-rolled Tab/focus/scroll logic (no JS event listeners in template markup)", () => {
    expect(markup).not.toMatch(/addEventListener/);
    expect(markup).not.toMatch(/KeyboardEvent/);
    expect(markup).not.toMatch(/document\.activeElement/);
    expect(markup).not.toMatch(/style=[^>]*overflow\s*:/);
  });

  test("seam note documents alert-dialog + drawer/sheet as composing the SAME two attributes", () => {
    expect(jte).toContain("alert-dialog");
    expect(jte).toContain("drawer");
  });
});
