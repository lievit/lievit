/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Structural golden for the ui1 LIST/DISPLAY primitives (ui1-lists): the read-only display + list
 * partials the lievit-kit infolist / widgets and gest's profile lists need but the registry lacked
 * -- data-list (+ data-list/row), description-list (+ description-list/item), infolist-entry (the
 * ColorEntry/IconEntry/ImageEntry/CodeEntry read-only variants under one type switch), and stat-card
 * (the StatWidget KPI tile). empty.jte is verified (Filament empty-state) but NOT extended here.
 *
 * As with the other JTE suites, these partials compile in the Java world, so the harness asserts on
 * the partial SOURCE as text: exact data-slot, the WAI-ARIA semantics, token-driven styling (every
 * colour/space/radius reads a --lv-* var, never a hardcoded hex), the Apache header, the declared
 * @param API, and strict-CSP cleanliness (no inline <script>, no on* handler).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const read = (rel: string) => readFileSync(join(jteDir, rel), "utf8");

// Every new .jte source under test (relative to registry/jte).
const ALL_SOURCES = [
  "data-list.jte",
  "data-list/row.jte",
  "description-list.jte",
  "description-list/item.jte",
  "infolist-entry.jte",
  "stat-card.jte",
] as const;

describe("ui1 list/display primitives: cross-cutting invariants", () => {
  test.each(ALL_SOURCES)("%s carries the Apache header", (rel) => {
    const src = read(rel);
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain('Licensed under the Apache License, Version 2.0 (the "License").');
  });

  test.each(ALL_SOURCES)("%s is token-driven: no hardcoded hex colour", (rel) => {
    // background-color:${value} for the swatch is a runtime CSS value, not a literal hex in source.
    expect(read(rel)).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test.each(ALL_SOURCES)("%s is CSP-clean: no inline <script> and no on* handler", (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(/<script/i);
    // on*= HTML event-handler attribute (allow JTE @ directives; only flag HTML on... attrs).
    expect(src).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test.each(ALL_SOURCES)("%s declares a cssClass passthrough (className parity)", (rel) => {
    expect(read(rel)).toContain("@param String cssClass");
  });
});

describe("data-list — divided <ul role=list> surface", () => {
  const src = read("data-list.jte");
  test("is a real <ul> stamped data-slot, role-driven list", () => {
    expect(src).toMatch(/<ul\b/);
    expect(src).toContain('data-slot="data-list"');
    expect(src).toContain('role="${role}"');
    expect(src).toContain('@param String role = "list"');
  });
  test("rules rows with a token-coloured divide and is bordered by default", () => {
    expect(src).toContain("[&>li:not(:first-child)]:border-t");
    expect(src).toContain("[&>li]:border-[var(--lv-color-border)]");
    expect(src).toContain("@param boolean bordered = true");
    expect(src).toContain("bg-[var(--lv-color-card)]");
  });
});

describe("data-list/row — <li> row: leading + content + actions", () => {
  const src = read("data-list/row.jte");
  test("is a real <li role=listitem> with the three slots", () => {
    expect(src).toMatch(/<li\b/);
    expect(src).toContain('data-slot="data-list-row"');
    expect(src).toContain('@param String role = "listitem"');
    expect(src).toContain('data-slot="data-list-row-content"');
  });
  test("exposes leading + actions content slots, content required", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("@param gg.jte.Content leading = null");
    expect(src).toContain("@param gg.jte.Content actions = null");
    expect(src).toContain("${leading}");
    expect(src).toContain("${actions}");
  });
});

describe("description-list — read-only label->value <dl> grid", () => {
  const src = read("description-list.jte");
  test("is a native <dl> stamped data-slot, column-driven grid", () => {
    expect(src).toMatch(/<dl\b/);
    expect(src).toContain('data-slot="description-list"');
    expect(src).toContain("@param int columns = 1");
    // columns drive the grid via the custom property, not a per-instance <style> tag.
    expect(src).toContain("--lv-dl-cols");
    expect(src).not.toMatch(/<style/i);
  });
});

describe("description-list/item — <dt> term + <dd> value pair", () => {
  const src = read("description-list/item.jte");
  test("emits a <dt>+<dd> sibling pair (native dl association)", () => {
    expect(src).toMatch(/<dt\b/);
    expect(src).toMatch(/<dd\b/);
    expect(src).toContain('data-slot="description-list-term"');
    expect(src).toContain('data-slot="description-list-value"');
    expect(src).toContain("@param String term");
    expect(src).toContain("@param gg.jte.Content content");
  });
  test("term is muted, value is the foreground; columnSpan supported", () => {
    expect(src).toContain("text-[var(--lv-color-muted-fg)]");
    expect(src).toContain("text-[var(--lv-color-fg)]");
    expect(src).toContain("@param int columnSpan = 1");
  });
});

describe("infolist-entry — read-only display variants (kit Entry.kind switch)", () => {
  const src = read("infolist-entry.jte");
  test("branches on a `type` param matching the kit Entry.kind tags", () => {
    expect(src).toContain('@param String type = "text"');
    expect(src).toContain('type.equals("color")');
    expect(src).toContain('type.equals("icon")');
    expect(src).toContain('type.equals("image")');
    expect(src).toContain('type.equals("code")');
  });
  test("color: a token-bordered swatch + the value, decorative swatch", () => {
    expect(src).toContain('data-slot="infolist-entry-swatch"');
    expect(src).toContain("border-[var(--lv-color-border)]");
    expect(src).toContain('aria-hidden="true"');
  });
  test("icon: reuses the icon primitive, tinted by a colour token", () => {
    expect(src).toContain("@template.lievit.icon");
    expect(src).toContain("var(--lv-color-success)");
  });
  test("image: a real <img> requiring alt, circular variant on a radius token", () => {
    expect(src).toMatch(/<img\b/);
    expect(src).toContain("@param String alt = null");
    expect(src).toContain("rounded-[var(--lv-radius-full)]");
    expect(src).toContain("object-cover");
  });
  test("code: a <pre><code> on a muted surface, language + line-number affordances", () => {
    expect(src).toMatch(/<pre\b/);
    expect(src).toMatch(/<code\b/);
    expect(src).toContain("bg-[var(--lv-color-muted-bg)]");
    expect(src).toContain('data-language="${language}"');
    expect(src).toContain("@param boolean lineNumbers = false");
  });
  test("text fallback: a plain value span for any non-decorated kind", () => {
    expect(src).toContain('data-type="text"');
  });
});

describe("stat-card — KPI tile (kit StatWidget)", () => {
  const src = read("stat-card.jte");
  test("stamps data-slot and the StatWidget core params", () => {
    expect(src).toContain('data-slot="stat-card"');
    expect(src).toContain("@param String heading");
    expect(src).toContain("@param String value");
    expect(src).toContain("@param String description = null");
  });
  test("trend icon with a before/after position (StatWidget.IconPosition)", () => {
    expect(src).toContain("@param String descriptionIcon = null");
    expect(src).toContain('@param String iconPosition = "before"');
    expect(src).toContain('data-slot="stat-card-trend"');
    expect(src).toContain('"after".equals(iconPosition)');
  });
  test("optional whole-card link: an <a> when url is set, newTab honoured", () => {
    expect(src).toContain("@param String url = null");
    expect(src).toContain("@param boolean newTab = false");
    expect(src).toMatch(/<a\b/);
    expect(src).toContain('target="${newTab ? "_blank" : null}"');
    expect(src).toContain('rel="${newTab ? "noopener noreferrer" : null}"');
  });
  test("colour tint maps to a --lv-color-* var (no hex), card surface tokens", () => {
    expect(src).toContain("var(--lv-color-success)");
    expect(src).toContain("rounded-[var(--lv-radius-xl)]");
    expect(src).toContain("bg-[var(--lv-color-card)]");
    expect(src).toContain("shadow-[var(--lv-shadow-xs)]");
  });
  test("sparkline rides an optional chart slot, not the static card body", () => {
    expect(src).toContain("@param gg.jte.Content chart = null");
    expect(src).toContain('data-slot="stat-card-chart"');
  });
});

describe("empty.jte already covers Filament's empty-state (icon + heading + description + action)", () => {
  const src = read("empty.jte");
  test("has the icon tile, the title, the description, and an action slot", () => {
    expect(src).toContain('data-slot="empty-icon"');
    expect(src).toContain('data-slot="empty-title"');
    expect(src).toContain('data-slot="empty-description"');
    expect(src).toContain("@param gg.jte.Content action = null");
    expect(src).toContain("@param String icon");
    // No extension needed: the Filament empty-state (EmptyMedia + EmptyTitle + EmptyDescription
    // + EmptyContent) is already fully modelled, so ui1-lists leaves it untouched.
  });
});
