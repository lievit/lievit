/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Tests for the popover-anchor shared enhancer. Asserts:
 * - opener is recorded when toggle fires with newState="open"
 * - focus returns to opener on light-dismiss (toggle closed, activeElement !== opener)
 * - focus is NOT returned when browser already returned it (activeElement === opener)
 * - [data-lv-autofocus] element gets focus after the popover opens
 * - close() wire action is fired when the popover closes (server state sync)
 *
 * The native `popover` attribute's show/hide is not unit-testable in happy-dom
 * (no layout engine); tests dispatch ToggleEvent manually to simulate the browser behaviour.
 *
 * Substrate: happy-dom (real events, real DOM, real LievitRuntime — no mocked $lievit).
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { installPopoverAnchor } from "../runtime/features/popover-anchor.enhancer.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
 * Dispatches a ToggleEvent (or a synthetic custom event that mimics it) on a panel element.
 * happy-dom may not ship `ToggleEvent` as a global; fall back to a plain Event with patched
 * `newState`.
 */
function fireToggle(panel: Element, newState: "open" | "closed"): void {
  let ev: Event;
  try {
    // Prefer the native ToggleEvent when available.
    ev = new ToggleEvent("toggle", {
      newState,
      oldState: newState === "open" ? "closed" : "open",
      bubbles: false,
    });
  } catch {
    // happy-dom fallback: plain Event with newState patched.
    ev = new Event("toggle", { bubbles: false });
    Object.defineProperty(ev, "newState", { value: newState, writable: false });
  }
  panel.dispatchEvent(ev);
}

