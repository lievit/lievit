/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-hover-card Stimulus controller -- the conversion of hover-card.enhancer.ts to the foundation
 * controller model. This suite proves the WAI-ARIA APG Tooltip contract through the REAL Stimulus
 * Application (started by startStimulus(), auto-loading controllers by filename) + the REAL lievit
 * wire morph (no mocked $lievit, no mocked runtime: a fetch stub captures the `_calls` the runtime
 * would POST, so the "zero round-trips by design" doctrine is asserted, not assumed).
 *
 * It mirrors hover-card.test.ts assertion-for-assertion (initial state, hover open/close with delay,
 * early-leave cancel, hover-grace, focus-open path, openOnFocus suppression, focus-never-enters-card,
 * Esc dismiss + stopPropagation, slot conditionality) and adds the morph-safety proofs the enhancer
 * test could not state: after a real morph one gesture still opens exactly once (no stacked
 * listeners), a wrapper removed by a morph fires nothing (disconnect tore the listeners down), and
 * the wire is never called across any cycle (hover-card is the degenerate uncontrolled surface).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application. showPopover/hidePopover are
 * polyfilled (happy-dom v20 lacks them); `data-open` on the panel is the observable open-state proxy
 * (the `:popover-open` pseudo-class is un-queryable via .matches() in happy-dom).
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

/**
 * happy-dom v20 exposes `popover` but does NOT implement showPopover() / hidePopover(); patch them
 * per-element so the controller can call them. The controller stamps/removes `data-open` itself,
 * AFTER the call, so the polyfill is a no-op.
 */
function polyfillPopover(el: HTMLElement): void {
  if (typeof el.showPopover === "function") return;
  (el as unknown as { showPopover: () => void }).showPopover = (): void => {};
  (el as unknown as { hidePopover: () => void }).hidePopover = (): void => {};
}

/** True when the panel carries data-open (the controller's open-state sentinel). */
function isOpen(panel: HTMLElement): boolean {
  return panel.hasAttribute("data-open");
}

interface HoverCardDom {
  componentRoot: HTMLElement;
  wrapper: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
}

/** Build the server-rendered hover-card DOM (trigger wrapper + panel) exactly as the .jte emits it. */
function mountHoverCard(opts: {
  delay?: number;
  closeDelay?: number;
  openOnFocus?: boolean;
  cardId?: string;
  withHeader?: boolean;
  withFooter?: boolean;
} = {}): HoverCardDom {
  const id = opts.cardId ?? "hc-test";
  const delay = opts.delay ?? 300;
  const closeDelay = opts.closeDelay ?? 150;
  const openOnFocus = opts.openOnFocus ?? true;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  // --- trigger wrapper (mirrors hover-card-trigger.jte output, now with data-controller) ---
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-controller", "lv-hover-card");
  wrapper.setAttribute("data-slot", "hover-card-trigger");
  wrapper.setAttribute("data-lv-hover-card-trigger", "");
  wrapper.setAttribute("data-card-id", id);
  wrapper.setAttribute("data-delay", String(delay));
  wrapper.setAttribute("data-close-delay", String(closeDelay));
  wrapper.setAttribute("data-open-on-focus", String(openOnFocus));
  wrapper.setAttribute("aria-describedby", id);
  wrapper.className = "relative inline-flex";

  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.textContent = "Ada Lovelace";
  wrapper.appendChild(trigger);

  // --- card panel (mirrors hover-card.jte output) ---
  const panel = document.createElement("div");
  panel.id = id;
  panel.setAttribute("role", "tooltip");
  panel.setAttribute("popover", "manual");
  panel.setAttribute("data-slot", "hover-card");
  panel.setAttribute("data-variant", "default");
  panel.setAttribute("data-max-width", "sm");

  if (opts.withHeader === true) {
    const header = document.createElement("div");
    header.setAttribute("data-slot", "header");
    header.textContent = "Ada Lovelace";
    panel.appendChild(header);
  }

  const contentDiv = document.createElement("div");
  contentDiv.setAttribute("data-slot", "content");
  contentDiv.textContent = "First programmer. Babbage collaborator. 1815-1852.";
  panel.appendChild(contentDiv);

  if (opts.withFooter === true) {
    const footer = document.createElement("div");
    footer.setAttribute("data-slot", "footer");
    footer.textContent = "Joined 1840";
    panel.appendChild(footer);
  }

  polyfillPopover(panel);

  componentRoot.appendChild(wrapper);
  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);

  return { componentRoot, wrapper, panel, trigger };
}

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ===========================================================================
// INITIAL STATE
// ===========================================================================

