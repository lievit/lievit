/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildRegistry, serializeRegistry } from "../cli/build-registry.js";
import { resolve, type Registry } from "../cli/registry.js";

const registryRoot = join(import.meta.dirname, "..", "registry");
const built = buildRegistry(registryRoot);

const TIER_1 = [
  "button",
  "input",
  "textarea",
  "label",
  "badge",
  "card",
  "separator",
  "spinner",
  "alert",
];

const TIER_2 = [
  "checkbox",
  "native-select",
  "switch",
  "field",
  "toast",
  "tooltip",
  "progress",
];

const TIER_3 = [
  "dropdown-menu",
  "date-picker",
  "data-table",
  "file-upload",
  "rich-select",
];

// Wave 2 (ADR-0012, server-first inputs): these four interactive inputs are no longer Lit islands.
// rich-select / command / file-upload became registry:wire (Java + JTE); input-otp became a
// registry:jte partial + a CSP-clean enhancer. They must NOT ship as a registry:ui (Lit) item.
const WAVE_2_SERVER_FIRST: Record<string, "registry:wire" | "registry:jte"> = {
  "rich-select": "registry:wire",
  command: "registry:wire",
  "file-upload": "registry:wire",
  "input-otp": "registry:jte",
};

// Wave 3 (ADR-0012, server-first): alert-dialog is now a registry:wire confirm modal built on the
// dialog wire (role=alertdialog, real l:click buttons), and toast is a registry:jte partial +
// CSP-clean enhancer rendered from a server flash. Neither ships as a Lit island (registry:ui).
const WAVE_3_SERVER_FIRST: Record<string, "registry:wire" | "registry:jte"> = {
  "alert-dialog": "registry:wire",
  toast: "registry:jte",
};

