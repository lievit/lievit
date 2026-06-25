/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * lv-toast-region Stimulus controller -- the conversion of toast.enhancer.ts's RegionEnhancer.
 * This suite proves the toast region behaviour through the REAL @hotwired/stimulus Application
 * started by startStimulus() (which auto-loads controllers by filename) and the REAL lievit wire
 * morph -- never a mocked enhancer. It mirrors the region-behaviour assertions of toast.test.ts
 * (queue cap, auto-dismiss, variant -> live-region routing, click/Esc dismiss, pause-on-focus, no
 * focus-steal, SSE path) and adds the morph-safety proof the enhancer could not state: after a real
 * morph one dispatched toast inserts EXACTLY one item (no stacked document listener), and a region
 * removed by a morph inserts nothing (disconnect tore the listener down + cancelled timers).
 *
 * A toast NEVER round-trips the wire on close, so there is no controlled/uncontrolled branch to
 * assert here (that doctrine lives in DismissableController and applies only to overlays); the
 * controller extends the plain Controller. Substrate: happy-dom + real Stimulus. Connect happens
 * with real timers (flushStimulus awaits the MutationObserver); duration-sensitive cases switch to
 * fake timers AFTER the controller has connected.
 */
import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";

import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

/** Build a toast-region DOM mirroring toast/region.jte output, carrying the controller attribute. */
function renderRegion(
  opts: {
    placement?: string;
    maxVisible?: number;
    sseUrl?: string;
    bellId?: string;
    parent?: HTMLElement;
  } = {},
): HTMLElement {
  const root = document.createElement("div");
  root.setAttribute("data-controller", "lv-toast-region");
  root.setAttribute("data-slot", "toast-region");
  root.setAttribute("data-toast-placement", opts.placement ?? "bottom-end");
  root.setAttribute("data-toast-max-visible", String(opts.maxVisible ?? 5));
  if (opts.sseUrl) root.setAttribute("data-toast-sse-url", opts.sseUrl);
  if (opts.bellId) root.setAttribute("data-toast-bell-id", opts.bellId);

  const polite = document.createElement("div");
  polite.setAttribute("role", "status");
  polite.setAttribute("aria-live", "polite");
  polite.setAttribute("aria-atomic", "false");
  polite.setAttribute("data-slot", "toast-live-polite");

  const assertive = document.createElement("div");
  assertive.setAttribute("role", "alert");
  assertive.setAttribute("aria-live", "assertive");
  assertive.setAttribute("aria-atomic", "false");
  assertive.setAttribute("data-slot", "toast-live-assertive");

  root.appendChild(polite);
  root.appendChild(assertive);
  (opts.parent ?? document.body).appendChild(root);
  return root;
}

/** Fire a toast on the global insertion path (the wire-morph hook / window.lievit.toast()). */
function fireToast(detail: Record<string, unknown>): void {
  document.dispatchEvent(new CustomEvent("lievit:toast", { detail }));
}

const items = (root: ParentNode): NodeListOf<HTMLElement> =>
  root.querySelectorAll<HTMLElement>('[data-slot="toast-item"]');

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  vi.useRealTimers();
  document.body.innerHTML = "";
});

describe("lv-toast-region controller — insertion + live-region routing (real Stimulus)", () => {
  it("info/success items land in the polite sub-container", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();

    for (const variant of ["info", "success"] as const) {
      const id = `polite-${variant}`;
      fireToast({ variant, message: variant, duration: 0, id });
      const polite = root.querySelector('[data-slot="toast-live-polite"]');
      expect(polite?.querySelector(`[data-toast-id="${id}"]`)).not.toBeNull();
    }
  });

  it("warning/destructive items land in the assertive sub-container", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();

    for (const variant of ["warning", "destructive"] as const) {
      const id = `assertive-${variant}`;
      fireToast({ variant, message: variant, duration: 0, id });
      const assertive = root.querySelector('[data-slot="toast-live-assertive"]');
      expect(assertive?.querySelector(`[data-toast-id="${id}"]`)).not.toBeNull();
    }
  });

  it("renders the message text into the item card", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();

    fireToast({ variant: "info", message: "File saved.", duration: 0, id: "msg-1" });
    const item = root.querySelector('[data-toast-id="msg-1"]');
    expect(item?.querySelector('[data-slot="toast-message"]')?.textContent).toBe("File saved.");
    expect(item?.getAttribute("role")).toBe("none");
  });

  it("does NOT move focus when a toast appears (APG Alert: no focus-steal)", async () => {
    renderRegion();
    startStimulus();
    await flushStimulus();

    const external = document.createElement("button");
    document.body.appendChild(external);
    external.focus();
    const before = document.activeElement;

    fireToast({ variant: "info", message: "No focus steal", duration: 0, id: "nf-1" });
    expect(document.activeElement).toBe(before);
  });
});

describe("lv-toast-region controller — queue + timers", () => {
  it("caps visible items at maxVisible and dequeues on dismiss", async () => {
    const root = renderRegion({ maxVisible: 2 });
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const id = `q-${i}`;
      ids.push(id);
      fireToast({ variant: "info", message: `Toast ${i}`, duration: 0, id, dismissible: true });
    }
    expect(items(root)).toHaveLength(2);

    const firstDismiss = root.querySelector<HTMLButtonElement>(
      `[data-toast-id="${ids[0]}"] [data-slot="toast-dismiss"]`,
    );
    firstDismiss?.click();
    vi.advanceTimersByTime(500);

    expect(items(root)).toHaveLength(2); // a queued item dequeued into the freed slot
  });

  it("auto-dismisses an item after its duration", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({ variant: "info", message: "Auto gone", duration: 200, id: "ad-1" });
    expect(root.querySelector('[data-toast-id="ad-1"]')).not.toBeNull();

    vi.advanceTimersByTime(700); // 200ms timer + 200ms exit transition + buffer
    expect(root.querySelector('[data-toast-id="ad-1"]')).toBeNull();
  });

  it("a persistent toast (duration=0) never auto-dismisses", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({ variant: "info", message: "Persistent", duration: 0, id: "persist-1" });
    vi.advanceTimersByTime(30_000);
    expect(root.querySelector('[data-toast-id="persist-1"]')).not.toBeNull();
  });
});

