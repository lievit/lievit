/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-tooltip Stimulus controller -- the conversion of `tooltip.enhancer.ts`. This suite proves the
 * WAI-ARIA APG Tooltip contract through the REAL Stimulus Application (started by startStimulus(),
 * which auto-loads controllers by filename) + the REAL lievit wire morph -- never a mocked $lievit.
 * It ports tooltip.enhancer.test.ts assertion-for-assertion (focus shows immediately, blur hides
 * immediately, Escape dismisses + handler-removed-after-hide, hover show/hide delay timing, hover
 * persistence, disabled suppression, aria-describedby on first-focusable / wrapper / removed-on-
 * destroy) and adds the two proofs the enhancer test could not state on the real lifecycle:
 *   - the controlled/uncontrolled DOCTRINE for the tooltip: a full show -> Escape -> hide cycle
 *     fires ZERO wire calls (the tooltip is always uncontrolled by construction);
 *   - morph-safety: after a real morph one gesture = one effect (no stacked listeners), and a
 *     morph that REMOVES the wrapper tears the aria + listeners down (disconnect).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application; flushStimulus() awaits the
 * MutationObserver. happy-dom v20 lacks showPopover()/hidePopover(), so the bubble is polyfilled
 * with a `data-popover-open` sentinel the assertions read as the open-state proxy.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

// ---------------------------------------------------------------------------
// Popover polyfill (happy-dom) + open-state probe
// ---------------------------------------------------------------------------

function polyfillPopover(el: HTMLElement): void {
  if (typeof el.showPopover === "function") return;
  (el as unknown as { showPopover: () => void }).showPopover = (): void => {
    el.setAttribute("data-popover-open", "");
  };
  (el as unknown as { hidePopover: () => void }).hidePopover = (): void => {
    el.removeAttribute("data-popover-open");
  };
}

/** True if the bubble is in the "open" state (polyfill sentinel). */
function isOpen(bubble: HTMLElement): boolean {
  return bubble.hasAttribute("data-popover-open");
}

// ---------------------------------------------------------------------------
// Runtime with a fetch stub that records the wire actions POSTed
// ---------------------------------------------------------------------------

function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

// ---------------------------------------------------------------------------
// DOM builder: the wrapper + bubble exactly as tooltip.jte emits them
// ---------------------------------------------------------------------------

interface Mounted {
  componentRoot: HTMLElement;
  wrapper: HTMLElement;
  bubble: HTMLElement;
  /** The focusable trigger inside the wrapper (null when nonFocusableTrigger). */
  trigger: HTMLButtonElement | null;
}

function mountTooltip(
  opts: {
    delay?: number;
    hideDelay?: number;
    disabled?: boolean;
    nonFocusableTrigger?: boolean;
  } = {},
): Mounted {
  const id = "tip-test";
  const delay = opts.delay ?? 600;
  const hideDelay = opts.hideDelay ?? 0;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-controller", "lv-tooltip");
  wrapper.setAttribute("data-lievit-tooltip-wrapper", "");
  wrapper.setAttribute("data-lievit-tooltip-id", id);
  wrapper.setAttribute("data-lievit-tooltip-delay", String(delay));
  wrapper.setAttribute("data-lievit-tooltip-hide-delay", String(hideDelay));
  wrapper.setAttribute("data-lievit-tooltip-placement", "top");
  if (opts.disabled === true) {
    wrapper.setAttribute("data-lievit-tooltip-disabled", "true");
  }

  let trigger: HTMLButtonElement | null = null;
  if (opts.nonFocusableTrigger !== true) {
    trigger = document.createElement("button");
    trigger.type = "button";
    trigger.textContent = "Hover me";
    wrapper.appendChild(trigger);
  } else {
    const span = document.createElement("span");
    span.textContent = "Non-focusable label";
    wrapper.appendChild(span);
  }

  const bubble = document.createElement("div");
  bubble.id = id;
  bubble.setAttribute("role", "tooltip");
  bubble.setAttribute("popover", "manual");
  bubble.setAttribute("data-slot", "tooltip");
  bubble.textContent = "Save document";
  polyfillPopover(bubble);
  wrapper.appendChild(bubble);

  componentRoot.appendChild(wrapper);
  document.body.appendChild(componentRoot);

  return { componentRoot, wrapper, bubble, trigger };
}