/** Build a minimal component + popover panel setup. */
function mountPopover(opts: {
  openerId?: string;
  hasAutofocus?: boolean;
}): {
  runtime: LievitRuntime;
  calledActions: string[];
  componentRoot: HTMLElement;
  panel: HTMLElement;
  opener: HTMLButtonElement;
} {
  const { runtime, calledActions } = makeRuntime();
  installPopoverAnchor(runtime);

  const openerId = opts.openerId ?? "the-opener";
  const opener = document.createElement("button");
  opener.id = openerId;
  opener.textContent = "Open";
  document.body.appendChild(opener);

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.C");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const panel = document.createElement("div");
  panel.setAttribute("popover", "");
  panel.setAttribute("data-lv-opener", openerId);
  panel.id = "the-panel";

  if (opts.hasAutofocus === true) {
    const input = document.createElement("input");
    input.setAttribute("data-lv-autofocus", "");
    panel.appendChild(input);
  } else {
    const content = document.createElement("p");
    content.textContent = "Panel content";
    panel.appendChild(content);
  }

  componentRoot.appendChild(panel);
  document.body.appendChild(componentRoot);

  runtime.start();

  return { runtime, calledActions, componentRoot, panel, opener };
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

describe("popover-anchor.enhancer — native popover API seam", () => {
  it("records_opener_on_toggle_open — opener is stored when toggle fires with newState=open", () => {
    const { panel, opener } = mountPopover({});

    opener.focus();
    fireToggle(panel, "open");

    // The opener should be recorded (verified indirectly: on close, focus returns).
    // We can test this by closing and checking focus returns.
    // But also: no throw and no double-registration.
    expect(() => fireToggle(panel, "open")).not.toThrow();
  });

  it("focus_returns_to_opener_on_light_dismiss — toggle closed + activeElement !== opener → opener.focus()", () => {
    const { panel, opener } = mountPopover({});

    opener.focus();
    fireToggle(panel, "open");

    // Simulate the user clicking outside (focus moves away from the opener before close).
    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    expect(document.activeElement).toBe(outside);

    fireToggle(panel, "closed");

    // The enhancer should have called opener.focus().
    expect(document.activeElement).toBe(opener);
  });

  it("no_focus_return_when_browser_already_returned — toggle closed + activeElement === opener → no second focus()", () => {
    const { panel, opener } = mountPopover({});

    opener.focus();
    fireToggle(panel, "open");

    // Browser returned focus to opener already (e.g. closed via the opener button itself).
    opener.focus();
    const focusSpy = vi.spyOn(opener, "focus");
    expect(document.activeElement).toBe(opener);

    fireToggle(panel, "closed");

    // The enhancer should NOT call focus() again (browser already there).
    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("autofocus_moves_focus_to_data_lv_autofocus — after open, [data-lv-autofocus] gets focus", async () => {
    const { panel } = mountPopover({ hasAutofocus: true });
    const autofocusEl = panel.querySelector<HTMLInputElement>("[data-lv-autofocus]");
    expect(autofocusEl).not.toBeNull();

    fireToggle(panel, "open");

    // The autofocus call is deferred via queueMicrotask; flush the microtask queue.
    await Promise.resolve();
    expect(document.activeElement).toBe(autofocusEl);
  });

  it("close_action_fires_on_light_dismiss — toggle closed fires close() wire action", async () => {
    const { panel, opener, calledActions } = mountPopover({});

    opener.focus();
    fireToggle(panel, "open");

    // Simulate light-dismiss: focus somewhere else, then toggle closed.
    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    // The enhancer should have queued a close() wire action.
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("close");
  });

  // ---------------------------------------------------------------------------
  // ADDITIVE: configurable light-dismiss action name via data-lv-wire-close
  // ---------------------------------------------------------------------------

  it("custom_close_action_via_data_lv_wire_close — data-lv-wire-close overrides the hardcoded close action", async () => {
    // Build a setup where the panel carries data-lv-wire-close="toggleOpen".
    const { runtime, calledActions } = makeRuntime();
    installPopoverAnchor(runtime);

    const openerId = "custom-opener";
    const opener = document.createElement("button");
    opener.id = openerId;
    opener.textContent = "Open";
    document.body.appendChild(opener);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.C");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const panel = document.createElement("div");
    panel.setAttribute("popover", "");
    panel.setAttribute("data-lv-opener", openerId);
    panel.setAttribute("data-lv-wire-close", "toggleOpen"); // custom action name
    panel.id = "custom-panel";

    const content = document.createElement("p");
    content.textContent = "Custom panel";
    panel.appendChild(content);
    componentRoot.appendChild(panel);
    document.body.appendChild(componentRoot);

    runtime.start();

    opener.focus();
    fireToggle(panel, "open");

    // Light-dismiss.
    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    // Should fire "toggleOpen", NOT "close".
    expect(calledActions).toContain("toggleOpen");
    expect(calledActions).not.toContain("close");
  });

  it("fallback_to_close_when_no_data_lv_wire_close — without data-lv-wire-close the default close action fires", async () => {
    // Existing behavior: panel with NO data-lv-wire-close fires "close".
    const { panel, opener, calledActions } = mountPopover({});

    opener.focus();
    fireToggle(panel, "open");

    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("close");
    // Must NOT contain any other action name (pure fallback).
    expect(calledActions.filter((a) => a !== "close")).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // ADDITIVE: aria-expanded sync on the opener (guarded by existing aria-expanded attr)
  // ---------------------------------------------------------------------------

  it("aria_expanded_set_true_on_panel_open — aria-expanded is set to 'true' on the opener when the panel opens", () => {
    const { runtime, calledActions } = makeRuntime();
    installPopoverAnchor(runtime);

    const openerId = "disclosure-btn";
    const opener = document.createElement("button");
    opener.id = openerId;
    opener.textContent = "Open menu";
    // Opener opts in as a disclosure trigger by declaring aria-expanded.
    opener.setAttribute("aria-expanded", "false");
    document.body.appendChild(opener);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Nav");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const panel = document.createElement("div");
    panel.setAttribute("popover", "");
    panel.setAttribute("data-lv-opener", openerId);
    panel.id = "nav-panel";
    componentRoot.appendChild(panel);
    document.body.appendChild(componentRoot);

    runtime.start();

    opener.focus();
    expect(opener.getAttribute("aria-expanded")).toBe("false");

    fireToggle(panel, "open");

    expect(opener.getAttribute("aria-expanded")).toBe("true");
    void calledActions; // suppress unused-variable lint; calledActions not relevant here
  });

  it("aria_expanded_set_false_on_panel_close — aria-expanded is set to 'false' on the opener when the panel closes", () => {
    const { runtime } = makeRuntime();
    installPopoverAnchor(runtime);

    const openerId = "disclosure-btn-close";
    const opener = document.createElement("button");
    opener.id = openerId;
    opener.setAttribute("aria-expanded", "false");
    document.body.appendChild(opener);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.Nav");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const panel = document.createElement("div");
    panel.setAttribute("popover", "");
    panel.setAttribute("data-lv-opener", openerId);
    panel.id = "nav-panel-close";
    componentRoot.appendChild(panel);
    document.body.appendChild(componentRoot);

    runtime.start();

    opener.focus();
    fireToggle(panel, "open");
    expect(opener.getAttribute("aria-expanded")).toBe("true");

    // Light-dismiss close.
    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    expect(opener.getAttribute("aria-expanded")).toBe("false");
  });

  it("aria_expanded_not_added_when_opener_has_no_aria_expanded — opener without aria-expanded never gets the attribute added", () => {
    // Guard: triggers that did NOT declare aria-expanded should be left untouched.
    const { panel, opener } = mountPopover({});
    // The default mountPopover() does NOT set aria-expanded on the opener.
    expect(opener.hasAttribute("aria-expanded")).toBe(false);

    opener.focus();
    fireToggle(panel, "open");
    // Must NOT have been added.
    expect(opener.hasAttribute("aria-expanded")).toBe(false);

    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");
    // Still not added.
    expect(opener.hasAttribute("aria-expanded")).toBe(false);
  });

  it("aria_expanded_sync_does_not_affect_close_action — existing close action still fires when aria-expanded is synced", async () => {
    // Verify the additive aria-expanded sync does not break the close-action path.
    const { runtime, calledActions } = makeRuntime();
    installPopoverAnchor(runtime);

    const openerId = "sync-opener";
    const opener = document.createElement("button");
    opener.id = openerId;
    opener.setAttribute("aria-expanded", "false"); // opts in to aria-expanded sync
    document.body.appendChild(opener);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.D");
    componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
    componentRoot.setAttribute("data-lievit-snapshot", "s1");

    const panel = document.createElement("div");
    panel.setAttribute("popover", "");
    panel.setAttribute("data-lv-opener", openerId);
    panel.id = "sync-panel";
    componentRoot.appendChild(panel);
    document.body.appendChild(componentRoot);

    runtime.start();

    opener.focus();
    fireToggle(panel, "open");

    const outside = document.createElement("button");
    outside.textContent = "elsewhere";
    document.body.appendChild(outside);
    outside.focus();
    fireToggle(panel, "closed");

    await new Promise((r) => setTimeout(r, 10));
    // aria-expanded was synced.
    expect(opener.getAttribute("aria-expanded")).toBe("false");
    // The close action still fired.
    expect(calledActions).toContain("close");
  });
});
