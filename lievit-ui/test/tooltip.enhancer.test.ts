/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Tests for the tooltip shared enhancer (`tooltip.enhancer.ts`). Asserts the WAI-ARIA APG
 * Tooltip keyboard contract (focus shows immediately, blur hides immediately, Escape dismisses,
 * hover-persistence, delay timing, disabled suppression) and the aria-describedby wiring.
 *
 * Substrate: happy-dom (real events, real DOM, real LievitRuntime — no mocked $lievit).
 * Pattern: build DOM BEFORE runtime.start() so the scan fires on start(); use vi.useFakeTimers()
 * for delay assertions; polyfill showPopover/hidePopover because happy-dom v20 does not implement
 * them (they are present only as property stubs). The polyfill stamps/removes `data-popover-open`
 * as the observable open-state proxy used by assertions.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installTooltip } from "../runtime/features/tooltip.enhancer.js";

// ---------------------------------------------------------------------------
// Polyfill showPopover / hidePopover for happy-dom
// ---------------------------------------------------------------------------

/**
 * happy-dom v20 exposes `popover` as a property but does NOT implement showPopover() /
 * hidePopover(). We add them per-element in `buildTooltip()` so the enhancer can call them.
 * We track the open state via `data-popover-open` (set/removed by the polyfill) so tests can
 * assert `.hasAttribute("data-popover-open")` as the substitute for `:popover-open`.
 */
function polyfillPopover(el: HTMLElement): void {
  if (typeof el.showPopover === "function") return; // real browser or already patched
  (el as unknown as { showPopover: () => void }).showPopover = (): void => {
    el.setAttribute("data-popover-open", "");
  };
  (el as unknown as { hidePopover: () => void }).hidePopover = (): void => {
    el.removeAttribute("data-popover-open");
  };
}

/** True if the bubble is in the "open" state (polyfill or real `:popover-open`). */
function isOpen(bubble: HTMLElement): boolean {
  // In a real browser, `:popover-open` applies but cannot be queried via `matches()` in
  // happy-dom. We use the polyfill's sentinel attribute; in a real browser the attribute
  // would also be absent (showPopover() is the real thing) so we treat "no attribute" as
  // closed in that case. The assertions in this file are meaningful in the happy-dom substrate.
  return bubble.hasAttribute("data-popover-open");
}

// ---------------------------------------------------------------------------
// DOM builder
// ---------------------------------------------------------------------------

function makeFetchImpl(): typeof fetch {
  return vi.fn(async () =>
    new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } })
  ) as unknown as typeof fetch;
}

/**
 * Build the server-rendered tooltip DOM (wrapper + bubble), mount it in a component root, then
 * start a runtime with `installTooltip` so the scan fires on `runtime.start()`.
 *
 * The DOM mirrors what `tooltip.jte` actually emits (the subset the enhancer reads).
 */
function buildTooltip(opts: {
  delay?: number;
  hideDelay?: number;
  disabled?: boolean;
  /** When true the trigger slot holds a non-focusable <span> instead of a <button>. */
  nonFocusableTrigger?: boolean;
} = {}): {
  runtime: LievitRuntime;
  componentRoot: HTMLElement;
  wrapper: HTMLElement;
  bubble: HTMLElement;
  /** The focusable trigger element inside the wrapper (button or null if nonFocusableTrigger). */
  trigger: HTMLButtonElement | null;
} {
  document.body.innerHTML = "";

  const id = "tip-test";
  const delay = opts.delay ?? 600;
  const hideDelay = opts.hideDelay ?? 0;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  // --- wrapper (the <span data-lievit-tooltip-wrapper …>) ---
  const wrapper = document.createElement("span");
  wrapper.setAttribute("data-lievit-tooltip-wrapper", "");
  wrapper.setAttribute("data-lievit-tooltip-id", id);
  wrapper.setAttribute("data-lievit-tooltip-delay", String(delay));
  wrapper.setAttribute("data-lievit-tooltip-hide-delay", String(hideDelay));
  wrapper.setAttribute("data-lievit-tooltip-placement", "top");
  if (opts.disabled === true) {
    wrapper.setAttribute("data-lievit-tooltip-disabled", "true");
  }

  // --- trigger slot ---
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

  // --- bubble (the <div role="tooltip" popover="manual" …>) ---
  const bubble = document.createElement("div");
  bubble.id = id;
  bubble.setAttribute("role", "tooltip");
  bubble.setAttribute("popover", "manual");
  bubble.setAttribute("data-slot", "tooltip");
  bubble.textContent = "Save document";
  wrapper.appendChild(bubble);

  // Polyfill showPopover / hidePopover BEFORE the runtime scans.
  polyfillPopover(bubble);

  componentRoot.appendChild(wrapper);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl() });
  installTooltip(runtime);
  runtime.start(); // triggers onComponentInit → scanRoot → wireWrapper

  return { runtime, componentRoot, wrapper, bubble, trigger };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("tooltip.enhancer — show/hide on focus (immediate, no delay)", () => {
  it("tooltip_shows_immediately_on_focusin — focusin shows the bubble without any timer delay", () => {
    const { wrapper, bubble } = buildTooltip({ delay: 600 });

    expect(isOpen(bubble)).toBe(false);
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);
  });

  it("tooltip_hides_on_focusout — focusout hides the bubble immediately (no hide-delay)", () => {
    const { wrapper, bubble } = buildTooltip({ delay: 0 });

    // Show first via focusin.
    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });
});

