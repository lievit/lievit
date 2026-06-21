/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Type-2 compound sub-components for the overlay family (issue #464): dropdown-menu
 * (Label / Group / Shortcut / Sub + the checked-state indicator glyph), popover
 * (Header / Title / Description + Anchor + the align axis) and alert (Title / Description /
 * Action + the shadcn icon + CSS-grid layout). These tests pin the SOURCE contract of the new
 * partials: the shadcn data-slot names, the ARIA roles + aria-labelledby wiring, the grid layout,
 * CSP-cleanliness and token-drivenness. They do NOT exercise the native popover / <details>
 * show/hide (the browser's, not unit-testable in happy-dom) -- the real-compile is the JTE smoke.
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const registryRoot = join(import.meta.dirname, "..", "registry");
const read = (rel: string) => readFileSync(join(registryRoot, rel), "utf8");
const stripComments = (jte: string) => jte.replace(/<%--[\s\S]*?--%>/g, "");
const APACHE = "Licensed under the Apache License, Version 2.0";
// every interpolated --lv-* token reference, no raw hex or px literal in the markup.
const assertTokenDriven = (markup: string, where: string) => {
  expect(markup, `${where} should use --lv-* tokens`).toMatch(/var\(--lv-/);
  expect(markup.match(/#[0-9a-fA-F]{3,8}\b/), `${where} hardcodes a hex colour`).toBeNull();
};
const assertCspClean = (jte: string, where: string) => {
  expect(jte, `${where} must have no inline <script>`).not.toMatch(/<script/i);
  expect(stripComments(jte), `${where} must have no inline on* handler`).not.toMatch(/\son[a-z]+=/i);
};
const assertApache = (jte: string, where: string) =>
  expect(jte, `${where} missing Apache header`).toContain(APACHE);

describe("dropdown-menu/label: a non-interactive caption (shadcn DropdownMenuLabel)", () => {
  const jte = read("jte/dropdown-menu/label.jte");
  const markup = stripComments(jte);
  test("carries the shadcn data-slot and is NOT a menuitem", () => {
    expect(markup).toContain('data-slot="dropdown-menu-label"');
    expect(markup).not.toContain('role="menuitem"');
  });
  test("supports the shadcn `inset` indent + an id for aria-labelledby pairing", () => {
    expect(jte).toContain("@param boolean inset");
    expect(markup).toContain('data-inset=');
    expect(jte).toContain("@param String id");
  });
  test("is token-driven, CSP-clean, Apache-headed", () => {
    assertTokenDriven(markup, "dropdown-menu/label");
    assertCspClean(jte, "dropdown-menu/label");
    assertApache(jte, "dropdown-menu/label");
  });
});

describe("dropdown-menu/group: role=group + aria-labelledby wiring", () => {
  const jte = read("jte/dropdown-menu/group.jte");
  const markup = stripComments(jte);
  test("renders role=group with the shadcn data-slot", () => {
    expect(markup).toContain('role="group"');
    expect(markup).toContain('data-slot="dropdown-menu-group"');
  });
  test("a labelId drives aria-labelledby (names the group via a dropdown-menu/label id)", () => {
    expect(jte).toContain("@param String labelId");
    expect(markup).toContain("aria-labelledby=");
  });
  test("the items are an OWNED content slot, never a native <slot>", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
  });
  test("is CSP-clean + Apache-headed", () => {
    assertCspClean(jte, "dropdown-menu/group");
    assertApache(jte, "dropdown-menu/group");
  });
});

describe("dropdown-menu/shortcut: a real data-slot (was folded into item's shortcut param)", () => {
  const jte = read("jte/dropdown-menu/shortcut.jte");
  const markup = stripComments(jte);
  test("carries data-slot=dropdown-menu-shortcut and is decorative (aria-hidden)", () => {
    expect(markup).toContain('data-slot="dropdown-menu-shortcut"');
    expect(markup).toContain('aria-hidden="true"');
  });
  test("is token-driven (ml-auto + muted + text-xs), CSP-clean, Apache-headed", () => {
    expect(markup).toContain("margin-left: auto");
    assertTokenDriven(markup, "dropdown-menu/shortcut");
    assertCspClean(jte, "dropdown-menu/shortcut");
    assertApache(jte, "dropdown-menu/shortcut");
  });
});

describe("dropdown-menu/item: the checked-state indicator glyph (shadcn ItemIndicator)", () => {
  const jte = read("jte/dropdown-menu/item.jte");
  const markup = stripComments(jte);
  test("a checkable item reserves an indicator column with the shadcn data-slot", () => {
    expect(markup).toContain('data-slot="dropdown-menu-item-indicator"');
  });
  test("the glyph is a Lucide check (checkbox) or a filled dot (radio), shown when checked", () => {
    expect(markup).toMatch(/@if\(checked\)/);
    expect(jte).toContain('@template.lievit.icon(name = "check"');
    // radio renders a filled dot via currentColor, not a check icon.
    expect(markup).toContain("background: currentColor");
  });
  test("the inline shortcut now carries the shortcut data-slot (back-compat retained)", () => {
    expect(markup).toContain('data-slot="dropdown-menu-shortcut"');
    expect(jte).toContain("@param String shortcut");
  });
  test("destructive variant (Type-1) is untouched + still token-driven", () => {
    expect(markup).toContain('data-variant="${destructive ? "destructive" : null}"');
    assertTokenDriven(markup, "dropdown-menu/item");
    assertCspClean(jte, "dropdown-menu/item");
  });
});

describe("dropdown-menu/sub: a server-first nested submenu (Sub/SubTrigger/SubContent)", () => {
  const jte = read("jte/dropdown-menu/sub.jte");
  const markup = stripComments(jte);
  test("uses a native <details>/<summary> disclosure (zero JS, CSP-clean)", () => {
    expect(markup).toMatch(/<details[\s\n]/);
    expect(markup).toMatch(/<summary[\s\n]/);
    assertCspClean(jte, "dropdown-menu/sub");
  });
  test("the three shadcn data-slots are present (sub / sub-trigger / sub-content)", () => {
    expect(markup).toContain('data-slot="dropdown-menu-sub"');
    expect(markup).toContain('data-slot="dropdown-menu-sub-trigger"');
    expect(markup).toContain('data-slot="dropdown-menu-sub-content"');
  });
  test("the trigger is role=menuitem + aria-haspopup=menu, the content role=menu (WAI-ARIA APG)", () => {
    expect(markup).toContain('role="menuitem"');
    expect(markup).toContain('aria-haspopup="menu"');
    expect(markup).toContain('role="menu"');
  });
  test("a trailing chevron-right marks the submenu; items are an OWNED slot, Apache-headed", () => {
    expect(jte).toContain('@template.lievit.icon(name = "chevron-right"');
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
    assertApache(jte, "dropdown-menu/sub");
  });
});

describe("popover.jte: align axis + labelled-dialog header + anchor decoupling", () => {
  const jte = read("jte/popover.jte");
  const markup = stripComments(jte);
  test("the align axis maps start|center|end to data-align + a position-area inline span", () => {
    expect(jte).toContain('@param String align');
    expect(markup).toContain('data-align="${align}"');
    // start spans the inline-end side, end the inline-start side (CSS anchor positioning).
    expect(jte).toContain('case "start" -> "span-right"');
    expect(jte).toContain('case "end"   -> "span-left"');
  });
  test("a title turns the panel into a LABELLED dialog (role=dialog + aria-labelledby the title id)", () => {
    expect(markup).toContain('role="${labelled ? "dialog" : null}"');
    expect(markup).toContain('aria-labelledby="${labelled ? titleId : null}"');
    // header/title/description carry the shadcn data-slots.
    expect(markup).toContain('data-slot="popover-header"');
    expect(markup).toContain('data-slot="popover-title"');
    expect(markup).toContain('data-slot="popover-description"');
    // the title id the aria-labelledby points at is rendered on the title element.
    expect(markup).toContain('id="${titleId}"');
  });
  test("a header-LESS popover stays role-less (no accessible-name lie to AT)", () => {
    // the literal role="dialog" substring must NOT appear unconditionally.
    expect(markup).not.toContain('role="dialog" ');
    expect(markup).not.toContain('aria-modal');
  });
  test("anchorId decouples the positioning anchor from the trigger", () => {
    expect(jte).toContain("@param String anchorId");
    // when anchorId is set the trigger drops its own anchor-name; the panel binds to --<anchorId>-anchor.
    expect(markup).toContain("anchorId.isEmpty()");
    expect(markup).toContain("position-anchor:${anchorName}");
  });
  test("still CSP-clean, no <slot>, token-driven, Apache-headed", () => {
    assertCspClean(jte, "popover");
    expect(markup).not.toMatch(/<slot[\s>]/);
    assertTokenDriven(markup, "popover");
    assertApache(jte, "popover");
  });
});

describe("popover/anchor: shadcn PopoverAnchor (CSS anchor-name carrier)", () => {
  const jte = read("jte/popover/anchor.jte");
  const markup = stripComments(jte);
  test("carries data-slot=popover-anchor and sets anchor-name from anchorId", () => {
    expect(markup).toContain('data-slot="popover-anchor"');
    expect(markup).toContain("anchor-name:--${anchorId}-anchor");
  });
  test("wraps an OWNED content slot, CSP-clean, Apache-headed", () => {
    expect(jte).toContain("@param gg.jte.Content content");
    expect(markup).toContain("${content}");
    expect(markup).not.toMatch(/<slot[\s>]/);
    assertCspClean(jte, "popover/anchor");
    assertApache(jte, "popover/anchor");
  });
});

describe("alert.jte: shadcn icon + CSS GRID layout + real Title/Description/Action slots", () => {
  const jte = read("jte/alert.jte");
  const markup = stripComments(jte);
  test("the root is a CSS grid; title + description + action sit in column 2", () => {
    expect(markup).toContain("grid-template-columns:");
    // 1rem icon column when an icon is present, 0 otherwise (shadcn has-[>svg] toggle).
    expect(markup).toContain('hasIcon ? "1rem 1fr" : "0 1fr"');
    expect(markup).toContain("grid-column:2");
  });
  test("the optional leading Lucide icon renders in column 1 (the defining shadcn visual)", () => {
    expect(jte).toContain("@param String icon");
    expect(markup).toContain("@template.lievit.icon(name = icon");
    expect(markup).toContain("grid-column:1");
  });
  test("Title / Description / Action are real data-slots (not the ad-hoc heading div)", () => {
    expect(markup).toContain('data-slot="alert-title"');
    expect(markup).toContain('data-slot="alert-description"');
    expect(markup).toContain('data-slot="alert-action"');
  });
  test("the live role stays severity-driven (assertive vs polite) + heading back-compat", () => {
    expect(markup).toContain('role="${urgent ? "alert" : "status"}"');
    expect(jte).toContain("@param String heading");
  });
  test("token-driven, CSP-clean, Apache-headed", () => {
    assertTokenDriven(markup, "alert");
    assertCspClean(jte, "alert");
    assertApache(jte, "alert");
  });
});

describe("alert sub-partials: title / description / action stand alone", () => {
  for (const [file, slot] of [
    ["jte/alert/title.jte", "alert-title"],
    ["jte/alert/description.jte", "alert-description"],
    ["jte/alert/action.jte", "alert-action"],
  ] as const) {
    const jte = read(file);
    const markup = stripComments(jte);
    test(`${file} carries data-slot=${slot}, an OWNED content slot, token-driven, Apache-headed`, () => {
      expect(markup).toContain(`data-slot="${slot}"`);
      expect(jte).toContain("@param gg.jte.Content content");
      expect(markup).toContain("${content}");
      expect(markup).not.toMatch(/<slot[\s>]/);
      assertTokenDriven(markup, file);
      assertCspClean(jte, file);
      assertApache(jte, file);
    });
  }
});
