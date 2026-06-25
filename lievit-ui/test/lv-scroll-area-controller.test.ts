/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-scroll-area Stimulus controller -- the conversion of scroll-area.enhancer.ts. This suite proves
 * the overlay-scrollbar behaviour through the REAL Stimulus Application started by startStimulus()
 * (auto-loads controllers by filename) + the REAL lievit wire morph -- never a mocked $lievit, never
 * a stub runtime.
 *
 * It mirrors the old scroll-area.enhancer §5 assertion-for-assertion (thumb sizing + min floor,
 * scroll -> aria-valuenow + translateY, data-scrolling, data-no-overflow both branches, pointer-over
 * enter/leave) and adds what the enhancer test could not state:
 *   - the controlled/uncontrolled doctrine: a scroll area is UNCONTROLLED by construction, so a real
 *     runtime (fetch stub) records ZERO `/lievit/<id>/call` across scroll + pointer + drag;
 *   - thumb-drag parity (the enhancer had drag code but no drag test);
 *   - morph-safety: after a real morph one scroll == one `scrolled()` (no stacked listeners), and a
 *     morph that REMOVES the root tears the controller down (the detached viewport fires nothing).
 *
 * Substrate: happy-dom + the real @hotwired/stimulus Application; flushStimulus() awaits the
 * MutationObserver. Geometry (clientHeight / scrollHeight / offsetHeight) is stubbed via
 * defineProperty because happy-dom has no layout engine.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";
import LvScrollAreaController from "../runtime/stimulus/controllers/lv-scroll-area-controller.js";

/** A real runtime whose fetch is stubbed; `calledActions` captures every wire action POSTed. */
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

function stubProp(el: HTMLElement, name: string, value: number): void {
  Object.defineProperty(el, name, { get: () => value, configurable: true });
}

interface Mounted {
  componentRoot: HTMLElement;
  root: HTMLElement;
  viewport: HTMLElement;
  rail: HTMLElement;
  thumb: HTMLElement;
}

/**
 * Build a component root wrapping a `data-controller="lv-scroll-area"` overlay scroll-area shaped
 * exactly as scroll-area.jte emits it for overlay=true, orientation="vertical" (the data-controller,
 * the targets, the scroll + thumb data-action descriptors). Geometry is stubbed for happy-dom.
 */
