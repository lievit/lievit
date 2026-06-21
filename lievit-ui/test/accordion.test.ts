/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * New static JTE LAYOUT primitive: accordion (+ accordion/item sub-part). The server-first,
 * zero-JS counterpart of shadcn's Accordion (Radix a11y) / Filament accordion: each item is a native
 * <details>/<summary>, the open set is the server's `open` flags, single-open mode uses the platform
 * <details name=...> grouping (no JS). Distinct from the INTERACTIVE registry:wire accordion.
 *
 * The Node harness has no JTE compiler, so this asserts on the partial SOURCE as text (the @param
 * API, the data-slot set, the native <details>/<summary>, the aria pairing, the single-mode `name`
 * grouping, token-driven styling, and that no inline script / on* handler / <style> / hex ships).
 * The real-compiler golden runs via `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

describe("accordion (server-first JTE layout primitive; shadcn Accordion / Filament accordion)", () => {
  const parent = read("accordion.jte");
  const item = read("accordion/item.jte");

  test("ships parent + item sub-part + meta.json, registers as copy-in registry:jte with usage docs", () => {
    expect(existsSync(join(jteDir, "accordion", "meta.json")), "meta.json so it registers").toBe(true);
    expect(existsSync(join(jteDir, "accordion", "item.jte")), "accordion/item.jte sub-part").toBe(true);
    expect(parent, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(parent, "comment block must close").toContain("--%>");
    expect(parent, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(parent, "missing Usage section").toMatch(/Usage:/);
    expect(parent).toContain("@@template.lievit.accordion(");
    expect(parent).toContain("@param gg.jte.Content content");
  });

  test("item declares the documented param API: label + content + id + name + open", () => {
    expect(item).toContain("@param String label");
    expect(item).toContain("@param gg.jte.Content content");
    expect(item).toContain("@param String id");
    expect(item).toContain("@param String name = null");
    expect(item).toContain("@param boolean open = false");
  });

  test("carries the shadcn data-slot set (accordion / accordion-item / accordion-trigger / accordion-content)", () => {
    expect(parent).toContain('data-slot="accordion"');
    expect(item).toContain('data-slot="accordion-item"');
    expect(item).toContain('data-slot="accordion-trigger"');
    expect(item).toContain('data-slot="accordion-content"');
  });

  test("each item is a NATIVE <details>/<summary> (zero JS); open is server-driven; single-mode via <details name>", () => {
    expect(item).toContain("<details");
    expect(item).toContain('open="${open}"');
    expect(item).toContain('name="${name}"'); // same name across items => browser one-open-at-a-time
    expect(item).toContain("<summary");
    // the trigger summary kills the native marker (we render our own chevron)
    expect(item).toContain("list-style: none");
    expect(item).toContain('name = "chevron-down"');
  });

  test("a11y (Radix/APG): trigger <-> content paired via aria-controls / aria-labelledby + role=region", () => {
    expect(item).toContain('aria-controls="${panelId}"');
    expect(item).toContain('aria-labelledby="${triggerId}"');
    expect(item).toContain('role="region"');
    expect(item).toContain('var triggerId = id + "-trigger";');
    expect(item).toContain('var panelId = id + "-panel";');
  });

  test("token-driven (border / radius / card surface / spacing / type); no hardcoded hex", () => {
    expect(parent).toContain("var(--lv-color-border)");
    expect(parent).toContain("var(--lv-radius-md)");
    expect(parent).toContain("var(--lv-color-card)");
    expect(item).toContain("var(--lv-space-4)");
    expect(item).toContain("var(--lv-text-base)");
    expect(parent, "parent leaked a hex").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(item, "item leaked a hex").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("CSP-clean: no inline script, no on* handler, NO <style> block in either file", () => {
    for (const [name, src] of [["parent", parent], ["item", item]] as const) {
      const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
      expect(markup, `${name}: inline <script>`).not.toMatch(/<script/i);
      expect(markup, `${name}: <style> block`).not.toMatch(/<style[\s>]/i);
      expect(markup, `${name}: inline on* handler`).not.toMatch(/\son[a-z]+=/i);
      expect(src.toLowerCase(), `${name}: lit island`).not.toMatch(/customelement|litelement|import .*\blit\b/);
    }
  });

  test("Apache header present in both files", () => {
    for (const src of [parent, item]) {
      expect(src).toContain("Copyright 2026 Francesco Bilotta");
      expect(src).toContain("Apache License");
    }
  });
});
