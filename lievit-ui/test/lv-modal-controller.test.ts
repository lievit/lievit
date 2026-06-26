/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-modal Stimulus controller -- the conversion proof for the modal-overlay family (the `modal`
 * PARTIAL + the `dialog` WIRE). It collapses the two old focus-mechanics enhancers
 * (focus-trap.enhancer.ts + overlay.enhancer.ts) into ONE controller composing the shared FocusTrap
 * util + the shared DismissableController doctrine. This suite proves the behaviour through the REAL
 * Stimulus Application + the REAL lievit wire morph (no mocked $lievit, no mocked runtime: a fetch
 * stub captures the actual `_calls` the runtime POSTs), per the conversion convention §6.
 *
 * It pins, assertion-for-assertion, what the two enhancers did:
 *   - focus-trap: Tab / Shift+Tab cycle within the panel; initial focus moves in on open;
 *   - return-focus: the trigger that opened the modal regains focus on close;
 *   - scroll-lock: the body is locked while open, restored on close;
 *   - Escape-to-close, CONTROLLED only (data-lv-wire-close present) -> exactly one wire call;
 *     must-act (no data-lv-wire-close) -> Escape inert, ZERO wire calls (the wire-410 doctrine);
 *   - server-owned open: the open<->close transition rides the wire morph rewriting
 *     data-lv-modal-open-value (the element is preserved, so it is a value change, not reconnect);
 *   - morph-safety: a preserved element does not stack listeners; a removed element tears down.
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

function pressEscape(): void {
  // cancelable:true so the trap's preventDefault is observable (a default KeyboardEvent is NOT
  // cancelable, which silently makes preventDefault a no-op).
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
  );
}