describe("lv-toast-region controller — dismiss + keyboard", () => {
  it("clicking the dismiss button removes the item", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({
      variant: "info",
      message: "Click dismiss",
      duration: 0,
      id: "dismiss-1",
      dismissible: true,
    });
    root
      .querySelector<HTMLButtonElement>('[data-toast-id="dismiss-1"] [data-slot="toast-dismiss"]')
      ?.click();
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="dismiss-1"]')).toBeNull();
  });

  it("Esc while focused inside a dismissible item removes it", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({
      variant: "info",
      message: "Esc dismiss",
      duration: 0,
      id: "esc-1",
      dismissible: true,
    });
    const item = root.querySelector<HTMLElement>('[data-toast-id="esc-1"]')!;
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="esc-1"]')).toBeNull();
  });

  it("Esc does NOT dismiss a non-dismissible item", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({
      variant: "info",
      message: "Non-dismissible",
      duration: 0,
      id: "no-esc",
      dismissible: false,
    });
    const item = root.querySelector<HTMLElement>('[data-toast-id="no-esc"]')!;
    item.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    vi.advanceTimersByTime(500);

    expect(root.querySelector('[data-toast-id="no-esc"]')).not.toBeNull();
  });
});

describe("lv-toast-region controller — auto-dismiss pauses while focused (react-aria useToast)", () => {
  it("fires after duration when the item is never focused", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({ variant: "info", message: "Quick gone", duration: 200, id: "no-focus" });
    vi.advanceTimersByTime(600);
    expect(root.querySelector('[data-toast-id="no-focus"]')).toBeNull();
  });

  it("defers the auto-dismiss while the item holds focus", async () => {
    const root = renderRegion();
    startStimulus();
    await flushStimulus();
    vi.useFakeTimers();

    fireToast({
      variant: "info",
      message: "Focused item",
      duration: 200,
      id: "focus-pause",
      dismissible: true,
    });
    const item = root.querySelector<HTMLElement>('[data-toast-id="focus-pause"]')!;

    // focusin clears the pending timer -> it never fires while focused.
    item.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    vi.advanceTimersByTime(500);
    expect(root.querySelector('[data-toast-id="focus-pause"]')).not.toBeNull();

    // focusout with no expired-while-focused timer keeps the item until manual dismiss.
    item.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    vi.advanceTimersByTime(300);
    expect(root.querySelector('[data-toast-id="focus-pause"]')).not.toBeNull();
  });
});

describe("lv-toast-region controller — SSE insertion path", () => {
  it("an EventSource 'toast' frame inserts an item through the controller", async () => {
    // Capture the controller's 'toast' listener so the test can emit a real SSE frame.
    let toastHandler: ((e: { data: string }) => void) | null = null;
    function MockEventSource(this: Record<string, unknown>, _url: string) {
      this["close"] = vi.fn();
      this["addEventListener"] = (type: string, handler: (e: { data: string }) => void) => {
        if (type === "toast") toastHandler = handler;
      };
    }
    const OrigES = globalThis.EventSource;
    // @ts-expect-error -- happy-dom mock
    globalThis.EventSource = MockEventSource;

    try {
      const root = renderRegion({ sseUrl: "/api/notifications/stream" });
      startStimulus();
      await flushStimulus();

      expect(toastHandler).not.toBeNull();
      toastHandler!({
        data: JSON.stringify({ variant: "success", message: "Server push", duration: 0, id: "sse-1" }),
      });

      expect(
        root.querySelector('[data-slot="toast-live-polite"] [data-toast-id="sse-1"]'),
      ).not.toBeNull();
    } finally {
      globalThis.EventSource = OrigES;
    }
  });
});

describe("lv-toast-region controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one dispatched toast inserts EXACTLY one item (no stacked listener)", async () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    renderRegion({ parent });
    startStimulus();
    await flushStimulus();

    // A wire morph re-renders the region subtree (idiomorph). The markup is identical, so the
    // controller must NOT double-connect and the global lievit:toast listener must stay single.
    morph(
      parent,
      `<div data-controller="lv-toast-region" data-slot="toast-region" data-toast-max-visible="5">
         <div role="status" aria-live="polite" aria-atomic="false" data-slot="toast-live-polite"></div>
         <div role="alert" aria-live="assertive" aria-atomic="false" data-slot="toast-live-assertive"></div>
       </div>`,
    );
    await flushStimulus();

    fireToast({ variant: "info", message: "once", duration: 0, id: "morph-1" });
    expect(parent.querySelectorAll('[data-toast-id="morph-1"]')).toHaveLength(1);
    expect(items(parent)).toHaveLength(1);
  });

  it("a region removed by a morph inserts nothing (disconnect tore the listener down)", async () => {
    const parent = document.createElement("div");
    document.body.appendChild(parent);
    renderRegion({ parent });
    startStimulus();
    await flushStimulus();

    morph(parent, `<div><span>gone</span></div>`);
    await flushStimulus();

    fireToast({ variant: "info", message: "into the void", duration: 0, id: "gone-1" });
    expect(document.querySelectorAll('[data-toast-id="gone-1"]')).toHaveLength(0);
  });
});
