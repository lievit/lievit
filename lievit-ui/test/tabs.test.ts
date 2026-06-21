/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * New static JTE LAYOUT primitive: tabs (+ tabs/panel sub-part). The server-first, zero-JS
 * counterpart of shadcn's Tabs (Radix a11y) / Filament Tabs / schema Tabs (the container the kit's
 * Tabs + InfolistTabs render through). The active tab is a SERVER fact: each tab is a real <a href>
 * (the active id changes via a GET), the inactive panels are `hidden`. Distinct from the INTERACTIVE
 * registry:wire tabs whose active id is live @Wire state.
 *
 * The Node harness has no JTE compiler, so this asserts on the partial SOURCE as text (the @param
 * API, the data-slot set, role=tablist/tab/tabpanel, roving tabindex + aria-selected, the
 * aria-controls/aria-labelledby pairing, the hidden inactive panel, token-driven styling, and that
 * no inline script / on* handler / <style> / hex ships). The real-compiler golden runs via
 * `npm run test:jte-compile`.
 */
import { describe, test, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

describe("tabs (server-first JTE layout primitive; shadcn Tabs / Filament Tabs / schema Tabs)", () => {
  const parent = read("tabs.jte");
  const panel = read("tabs/panel.jte");

  test("ships parent + panel sub-part + meta.json, registers as copy-in registry:jte with usage docs", () => {
    expect(existsSync(join(jteDir, "tabs", "meta.json")), "meta.json so it registers").toBe(true);
    expect(existsSync(join(jteDir, "tabs", "panel.jte")), "tabs/panel.jte sub-part").toBe(true);
    expect(parent, "missing <%-- --%> jte comment block").toContain("<%--");
    expect(parent, "comment block must close").toContain("--%>");
    expect(parent, "must NOT use the @* *@ comment syntax").not.toMatch(/@\*/);
    expect(parent, "missing Usage section").toMatch(/Usage:/);
    expect(parent).toContain("@@template.lievit.tabs(");
  });

  test("declares the documented param API: tabIds + labels + hrefs + active + content (panel: id + active)", () => {
    expect(parent).toContain("@param List<String> tabIds");
    expect(parent).toContain("@param List<String> labels");
    expect(parent).toContain("@param List<String> hrefs");
    expect(parent).toContain("@param String active");
    expect(parent).toContain("@param gg.jte.Content content");
    expect(panel).toContain("@param String id");
    expect(panel).toContain("@param String active");
    expect(panel).toContain("@param gg.jte.Content content");
  });

  test("carries the shadcn data-slot set (tabs / tabs-list / tabs-trigger / tabs-content)", () => {
    expect(parent).toContain('data-slot="tabs"');
    expect(parent).toContain('data-slot="tabs-list"');
    expect(parent).toContain('data-slot="tabs-trigger"');
    expect(panel).toContain('data-slot="tabs-content"');
  });

  test("WAI-ARIA APG roles: tablist > tab links, panel = tabpanel", () => {
    expect(parent).toContain('role="tablist"');
    expect(parent).toContain('role="tab"');
    expect(panel).toContain('role="tabpanel"');
    // the tab is a real <a href> (server-first switch, JS-off GET)
    expect(parent).toMatch(/<a\s[\s\S]*?role="tab"[\s\S]*?href="\$\{href\}"/);
  });

  test("active tab is a server fact: aria-selected + roving tabindex; inactive panel is hidden", () => {
    expect(parent).toContain("var isActive = id.equals(active);");
    expect(parent).toContain('aria-selected="${isActive ? "true" : "false"}"');
    expect(parent).toContain('tabindex="${isActive ? "0" : "-1"}"');
    // panel: hidden when not active, removed from view + a11y tree
    expect(panel).toContain("var isActive = id.equals(active);");
    expect(panel).toContain('hidden="${!isActive}"');
  });

  test("a11y: tab <-> panel paired via aria-controls / aria-labelledby on a deterministic id scheme", () => {
    expect(parent).toContain('aria-controls="lv-tabpanel-${id}"');
    expect(parent).toContain('id="lv-tab-${id}"');
    expect(panel).toContain('id="lv-tabpanel-${id}"');
    expect(panel).toContain('aria-labelledby="lv-tab-${id}"');
  });

  test("token-driven (color / space / type); active underline reads the primary token; no hardcoded hex", () => {
    expect(parent).toContain("var(--lv-color-border)");
    expect(parent).toContain("var(--lv-color-primary)");
    expect(parent).toContain("var(--lv-color-muted-fg)");
    expect(parent).toContain("var(--lv-space-3)");
    expect(parent).toContain("var(--lv-text-sm)");
    expect(parent, "parent leaked a hex").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(panel, "panel leaked a hex").not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("CSP-clean: no inline script, no on* handler, NO <style> block in either file", () => {
    for (const [name, src] of [["parent", parent], ["panel", panel]] as const) {
      const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
      expect(markup, `${name}: inline <script>`).not.toMatch(/<script/i);
      expect(markup, `${name}: <style> block`).not.toMatch(/<style[\s>]/i);
      expect(markup, `${name}: inline on* handler`).not.toMatch(/\son[a-z]+=/i);
      expect(src.toLowerCase(), `${name}: lit island`).not.toMatch(/customelement|litelement|import .*\blit\b/);
    }
  });

  test("Apache header present in both files", () => {
    for (const src of [parent, panel]) {
      expect(src).toContain("Copyright 2026 Francesco Bilotta");
      expect(src).toContain("Apache License");
    }
  });
});
