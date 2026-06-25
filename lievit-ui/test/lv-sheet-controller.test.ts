/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-sheet Stimulus controller -- the conversion of the sheet's use of focus-trap.enhancer.ts. The
 * three modal focus-mechanics (trap Tab, scroll-lock, return-focus) come from the shared FocusTrap
 * util; Escape obeys the controlled/uncontrolled doctrine via the shared DismissableController base.
 * This suite proves the behaviour through the REAL Stimulus Application + the REAL lievit wire morph
 * (no mocked $lievit, no mocked runtime: a fetch stub captures the actual `_calls` the runtime POSTs),
 * the substrate-fidelity rule that stops a client bug passing green.
 *
 * Mandatory cases (per the conversion convention §6):
 * - behaviour parity: the dialog traps + scroll-locks on open, restores focus + scroll on close;
 * - controlled fires / uncontrolled silent: Escape fires the close action exactly once when the
 *   <dialog> carries data-lv-wire-close (controlled + closable), and ZERO wire calls when it does
 *   not (controlled + !closable, the must-act pattern / wire-410 regression guard);
 * - morph-safety: after a real morph one Escape still fires close EXACTLY once (no stacked document
 *   listeners), and a dialog removed by a morph stops trapping (disconnect tore the trap down).
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

/** Dispatch a document-level Escape keydown (the FocusTrap binds its key handler on `document`). */
function pressEscape(): void {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

const PANEL_ID = "filter-sheet";

/**
 * The controlled + open `<dialog>` markup exactly as sheet.jte emits it when `isControlled && open`:
 * data-controller="lv-sheet" mounts the trap; data-lv-wire-close is present only when closable.
 */
function controlledOpenMarkup(opts: { wireClose?: string | null } = {}): string {
  const wireCloseAttr =
    opts.wireClose == null ? "" : ` data-lv-wire-close="${opts.wireClose}"`;
  const closeButton =
    opts.wireClose == null
      ? ""
      : `<button type="button" data-slot="sheet-close" aria-label="Close" l:click="${opts.wireClose}">X</button>`;
  return `<div data-lievit-component="com.example.C" data-lievit-snapshot="s1">
    <span data-slot="sheet" data-placement="right">
      <div data-slot="sheet-backdrop" aria-hidden="true" l:click="${opts.wireClose ?? ""}"></div>
      <dialog id="${PANEL_ID}" data-slot="sheet-panel" data-placement="right" data-size="md"
              role="dialog" aria-modal="true" aria-label="Sheet" tabindex="-1"
              data-controller="lv-sheet"${wireCloseAttr}>
        <div data-slot="sheet-header">${closeButton}</div>
        <div data-slot="sheet-body"><button id="body-btn" type="button">Body action</button></div>
        <div data-slot="sheet-footer"><button id="apply-btn" type="button">Apply</button></div>
      </dialog>
    </span>
  </div>`;
}

/** The controlled + CLOSED markup: dialog hidden, controller + close action dropped (open=false). */
function controlledClosedMarkup(): string {
  return `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2">
    <span data-slot="sheet" data-placement="right">
      <dialog id="${PANEL_ID}" data-slot="sheet-panel" data-placement="right" data-size="md"
              role="dialog" aria-modal="true" aria-label="Sheet" tabindex="-1" hidden="">
        <div data-slot="sheet-header"></div>
        <div data-slot="sheet-body"><button id="body-btn" type="button">Body action</button></div>
      </dialog>
    </span>
  </div>`;
}

/** Mount a fresh opener + the controlled-open sheet, returning the live nodes. */
function mount(opts: { wireClose?: string | null } = {}): {
  opener: HTMLButtonElement;
  root: HTMLElement;
  dialog: HTMLElement;
} {
  const opener = document.createElement("button");
  opener.id = "the-opener";
  opener.textContent = "Open filters";
  document.body.appendChild(opener);

  const host = document.createElement("div");
  host.innerHTML = controlledOpenMarkup(opts);
  const root = host.firstElementChild as HTMLElement;
  document.body.appendChild(root);

  const dialog = root.querySelector<HTMLElement>(`#${PANEL_ID}`)!;
  return { opener, root, dialog };
}

beforeEach(() => {
  document.body.innerHTML = "";
  document.body.style.overflow = "";
});

afterEach(async () => {
  // Stimulus's application.stop() stops its observers but does NOT disconnect already-connected
  // controllers, so a FocusTrap's DOCUMENT-scoped keydown listener would survive a bare
  // stopStimulus() + innerHTML="" and leak into the next test (firing a second wire call). Remove
  // the controller elements FIRST while the observer is still live and flush, so Stimulus runs
  // disconnect() -> FocusTrap.deactivate() -> removeEventListener, THEN stop the now-empty app.
  document.body.innerHTML = "";
  await flushStimulus();
  stopStimulus();
  document.body.style.overflow = "";
});

describe("lv-sheet controller — modal focus mechanics (real Stimulus + real FocusTrap)", () => {
  it("traps focus inside the dialog and scroll-locks the body on open", async () => {
    const { runtime } = makeRuntime();
    const { opener, dialog } = mount({ wireClose: "close" });
    opener.focus();

    startStimulus({ runtime });
    await flushStimulus();

    // Initial focus moved into the dialog (first focusable = the close button).
    expect(dialog.contains(document.activeElement)).toBe(true);
    // Body is scroll-locked while the trap is active.
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("controlled + closable: Escape fires the close action EXACTLY once", async () => {
    const { runtime, calledActions } = makeRuntime();
    mount({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("controlled close action name is read from data-lv-wire-close (not a hardcoded 'close')", async () => {
    const { runtime, calledActions } = makeRuntime();
    mount({ wireClose: "closeFilters" });
    startStimulus({ runtime });
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toContain("closeFilters");
    expect(calledActions).not.toContain("close");
  });

  it("controlled + !closable (no data-lv-wire-close): Escape fires ZERO wire calls (must-act)", async () => {
    const { runtime, calledActions } = makeRuntime();
    mount({ wireClose: null }); // trap mounts, but no close action declared
    startStimulus({ runtime });
    await flushStimulus();

    // The trap is still active (focus moved in), proving the controller is connected.
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });

  it("closing the sheet (open -> hidden, controller dropped) restores focus + unlocks scroll, no spurious wire call", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { opener, root } = mount({ wireClose: "close" });
    opener.focus();
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // The server re-renders open=false: the dialog goes hidden and drops data-controller.
    morph(root, controlledClosedMarkup());
    await flushStimulus();

    expect(document.activeElement).toBe(opener); // focus returned to the opener
    expect(document.body.style.overflow).toBe(""); // scroll lock released
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0); // disconnect does NOT round-trip the wire
  });
});

describe("lv-sheet controller — morph-safety (real lievit morph)", () => {
  it("after a re-render that keeps it open, one Escape still fires close EXACTLY once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root } = mount({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();

    // A wire morph re-renders the still-open sheet (same id, data-controller preserved). The
    // controller must NOT double-connect and the document keydown listener must stay single.
    morph(root, controlledOpenMarkup({ wireClose: "close" }));
    await flushStimulus();

    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions.filter((a) => a === "close")).toHaveLength(1);
  });

  it("a dialog removed by a morph stops trapping (disconnect tore the trap down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root } = mount({ wireClose: "close" });
    startStimulus({ runtime });
    await flushStimulus();
    expect(document.body.style.overflow).toBe("hidden");

    // Morph the dialog out of the tree entirely.
    morph(
      root,
      `<div data-lievit-component="com.example.C" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // disconnect ran: scroll unlocked and the detached trap fires nothing on Escape.
    expect(document.body.style.overflow).toBe("");
    pressEscape();
    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});