/** Boot the real Stimulus app on the mounted DOM and await the connect scan. */
async function start(runtime: LievitRuntime): Promise<void> {
  startStimulus({ runtime });
  await flushStimulus();
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

// ---------------------------------------------------------------------------
// Focus: immediate show / immediate hide
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — focus (immediate, no delay)", () => {
  it("shows_immediately_on_focusin", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 600 });
    await start(runtime);

    expect(isOpen(bubble)).toBe(false);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);
  });

  it("hides_immediately_on_focusout", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 0 });
    await start(runtime);

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Escape
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — Escape", () => {
  it("esc_dismisses_while_visible", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip();
    await start(runtime);

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    expect(isOpen(bubble)).toBe(false);
  });

  it("esc_is_noop_while_hidden", async () => {
    const { runtime } = makeRuntime();
    const { bubble } = mountTooltip();
    await start(runtime);

    expect(isOpen(bubble)).toBe(false);
    expect(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    ).not.toThrow();
    expect(isOpen(bubble)).toBe(false);
  });

  it("esc_after_hide_is_noop", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip();
    await start(runtime);

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);

    expect(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    ).not.toThrow();
    expect(isOpen(bubble)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hover delay timing
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — hover delay", () => {
  it("shows_after_delay_on_pointerenter", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 400 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);

    vi.advanceTimersByTime(400);
    expect(isOpen(bubble)).toBe(true);
  });

  it("show_cancelled_when_pointerleave_before_delay", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 400 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(399);
    expect(isOpen(bubble)).toBe(false);

    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(isOpen(bubble)).toBe(false);
  });

  it("hides_after_hide_delay_on_pointerleave", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 0, hideDelay: 200 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(199);
    expect(isOpen(bubble)).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isOpen(bubble)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Hover persistence (APG): trigger -> bubble keeps it open
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — hover persistence", () => {
  it("crossing_into_bubble_cancels_hide_timer", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 0, hideDelay: 200 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    bubble.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(isOpen(bubble)).toBe(true);
  });

  it("leaving_the_bubble_starts_the_hide_timer", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ delay: 0, hideDelay: 150 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    bubble.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    bubble.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(151);
    expect(isOpen(bubble)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Disabled
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — disabled", () => {
  it("never_shows_on_pointerenter_when_disabled", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ disabled: true, delay: 0 });
    await start(runtime);

    vi.useFakeTimers();
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(1000);
    expect(isOpen(bubble)).toBe(false);
  });

  it("never_shows_on_focusin_when_disabled", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ disabled: true });
    await start(runtime);

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });

  it("does_not_set_aria_describedby_when_disabled", async () => {
    const { runtime } = makeRuntime();
    const { trigger } = mountTooltip({ disabled: true });
    await start(runtime);

    expect(trigger!.hasAttribute("aria-describedby")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// aria-describedby wiring
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — aria-describedby", () => {
  it("sets_aria_describedby_on_first_focusable", async () => {
    const { runtime } = makeRuntime();
    const { trigger, bubble } = mountTooltip();
    await start(runtime);

    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-describedby")).toBe(bubble.id);
  });

  it("sets_aria_describedby_on_wrapper_when_no_focusable", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, bubble } = mountTooltip({ nonFocusableTrigger: true });
    await start(runtime);

    expect(wrapper.getAttribute("aria-describedby")).toBe(bubble.id);
  });

  it("removes_aria_describedby_on_disconnect", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, trigger, bubble } = mountTooltip();
    await start(runtime);
    expect(trigger!.getAttribute("aria-describedby")).toBe(bubble.id);

    // A real wire morph that drops the tooltip subtree -> Stimulus disconnect -> aria removed.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    expect(trigger!.getAttribute("aria-describedby")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Controlled/uncontrolled doctrine: the tooltip is ALWAYS uncontrolled (zero wire calls)
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — doctrine (always uncontrolled, zero round-trips)", () => {
  it("a_full_show_escape_hide_cycle_fires_no_wire_call", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { wrapper, bubble } = mountTooltip();
    await start(runtime);

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    expect(isOpen(bubble)).toBe(false);

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Morph-safety (real lievit morph)
// ---------------------------------------------------------------------------

describe("lv-tooltip controller — morph-safety", () => {
  it("after_a_real_morph_one_gesture_is_one_effect_and_aria_is_not_doubled", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountTooltip({ delay: 0 });
    await start(runtime);

    // Re-render the same subtree (idiomorph preserves the wrapper) -> the controller stays single,
    // no re-connect, so aria-describedby is NOT doubled and the behaviour still fires exactly once.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const wrapper = componentRoot.querySelector<HTMLElement>("[data-controller~='lv-tooltip']")!;
    const bubble = componentRoot.querySelector<HTMLElement>("#tip-test")!;
    polyfillPopover(bubble);
    const trigger = wrapper.querySelector("button")!;
    expect(trigger.getAttribute("aria-describedby")).toBe("tip-test");

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);
    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });

  it("a_wrapper_removed_by_a_morph_fires_nothing", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, wrapper, bubble } = mountTooltip({ delay: 0 });
    await start(runtime);

    morph(
      componentRoot,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached wrapper has no live controller -> a focusin opens nothing.
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });
});
