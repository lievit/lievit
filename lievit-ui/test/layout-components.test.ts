/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/scroll-area/scroll-area.js";
import "../registry/components/resizable/resizable.js";
// sheet became a server-first WIRE component (Wave 2, ADR-0012): no Lit island to import. Its
// server state-transition + render behaviour is pinned on the JVM side in lievit-kit
// (SheetComponentIT), the same way collapsible's is.

async function mount<T extends HTMLElement>(tag: string, set?: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  set?.(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

async function settle(el: HTMLElement) {
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Light DOM check for all three layout primitives
// ---------------------------------------------------------------------------
describe("layout light DOM", () => {
  test("every layout primitive renders into the light DOM (no shadow root)", async () => {
    for (const tag of ["lv-scroll-area", "lv-resizable"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-scroll-area
// ---------------------------------------------------------------------------
type ScrollAreaEl = HTMLElement & { orientation: string; type: string };

describe("lv-scroll-area", () => {
  test("renders a native scroll viewport that holds the slotted content", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area");
    const vp = el.querySelector(".lv-scroll-area__viewport") as HTMLElement;
    expect(vp).not.toBeNull();
    // native scrolling preserved: it is a real overflow:scroll container, not role-hijacked
    expect(vp.querySelector("slot")).not.toBeNull();
  });

  test("the viewport is keyboard-focusable so native keyboard scrolling works", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area");
    const vp = el.querySelector(".lv-scroll-area__viewport") as HTMLElement;
    expect(vp.getAttribute("tabindex")).toBe("0");
  });

  test("vertical (default) renders only the y scrollbar, marked aria-hidden", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area");
    expect(el.querySelector(".lv-scroll-area__scrollbar--y")).not.toBeNull();
    expect(el.querySelector(".lv-scroll-area__scrollbar--x")).toBeNull();
    expect(el.querySelector(".lv-scroll-area__scrollbar--y")?.getAttribute("aria-hidden")).toBe(
      "true"
    );
  });

  test("horizontal renders only the x scrollbar", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area", (e) => {
      e.orientation = "horizontal";
    });
    expect(el.querySelector(".lv-scroll-area__scrollbar--x")).not.toBeNull();
    expect(el.querySelector(".lv-scroll-area__scrollbar--y")).toBeNull();
  });

  test("both renders x and y scrollbars, each with a thumb", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area", (e) => {
      e.orientation = "both";
    });
    expect(el.querySelector(".lv-scroll-area__scrollbar--y .lv-scroll-area__thumb")).not.toBeNull();
    expect(el.querySelector(".lv-scroll-area__scrollbar--x .lv-scroll-area__thumb")).not.toBeNull();
  });

  test("type=always pins the bars visible", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area", (e) => {
      e.type = "always";
    });
    await settle(el);
    expect(el.querySelector(".lv-scroll-area__scrollbar--visible")).not.toBeNull();
  });

  test("a scroll event shows the bar (no crash) and keeps the native scroll intact", async () => {
    const el = await mount<ScrollAreaEl>("lv-scroll-area");
    const vp = el.querySelector(".lv-scroll-area__viewport") as HTMLElement;
    vp.dispatchEvent(new Event("scroll"));
    await settle(el);
    // the viewport is still a real scroll container after our handler ran
    expect(getComputedStyle(vp).overflow).not.toBe("hidden");
  });
});

// ---------------------------------------------------------------------------
// lv-resizable
// ---------------------------------------------------------------------------
type ResizableEl = HTMLElement & {
  panels: Array<{ id?: string; size?: number; min?: number; max?: number; collapsible?: boolean }>;
  direction: "horizontal" | "vertical";
  withHandle: boolean;
  keyboardStep: number;
};

const twoPanels = [{ id: "a", size: 50 }, { id: "b", size: 50 }];

describe("lv-resizable", () => {
  test("renders one panel per descriptor and a separator between adjacent panels", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = [{ size: 33 }, { size: 33 }, { size: 34 }];
    });
    expect(el.querySelectorAll(".lv-resizable__panel").length).toBe(3);
    // n panels => n-1 handles
    expect(el.querySelectorAll(".lv-resizable__handle").length).toBe(2);
  });

  test("each handle is a role=separator with the full ARIA value set", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = twoPanels;
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    expect(sep.getAttribute("role")).toBe("separator");
    expect(sep.getAttribute("tabindex")).toBe("0");
    expect(sep.getAttribute("aria-orientation")).toBe("vertical"); // horizontal layout
    expect(sep.getAttribute("aria-valuemin")).toBeTruthy();
    expect(sep.getAttribute("aria-valuemax")).toBeTruthy();
    expect(sep.getAttribute("aria-valuenow")).toBe("50");
    expect(sep.getAttribute("aria-controls")).toBeTruthy();
  });

  test("vertical direction flips the separator orientation", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = twoPanels;
      e.direction = "vertical";
    });
    expect(el.querySelector(".lv-resizable__handle")?.getAttribute("aria-orientation")).toBe(
      "horizontal"
    );
  });

  test("ArrowRight grows the preceding panel by the keyboard step and emits lv-resize", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = twoPanels;
      e.keyboardStep = 5;
    });
    let detail: { sizes: number[] } | undefined;
    el.addEventListener("lv-resize", (e) => {
      detail = (e as CustomEvent).detail;
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    await settle(el);
    expect(detail?.sizes[0]).toBe(55);
    expect(detail?.sizes[1]).toBe(45);
    expect(sep.getAttribute("aria-valuenow")).toBe("55");
  });

  test("ArrowLeft shrinks the preceding panel by the keyboard step", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = twoPanels;
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await settle(el);
    expect(sep.getAttribute("aria-valuenow")).toBe("45");
  });

  test("resize is clamped so a panel never drops below its min", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = [{ size: 20, min: 15 }, { size: 80 }];
      e.keyboardStep = 20;
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
    await settle(el);
    // wanted -20 but min is 15, so it stops at 15, not 0
    expect(sep.getAttribute("aria-valuenow")).toBe("15");
  });

  test("Home drives the preceding panel to its min, End to its max", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = [{ size: 50, min: 20, max: 70 }, { size: 50, min: 20 }];
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
    await settle(el);
    expect(sep.getAttribute("aria-valuenow")).toBe("20");
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
    await settle(el);
    // End wants 70 but neighbour b min is 20, so a can grow to at most 100-20=80, capped by a.max=70
    expect(sep.getAttribute("aria-valuenow")).toBe("70");
  });

  test("with-handle renders a Lucide grip svg, never Font Awesome", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = twoPanels;
      e.withHandle = true;
    });
    expect(el.querySelector(".lv-resizable__grip svg")).not.toBeNull();
    expect(el.querySelector("i.fa, i.fas, wa-icon")).toBeNull();
  });

  test("a collapsible panel collapses to 0 on Enter and reopens on a second Enter", async () => {
    const el = await mount<ResizableEl>("lv-resizable", (e) => {
      e.panels = [{ size: 30, min: 20, collapsible: true }, { size: 70 }];
    });
    const sep = el.querySelector(".lv-resizable__handle") as HTMLElement;
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(el);
    expect(sep.getAttribute("aria-valuenow")).toBe("0");
    sep.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await settle(el);
    expect(sep.getAttribute("aria-valuenow")).toBe("20"); // reopens to its min
  });
});
