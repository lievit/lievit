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
  // v-next re-forge: the `type` switch (color/icon/image/code/text) was REMOVED.
  // infolist-entry is now a native <dt>+<dd> description-list row. The `label` and `value`
  // params replace the per-type rendering; type-specific display (swatch, icon, code) is the
  // CALLER's responsibility via the `value` Content slot. The `variant` param drives ink colour.
  // This is the correct server-first pattern: the partial is a layout primitive, not a
  // type-switching renderer (the type switch belongs in the kit's field components, not here).
  const src = read("infolist-entry.jte");
  test("branches on a `type` param matching the kit Entry.kind tags", () => {
    // v-next: the `type` param and its per-type switch are GONE.
    // The caller supplies type-specific markup via the `value` Content slot.
    // The `variant` param (default/highlight/destructive/success/warning) drives ink colour.
    expect(src).not.toContain('@param String type = "text"');
    expect(src).not.toContain('type.equals("color")');
    expect(src).not.toContain('type.equals("image")');
    expect(src).not.toContain('type.equals("code")');
    // New surface: label + value Content slot
    expect(src).toContain('@param String label');
    expect(src).toMatch(/@param gg\.jte\.Content value/);
    expect(src).toContain('@param String variant = "default"');
  });
  test("color: swatch rendering is now the CALLER's value-slot responsibility (removal noted)", () => {
    // The old data-slot=infolist-entry-swatch is gone; the caller supplies a swatch span
    // inside the value Content slot. The partial provides data-slot=infolist-entry-value-content
    // to wrap whatever the caller renders.
    expect(src).not.toContain('data-slot="infolist-entry-swatch"');
    // The entry still carries a variant-driven value colour (e.g. for highlight/destructive/success)
    expect(src).toContain("var(--lv-color-destructive)");
    expect(src).toContain("var(--lv-color-success)");
    // The root <div> wraps <dt>+<dd>; caller is responsible for per-type decoration
    expect(src).toContain('data-slot="infolist-entry"');
    expect(src).toContain('data-slot="infolist-entry-value-content"');
  });
  test("image: no built-in <img> (caller renders it in value slot); native dt+dd structure", () => {
    // v-next: no built-in <img>; rounded-[var(--lv-radius-full)] is the caller's responsibility.
    // The partial is a native <dt>+<dd> row; all type-specific decoration is caller-owned.
    expect(src).not.toContain("object-cover");
    expect(src).not.toMatch(/@param String alt/);
    // dt + dd are the structural primitives
    expect(src).toMatch(/<dt\b/);
    expect(src).toMatch(/<dd\b/);
    expect(src).toContain('data-slot="infolist-entry-label"');
    expect(src).toContain('data-slot="infolist-entry-value"');
  });
  test("code: no built-in <pre><code> (caller renders it in value slot); muted-bg is caller responsibility", () => {
    // v-next: no built-in pre/code element; the partial provides layout + ink, not code highlighting.
    // Strip JTE comments (<%-- ... --%>) before checking: the doc-comment may contain <code> examples.
    const markup = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(markup).not.toMatch(/<pre\b/);
    expect(markup).not.toMatch(/<code\b/);
    expect(src).not.toContain('@param boolean lineNumbers = false');
    expect(src).not.toContain('data-language=');
    // The variant-driven _valueBg provides tinted background for non-default variants via color-mix.
    expect(src).toContain("color-mix");
  });
  test("text fallback: empty fallback string when value slot is absent (not a data-type=text sentinel)", () => {
    // v-next: the old data-type=text sentinel is gone. The partial renders the `empty` param
    // string in <dd> when the value slot is absent (null). This is the correct pattern.
    expect(src).not.toContain('data-type="text"');
    expect(src).toContain('@param String empty = "—"');
    expect(src).toContain('data-slot="infolist-entry-empty"');
    expect(src).toContain("${empty}");
  });
});