function mountVertical(opts: {
  hideDelay?: number;
  viewportHeight?: number;
  contentHeight?: number;
  scrollTop?: number;
  railHeight?: number;
  thumbHeight?: number;
} = {}): Mounted {
  const {
    hideDelay = 1000,
    viewportHeight = 200,
    contentHeight = 400,
    scrollTop = 0,
    railHeight = viewportHeight,
    thumbHeight,
  } = opts;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.ScrollArea");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");

  const root = document.createElement("div");
  root.setAttribute("data-slot", "scroll-area");
  root.setAttribute("data-orientation", "vertical");
  root.setAttribute("data-type", "hover");
  root.setAttribute("data-hide-delay", String(hideDelay));
  root.setAttribute("data-controller", "lv-scroll-area");

  const viewport = document.createElement("div");
  viewport.setAttribute("data-slot", "scroll-area-viewport");
  viewport.setAttribute("id", "lv-sa-test");
  viewport.setAttribute("tabindex", "0");
  viewport.setAttribute("data-lv-scroll-area-target", "viewport");
  viewport.setAttribute("data-action", "scroll->lv-scroll-area#scrolled");
  stubProp(viewport, "clientHeight", viewportHeight);
  stubProp(viewport, "scrollHeight", contentHeight);
  Object.defineProperty(viewport, "scrollTop", { value: scrollTop, writable: true, configurable: true });
  root.appendChild(viewport);

  const rail = document.createElement("div");
  rail.setAttribute("data-slot", "scroll-area-bar");
  rail.setAttribute("data-orientation", "vertical");
  rail.setAttribute("role", "scrollbar");
  rail.setAttribute("aria-controls", "lv-sa-test");
  rail.setAttribute("aria-orientation", "vertical");
  rail.setAttribute("aria-valuenow", "0");
  rail.setAttribute("aria-valuemin", "0");
  rail.setAttribute("aria-valuemax", "100");
  rail.setAttribute("aria-label", "Vertical scrollbar");
  rail.setAttribute("tabindex", "-1");
  rail.setAttribute("data-lv-scroll-area-target", "verticalRail");
  stubProp(rail, "clientHeight", railHeight);

  const thumb = document.createElement("div");
  thumb.setAttribute("data-slot", "scroll-area-thumb");
  thumb.setAttribute("data-lv-scroll-area-target", "verticalThumb");
  thumb.setAttribute(
    "data-action",
    "pointerdown->lv-scroll-area#dragStartVertical pointermove->lv-scroll-area#dragMoveVertical " +
      "pointerup->lv-scroll-area#dragEndVertical pointercancel->lv-scroll-area#dragEndVertical",
  );
  if (thumbHeight != null) stubProp(thumb, "offsetHeight", thumbHeight);
  rail.appendChild(thumb);
  root.appendChild(rail);

  componentRoot.appendChild(root);
  document.body.appendChild(componentRoot);
  return { componentRoot, root, viewport, rail, thumb };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("lv-scroll-area controller — thumb sizing (real Stimulus)", () => {
  it("sizes the thumb to viewport/content * railHeight on connect", async () => {
    const { runtime } = makeRuntime();
    const { thumb } = mountVertical({ viewportHeight: 200, contentHeight: 400 });
    startStimulus({ runtime });
    await flushStimulus();

    // thumbRatio = 200/400 = 0.5; thumbH = max(20, 200 * 0.5) = 100px
    expect(thumb.style.height).toBe("100px");
  });

  it("floors the thumb height at 20px (usability minimum)", async () => {
    const { runtime } = makeRuntime();
    const { thumb } = mountVertical({ viewportHeight: 50, contentHeight: 10000 });
    startStimulus({ runtime });
    await flushStimulus();

    expect(parseInt(thumb.style.height, 10)).toBeGreaterThanOrEqual(20);
  });
});

describe("lv-scroll-area controller — scroll sync", () => {
  it("updates aria-valuenow and translateY on the viewport scroll event", async () => {
    const { runtime } = makeRuntime();
    const { viewport, rail, thumb } = mountVertical({
      viewportHeight: 200,
      contentHeight: 400,
      scrollTop: 100,
    });
    startStimulus({ runtime });
    await flushStimulus();

    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));

    // scrollRatio = 100 / (400 - 200) = 0.5 -> aria-valuenow = 50
    expect(rail.getAttribute("aria-valuenow")).toBe("50");
    expect(thumb.style.transform).toContain("translateY(");
  });

  it("sets data-scrolling on the root while scrolling", async () => {
    const { runtime } = makeRuntime();
    const { root, viewport } = mountVertical();
    startStimulus({ runtime });
    await flushStimulus();

    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(root.hasAttribute("data-scrolling")).toBe(true);
  });

  it("clears data-scrolling after the hide delay of idle", async () => {
    vi.useFakeTimers();
    try {
      const { runtime } = makeRuntime();
      const { root, viewport } = mountVertical({ hideDelay: 300 });
      startStimulus({ runtime });
      // flushStimulus uses setTimeout; advance the fake clock so the MutationObserver settles.
      await vi.advanceTimersByTimeAsync(0);

      viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
      expect(root.hasAttribute("data-scrolling")).toBe(true);

      await vi.advanceTimersByTimeAsync(300);
      expect(root.hasAttribute("data-scrolling")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("lv-scroll-area controller — data-no-overflow", () => {
  it("is ABSENT when the content overflows the viewport", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountVertical({ viewportHeight: 200, contentHeight: 400 });
    startStimulus({ runtime });
    await flushStimulus();

    expect(root.hasAttribute("data-no-overflow")).toBe(false);
  });

  it("is PRESENT when the content does not overflow the viewport", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountVertical({ viewportHeight: 400, contentHeight: 200 });
    startStimulus({ runtime });
    await flushStimulus();

    expect(root.hasAttribute("data-no-overflow")).toBe(true);
  });
});

describe("lv-scroll-area controller — pointer-over (root's own event)", () => {
  it("sets data-pointer-over on pointerenter and removes it on pointerleave", async () => {
    const { runtime } = makeRuntime();
    const { root } = mountVertical();
    startStimulus({ runtime });
    await flushStimulus();

    root.dispatchEvent(new PointerEvent("pointerenter"));
    expect(root.hasAttribute("data-pointer-over")).toBe(true);

    root.dispatchEvent(new PointerEvent("pointerleave"));
    expect(root.hasAttribute("data-pointer-over")).toBe(false);
  });
});

describe("lv-scroll-area controller — thumb drag", () => {
  it("drags the viewport scrollTop proportionally and marks data-dragging", async () => {
    const { runtime } = makeRuntime();
    // rail 200, thumb 100 -> maxTranslate 100; scrollable = 400 - 200 = 200.
    const { viewport, thumb } = mountVertical({
      viewportHeight: 200,
      contentHeight: 400,
      railHeight: 200,
      thumbHeight: 100,
      scrollTop: 0,
    });
    startStimulus({ runtime });
    await flushStimulus();

    thumb.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, pointerId: 1 }));
    expect(thumb.hasAttribute("data-dragging")).toBe(true);

    // dy = 50; scrollTop = 0 + (50/100) * 200 = 100.
    thumb.dispatchEvent(new PointerEvent("pointermove", { clientY: 50, pointerId: 1 }));
    expect(viewport.scrollTop).toBe(100);

    thumb.dispatchEvent(new PointerEvent("pointerup", { clientY: 50, pointerId: 1 }));
    expect(thumb.hasAttribute("data-dragging")).toBe(false);
  });

  it("ignores a stray pointermove with no active drag", async () => {
    const { runtime } = makeRuntime();
    const { viewport, thumb } = mountVertical({ scrollTop: 0 });
    startStimulus({ runtime });
    await flushStimulus();

    // No pointerdown first: dragAxis is null -> move is a no-op, scrollTop unchanged.
    thumb.dispatchEvent(new PointerEvent("pointermove", { clientY: 80, pointerId: 1 }));
    expect(viewport.scrollTop).toBe(0);
  });
});