describe("lv-hover-card controller — initial state (real Stimulus)", () => {
  it("renders the panel closed (no data-open) on connect", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();

    expect(panel).toBeTruthy();
    expect(isOpen(panel)).toBe(false);
  });

  it("trigger wrapper aria-describedby matches the card id (static, server-rendered)", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();

    expect(wrapper.getAttribute("aria-describedby")).toBe(panel.id);
  });
});

// ===========================================================================
// HOVER SHOW / HIDE WITH DELAY
// ===========================================================================

describe("lv-hover-card controller — hover show/hide with delay", () => {
  it("pointerenter opens the card after delay ms", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 300 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(isOpen(panel)).toBe(false); // still in timer

    vi.advanceTimersByTime(300);
    expect(isOpen(panel)).toBe(true);
  });

  it("pointerleave on trigger closes the card after closeDelay ms", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, closeDelay: 150 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(panel)).toBe(true);

    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    expect(isOpen(panel)).toBe(true); // still in grace timer

    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });

  it("leaving before the open delay fires never opens the card", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 300 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(100);
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(isOpen(panel)).toBe(false);
  });
});

// ===========================================================================
// HOVER GRACE PERIOD (pointer travelling trigger -> card)
// ===========================================================================

describe("lv-hover-card controller — hover grace period", () => {
  it("pointerenter on the panel cancels the close timer (grace succeeded)", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, closeDelay: 150 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(panel)).toBe(true);

    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(50); // half the grace time

    panel.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(200); // well past close delay
    expect(isOpen(panel)).toBe(true); // still open (grace held)
  });

  it("leaving the panel closes the card after closeDelay", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, closeDelay: 150 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);

    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    panel.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    panel.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });
});

// ===========================================================================
// KEYBOARD / FOCUS-OPEN PATH
// ===========================================================================

describe("lv-hover-card controller — keyboard / focus-open path", () => {
  it("focusin opens the card immediately when openOnFocus is true", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ openOnFocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    expect(isOpen(panel)).toBe(false);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);
  });

  it("focusout starts the close timer", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ openOnFocus: true, closeDelay: 150 });
    startStimulus({ runtime });
    await flushStimulus();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(panel)).toBe(true); // still in timer

    vi.advanceTimersByTime(150);
    expect(isOpen(panel)).toBe(false);
  });

  it("focus returning before the close delay keeps the card open", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ openOnFocus: true, closeDelay: 150 });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    vi.advanceTimersByTime(50);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    vi.advanceTimersByTime(200);
    expect(isOpen(panel)).toBe(true);
  });

  it("openOnFocus=false suppresses the keyboard-open path", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ openOnFocus: false });
    startStimulus({ runtime });
    await flushStimulus();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(false);
  });

  it("focus stays on the trigger when the card opens (focus never enters the card)", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, trigger } = mountHoverCard({ openOnFocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    trigger.focus();
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));

    expect(document.activeElement).toBe(trigger);
  });

  it("the card panel has no tabindex (no focusable target inside)", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();

    expect(panel.hasAttribute("tabindex")).toBe(false);
    expect(panel.querySelectorAll<HTMLElement>("[tabindex]")).toHaveLength(0);
  });
});

// ===========================================================================
// ESC DISMISS
// ===========================================================================

