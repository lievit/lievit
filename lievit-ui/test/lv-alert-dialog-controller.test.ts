/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-alert-dialog Stimulus controller -- the conversion of the shared focus-trap enhancer for the
 * alert-dialog instance. Proves the three modal focus mechanics (focus-trap, initial-focus-on-
 * cancel, return-focus) + the Escape==cancel wire routing through the REAL Stimulus Application +
 * the REAL lievit wire morph (no mocked $lievit, no mocked runtime: a fetch stub captures the
 * actual `_calls` the runtime POSTs). Mirrors lv-popover-controller.test.ts.
 *
 * It asserts the controlled/uncontrolled doctrine on BOTH branches (the whole-contract rule):
 * controlled (`data-lv-wire-close` present) fires `cancel` once on Escape; uncontrolled (absent)
 * fires ZERO round-trips. And the morph-safety the enhancer test could not state: after a real
 * morph the Escape still fires EXACTLY once (no stacked document listeners), and a panel removed by
 * a morph fires nothing (disconnect tore the trap's keydown listener down + restored scroll/focus).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application started by startStimulus(), which
 * auto-loads controllers by filename. flushStimulus() awaits the MutationObserver.
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

/** The panel HTML the partial emits (cancel FIRST in DOM with data-initial-focus, confirm SECOND). */
function panelHtml(opts: { wireClose?: string } = {}): string {
  const wireClose =
    opts.wireClose != null ? ` data-lv-wire-close="${opts.wireClose}"` : "";
  return `
    <div role="alertdialog" aria-modal="true" data-slot="alert-dialog"
         data-controller="lv-alert-dialog"${wireClose}
         aria-labelledby="lv-alert-dialog-title" aria-describedby="lv-alert-dialog-desc">
      <h2 id="lv-alert-dialog-title" data-slot="alert-dialog-title">Delete?</h2>
      <p id="lv-alert-dialog-desc" data-slot="alert-dialog-description">This cannot be undone.</p>
      <div data-slot="alert-dialog-actions">
        <button type="button" data-slot="alert-dialog-cancel" data-initial-focus>Cancel</button>
        <button type="button" data-slot="alert-dialog-confirm">Delete</button>
      </div>
    </div>`;
}

interface Mounted {
  componentRoot: HTMLElement;
  panel: HTMLElement;
  cancel: HTMLButtonElement;
  confirm: HTMLButtonElement;
}

/** Build a component host wrapping the alert-dialog panel exactly as the partial renders inside a wire component. */
function mountDialog(opts: { wireClose?: string } = {}): Mounted {
  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.D");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");
  componentRoot.innerHTML = panelHtml(opts);
  document.body.appendChild(componentRoot);
  const panel = componentRoot.querySelector<HTMLElement>('[data-slot="alert-dialog"]')!;
  return {
    componentRoot,
    panel,
    cancel: panel.querySelector<HTMLButtonElement>('[data-slot="alert-dialog-cancel"]')!,
    confirm: panel.querySelector<HTMLButtonElement>('[data-slot="alert-dialog-confirm"]')!,
  };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(async () => {
  // Remove the controller elements while the Stimulus observer is still LIVE so the real
  // disconnect() runs (FocusTrap.deactivate -> removes its document keydown listener + releases
  // the body scroll-lock). Application.stop() only stops observers; it does NOT disconnect
  // controllers, so stopping first would leak the document listener + overflow:hidden into the
  // next test. Clear -> flush (let the MutationObserver disconnect) -> stop.
  document.body.innerHTML = "";
  await flushStimulus();
  stopStimulus();
});

describe("lv-alert-dialog controller — modal focus mechanics (real Stimulus + real runtime)", () => {
  it("moves_initial_focus_to_the_cancel_button_on_open (APG least-destructive default)", async () => {
    const { runtime } = makeRuntime();
    const { cancel } = mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    expect(document.activeElement).toBe(cancel);
  });

  it("scroll_locks_the_body_while_open", async () => {
    const { runtime } = makeRuntime();
    mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(true);
  });

  it("traps_Tab_within_the_panel_wrapping_last_to_first", async () => {
    const { runtime } = makeRuntime();
    const { cancel, confirm } = mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    confirm.focus(); // the last focusable
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    expect(document.activeElement).toBe(cancel);
  });

  it("traps_Shift_Tab_within_the_panel_wrapping_first_to_last", async () => {
    const { runtime } = makeRuntime();
    const { cancel, confirm } = mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    cancel.focus(); // the first focusable
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(confirm);
  });

  it("controlled_panel_fires_the_cancel_action_once_on_Escape", async () => {
    const { runtime, calledActions } = makeRuntime();
    mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "cancel")).toHaveLength(1);
  });

  it("custom_escape_action_via_data_lv_wire_close (no hardcoded cancel fallback)", async () => {
    const { runtime, calledActions } = makeRuntime();
    mountDialog({ wireClose: "dismissPrompt" });
    startStimulus({ runtime });
    await flushStimulus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("dismissPrompt");
    expect(calledActions).not.toContain("cancel");
  });

  it("uncontrolled_panel_fires_no_wire_call_on_Escape (the 410 page-expired regression)", async () => {
    const { runtime, calledActions } = makeRuntime();
    mountDialog({}); // no data-lv-wire-close => uncontrolled
    startStimulus({ runtime });
    await flushStimulus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("returns_focus_to_the_opener_when_the_morph_closes_the_panel", async () => {
    const { runtime } = makeRuntime();
    // The opener (trigger) holds focus when the wire round-trip opens the dialog.
    const opener = document.createElement("button");
    opener.textContent = "Open";
    document.body.appendChild(opener);

    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.D");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
    document.body.appendChild(componentRoot);

    startStimulus({ runtime });
    await flushStimulus();

    opener.focus();
    expect(document.activeElement).toBe(opener);

    // Server re-render opens the dialog: morph IN the panel -> connect -> trap captures the opener.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.D" data-lievit-snapshot="s2">${panelHtml({ wireClose: "cancel" })}</div>`,
    );
    await flushStimulus();
    expect(document.activeElement).not.toBe(opener); // focus moved into the panel (cancel)

    // Server re-render closes it: morph OUT the panel -> disconnect -> trap returns focus + unlocks.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.D" data-lievit-snapshot="s3"></div>`,
    );
    await flushStimulus();

    expect(document.activeElement).toBe(opener);
    expect(document.body.style.overflow).not.toBe("hidden"); // scroll lock released
  });
});

describe("lv-alert-dialog controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_Escape_still_fires_cancel_exactly_once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    // A real lievit wire morph re-renders the component subtree (idiomorph). The panel markup is
    // identical, so the controller must NOT be double-connected and the trap's keydown stays single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.D" data-lievit-snapshot="s2">${panelHtml({ wireClose: "cancel" })}</div>`,
    );
    await flushStimulus();

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "cancel")).toHaveLength(1);
  });

  it("a_panel_removed_by_a_morph_stops_firing (disconnect tore the listener down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountDialog({ wireClose: "cancel" });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the panel out of the tree (the dialog closed server-side).
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.D" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The trap's document keydown listener was removed on disconnect -> Escape reaches no controller.
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