describe("stat-card — KPI tile (kit StatWidget, v-next re-forge)", () => {
  const src = read("stat-card.jte");
  test("stamps data-slot=stat-card and the v-next core params (title/value, not heading)", () => {
    // v-next: 'heading' → 'title'; 'description' is now empty-string default (not null).
    // Old params removed: heading, url, newTab, color, descriptionIcon, iconPosition, chart.
    expect(src).toContain('data-slot="stat-card"');
    expect(src).toContain("@param String title");
    expect(src).toContain("@param String value");
    expect(src).toContain('@param String description = ""');
    // old 'heading' param is gone (replaced by 'title')
    expect(src).not.toContain("@param String heading");
  });
  test("trend indicator: direction via trend param (up/down/neutral/none), role=img a11y", () => {
    // v-next: OLD descriptionIcon/iconPosition API → NEW trend/trendValue/trendLabel params.
    // Trend indicator is a span[role=img] with auto-generated Italian label.
    expect(src).toContain('@param String trend = "none"');
    expect(src).toContain('@param String trendValue = ""');
    expect(src).toContain('data-slot="stat-card-trend"');
    expect(src).toContain('role="img"');
    // old iconPosition API is gone
    expect(src).not.toContain("@param String iconPosition");
    expect(src).not.toContain("@param String descriptionIcon");
  });
  test("optional whole-card link: stretched-link <a> INSIDE the figure (href param, not url/newTab)", () => {
    // v-next: OLD url/newTab → NEW href (single param, no newTab).
    // CRITICAL anti-pattern corrected: the <a> is a stretched-link INSIDE the figure
    // (figure is position:relative; a is absolute inset-0) — NOT a wrapping <a> around the figure.
    // The figure is NOT aria-hidden; the <a> carries aria-label="${_linkLabel}".
    expect(src).toContain("@param String href = null");
    expect(src).toContain('data-slot="stat-card-link"');
    expect(src).toContain("absolute inset-0");
    expect(src).toContain('aria-label="${_linkLabel}"');
    // figure is NOT aria-hidden (the a carries the accessible name, not the figure)
    expect(src).not.toContain('<figure aria-hidden');
    // old url/newTab params are gone
    expect(src).not.toContain("@param String url");
    expect(src).not.toContain("@param boolean newTab");
  });
  test("variant maps to left-border accent colour (not bg tint); uses --lv-color-success, border-left-color", () => {
    // v-next: OLD color param (bg tint) → NEW variant param (left-border accent only).
    // The card body background stays --lv-color-card; variant only drives border-left-color.
    expect(src).toContain("var(--lv-color-success)");
    expect(src).toContain("border-left-color");
    expect(src).toContain("var(--lv-color-card)");
    expect(src).toContain("var(--lv-shadow-sm)");
    // old color param is gone
    expect(src).not.toContain("@param String color");
  });
  test("footer slot replaces old chart slot; root is <figure> with <figcaption>", () => {
    // v-next: OLD chart slot (data-slot=stat-card-chart) → NEW footer slot (data-slot=stat-card-footer).
    // Root is <figure> (semantic self-contained metric tile); title becomes <figcaption>.
    expect(src).toContain("@param gg.jte.Content footer = null");
    expect(src).toContain('data-slot="stat-card-footer"');
    expect(src).toMatch(/<figure[\s>]/);
    expect(src).toMatch(/<figcaption[\s>]/);
    // old chart slot is gone
    expect(src).not.toContain("@param gg.jte.Content chart");
    expect(src).not.toContain('data-slot="stat-card-chart"');
  });
});

describe("empty.jte already covers Filament's empty-state (icon + heading + description + action)", () => {
  const src = read("empty.jte");
  test("has the illustration tile, the title, the description, and an action slot", () => {
    // v-next: data-slot="empty-icon" renamed to "empty-illustration" (supports both icon and
    // custom image/imageUrl); explicit icon param replaced by variant-driven _defaultIcon switch
    expect(src).toContain('data-slot="empty-illustration"');
    expect(src).toContain('data-slot="empty-title"');
    expect(src).toContain('data-slot="empty-description"');
    expect(src).toContain("@param gg.jte.Content action = null");
    // icon is now variant-driven (no explicit icon param); variant drives _defaultIcon
    expect(src).toContain("@param String variant");
    // No extension needed: the Filament empty-state (EmptyMedia + EmptyTitle + EmptyDescription
    // + EmptyContent) is already fully modelled, so ui1-lists leaves it untouched.
  });
});

describe("data-list — v-next: ariaLabel + bordered chrome", () => {
  const src = read("data-list.jte");
  test("has ariaLabel smart-attribute param", () => {
    expect(src).toContain('@param String ariaLabel = null');
    expect(src).toContain('aria-label="${ariaLabel}"');
  });
  test("data-bordered attribute is present", () => {
    expect(src).toContain('data-bordered="${bordered}"');
  });
  test("card chrome classes present when bordered", () => {
    expect(src).toContain('var(--lv-radius-lg)');
    expect(src).toContain('var(--lv-color-card)');
    expect(src).toContain('var(--lv-color-card-fg)');
  });
  test("no dev.lievit import", () => {
    expect(src).not.toContain('import dev.lievit');
  });
});