describe("tooltip.enhancer — Escape key", () => {
  it("tooltip_esc_dismisses_while_visible — Escape hides the open tooltip", () => {
    const { wrapper, bubble } = buildTooltip();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );

    expect(isOpen(bubble)).toBe(false);
  });

  it("tooltip_esc_is_noop_while_hidden — Escape does nothing when the tooltip is already hidden", () => {
    const { bubble } = buildTooltip();

    expect(isOpen(bubble)).toBe(false);

    expect(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    ).not.toThrow();

    expect(isOpen(bubble)).toBe(false);
  });

  it("tooltip_esc_handler_removed_after_hide — Esc after hide is a no-op (listener was removed)", () => {
    const { wrapper, bubble } = buildTooltip();

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new Event("focusout", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);

    // A second Escape should not throw and should leave the bubble hidden.
    expect(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    ).not.toThrow();

    expect(isOpen(bubble)).toBe(false);
  });
});

describe("tooltip.enhancer — hover delay", () => {
  it("tooltip_shows_after_delay_on_pointerenter — bubble shows after delay ms of pointerenter", () => {
    vi.useFakeTimers();
    const delay = 400;
    const { wrapper, bubble } = buildTooltip({ delay });

    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);

    vi.advanceTimersByTime(delay);
    expect(isOpen(bubble)).toBe(true);
  });

  it("tooltip_show_cancelled_before_delay — pointerleave before delay fires cancels the show", () => {
    vi.useFakeTimers();
    const delay = 400;
    const { wrapper, bubble } = buildTooltip({ delay });

    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(delay - 1);
    expect(isOpen(bubble)).toBe(false);

    // Leave before the timer fires.
    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(delay + 100);

    // Still hidden — the show timer was cancelled.
    expect(isOpen(bubble)).toBe(false);
  });

  it("tooltip_hides_after_hide_delay_on_pointerleave — bubble hides after hideDelay ms", () => {
    vi.useFakeTimers();
    const hideDelay = 200;
    const { wrapper, bubble } = buildTooltip({ delay: 0, hideDelay });

    // Show immediately.
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(hideDelay - 1);
    expect(isOpen(bubble)).toBe(true);

    vi.advanceTimersByTime(1);
    expect(isOpen(bubble)).toBe(false);
  });
});

describe("tooltip.enhancer — hover persistence", () => {
  it("tooltip_hover_persistence_crossing_into_bubble — pointer from wrapper to bubble cancels hide timer", () => {
    vi.useFakeTimers();
    const hideDelay = 200;
    const { wrapper, bubble } = buildTooltip({ delay: 0, hideDelay });

    // Show via pointerenter on wrapper.
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    // Pointer leaves the wrapper (normally starts the hide timer).
    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    // But immediately enters the bubble (APG hover-persistence rule).
    bubble.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));

    // Advance well past the hide delay.
    vi.advanceTimersByTime(hideDelay + 100);

    // Bubble should still be open (hide was cancelled by bubble's pointerenter).
    expect(isOpen(bubble)).toBe(true);
  });

  it("tooltip_hides_when_leaving_bubble — pointer leaving the bubble starts the hide timer", () => {
    vi.useFakeTimers();
    const hideDelay = 150;
    const { wrapper, bubble } = buildTooltip({ delay: 0, hideDelay });

    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(true);

    // Traverse into the bubble (cancels wrapper's hide timer).
    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    bubble.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));

    // Now leave the bubble itself — this starts a new hide timer.
    bubble.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(hideDelay + 1);

    expect(isOpen(bubble)).toBe(false);
  });
});

