/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Tests for the focus-trap shared enhancer. Asserts WAI-ARIA APG Dialog Modal keyboard contract:
 * Tab/Shift+Tab cycle within the container, initial focus placement, Escape fires the wire action,
 * focus returns to the opener on deactivation, and idempotency under re-bind.
 *
 * Substrate: happy-dom (real KeyboardEvents, real DOM, real LievitRuntime — no mocked $lievit).
 * Pattern: build DOM BEFORE runtime.start() so the directive scan fires on start().
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installFocusTrap } from "../runtime/features/focus-trap.enhancer.js";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function makeFetchImpl(actions: string[]): typeof fetch {
  return vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      actions.push(...calls);
    }
    return new Response("<div></div>", {
      status: 200,
      headers: { "Lievit-Snapshot": "s2" },
    });
  }) as unknown as typeof fetch;
}

/**
 * Build a lievit component root with a focus-trap container inside it, mount it in the DOM,
 * then create and start the runtime so the directive scan fires on the already-present DOM.
 */
function buildTrap(opts: {
  buttonCount?: number;
  escapeAction?: string;
  autofocusFirst?: boolean;
  /** Index of the button that should carry data-initial-focus (highest priority). */
  initialFocusIdx?: number;
} = {}): {
  runtime: LievitRuntime;
  actions: string[];
  componentRoot: HTMLElement;
  container: HTMLElement;
  buttons: HTMLButtonElement[];
} {
  document.body.innerHTML = "";
  const actions: string[] = [];

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const container = document.createElement("div");
  container.setAttribute("data-lievit-focus-trap", "");
  if (opts.escapeAction != null) {
    container.setAttribute("data-lievit-escape-action", opts.escapeAction);
  }

  const buttons: HTMLButtonElement[] = [];
  const count = opts.buttonCount ?? 3;
  for (let i = 0; i < count; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Btn${i}`;
    if (i === 0 && opts.autofocusFirst === true) {
      btn.setAttribute("autofocus", "");
    }
    if (opts.initialFocusIdx === i) {
      btn.setAttribute("data-initial-focus", "");
    }
    container.appendChild(btn);
    buttons.push(btn);
  }

  componentRoot.appendChild(container);
  document.body.appendChild(componentRoot);

  const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
  installFocusTrap(runtime);
  runtime.start(); // scans DOM, fires directive bind on the container

  return { runtime, actions, componentRoot, container, buttons };
}

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("focus-trap.enhancer — WAI-ARIA APG Dialog Modal", () => {
  it("focus_moves_into_container_on_bind — initial focus enters the trap container on activation", () => {
    const { buttons } = buildTrap();
    // After directive bind (on runtime.start()), focus should move to the first focusable.
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("tab_wraps_at_last_focusable — Tab at the last focusable wraps to the first", () => {
    const { buttons } = buildTrap();
    const last = buttons[buttons.length - 1];
    const first = buttons[0];

    last.focus();
    expect(document.activeElement).toBe(last);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(first);
  });

  it("shift_tab_wraps_at_first_focusable — Shift+Tab at the first focusable wraps to the last", () => {
    const { buttons } = buildTrap();
    const first = buttons[0];
    const last = buttons[buttons.length - 1];

    first.focus();
    expect(document.activeElement).toBe(first);

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true, cancelable: true }),
    );
    expect(document.activeElement).toBe(last);
  });

  it("escape_fires_wire_action — Escape fires the named wire action via callAction", async () => {
    const { buttons, actions } = buildTrap({ escapeAction: "close" });
    buttons[0].focus();

    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );

    await new Promise<void>((r) => setTimeout(r, 20));
    expect(actions).toContain("close");
  });

  it("no_double_registration — trap is idempotent (ACTIVE_ATTR set exactly once)", () => {
    const { container } = buildTrap();
    expect(container.getAttribute("data-lievit-rt-focus-trap-active")).toBe("");
    // Count how many times the attribute appears — must be exactly 1.
    expect(
      Array.from(container.attributes).filter(
        (a) => a.name === "data-lievit-rt-focus-trap-active",
      ).length,
    ).toBe(1);
  });

  it("data_initial_focus_wins_over_autofocus — [data-initial-focus] gets focus before [autofocus] and first-focusable", () => {
    // Build a trap where btn0 has [autofocus], btn2 has [data-initial-focus].
    // Expected: btn2 receives focus (highest priority), not btn0.
    document.body.innerHTML = "";
    const actions: string[] = [];

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.C");
    componentRoot.setAttribute("data-lievit-id", `cid-initial-focus`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const container = document.createElement("div");
    container.setAttribute("data-lievit-focus-trap", "");

    const btn0 = document.createElement("button");
    btn0.textContent = "Btn0";
    btn0.setAttribute("autofocus", ""); // autofocus — lower priority than data-initial-focus
    container.appendChild(btn0);

    const btn1 = document.createElement("button");
    btn1.textContent = "Btn1";
    container.appendChild(btn1);

    const btn2 = document.createElement("button");
    btn2.textContent = "Btn2";
    btn2.setAttribute("data-initial-focus", ""); // highest priority
    container.appendChild(btn2);

    componentRoot.appendChild(container);
    document.body.appendChild(componentRoot);

    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    installFocusTrap(runtime);
    runtime.start();

    // btn2 (data-initial-focus) must win over btn0 (autofocus).
    expect(document.activeElement).toBe(btn2);
  });

  it("data_initial_focus_wins_over_first_focusable — [data-initial-focus] on a non-first item beats first-focusable fallback", () => {
    // No [autofocus], btn1 carries [data-initial-focus]. Expect btn1, not btn0 (first focusable).
    const { buttons } = buildTrap({ buttonCount: 3, initialFocusIdx: 1 });
    expect(document.activeElement).toBe(buttons[1]);
  });

  it("no_initial_focus_attr_falls_back_to_autofocus — without [data-initial-focus], [autofocus] still works", () => {
    const { buttons } = buildTrap({ autofocusFirst: true });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("no_initial_focus_attr_falls_back_to_first_focusable — without [data-initial-focus] or [autofocus], first focusable gets focus", () => {
    const { buttons } = buildTrap({ buttonCount: 3 });
    expect(document.activeElement).toBe(buttons[0]);
  });

  it("focus_returns_to_trigger_on_cleanup — focus is restored to the pre-trap element after removal", async () => {
    document.body.innerHTML = "";
    const actions: string[] = [];

    // Build a trigger button that holds focus before the trap activates.
    const trigger = document.createElement("button");
    trigger.textContent = "Open dialog";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.C");
    componentRoot.setAttribute("data-lievit-id", "cid-return");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const container = document.createElement("div");
    container.setAttribute("data-lievit-focus-trap", "");
    const btn = document.createElement("button");
    btn.textContent = "inside";
    container.appendChild(btn);
    componentRoot.appendChild(container);
    document.body.appendChild(componentRoot);

    // Start the runtime AFTER placing the DOM: focus will be captured at runtime.start() moment.
    // But trigger.focus() was called before, so activeElement is trigger when bind fires.
    const runtime = new LievitRuntime({ fetchImpl: makeFetchImpl(actions) });
    installFocusTrap(runtime);

    // Set trigger as focused JUST before start so it is captured as the return target.
    trigger.focus();
    runtime.start();

    // Trap is now active; focus should be inside the container.
    expect(container.contains(document.activeElement)).toBe(true);

    // Remove the trap container from the DOM (simulates a wire response that closes the dialog).
    container.remove();

    // Trigger the afterCall lifecycle hook by issuing a wire call.
    await runtime.callAction(componentRoot, "act");
    await new Promise<void>((r) => setTimeout(r, 20));

    expect(document.activeElement).toBe(trigger);
  });
});
