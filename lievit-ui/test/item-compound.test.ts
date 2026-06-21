/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Structural golden for the item COMPOUND sub-parts (#464 Type-2): the typed child partials that
 * mirror shadcn new-york-v4 item.tsx -- ItemTitle / ItemDescription / ItemHeader / ItemFooter /
 * ItemGroup / ItemSeparator / ItemMedia (default | icon | image). The core item.jte row is pinned
 * in static-partials-b1.test.ts (#435); this file pins ONLY the new compound vocabulary.
 *
 * As with the other JTE suites, these partials compile in the Java world, so the harness asserts
 * on the partial SOURCE as text: exact shadcn data-slot, the WAI-ARIA role, token-driven styling
 * (every colour/space/radius reads a --lv-* var, never a hardcoded hex/px), the Apache header, the
 * declared @param API, and the strict-CSP cleanliness (no inline <script>, no on* handler).
 */
import { describe, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const itemDir = join(import.meta.dirname, "..", "registry", "jte", "item");
const read = (name: string) => readFileSync(join(itemDir, `${name}.jte`), "utf8");

const PARTS = [
  "title",
  "description",
  "header",
  "footer",
  "group",
  "separator",
  "media",
] as const;

// shadcn new-york-v4 item.tsx data-slot per sub-part (the exact names the cascade/styling key on).
const SLOTS: Record<(typeof PARTS)[number], string> = {
  title: "item-title",
  description: "item-description",
  header: "item-header",
  footer: "item-footer",
  group: "item-group",
  separator: "item-separator",
  media: "item-media",
};

describe("item compound sub-parts: cross-cutting invariants", () => {
  test.each(PARTS)("%s carries the Apache header", (part) => {
    const src = read(part);
    expect(src).toContain("Copyright 2026 Francesco Bilotta");
    expect(src).toContain('Licensed under the Apache License, Version 2.0 (the "License").');
  });

  test.each(PARTS)("%s stamps shadcn's exact data-slot", (part) => {
    expect(read(part)).toContain(`data-slot="${SLOTS[part]}"`);
  });

  test.each(PARTS)("%s is token-driven: no hardcoded hex colour", (part) => {
    const src = read(part);
    // No raw hex literals (#fff, #2563eb...). Colours must read a --lv-* var.
    expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test.each(PARTS)("%s is CSP-clean: no inline <script> and no on* handler", (part) => {
    const src = read(part);
    expect(src).not.toMatch(/<script/i);
    // on*= event handler attribute (allow JTE's own @ directives, only flag HTML on... attrs).
    expect(src).not.toMatch(/\son[a-z]+\s*=/i);
  });

  test.each(PARTS)("%s declares a cssClass passthrough (shadcn className parity)", (part) => {
    expect(read(part)).toContain("@param String cssClass");
  });
});

describe("item.title — ItemTitle (typed, not a free content slot)", () => {
  const src = read("title");
  test("renders the title content slot with shadcn typography", () => {
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
    expect(src).toContain("font-[var(--lv-font-medium)]");
    expect(src).toContain("leading-snug");
  });
});

describe("item.description — ItemDescription (typed muted line)", () => {
  const src = read("description");
  test("is a <p>, muted, with the inline-link affordances", () => {
    expect(src).toMatch(/<p\b/);
    expect(src).toContain("text-[var(--lv-color-muted-fg)]");
    expect(src).toContain("line-clamp-2");
    expect(src).toContain("[&>a]:underline");
    expect(src).toContain("[&>a:hover]:text-[var(--lv-color-primary)]");
  });
});

describe("item.header / item.footer — full-width edge-justified bands", () => {
  test.each(["header", "footer"] as const)("%s spans the row and edge-justifies", (part) => {
    const src = read(part);
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("basis-full");
    expect(src).toContain("justify-between");
  });
});

describe("item.group — ItemGroup (role=list)", () => {
  const src = read("group");
  test("is role=list around the rows", () => {
    expect(src).toContain('role="list"');
    expect(src).toContain("@param gg.jte.Content content");
    expect(src).toContain("${content}");
  });
});

describe("item.separator — ItemSeparator (decorative divider)", () => {
  const src = read("separator");
  test("is a decorative token-coloured rule, hidden from AT", () => {
    expect(src).toContain('aria-hidden="true"');
    expect(src).toContain("bg-[var(--lv-color-border)]");
    // decorative => no role announced.
    expect(src).not.toMatch(/role="separator"/);
  });
});

describe("item.media — ItemMedia variants (default | icon | image)", () => {
  const src = read("media");
  test("exposes the variant param and emits data-variant", () => {
    expect(src).toContain("@param String variant");
    expect(src).toContain('data-variant="${variant}"');
  });
  test("icon variant: bordered muted tile, token radius + border + bg", () => {
    expect(src).toContain('case "icon"');
    expect(src).toContain("rounded-[var(--lv-radius-sm)]");
    expect(src).toContain("border-[var(--lv-color-border)]");
    expect(src).toContain("bg-[var(--lv-color-muted-bg)]");
  });
  test("image variant: overflow-clipped tile, object-cover img", () => {
    expect(src).toContain('case "image"');
    expect(src).toContain("overflow-hidden");
    expect(src).toContain("[&_img]:object-cover");
  });
  test("default variant is transparent (just centres the slot)", () => {
    expect(src).toContain("bg-transparent");
  });
});