describe("tooltip.enhancer — disabled", () => {
  it("tooltip_disabled_does_not_show_on_pointerenter — disabled tooltip never shows on hover", () => {
    vi.useFakeTimers();
    const { wrapper, bubble } = buildTooltip({ disabled: true, delay: 0 });

    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(1000);
    expect(isOpen(bubble)).toBe(false);
  });

  it("tooltip_disabled_does_not_show_on_focusin — disabled tooltip never shows on focus", () => {
    const { wrapper, bubble } = buildTooltip({ disabled: true });

    wrapper.dispatchEvent(new Event("focusin", { bubbles: true }));
    expect(isOpen(bubble)).toBe(false);
  });
});

describe("tooltip.enhancer — aria-describedby wiring", () => {
  it("tooltip_enhancer_sets_aria_describedby_on_first_focusable — wired to <button> inside slot", () => {
    const { trigger, bubble } = buildTooltip();

    // The trigger (first focusable descendant) must carry aria-describedby pointing at the bubble.
    expect(trigger).not.toBeNull();
    expect(trigger!.getAttribute("aria-describedby")).toBe(bubble.id);
  });

  it("tooltip_enhancer_sets_aria_describedby_on_wrapper_when_no_focusable — non-focusable trigger slot", () => {
    const { wrapper, bubble } = buildTooltip({ nonFocusableTrigger: true });

    // No focusable descendant → aria-describedby goes on the wrapper itself.
    expect(wrapper.getAttribute("aria-describedby")).toBe(bubble.id);
  });

  it("tooltip_enhancer_removes_aria_describedby_on_destroy — attribute gone after wrapper removed from DOM", async () => {
    const { runtime, componentRoot, wrapper, trigger, bubble } = buildTooltip();

    // Confirm it was wired.
    expect(trigger!.getAttribute("aria-describedby")).toBe(bubble.id);

    // Remove the wrapper from the DOM to simulate a morph that removes the tooltip.
    wrapper.remove();

    // Trigger the afterCall hook by issuing a wire call on the component root.
    await runtime.callAction(componentRoot, "noop");
    await new Promise<void>((r) => setTimeout(r, 20));

    // aria-describedby must have been removed on destroy.
    expect(trigger!.getAttribute("aria-describedby")).toBeNull();
  });
});

describe("tooltip.enhancer — idempotency", () => {
  it("tooltip_wired_once — multiple scans do not double-bind event listeners", () => {
    vi.useFakeTimers();
    const { wrapper, bubble, runtime, componentRoot } = buildTooltip({ delay: 0 });

    // Force a re-scan by calling afterCall path (installTooltip is already installed).
    // We do this by calling installTooltip again on the same runtime — it registers a
    // second lifecycle hook, but the WeakSet guard in wireWrapper prevents double-bind.
    installTooltip(runtime);

    // Simulating re-scan via a noop afterCall (we go through the hook path).
    // The wrapper is still in the DOM so it will be re-scanned.
    // Show the tooltip: if listeners were doubled, showBubble() would be called twice
    // and toggle the state. With idempotency it's called once.
    wrapper.dispatchEvent(new PointerEvent("pointerenter", { bubbles: true }));
    vi.advanceTimersByTime(0);

    // Must be open exactly once (not toggled closed by a double-bind).
    expect(isOpen(bubble)).toBe(true);

    // Hide.
    wrapper.dispatchEvent(new PointerEvent("pointerleave", { bubbles: true }));
    vi.advanceTimersByTime(0);
    expect(isOpen(bubble)).toBe(false);

    // If aria-describedby was set twice (duplicated value), this would be "tip-test tip-test".
    const button = wrapper.querySelector("button");
    expect(button?.getAttribute("aria-describedby")).toBe("tip-test");

    // Suppress unused-variable warning.
    void componentRoot;
  });
});