describe("data-list/row — v-next: href + hoverHighlight + dataAttrs", () => {
  const src = read("data-list/row.jte");
  test("has href param for whole-tile link", () => {
    expect(src).toContain('@param String href = null');
    expect(src).toContain('href="${href}"');
  });
  test("has hoverHighlight param", () => {
    expect(src).toContain('@param boolean hoverHighlight = true');
    expect(src).toContain('var(--lv-color-muted-bg)');
    expect(src).toContain('transition-colors');
  });
  test("has dataAttrs safe-escaped channel", () => {
    expect(src).toContain('@param java.util.Map<String, String> dataAttrs');
    expect(src).toContain('Escape.htmlAttribute');
    expect(src).toContain('$unsafe{');
  });
  test("data-slot on row and all three sub-slots", () => {
    expect(src).toContain('data-slot="data-list-row"');
    expect(src).toContain('data-slot="data-list-row-media"');
    expect(src).toContain('data-slot="data-list-row-content"');
    expect(src).toContain('data-slot="data-list-row-actions"');
  });
  test("linked row uses block-display <a> inside <li>", () => {
    expect(src).toContain('<a ');
    expect(src).toContain('"block');
  });
  test("focus ring on linked row", () => {
    expect(src).toContain('var(--lv-ring)');
  });
  test("no dev.lievit import", () => {
    expect(src).not.toContain('import dev.lievit');
  });
});

describe("description-list — v-next: bordered + size + title + extra", () => {
  const src = read("description-list.jte");
  test("has bordered param", () => {
    expect(src).toContain('@param boolean bordered = false');
    expect(src).toContain('data-bordered="${bordered}"');
  });
  test("has size param with sm/md/lg", () => {
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('data-size="${size}"');
    expect(src).toContain('var(--lv-text-xs)');
    expect(src).toContain('var(--lv-text-sm)');
    expect(src).toContain('var(--lv-text-base)');
  });
  test("has title param rendering <p data-slot>", () => {
    expect(src).toContain('@param String title = null');
    expect(src).toContain('data-slot="description-list-title"');
  });
  test("has extra slot param", () => {
    expect(src).toContain('@param gg.jte.Content extra = null');
    expect(src).toContain('data-slot="description-list-extra"');
  });
  test("size=lg uses --lv-space-7 for row gap", () => {
    expect(src).toContain('var(--lv-space-7)');
  });
  test("bordered adds card chrome tokens", () => {
    expect(src).toContain('var(--lv-radius-md)');
    expect(src).toContain('var(--lv-color-card)');
  });
  test("font-semibold on title", () => {
    expect(src).toContain('var(--lv-font-semibold)');
  });
  test("no dev.lievit import", () => {
    expect(src).not.toContain('import dev.lievit');
  });
});

describe("description-list/item — v-next: colon param", () => {
  const src = read("description-list/item.jte");
  test("has colon param", () => {
    expect(src).toContain('@param boolean colon = true');
  });
  test("appends colon to term when colon=true", () => {
    // The template computes termText = colon ? term + ":" : term
    expect(src).toContain('+ ":"');
  });
  test("term uses muted-fg colour", () => {
    expect(src).toContain('var(--lv-color-muted-fg)');
  });
  test("value uses fg colour", () => {
    expect(src).toContain('var(--lv-color-fg)');
  });
  test("columnSpan emits grid-column span on both dt and dd", () => {
    expect(src).toContain('grid-column:span');
  });
  test("no dev.lievit import", () => {
    expect(src).not.toContain('import dev.lievit');
  });
});

describe("key-value — v-next: bordered + striped + emptyMessage + scope", () => {
  const src = read("key-value.jte");
  test("has bordered param", () => {
    expect(src).toContain('@param boolean bordered = true');
    expect(src).toContain('data-bordered="${bordered}"');
  });
  test("has striped param", () => {
    expect(src).toContain('@param boolean striped = false');
    expect(src).toContain('data-striped="${striped}"');
  });
  test("has emptyMessage param with colspan=2 cell", () => {
    expect(src).toContain('@param String emptyMessage = null');
    expect(src).toContain('colspan="2"');
  });
  test("th elements carry scope=col", () => {
    // Both th headers must carry scope="col"
    const thMatches = src.match(/scope="col"/g);
    expect(thMatches).not.toBeNull();
    expect(thMatches!.length).toBeGreaterThanOrEqual(2);
  });
  test("NO explicit role=table on the <table>", () => {
    expect(src).not.toContain('role="table"');
  });
  test("data-slot=key-value on <table>", () => {
    expect(src).toContain('data-slot="key-value"');
  });
  test("data-slot=key-value-key-head and key-value-value-head on th", () => {
    expect(src).toContain('data-slot="key-value-key-head"');
    expect(src).toContain('data-slot="key-value-value-head"');
  });
  test("data-slot=key-value-row on tbody tr", () => {
    expect(src).toContain('data-slot="key-value-row"');
  });
  test("cell padding uses --lv-space-3 (v-next upgrade from space-2)", () => {
    expect(src).toContain('var(--lv-space-3)');
  });
  test("striped row tint uses --lv-color-surface", () => {
    expect(src).toContain('var(--lv-color-surface)');
  });
  test("bordered adds radius-md", () => {
    expect(src).toContain('var(--lv-radius-md)');
  });
  test("no dev.lievit import", () => {
    expect(src).not.toContain('import dev.lievit');
  });
});
