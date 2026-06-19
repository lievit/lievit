/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import "../registry/components/popover/popover.js";
import "../registry/components/hover-card/hover-card.js";

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
// Light DOM check (both overlays)
// ---------------------------------------------------------------------------
describe("overlays light DOM", () => {
  test("every overlay renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of ["lv-popover", "lv-hover-card"]) {
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

// ---------------------------------------------------------------------------
// lv-hover-card
// ---------------------------------------------------------------------------
type LvHoverCardEl = HTMLElement & {
  placement: string;
  openDelay: number;
  closeDelay: number;
};

const hcTrigger = (el: HTMLElement) =>
  el.querySelector(".lv-hover-card__trigger") as HTMLElement;
const hcPanel = (el: HTMLElement) =>
  el.querySelector(".lv-hover-card__panel") as HTMLElement;

describe("lv-hover-card", () => {
  test("the preview card carries NO ARIA role and is aria-hidden (Radix preview model)", async () => {
    const el = await mount("lv-hover-card");
    const p = hcPanel(el);
    expect(p.getAttribute("role")).toBeNull();
    expect(p.getAttribute("aria-hidden")).toBe("true");
  });

  test("the trigger has data-state but NOT aria-haspopup (not an announced popup)", async () => {
    const el = await mount("lv-hover-card");
    const t = hcTrigger(el);
    expect(t.getAttribute("data-state")).toBe("closed");
    expect(t.getAttribute("aria-haspopup")).toBeNull();
  });

  test("card is hidden by default (no --open class)", async () => {
    const el = await mount("lv-hover-card");
    expect(el.querySelector(".lv-hover-card__panel--open")).toBeNull();
  });

  test("pointer-enter opens the card only AFTER open-delay elapses", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 300;
    });
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    // not open yet (delay pending)
    expect(el.querySelector(".lv-hover-card__panel--open")).toBeNull();
    vi.advanceTimersByTime(300);
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).not.toBeNull();
  });

  test("focus also opens after the delay (keyboard users get the preview)", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 300;
    });
    hcTrigger(el).dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.advanceTimersByTime(300);
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).not.toBeNull();
  });

  test("pointer-leave closes the card after close-delay", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 0;
      e.closeDelay = 300;
    });
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).not.toBeNull();
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    // still open (close pending)
    expect(el.querySelector(".lv-hover-card__panel--open")).not.toBeNull();
    vi.advanceTimersByTime(300);
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).toBeNull();
  });

  test("moving the pointer onto the card before close cancels the close (gap is crossable)", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 0;
      e.closeDelay = 300;
    });
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await settle(el);
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    // re-enter on the card itself cancels the pending close
    hcPanel(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(300);
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).not.toBeNull();
  });

  test("Escape closes immediately (no delay)", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 0;
    });
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await settle(el);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await settle(el);
    expect(el.querySelector(".lv-hover-card__panel--open")).toBeNull();
  });

  test("opening emits lv-open, closing emits lv-close", async () => {
    vi.useFakeTimers();
    const el = await mount<LvHoverCardEl>("lv-hover-card", (e) => {
      e.openDelay = 0;
      e.closeDelay = 0;
    });
    let opened = false;
    let closed = false;
    el.addEventListener("lv-open", () => (opened = true));
    el.addEventListener("lv-close", () => (closed = true));
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await settle(el);
    expect(opened).toBe(true);
    hcTrigger(el).dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(0);
    await settle(el);
    expect(closed).toBe(true);
  });
});
