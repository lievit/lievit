/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import "../registry/components/popover/popover.js";

// @floating-ui/dom calls getBoundingClientRect/getComputedStyle which happy-dom
// stubs to zeros; computePosition still resolves, so position() runs without throwing.
async function mount<T extends HTMLElement>(
  tag: string,
  set?: (el: T) => void
): Promise<T> {
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
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Light DOM check
// ---------------------------------------------------------------------------
describe("overlays light DOM", () => {
  test("every overlay renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of ["lv-popover"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-popover
// ---------------------------------------------------------------------------
type LvPopoverEl = HTMLElement & {
  placement: string;
  disabled: boolean;
  trapFocus: boolean;
};

const trigger = (el: HTMLElement) =>
  el.querySelector(".lv-popover__trigger") as HTMLElement;
const panel = (el: HTMLElement) =>
  el.querySelector(".lv-popover__panel") as HTMLElement;

describe("lv-popover", () => {
  test("renders a role=dialog panel referenced by the trigger's aria-controls", async () => {
    const el = await mount("lv-popover");
    const p = panel(el);
    expect(p.getAttribute("role")).toBe("dialog");
    // non-modal popover
    expect(p.getAttribute("aria-modal")).toBe("false");
  });

  test("trigger advertises aria-haspopup=dialog and starts collapsed", async () => {
    const el = await mount("lv-popover");
    const t = trigger(el);
    expect(t.getAttribute("aria-haspopup")).toBe("dialog");
    expect(t.getAttribute("aria-expanded")).toBe("false");
    expect(t.getAttribute("data-state")).toBe("closed");
    // aria-controls is empty while closed (Radix sets it only when open)
    expect(t.getAttribute("aria-controls")).toBe("");
  });

  test("panel is hidden by default (no --open class)", async () => {
    const el = await mount("lv-popover");
    expect(el.querySelector(".lv-popover__panel--open")).toBeNull();
  });

  test("clicking the trigger opens the panel and flips aria-expanded", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-popover__panel--open")).not.toBeNull();
    expect(trigger(el).getAttribute("aria-expanded")).toBe("true");
    expect(trigger(el).getAttribute("data-state")).toBe("open");
    // aria-controls now points at the panel id
    expect(trigger(el).getAttribute("aria-controls")).toBe(panel(el).id);
  });

  test("clicking the trigger again closes the panel (toggle)", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-popover__panel--open")).toBeNull();
  });

  test("opening emits a bubbling lv-open event", async () => {
    const el = await mount("lv-popover");
    let fired = false;
    el.addEventListener("lv-open", () => (fired = true));
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    expect(fired).toBe(true);
  });

  test("Escape closes the open panel and emits lv-close", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    let closed = false;
    el.addEventListener("lv-close", () => (closed = true));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle(el);
    expect(el.querySelector(".lv-popover__panel--open")).toBeNull();
    expect(closed).toBe(true);
  });

  test("a click outside the component dismisses the open panel", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    const outside = document.createElement("div");
    document.body.appendChild(outside);
    outside.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-popover__panel--open")).toBeNull();
  });

  test("disabled trigger does not open", async () => {
    const el = await mount<LvPopoverEl>("lv-popover", (e) => {
      e.disabled = true;
    });
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    expect(el.querySelector(".lv-popover__panel--open")).toBeNull();
  });

  test("on open it positions the panel (left/top set by Floating UI)", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    // computePosition is async (a promise chain inside Floating UI); flush the
    // microtask queue until the style lands.
    const p = panel(el);
    for (let i = 0; i < 20 && p.style.left === ""; i++) {
      await new Promise((r) => setTimeout(r, 0));
    }
    expect(p.style.left).not.toBe("");
    expect(p.style.top).not.toBe("");
  });

  test("trap-focus cycles Tab within the panel's focusables (wraps last->first)", async () => {
    const el = await mount<LvPopoverEl>("lv-popover", (e) => {
      e.trapFocus = true;
    });
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    const p = panel(el);
    // inject real focusables into the rendered panel (slot projection is inert in
    // light DOM; the trap logic queries the panel's actual descendants).
    const first = document.createElement("button");
    const last = document.createElement("button");
    p.append(first, last);
    last.focus();
    const ev = new KeyboardEvent("keydown", {
      key: "Tab",
      bubbles: true,
      cancelable: true,
    });
    p.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  test("without trap-focus, Tab is not intercepted", async () => {
    const el = await mount("lv-popover");
    trigger(el).dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await settle(el);
    const p = panel(el);
    const ev = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    p.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });
});
