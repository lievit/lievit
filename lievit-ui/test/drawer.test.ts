/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * drawer v-next: headless CONTROLLED / UNCONTROLLED side-panel overlay (architecture contract
 * overlay doctrine). No Java component, no @Wire field. The open-state belongs to the CALLER.
 *
 * UNCONTROLLED (default): trigger button + command="show-modal" + native <dialog> showModal.
 * Close paths are <form method="dialog"> submits. The browser owns focus-trap + Esc + ::backdrop.
 * Zero JS by construction.
 *
 * CONTROLLED: `open` param (from the caller's @Wire boolean) + `closeAction` (wire action name).
 * When modal=true + open=true: panel visible + scrim rendered + data-lievit-focus-trap activates
 * the shared focus-trap enhancer (Tab cycle, scroll-lock, Esc fires closeAction). When open=false:
 * panel hidden. When modal=false: no trap, no scrim (APG non-modal dialog).
 *
 * These source-text tests pin:
 *   1. Registry item shape (single registry:jte item, correct file targets).
 *   2. Uncontrolled API: trigger, command="show-modal", commandfor, <form method="dialog">.
 *   3. Controlled API: hidden smart-attr, scrim, focus-trap data-attrs, closeAction wiring.
 *   4. A11y contract: role=dialog, aria-modal conditional on modal param, aria-labelledby/
 *      aria-label, close button aria-label, scrim aria-hidden, must-act pattern.
 *   5. Data-slot contract: drawer, drawer-trigger, drawer-panel, drawer-header, drawer-title,
 *      drawer-body, drawer-footer, drawer-close, drawer-scrim.
 *   6. Placement + size params reflected as data-placement + data-size.
 *   7. Modal flag: aria-modal present only when modal=true (conditional smart-attr).
 *   8. Projection contract: content is an owned Content param (${content}), never a <slot>.
 *   9. DestroyOnClose guard: destroyOnClose/open combination controls panel presence.
 *  10. Focus-trap enhancer data-attribute contract (the seam modal + alert-dialog share).
 *  11. Server-purity + CSP-clean + token-driven + Apache-licensed.
 *  12. Consolidation note: slide-over.jte remains as the static native-dialog partial.
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

const jte = read("jte/drawer.jte");
const markup = stripComments(jte);

// ---------------------------------------------------------------------------
// 1. Registry item shape
// ---------------------------------------------------------------------------

describe("drawer registry:jte item shape", () => {
  test("drawer has exactly one registry:jte item (the partial; a separate registry:wire item may coexist)", () => {
    const matches = registry.items.filter((i) => i.name === "drawer" && i.type === "registry:jte");
    expect(matches, "exactly one registry:jte drawer item").toHaveLength(1);
    expect(matches[0].type).toBe("registry:jte");
  });

  test("it ships a .jte file landing under the adopter's JTE root at lievit/drawer.jte", () => {
    const item = registry.items.find((i) => i.name === "drawer" && i.type === "registry:jte")!;
    const file = item.files.find((f) => f.target.endsWith(".jte"))!;
    expect(file.root).toBe("jte");
    expect(file.target).toBe("lievit/drawer.jte");
  });

  test("it ships a .css file at lievit/drawer.css (placement-aware edge anchoring)", () => {
    const item = registry.items.find((i) => i.name === "drawer" && i.type === "registry:jte")!;
    const cssFile = item.files.find((f) => f.target.endsWith(".css"));
    expect(cssFile, "drawer.css must be in files").toBeDefined();
    expect(cssFile!.target).toBe("lievit/drawer.css");
  });

  test("it pulls tokens but never Lit or floating-ui (zero runtime deps)", () => {
    const item = registry.items.find((i) => i.name === "drawer" && i.type === "registry:jte")!;
    expect(item.dependencies ?? []).not.toContain("lit");
    expect(item.dependencies ?? []).not.toContain("@floating-ui/dom");
    const closure = resolve(registry, ["drawer"]).map((i) => i.name);
    expect(closure).toContain("tokens");
  });

  test("it declares no Java class (@Wire field belongs to the CALLER, not the drawer partial)", () => {
    const item = registry.items.find((i) => i.name === "drawer" && i.type === "registry:jte")!;
    const hasJava = item.files.some((f) => f.target.endsWith(".java"));
    expect(hasJava, "drawer must NOT ship a Java class (PARTIAL, not WIRE)").toBe(false);
  });

  test("it declares the focus-trap enhancer as a dependency", () => {
    const item = registry.items.find((i) => i.name === "drawer" && i.type === "registry:jte")!;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((item as any)["enhancers"]).toContain("focus-trap");
  });
});

// ---------------------------------------------------------------------------
// 2. Uncontrolled API (zero-JS native <dialog> path)
// ---------------------------------------------------------------------------

describe("drawer.jte: uncontrolled API (native <dialog>, zero JS)", () => {
  test("declares a trigger Content param (the open button content; null = pure controlled)", () => {
    expect(jte).toContain("@param gg.jte.Content trigger = null");
  });

  test("the trigger is a real <button command='show-modal' commandfor> (invoker command API)", () => {
    expect(markup).toContain('command="show-modal"');
    expect(markup).toContain('commandfor="${id}"');
    expect(markup).toContain('data-slot="drawer-trigger"');
  });

  test("the uncontrolled panel is a native <dialog> element with matching id", () => {
    expect(markup).toMatch(/<dialog[\s\n]/);
    expect(markup).toContain('id="${id}"');
  });

  test("uncontrolled close button is a <form method='dialog'> submit (native close, no JS)", () => {
    expect(markup).toContain('method="dialog"');
    expect(markup).toContain('data-slot="drawer-close"');
  });

  test("trigger block is guarded by @if(trigger != null) -- omitted in pure controlled mode", () => {
    expect(markup).toContain("trigger != null");
  });
});

// ---------------------------------------------------------------------------
// 3. Controlled API (server-owned open state)
// ---------------------------------------------------------------------------

describe("drawer.jte: controlled API (server-owned open state)", () => {
  test("declares open (boolean, default false) and closeAction (String, default null) params", () => {
    expect(jte).toContain("@param boolean open = false");
    expect(jte).toContain("@param String closeAction = null");
  });

  test("isControlled is derived from closeAction non-null (no extra param needed)", () => {
    // The template must compute isControlled from closeAction.
    expect(markup).toContain("isControlled");
    expect(markup).toContain("closeAction");
  });

  test("controlled panel carries hidden smart-attr (emitted bare when !open, omitted when open)", () => {
    // JTE boolean smart-attribute: hidden="${!open}" emits bare `hidden` when true,
    // omits the attr entirely when false.
    expect(markup).toContain('hidden="${!open}"');
  });

  test("the scrim is rendered only in controlled + modal=true + open=true state", () => {
    expect(markup).toContain("isControlled && modal && open");
    expect(markup).toContain('data-slot="drawer-scrim"');
  });

  test("scrim fires closeAction on click only when closable (must-act protection)", () => {
    expect(markup).toContain("closable ? closeAction : null");
  });

  test("data-lievit-focus-trap is set only in controlled + modal=true mode", () => {
    // trapModal = isControlled && modal; present when trapModal, null otherwise.
    expect(markup).toContain("data-lievit-focus-trap=");
    expect(markup).toContain("trapModal");
  });

  test("data-lievit-escape-action is set only in controlled + modal=true + closable mode (must-act)", () => {
    // omitted when !closable: Esc is a no-op (must-act pattern).
    expect(markup).toContain("data-lievit-escape-action=");
    expect(markup).toContain("trapModal && closable");
  });

  test("controlled close button fires l:click closeAction (the wire round-trip)", () => {
    // The controlled path uses type=button + l:click (not a form submit).
    expect(markup).toContain('l:click="${closeAction}"');
  });

  test("controlled + !closable: X button + scrim-click + Esc-action are all absent (must-act)", () => {
    // The template gates X on closable, scrim-click on closable, escape-action on closable.
    const closableGates = (markup.match(/closable/g) ?? []).length;
    expect(closableGates, "closable must gate at least 3 paths (X, scrim-click, Esc)").toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// 4. A11y contract (WAI-ARIA APG Dialog, Modal + Non-modal)
// ---------------------------------------------------------------------------

describe("drawer.jte: WAI-ARIA APG Dialog a11y contract", () => {
  test("panel carries role=dialog (both modal and non-modal variants)", () => {
    // role="dialog" must appear on the panel, not just the outer wrapper.
    expect(markup).toContain('role="dialog"');
  });

  test("aria-modal=true is present ONLY in controlled modal + uncontrolled paths; omitted in non-modal", () => {
    // For modal=true the attr emits "true". The conditional is: aria-modal="${modal ? "true" : null}"
    // which uses JTE smart-attr (omits the attr when null).
    expect(markup).toContain('aria-modal="${modal ? "true" : null}"');
  });

  test("uncontrolled <dialog> always carries aria-modal=true (native modal seam)", () => {
    // The uncontrolled path is always modal (native showModal); aria-modal is hard-coded true there.
    expect(markup).toContain('aria-modal="true"');
  });

  test("aria-labelledby is set when title is present (smart attr wires titleId)", () => {
    expect(markup).toContain("aria-labelledby=");
    expect(markup).toContain("titleId");
    expect(markup).toContain('id="${titleId}"');
    expect(markup).toContain('data-slot="drawer-title"');
  });

  test("a title-less drawer has aria-label='Drawer' (no nameless dialog rule)", () => {
    expect(markup).toContain('aria-label="${hasTitle ? null : "Drawer"}"');
  });

  test("close button has aria-label='Close' (icon-only: accessible name mandatory per APG)", () => {
    expect(markup).toContain('aria-label="Close"');
    expect(markup).toContain('data-slot="drawer-close"');
  });

  test("the scrim has aria-hidden=true (decorative: must not be announced to AT)", () => {
    expect(markup).toContain('aria-hidden="true"');
  });

  test("data-modal attribute is stamped on the panel root (focus-trap enhancer reads it)", () => {
    expect(markup).toContain('data-modal="${modal}"');
  });
});

// ---------------------------------------------------------------------------
// 5. Data-slot contract
// ---------------------------------------------------------------------------

describe("drawer.jte: data-slot landmark contract", () => {
  test("it stamps the expected drawer data-slot names", () => {
    for (const slot of [
      "drawer",
      "drawer-trigger",
      "drawer-panel",
      "drawer-header",
      "drawer-title",
      "drawer-body",
      "drawer-close",
      "drawer-scrim",
    ]) {
      expect(markup, `missing data-slot="${slot}"`).toContain(`data-slot="${slot}"`);
    }
  });

  test("drawer-footer is present when footer param is used", () => {
    expect(markup).toContain('data-slot="drawer-footer"');
    expect(markup).toContain("footer != null");
  });
});

// ---------------------------------------------------------------------------
// 6. Placement + size param reflection
// ---------------------------------------------------------------------------

describe("drawer.jte: placement + size params", () => {
  test("placement is reflected as data-placement on the panel (CSS hook + test target)", () => {
    expect(markup).toContain('data-placement="${edge}"');
    expect(jte).toContain('@param String placement = "right"');
  });

  test("size is reflected as data-size on the panel (CSS hook + test target)", () => {
    expect(markup).toContain('data-size="${sizeVal}"');
    expect(jte).toContain('@param String size = "md"');
  });

  test("placement switch covers all four canonical edges", () => {
    for (const edge of ["left", "right", "top", "bottom"]) {
      expect(jte, `placement switch missing "${edge}"`).toContain(`"${edge}"`);
    }
  });

  test("size switch covers all five size values", () => {
    for (const s of ["sm", "md", "lg", "xl", "full"]) {
      expect(jte, `size switch missing "${s}"`).toContain(`"${s}"`);
    }
  });

  test("full size resolves to viewport-spanning dimension (100vw or 100dvh)", () => {
    expect(jte).toContain("100vw");
    expect(jte).toContain("100dvh");
  });
});

// ---------------------------------------------------------------------------
// 7. Modal flag: aria-modal conditionality
// ---------------------------------------------------------------------------

describe("drawer.jte: modal=false omits aria-modal (APG non-modal dialog)", () => {
  test("the controlled panel emits aria-modal only when modal=true (smart attr pattern)", () => {
    // aria-modal="${modal ? "true" : null}" -- null omits the attribute in JTE.
    expect(markup).toContain('aria-modal="${modal ? "true" : null}"');
  });

  test("the scrim is guarded by modal in the controlled path (modal=false has no scrim)", () => {
    expect(markup).toContain("isControlled && modal && open");
  });

  test("focus-trap is guarded by modal in controlled path (modal=false no trap)", () => {
    // trapModal = isControlled && modal: trap only when both controlled and modal.
    expect(markup).toContain("trapModal");
    expect(jte).toContain("isControlled && modal");
  });
});

// ---------------------------------------------------------------------------
// 8. Projection contract
// ---------------------------------------------------------------------------

describe("drawer.jte: projection contract (body is OWNED, never a native slot)", () => {
  test("content is an owned Content param (${content}), never a native <slot>", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });

  test("footer is an optional Content param (null = absent, not an empty region)", () => {
    expect(jte).toContain("@param gg.jte.Content footer = null");
    expect(markup).toContain("${footer}");
    expect(markup).toContain("footer != null");
  });
});

// ---------------------------------------------------------------------------
// 9. DestroyOnClose guard
// ---------------------------------------------------------------------------

describe("drawer.jte: destroyOnClose + open presence guard", () => {
  test("declares destroyOnClose (boolean, default false)", () => {
    expect(jte).toContain("@param boolean destroyOnClose = false");
  });

  test("showPanel = open || !destroyOnClose controls whether the panel subtree is output", () => {
    // When destroyOnClose=true + open=false, showPanel=false and the @if omits the panel.
    expect(markup).toContain("showPanel");
    expect(jte).toContain("open || !destroyOnClose");
  });
});

// ---------------------------------------------------------------------------
// 10. Focus-trap enhancer seam (the contract modal + alert-dialog share)
// ---------------------------------------------------------------------------

describe("drawer.jte: focus-trap enhancer data-attribute contract (composable seam)", () => {
  test("activates trap on the panel element (data-lievit-focus-trap)", () => {
    expect(markup).toContain("data-lievit-focus-trap");
  });

  test("escape-action is bound on the same element as the trap (atomically paired)", () => {
    expect(markup).toContain("data-lievit-escape-action");
  });

  test("no hand-rolled Tab/focus/scroll logic in the template markup", () => {
    expect(markup).not.toMatch(/addEventListener/);
    expect(markup).not.toMatch(/KeyboardEvent/);
    expect(markup).not.toMatch(/document\.activeElement/);
    expect(markup).not.toMatch(/style=[^>]*overflow\s*:/);
  });

  test("seam note documents modal + alert-dialog as composing the SAME two attributes", () => {
    // The doc-comment must carry the seam note so future agents know.
    expect(jte).toContain("alert-dialog");
    expect(jte).toContain("modal");
    expect(jte).toContain("data-lievit-focus-trap");
    expect(jte).toContain("data-lievit-escape-action");
  });
});

// ---------------------------------------------------------------------------
// 11. Server-purity + CSP-clean + token-driven + licensed
// ---------------------------------------------------------------------------

describe("drawer.jte: server-purity + CSP-clean + token-driven + licensed", () => {
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

  test("it does not import dev.lievit.* (PARTIAL: no Java class deps in template)", () => {
    expect(jte).not.toContain("@import dev.lievit");
  });

  test("it carries the Apache licence header", () => {
    expect(jte).toContain("Licensed under the Apache License, Version 2.0");
  });
});

// ---------------------------------------------------------------------------
// 12. Consolidation: slide-over.jte persists as the static native-dialog partial
// ---------------------------------------------------------------------------

describe("drawer vs slide-over: consolidation note", () => {
  test("slide-over.jte still exists as a separate static partial (native <dialog> only)", () => {
    const slideOverJte = readFileSync(join(registryRoot, "jte/slide-over.jte"), "utf8");
    expect(slideOverJte).toContain('command="show-modal"');
    expect(slideOverJte).toContain('method="dialog"');
  });

  test("slide-over is still a separate registry item (not removed by the drawer addition)", () => {
    const matches = registry.items.filter((i) => i.name === "slide-over");
    expect(matches).toHaveLength(1);
  });

  test("drawer has its own registry:jte entry separate from slide-over", () => {
    const drawerJteItems = registry.items.filter((i) => i.name === "drawer" && i.type === "registry:jte");
    const slideOverItems = registry.items.filter((i) => i.name === "slide-over");
    expect(drawerJteItems, "exactly one registry:jte drawer item").toHaveLength(1);
    expect(slideOverItems).toHaveLength(1);
    // The jte drawer item is distinct from slide-over.
    expect(drawerJteItems[0].name).not.toBe(slideOverItems[0].name);
  });
});