describe("lv-hover-card controller — Esc dismiss", () => {
  it("Escape hides an open card and removes data-open", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, openOnFocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(isOpen(panel)).toBe(false);
  });

  it("Escape while the card is closed is a no-op (no throw, no state change)", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();

    expect(isOpen(panel)).toBe(false);
    expect(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    }).not.toThrow();
    expect(isOpen(panel)).toBe(false);
  });

  it("Escape does not propagate past the card (stopPropagation in the capture handler)", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, openOnFocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(panel)).toBe(true);

    // Bubble-phase listener registered AFTER the controller's capture listener: the capture
    // handler's stopPropagation() prevents it from firing while the card is open.
    let parentCalled = false;
    const parentHandler = (): void => {
      parentCalled = true;
    };
    document.addEventListener("keydown", parentHandler);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    document.removeEventListener("keydown", parentHandler);

    expect(isOpen(panel)).toBe(false);
    expect(parentCalled).toBe(false);
  });
});

// ===========================================================================
// SLOT CONDITIONALITY
// ===========================================================================

describe("lv-hover-card controller — slot conditionality", () => {
  it("wrapper and panel carry the expected data-slot values", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();

    expect(wrapper.getAttribute("data-slot")).toBe("hover-card-trigger");
    expect(panel.getAttribute("data-slot")).toBe("hover-card");
  });

  it("header absent when not built; present when built", async () => {
    const { runtime } = makeRuntime();
    const a = mountHoverCard({ withHeader: false });
    expect(a.panel.querySelector('[data-slot="header"]')).toBeNull();
    document.body.innerHTML = "";
    const b = mountHoverCard({ withHeader: true });
    expect(b.panel.querySelector('[data-slot="header"]')).not.toBeNull();
    void runtime;
  });

  it("footer absent when not built; present when built", async () => {
    const { runtime } = makeRuntime();
    const a = mountHoverCard({ withFooter: false });
    expect(a.panel.querySelector('[data-slot="footer"]')).toBeNull();
    document.body.innerHTML = "";
    const b = mountHoverCard({ withFooter: true });
    expect(b.panel.querySelector('[data-slot="footer"]')).not.toBeNull();
    void runtime;
  });

  it("content is always present", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountHoverCard();
    startStimulus({ runtime });
    await flushStimulus();
    expect(panel.querySelector('[data-slot="content"]')).not.toBeNull();
  });
});

// ===========================================================================
// CONTROLLED / UNCONTROLLED DOCTRINE — hover-card is the degenerate uncontrolled surface
// ===========================================================================

describe("lv-hover-card controller — zero wire round-trips (uncontrolled by design)", () => {
  it("a full hover + focus + Esc cycle never calls the wire", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { wrapper, panel } = mountHoverCard({ delay: 0, closeDelay: 0, openOnFocus: true });
    startStimulus({ runtime });
    await flushStimulus();

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    wrapper.dispatchEvent(new Event("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(0);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.useRealTimers();

    await new Promise((r) => setTimeout(r, 10));
    expect(isOpen(panel)).toBe(false);
    expect(calledActions).toHaveLength(0);
  });
});

// ===========================================================================
// MORPH-SAFETY (real lievit morph)
// ===========================================================================

describe("lv-hover-card controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one hover still opens the card exactly once (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountHoverCard({ delay: 0 });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). Markup is identical, so
    // the controller must NOT be double-connected and the listeners must stay single.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const wrapper = componentRoot.querySelector<HTMLElement>("[data-controller~='lv-hover-card']")!;
    const panel = componentRoot.querySelector<HTMLElement>("#hc-test")!;
    polyfillPopover(panel);
    const showSpy = vi.spyOn(panel, "showPopover");

    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    vi.useRealTimers();

    expect(isOpen(panel)).toBe(true);
    expect(showSpy).toHaveBeenCalledTimes(1);
  });

  it("a wrapper removed by a morph fires nothing (disconnect tore the listeners down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, wrapper, panel } = mountHoverCard({ delay: 0 });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the hover-card out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached wrapper's events must no longer reach a live controller -> the (also detached)
    // panel never opens.
    vi.useFakeTimers();
    wrapper.dispatchEvent(new Event("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(500);
    vi.useRealTimers();
    expect(isOpen(panel)).toBe(false);
  });
});