describe("lv-scroll-area controller — uncontrolled doctrine (real runtime, zero round-trips)", () => {
  it("makes NO wire call across scroll, pointer-over and drag (a scroll area is uncontrolled)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { root, viewport, thumb } = mountVertical({
      railHeight: 200,
      thumbHeight: 100,
      scrollTop: 0,
    });
    startStimulus({ runtime });
    await flushStimulus();

    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    root.dispatchEvent(new PointerEvent("pointerenter"));
    root.dispatchEvent(new PointerEvent("pointerleave"));
    thumb.dispatchEvent(new PointerEvent("pointerdown", { clientY: 0, pointerId: 1 }));
    thumb.dispatchEvent(new PointerEvent("pointermove", { clientY: 50, pointerId: 1 }));
    thumb.dispatchEvent(new PointerEvent("pointerup", { clientY: 50, pointerId: 1 }));

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-scroll-area controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one scroll == one scrolled() (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot } = mountVertical({ viewportHeight: 200, contentHeight: 400 });
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the subtree (idiomorph). The markup is identical, so the
    // controller must NOT be double-connected and the scroll action must stay single.
    morph(componentRoot, componentRoot.outerHTML);
    await flushStimulus();

    const viewport = componentRoot.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    stubProp(viewport, "clientHeight", 200);
    stubProp(viewport, "scrollHeight", 400);

    const spy = vi.spyOn(LvScrollAreaController.prototype, "scrolled");
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("a root removed by a morph stops firing (disconnect tears the listeners down)", async () => {
    const { runtime } = makeRuntime();
    const { componentRoot, viewport } = mountVertical();
    startStimulus({ runtime });
    await flushStimulus();

    const spy = vi.spyOn(LvScrollAreaController.prototype, "scrolled");

    // Morph the scroll-area root out of the component subtree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.ScrollArea" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    // The detached viewport's data-action no longer reaches a live controller.
    viewport.dispatchEvent(new Event("scroll", { bubbles: true }));
    expect(spy).not.toHaveBeenCalled();
  });
});
