/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
// dialog/drawer (Wave 2 overlays) + tabs/accordion (Wave 2 disclosure) became server-first WIRE
// components (ADR-0012): no Lit island to import. Their render behaviour is pinned on the JVM side
// in lievit-kit (DialogComponentIT / DrawerComponentIT / TabsComponentIT / AccordionComponentIT)
// + the registry shape in wire-*.test.ts. breadcrumb remains an island until Wave 4.
import "../registry/components/breadcrumb/breadcrumb.js";

async function mount<T extends HTMLElement>(tag: string, set?: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  set?.(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("tier-4 light DOM", () => {
  test("every tier-4 primitive renders into the light DOM (no shadow root)", async () => {
    for (const tag of ["lv-breadcrumb"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-breadcrumb
// ---------------------------------------------------------------------------
type BreadcrumbEl = HTMLElement & {
  items: Array<{ label: string; href?: string }>;
  separator: string;
  label: string;
};

const breadcrumbItems = [
  { label: "Home", href: "/" },
  { label: "Properties", href: "/properties" },
  { label: "Via Roma 12" },
];

describe("lv-breadcrumb", () => {
  test("renders a nav with the breadcrumb label", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
    });
    const nav = el.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav?.getAttribute("aria-label")).toBe("Breadcrumb");
  });

  test("renders an ordered list with one item per breadcrumb", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
    });
    const items = el.querySelectorAll("li");
    expect(items.length).toBe(3);
  });

  test("non-current items are anchor links", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
    });
    const links = el.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].textContent).toBe("Home");
    expect(links[1].textContent).toBe("Properties");
  });

  test("current (last) item has aria-current=page and is not a link", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
    });
    const current = el.querySelector('[aria-current="page"]') as HTMLElement;
    expect(current).not.toBeNull();
    expect(current.tagName).not.toBe("A");
    expect(current.textContent).toBe("Via Roma 12");
  });

  test("separator is rendered between items and is aria-hidden", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
      e.separator = ">";
    });
    const separators = el.querySelectorAll(".lv-breadcrumb__separator");
    expect(separators.length).toBe(2);
    separators.forEach((s) => expect(s.getAttribute("aria-hidden")).toBe("true"));
  });

  test("custom label prop is reflected on the nav aria-label", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = breadcrumbItems;
      e.label = "Percorso di navigazione";
    });
    expect(el.querySelector("nav")?.getAttribute("aria-label")).toBe("Percorso di navigazione");
  });

  test("single-item breadcrumb: no separator, item is current", async () => {
    const el = await mount<BreadcrumbEl>("lv-breadcrumb", (e) => {
      e.items = [{ label: "Home", href: "/" }];
    });
    expect(el.querySelectorAll(".lv-breadcrumb__separator").length).toBe(0);
    expect(el.querySelector('[aria-current="page"]')).not.toBeNull();
  });
});