describe("built registry.json", () => {
  test("ships every tier-1 primitive the research flagged", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const t of TIER_1) {
      expect(names, `missing tier-1 component: ${t}`).toContain(t);
    }
  });

  test("ships every tier-2 component", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const t of TIER_2) {
      expect(names, `missing tier-2 component: ${t}`).toContain(t);
    }
  });

  test("ships every tier-3 component", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const t of TIER_3) {
      expect(names, `missing tier-3 component: ${t}`).toContain(t);
    }
  });

  test("the Wave-2 interactive inputs ship server-first, not as Lit islands", () => {
    const byName = new Map(built.items.map((i) => [i.name, i]));
    for (const [name, type] of Object.entries(WAVE_2_SERVER_FIRST)) {
      const item = byName.get(name);
      expect(item, `missing Wave-2 input: ${name}`).toBeDefined();
      expect(item!.type, `${name} must be ${type}, not a Lit island`).toBe(type);
      // none of them is a registry:ui (the Lit island tier).
      expect(item!.type).not.toBe("registry:ui");
    }
  });

  test("the Wave-3 overlay/notify components ship server-first, not as Lit islands", () => {
    const byName = new Map(built.items.map((i) => [i.name, i]));
    for (const [name, type] of Object.entries(WAVE_3_SERVER_FIRST)) {
      const item = byName.get(name);
      expect(item, `missing Wave-3 component: ${name}`).toBeDefined();
      expect(item!.type, `${name} must be ${type}, not a Lit island`).toBe(type);
      expect(item!.type).not.toBe("registry:ui");
    }
  });

  test("data-table ships server-first as a registry:jte partial, not a Lit island", () => {
    const item = built.items.find((i) => i.name === "data-table");
    expect(item, "data-table must be a registry item").toBeDefined();
    // Wave 4 (ADR-0012): the client-side sortable/paginated <lv-data-table> Lit island is gone; the
    // stateful server-sorted/paginated table is owned by lievit-kit's admin list, and lievit-ui ships
    // the presentational primitive it composes as a JTE partial.
    expect(item!.type, "data-table must be registry:jte").toBe("registry:jte");
    expect(item!.type).not.toBe("registry:ui");
    const jte = item!.files.find((f) => f.path.endsWith("data-table.jte"))?.content ?? "";
    // server-first sort: real <th scope=col> + aria-sort + a real <a href> re-sort link, NO client sort.
    expect(jte).toContain('scope="col"');
    expect(jte).toContain("aria-sort=");
    expect(jte).toContain('data-slot="data-table-sort"');
    expect(jte).toMatch(/<a\s[\s\S]*?href="\$\{url\}"/);
    // no inline script (CSP) and no <lv-data-table> island markup (strip the doc comment first).
    expect(jte).not.toMatch(/<script/i);
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain("<lv-data-table");
  });

  test("the alert-dialog wire composes the dialog wire structure (no <lv-dialog> island)", () => {
    const item = built.items.find((i) => i.name === "alert-dialog");
    expect(item, "alert-dialog must be a registry item").toBeDefined();
    const jte = item!.files.find((f) => f.path.endsWith(".jte"))?.content ?? "";
    // role=alertdialog (the interruptive-prompt specialization), real confirm/cancel l:click buttons
    expect(jte).toContain('role="alertdialog"');
    expect(jte).toContain('l:click="confirm"');
    expect(jte).toContain('l:click="cancel"');
    // the old island is not RENDERED (the doc comment may name it as the dropped tier; the markup
    // must not). Strip the JTE doc comment and assert no <lv-dialog> usage remains.
    const markup = jte.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toContain("<lv-dialog");
  });

  test("the toast partial renders the live-region role + ships a CSP-clean enhancer (no <script>)", () => {
    const item = built.items.find((i) => i.name === "toast");
    expect(item, "toast must be a registry item").toBeDefined();
    // Wave 5 re-forge: the live-region roles (role=status / role=alert) now live on the
    // sub-containers in toast/region.jte, NOT on toast.jte (the item card). The item
    // card has role="none" (content inside the live region). Check region.jte for the roles.
    const regionJte = item!.files.find((f) => f.path.endsWith("toast/region.jte"))?.content ?? "";
    expect(regionJte, "region.jte must be in the toast registry files").not.toBe("");
    expect(regionJte).toContain('role="status"');
    expect(regionJte).toContain('role="alert"');
    expect(regionJte).not.toMatch(/<script/i);
    // The item card carries the dismiss button (data-slot="toast-dismiss") and no inline script.
    // Note: the dismiss slot attr is data-slot="toast-dismiss", not data-toast-dismiss.
    const itemJte = item!.files.find((f) => f.path.endsWith("toast.jte"))?.content ?? "";
    expect(itemJte).toContain('data-slot="toast-dismiss"');
    expect(itemJte).not.toMatch(/<script/i);
    // it ships the auto-dismiss enhancer alongside the partial.
    expect(item!.files.some((f) => f.path.endsWith("toast.enhancer.ts"))).toBe(true);
  });

  test("ships the tokens base item", () => {
    const names = built.items.map((i) => i.name);
    expect(names).toContain("tokens");
    // light-dom (the Lit light-DOM style helper) was dropped with the last island (ADR-0012,
    // Wave 4 R7): the server-first library ships no Lit runtime, so no component imports it.
    expect(names).not.toContain("light-dom");
  });

  test("every file declares non-empty inlined content with an Apache header", () => {
    for (const item of built.items) {
      for (const file of item.files) {
        expect(file.content, `${item.name}/${file.path} has no content`).toBeTruthy();
        expect(
          file.content,
          `${item.name}/${file.path} missing Apache header`
        ).toContain("Licensed under the Apache License, Version 2.0");
      }
    }
  });

  test("every registryDependency edge resolves to a known item", () => {
    const names = new Set(built.items.map((i) => i.name));
    for (const item of built.items) {
      for (const dep of item.registryDependencies) {
        expect(names, `${item.name} depends on unknown ${dep}`).toContain(dep);
      }
    }
  });

  test("resolving any tier-1 component succeeds and pulls in its tokens", () => {
    for (const t of TIER_1) {
      const closure = resolve(built, [t]).map((i) => i.name);
      expect(closure, `${t} should pull tokens`).toContain("tokens");
    }
  });

  test("every component references --lv-* tokens, never a hardcoded hex value", () => {
    for (const item of built.items) {
      if (item.type !== "registry:ui") {
        continue;
      }
      for (const file of item.files) {
        // the css lives in a `static readonly css` block; assert it uses var(--lv-*)
        // and contains no raw hex colour (#rrggbb / #rgb), which would bypass tokens.
        const css = file.content ?? "";
        expect(css, `${item.name} should use --lv-* tokens`).toMatch(/var\(--lv-/);
        const hex = css.match(/#[0-9a-fA-F]{3,8}\b/);
        // #fff is allowed nowhere: tokens carry every colour. Flag any hardcoded hex.
        expect(hex, `${item.name} hardcodes a colour: ${hex?.[0]}`).toBeNull();
      }
    }
  });

  test("the committed registry.json matches a fresh build (no drift)", () => {
    const committed = readFileSync(join(registryRoot, "registry.json"), "utf8");
    expect(committed).toBe(serializeRegistry(built));
  });

  test("is shaped as a valid Registry (name, homepage, items[])", () => {
    const reg: Registry = built;
    expect(reg.name).toBe("lievit-ui");
    expect(reg.homepage).toMatch(/^https?:\/\//);
    expect(Array.isArray(reg.items)).toBe(true);
    expect(reg.items.length).toBeGreaterThanOrEqual(TIER_1.length + 2);
  });
});
