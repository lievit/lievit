/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/dialog/dialog.js";
import "../registry/components/drawer/drawer.js";
// tabs + accordion were converted to server-first WIRE components (ADR-0012, Wave 2); their Lit
// islands are gone. Coverage moved to test/wire-disclosure.test.ts (registry) + the lievit-kit
// TabsComponentIT / AccordionComponentIT (render-asserting through the real runtime).
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

// ---------------------------------------------------------------------------
// Light DOM check for all tier-4 primitives
// ---------------------------------------------------------------------------
describe("tier-4 light DOM", () => {
  test("every tier-4 primitive renders into the light DOM (no shadow root)", async () => {
    for (const tag of [
      "lv-dialog",
      "lv-drawer",
      "lv-breadcrumb",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-dialog
// ---------------------------------------------------------------------------
type DialogEl = HTMLElement & { open: boolean; heading: string; dismissible: boolean };

describe("lv-dialog", () => {
  test("closed by default: backdrop has no --open class", async () => {
    const el = await mount("lv-dialog");
    expect(el.querySelector(".lv-dialog-backdrop--open")).toBeNull();
  });

  test("open renders the backdrop --open class", async () => {
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
    });
    expect(el.querySelector(".lv-dialog-backdrop--open")).not.toBeNull();
  });

  test("dialog panel has role=dialog and aria-modal=true", async () => {
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
    });
    const panel = el.querySelector(".lv-dialog");
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
  });

  test("heading renders and aria-labelledby is wired", async () => {
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
      e.heading = "Confirm action";
    });
    const title = el.querySelector(".lv-dialog__title");
    expect(title?.textContent).toBe("Confirm action");
    const panel = el.querySelector(".lv-dialog");
    const labelledBy = panel?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(el.querySelector(`#${labelledBy}`)?.textContent).toBe("Confirm action");
  });

  test("close button renders when heading is set", async () => {
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
      e.heading = "Test";
    });
    expect(el.querySelector(".lv-dialog__close")).not.toBeNull();
  });

  test("clicking close button emits lv-close", async () => {
    let closed = false;
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
      e.heading = "Test";
    });
    el.addEventListener("lv-close", () => { closed = true; });
    (el.querySelector(".lv-dialog__close") as HTMLButtonElement).click();
    expect(closed).toBe(true);
  });

  test("clicking backdrop emits lv-close when dismissible (default)", async () => {
    let closed = false;
    const el = await mount<DialogEl>("lv-dialog", (e) => {
      e.open = true;
    });
    el.addEventListener("lv-close", () => { closed = true; });
    const backdrop = el.querySelector(".lv-dialog-backdrop") as HTMLElement;
    // Simulate click directly on backdrop (not a child)
    backdrop.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(closed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lv-drawer
// ---------------------------------------------------------------------------
type DrawerEl = HTMLElement & { open: boolean; heading: string; side: string; dismissible: boolean };

describe("lv-drawer", () => {
  test("closed by default: drawer panel has no --open class", async () => {
    const el = await mount("lv-drawer");
    expect(el.querySelector(".lv-drawer--open")).toBeNull();
  });

  test("open adds --open class to the panel", async () => {
    const el = await mount<DrawerEl>("lv-drawer", (e) => {
      e.open = true;
    });
    expect(el.querySelector(".lv-drawer--open")).not.toBeNull();
  });

  test("role=dialog and aria-modal=true on the panel", async () => {
    const el = await mount<DrawerEl>("lv-drawer", (e) => {
      e.open = true;
    });
    const panel = el.querySelector(".lv-drawer");
    expect(panel?.getAttribute("role")).toBe("dialog");
    expect(panel?.getAttribute("aria-modal")).toBe("true");
  });

  test("side prop adds the correct class", async () => {
    for (const side of ["right", "left", "bottom", "top"] as const) {
      const el = await mount<DrawerEl>("lv-drawer", (e) => {
        e.side = side;
      });
      expect(el.querySelector(`.lv-drawer--${side}`)).not.toBeNull();
      document.body.innerHTML = "";
    }
  });

  test("heading renders and aria-labelledby is wired", async () => {
    const el = await mount<DrawerEl>("lv-drawer", (e) => {
      e.open = true;
      e.heading = "Filters";
    });
    const title = el.querySelector(".lv-drawer__title");
    expect(title?.textContent).toBe("Filters");
    const panel = el.querySelector(".lv-drawer");
    const labelledBy = panel?.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
  });

  test("clicking close button emits lv-close", async () => {
    let closed = false;
    const el = await mount<DrawerEl>("lv-drawer", (e) => {
      e.open = true;
      e.heading = "Settings";
    });
    el.addEventListener("lv-close", () => { closed = true; });
    (el.querySelector(".lv-drawer__close") as HTMLButtonElement).click();
    expect(closed).toBe(true);
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
    expect(separators.length).toBe(2); // n-1 separators
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