function pressTab(shift = false): KeyboardEvent {
  const ev = new KeyboardEvent("keydown", {
    key: "Tab",
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  document.dispatchEvent(ev);
  return ev;
}

/**
 * Build the `dialog` WIRE shape: a component root that IS the lv-modal element (carries
 * data-lievit-component + data-controller + data-lv-modal-open-value [+ data-lv-wire-close]) with
 * a separate role=dialog panel marked data-lv-modal-target="panel" holding two focusables.
 * Mirrors registry/wire/dialog/dialog.jte after the conversion.
 */
function dialogShapeHtml(opts: { open: boolean; wireClose?: string | null }): string {
  const openVal = String(opts.open);
  const hidden = opts.open ? "" : "hidden";
  const wireClose =
    opts.wireClose != null ? ` data-lv-wire-close="${opts.wireClose}"` : "";
  return `
    <div id="modal-root" data-lievit-component="com.example.Dialog" data-lievit-id="cid-dialog"
         data-lievit-snapshot="s1" data-controller="lv-modal"
         data-lv-modal-open-value="${openVal}"${wireClose} ${hidden}>
      <button id="backdrop" type="button" l:click="close">backdrop</button>
      <div id="panel" data-lv-modal-target="panel" role="dialog" aria-modal="true">
        <button id="close-x" type="button">Close</button>
        <button id="footer-close" type="button">Done</button>
      </div>
    </div>`;
}

interface Mounted {
  componentRoot: HTMLElement;
  root: HTMLElement;
  panel: HTMLElement;
  trigger: HTMLButtonElement;
}

/**
 * Build a CLIENT-`[hidden]`-driven overlay shape: the lv-modal element carries `data-controller` and
 * a `data-lv-modal-target="panel"` panel, but NO `data-lv-modal-open-value` (the open state is
 * client-owned, toggled via the `hidden` attribute by a consumer's own dispatcher). Mirrors a
 * consumer mounting the jar controller to drop its hand-rolled `[hidden]`-observer fork.
 */
function hiddenShapeHtml(opts: { open: boolean; dismissible?: boolean }): string {
  const hidden = opts.open ? "" : "hidden";
  const dismissible =
    opts.dismissible === false ? ' data-lv-modal-dismissible="false"' : "";
  return `
    <div id="modal-root" data-controller="lv-modal"${dismissible} ${hidden}>
      <div id="panel" data-lv-modal-target="panel" role="dialog" aria-modal="true">
        <button id="close-x" type="button">Close</button>
        <button id="footer-close" type="button">Done</button>
      </div>
    </div>`;
}

/** Mount a `[hidden]`-driven overlay under a wrapper, plus a trigger outside it that holds focus. */
function mountHidden(opts: { open: boolean; dismissible?: boolean }): Mounted {
  const trigger = document.createElement("button");
  trigger.id = "the-trigger";
  trigger.textContent = "Open";
  document.body.appendChild(trigger);

  const wrapper = document.createElement("div");
  wrapper.id = "wrapper";
  wrapper.innerHTML = hiddenShapeHtml(opts);
  document.body.appendChild(wrapper);

  const root = wrapper.querySelector<HTMLElement>("#modal-root")!;
  const panel = wrapper.querySelector<HTMLElement>("#panel")!;
  return { componentRoot: wrapper, root, panel, trigger };
}

/** Mount a `dialog`-shape modal under a wrapper, plus a trigger outside it that holds focus. */
function mountDialog(opts: { open: boolean; wireClose?: string | null }): Mounted {
  const trigger = document.createElement("button");
  trigger.id = "the-trigger";
  trigger.textContent = "Open";
  document.body.appendChild(trigger);

  const wrapper = document.createElement("div");
  wrapper.id = "wrapper";
  wrapper.innerHTML = dialogShapeHtml(opts);
  document.body.appendChild(wrapper);

  const root = wrapper.querySelector<HTMLElement>("#modal-root")!;
  const panel = wrapper.querySelector<HTMLElement>("#panel")!;
  return { componentRoot: wrapper, root, panel, trigger };
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.style.overflow = "";
  document.body.removeAttribute("data-lievit-trap-scroll-lock");
});

afterEach(async () => {
  // FocusTrap binds its keydown listener on `document`; only the controller's disconnect() removes
  // it, and Stimulus's Application.stop() does NOT disconnect live controllers (Router.stop only
  // stops the scope observer). So remove the elements WHILE the app observer is live -> Stimulus
  // fires disconnect() -> deactivate() -> the document listener is torn down -> THEN stop the app.
  // Without this, a trap left open at test end leaks its document listener into the next test.
  document.body.innerHTML = "";
  await flushStimulus();
  stopStimulus();
  document.body.style.overflow = "";
  document.body.removeAttribute("data-lievit-trap-scroll-lock");
});

describe("lv-modal controller — focus mechanics (real Stimulus + real runtime)", () => {
  it("ssr_open_moves_initial_focus_into_the_panel_and_scroll_locks_the_body", async () => {
    const { runtime } = makeRuntime();
    const { panel, trigger } = mountDialog({ open: true, wireClose: "close" });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();

    // Initial focus moved to the panel's first focusable (the close button).
    expect(document.activeElement).toBe(panel.querySelector("#close-x"));
    // Body scroll-locked while open.
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(true);
  });

  it("open_transition_via_wire_morph_activates_the_trap (server-owned open, element preserved)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, trigger } = mountDialog({ open: false, wireClose: "close" });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();
    // Closed on connect: no trap, no scroll-lock.
    expect(document.body.style.overflow).toBe("");

    // The server re-renders the SAME root with open-value flipped to true (idiomorph preserves the
    // element by id, so Stimulus fires openValueChanged -> activate, NOT a reconnect).
    morph(componentRoot, `<div id="wrapper">${dialogShapeHtml({ open: true, wireClose: "close" })}</div>`);
    await flushStimulus();

    const panel = componentRoot.querySelector<HTMLElement>("#panel")!;
    expect(document.activeElement).toBe(panel.querySelector("#close-x"));
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("close_transition_via_wire_morph_returns_focus_to_the_trigger_and_unlocks_scroll", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, trigger } = mountDialog({ open: true, wireClose: "close" });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // Server flips open -> false: the trap deactivates, restoring scroll + returning focus.
    morph(componentRoot, `<div id="wrapper">${dialogShapeHtml({ open: false, wireClose: "close" })}</div>`);
    await flushStimulus();

    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("tab_cycles_within_the_panel (last -> first); shift+tab wraps first -> last", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountDialog({ open: true, wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    const first = panel.querySelector<HTMLElement>("#close-x")!;
    const last = panel.querySelector<HTMLElement>("#footer-close")!;

    last.focus();
    const tab = pressTab(false);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const shiftTab = pressTab(true);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });
});

describe("lv-modal controller — controlled/uncontrolled doctrine (the wire-410 fix)", () => {
  it("controlled_panel_fires_close_exactly_once_on_escape", async () => {
    const { runtime, calledActions } = makeRuntime();
    mountDialog({ open: true, wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("must_act_dialog_fires_no_wire_call_on_escape (no data-lv-wire-close => Escape inert)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { panel } = mountDialog({ open: true, wireClose: null }); // non-dismissible: no wire-close
    startStimulus({ runtime });
    await flushStimulus();

    // Focus stays inside the panel (the trap still traps), Escape does nothing.
    expect(panel.contains(document.activeElement)).toBe(true);
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("partial_modal_shape_resolves_the_enclosing_component (modal.jte: root has no data-lievit-component)", async () => {
    // modal.jte is a PARTIAL: the <dialog> carries data-controller + data-lv-wire-close but NOT
    // data-lievit-component; the close action must resolve to the ENCLOSING parent component.
    const { runtime, calledActions } = makeRuntime();
    const parent = document.createElement("div");
    parent.setAttribute("data-lievit-component", "com.example.Parent");
    parent.setAttribute("data-lievit-id", "cid-parent");
    parent.setAttribute("data-lievit-snapshot", "s1");
    parent.innerHTML = `
      <dialog id="modal-root" data-controller="lv-modal" data-lv-modal-open-value="true"
              data-lv-wire-close="closeDialog">
        <button id="close-x" type="button" l:click="closeDialog">Close</button>
      </dialog>`;
    document.body.appendChild(parent);

    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "closeDialog")).toHaveLength(1);
  });
});

describe("lv-modal controller — morph-safety (real lievit morph)", () => {
  it("an open->close->open cycle of morphs fires close EXACTLY once per open (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountDialog({ open: true, wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // Close then re-open via morphs (element preserved each time).
    morph(componentRoot, `<div id="wrapper">${dialogShapeHtml({ open: false, wireClose: "close" })}</div>`);
    await flushStimulus();
    morph(componentRoot, `<div id="wrapper">${dialogShapeHtml({ open: true, wireClose: "close" })}</div>`);
    await flushStimulus();

    // One Escape after the cycle must fire close exactly once (no duplicate keydown listeners).
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a modal removed by a morph while open tears the trap down (scroll restored, no leaked Escape)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, trigger } = mountDialog({ open: true, wireClose: "close" });
    trigger.focus();
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // Morph the modal out of the tree entirely.
    morph(componentRoot, `<div id="wrapper"><span>gone</span></div>`);
    await flushStimulus();

    // disconnect() deactivated the trap: scroll restored, focus returned, Escape now a no-op.
    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(false);
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-modal controller — [hidden]-driven mode (client-owned open, no wire value)", () => {
  it("hidden_removed_engages_the_trap_and_scroll_locks_the_body (consumer reveals the overlay)", async () => {
    const { runtime } = makeRuntime();
    const { root, panel, trigger } = mountHidden({ open: false });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();
    // Closed on connect (hidden present): no trap, no scroll-lock.
    expect(root.hasAttribute("hidden")).toBe(true);
    expect(document.body.style.overflow).toBe("");

    // The consumer's dispatcher reveals the fragment by removing the hidden attribute.
    root.removeAttribute("hidden");
    await flushStimulus();

    // The MutationObserver saw it: initial focus moved into the panel, body scroll-locked.
    expect(document.activeElement).toBe(panel.querySelector("#close-x"));
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(true);
  });

  it("hidden_added_disengages_the_trap_restoring_focus_and_scroll (consumer hides the overlay)", async () => {
    const { runtime } = makeRuntime();
    const { root, trigger } = mountHidden({ open: true });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();
    // SSR-revealed (no hidden): the trap engaged on connect.
    expect(document.body.style.overflow).toBe("hidden");

    // The dispatcher hides the fragment by re-adding hidden.
    root.setAttribute("hidden", "");
    await flushStimulus();

    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  it("escape_closes_by_toggling_hidden_back (client-side close, no wire call)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, trigger } = mountHidden({ open: true });
    trigger.focus();

    startStimulus({ runtime });
    await flushStimulus();
    expect(root.hasAttribute("hidden")).toBe(false);

    pressEscape();
    await flushStimulus();

    // Escape re-added hidden (client-side close); the observer then tore the trap down.
    expect(root.hasAttribute("hidden")).toBe(true);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(trigger);
    // No wire round-trip: this is not a wire component.
    expect(calledActions).toHaveLength(0);
  });

  it("escape_dispatches_a_cancelable_dismiss_event_a_consumer_can_preventDefault_to_keep_open", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountHidden({ open: true });

    let dispatched = false;
    root.addEventListener("lievit:modal-dismiss", (e) => {
      dispatched = true;
      e.preventDefault(); // the consumer owns the close: keep the overlay open
    });

    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await flushStimulus();

    expect(dispatched).toBe(true);
    // preventDefault held it open: the controller did NOT re-add hidden, the trap is still active.
    expect(root.hasAttribute("hidden")).toBe(false);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("must_act_overlay_leaves_escape_inert (data-lv-modal-dismissible=false)", async () => {
    const { runtime } = makeRuntime();
    const { root, panel } = mountHidden({ open: true, dismissible: false });

    startStimulus({ runtime });
    await flushStimulus();
    expect(panel.contains(document.activeElement)).toBe(true);

    pressEscape();
    await flushStimulus();

    // Escape inert: still open, focus still trapped inside the panel.
    expect(root.hasAttribute("hidden")).toBe(false);
    expect(panel.contains(document.activeElement)).toBe(true);
  });

  it("tab_cycles_within_the_panel_in_hidden_driven_mode (last -> first, shift+tab first -> last)", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountHidden({ open: true });
    startStimulus({ runtime });
    await flushStimulus();

    const first = panel.querySelector<HTMLElement>("#close-x")!;
    const last = panel.querySelector<HTMLElement>("#footer-close")!;

    last.focus();
    const tab = pressTab(false);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);

    first.focus();
    const shiftTab = pressTab(true);
    expect(shiftTab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
  });

  it("removing a [hidden]-driven overlay from the tree while open tears the trap down", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, trigger } = mountHidden({ open: true });
    trigger.focus();
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // The dispatcher removes the fragment entirely: disconnect() disconnects the observer + the trap.
    morph(componentRoot, `<div id="wrapper"><span>gone</span></div>`);
    await flushStimulus();

    expect(document.body.style.overflow).toBe("");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(false);
  });
});

describe("lv-modal controller — the two modes stay separate (no regression on wire-value path)", () => {
  it("wire_value_open_still_traps (the value path is unchanged by the hidden-driven mode)", async () => {
    const { runtime } = makeRuntime();
    const { panel } = mountDialog({ open: true, wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // Wire-value mode still engages on the SSR-open value, exactly as before.
    expect(document.activeElement).toBe(panel.querySelector("#close-x"));
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("wire_value_mode_ignores_a_manual_hidden_toggle (no MutationObserver in the value path)", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountDialog({ open: true, wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // In wire-value mode the open state is the value, NOT the attribute: toggling hidden by hand
    // must not drive the trap (only data-lv-modal-open-value does). The trap stays engaged.
    root.setAttribute("hidden", "");
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.hasAttribute("data-lievit-trap-scroll-lock")).toBe(true);
  });
});
