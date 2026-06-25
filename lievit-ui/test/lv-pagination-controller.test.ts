/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-pagination Stimulus controller -- the conversion of runtime/features/pagination.ts (the old
 * `l:page` wire directive). Proven through the REAL Stimulus Application + the REAL lievit wire
 * morph (no mocked $lievit, no mocked runtime: a fetch stub captures the actual `_calls` the
 * runtime POSTs, and `scrollIntoView` is stubbed on the component root to observe scroll-to-top).
 *
 * It mirrors the old features.test.ts pagination case (a page click drives the action + scrolls to
 * top) assertion-for-assertion, then adds what the directive test could not state:
 * - the controlled/uncontrolled doctrine at the page level: a page element WITH an action param
 *   fires the wire exactly once; one WITHOUT an action param fires NOTHING and does not preventDefault
 *   (so a URL-mode <a href> navigates / Turbo takes over -- ZERO round-trip);
 * - the `l:page.arg` inline-argument form (`action(n)`) and the `l:page.no-scroll` modifier;
 * - morph-safety: after a real morph the click still fires EXACTLY once (no stacked listeners), and
 *   a page element removed by a morph fires nothing (Stimulus tore the binding down).
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

interface Mounted {
  componentRoot: HTMLElement;
  paginationRoot: HTMLElement;
  page: HTMLButtonElement;
  scrollSpy: ReturnType<typeof vi.fn>;
}

/**
 * Build a component root wrapping a `data-controller="lv-pagination"` pagination div with one
 * wire-mode page <button>, exactly as pagination.jte emits it in wire mode. Options pick the page
 * element's action / arg / no-scroll wiring; `action: null` renders an uncontrolled element (no
 * data-action, no action param) -- a URL-mode <a href> stand-in.
 */
function mountPagination(opts: {
  action?: string | null;
  page?: number;
  arg?: number;
  noScroll?: boolean;
} = {}): Mounted {
  const action = opts.action === undefined ? "goToPage" : opts.action;
  const page = opts.page ?? 3;

  const componentRoot = document.createElement("div");
  componentRoot.setAttribute("data-lievit-component", "com.example.List");
  componentRoot.setAttribute("data-lievit-id", `cid-${Math.random().toString(36).slice(2)}`);
  componentRoot.setAttribute("data-lievit-snapshot", "s1");
  const scrollSpy = vi.fn();
  componentRoot.scrollIntoView = scrollSpy as unknown as HTMLElement["scrollIntoView"];

  const paginationRoot = document.createElement("div");
  paginationRoot.setAttribute("data-slot", "pagination");

  const page0 = document.createElement("button");
  page0.type = "button";
  page0.setAttribute("data-slot", "pagination-page");
  page0.setAttribute("data-page", String(page));
  page0.textContent = String(page);

  if (action != null) {
    paginationRoot.setAttribute("data-controller", "lv-pagination");
    page0.setAttribute("data-action", "click->lv-pagination#goto");
    page0.setAttribute("data-lv-pagination-action-param", action);
    if (opts.arg !== undefined) {
      page0.setAttribute("data-lv-pagination-arg-param", String(opts.arg));
    }
    if (opts.noScroll === true) {
      page0.setAttribute("data-lv-pagination-no-scroll-param", "true");
    }
  }

  paginationRoot.appendChild(page0);
  componentRoot.appendChild(paginationRoot);
  document.body.appendChild(componentRoot);
  return { componentRoot, paginationRoot, page: page0, scrollSpy };
}

/** Dispatch a real, cancelable bubbling click and return the event (to read defaultPrevented). */
function clickPage(el: Element): MouseEvent {
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true });
  el.dispatchEvent(ev);
  return ev;
}

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
});

describe("lv-pagination controller — page click drives the wire (real Stimulus + real runtime)", () => {
  it("a_wire_page_click_drives_the_action_and_scrolls_to_top", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { page, scrollSpy } = mountPagination({ action: "goToPage" });
    startStimulus({ runtime });
    await flushStimulus();

    clickPage(page);
    await settle();

    expect(calledActions).toContain("goToPage");
    expect(scrollSpy).toHaveBeenCalledTimes(1);
  });

  it("controlled_page_fires_the_action_exactly_once", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { page } = mountPagination({ action: "goToPage" });
    startStimulus({ runtime });
    await flushStimulus();

    const ev = clickPage(page);
    await settle();

    expect(ev.defaultPrevented).toBe(true); // wire-controlled => navigation suppressed
    expect(calledActions.filter((a) => a === "goToPage")).toHaveLength(1);
  });

  it("uncontrolled_page_fires_no_wire_call_and_does_not_preventDefault (URL-mode link navigates)", async () => {
    const { runtime, calledActions } = makeRuntime();
    // An uncontrolled element bound to goto but with NO action param (the controller's own guard):
    // mirrors a URL-mode page whose click must reach the browser / Turbo, never the wire.
    const componentRoot = document.createElement("div");
    componentRoot.setAttribute("data-lievit-component", "com.example.List");
    componentRoot.setAttribute("data-lievit-id", "cid-x");
    componentRoot.setAttribute("data-lievit-snapshot", "s1");
    const scrollSpy = vi.fn();
    componentRoot.scrollIntoView = scrollSpy as unknown as HTMLElement["scrollIntoView"];
    const root = document.createElement("div");
    root.setAttribute("data-controller", "lv-pagination");
    const link = document.createElement("a");
    link.setAttribute("href", "/items?page=3");
    link.setAttribute("data-action", "click->lv-pagination#goto"); // bound, but no action param
    link.textContent = "3";
    root.appendChild(link);
    componentRoot.appendChild(root);
    document.body.appendChild(componentRoot);

    startStimulus({ runtime });
    await flushStimulus();

    const ev = clickPage(link);
    await settle();

    expect(calledActions).toHaveLength(0);
    expect(ev.defaultPrevented).toBe(false); // navigation left intact
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("no_scroll_param_suppresses_the_scroll_to_top_but_still_fires", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { page, scrollSpy } = mountPagination({ action: "goToPage", noScroll: true });
    startStimulus({ runtime });
    await flushStimulus();

    clickPage(page);
    await settle();

    expect(calledActions).toContain("goToPage");
    expect(scrollSpy).not.toHaveBeenCalled();
  });

  it("arg_param_sends_the_inline_argument_form (l:page.arg equivalent)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { page } = mountPagination({ action: "gotoPage", arg: 7 });
    startStimulus({ runtime });
    await flushStimulus();

    clickPage(page);
    await settle();

    expect(calledActions).toContain("gotoPage(7)");
  });
});

describe("lv-pagination controller — morph-safety (real lievit morph)", () => {
  it("after_a_real_morph_the_click_still_fires_exactly_once (no stacked listeners)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot } = mountPagination({ action: "goToPage", page: 3 });
    startStimulus({ runtime });
    await flushStimulus();

    // A real wire morph re-renders the component subtree (idiomorph). Identical markup, so the
    // controller must NOT be double-bound and goto must stay single.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.List" data-lievit-snapshot="s2">
         <div data-slot="pagination" data-controller="lv-pagination">
           <button type="button" data-slot="pagination-page" data-page="3"
                   data-action="click->lv-pagination#goto"
                   data-lv-pagination-action-param="goToPage">3</button>
         </div>
       </div>`,
    );
    await flushStimulus();

    const page = componentRoot.querySelector<HTMLButtonElement>('[data-slot="pagination-page"]')!;
    clickPage(page);
    await settle();

    expect(calledActions.filter((a) => a === "goToPage")).toHaveLength(1);
  });

  it("a_page_removed_by_a_morph_stops_firing (disconnect tears the binding down)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { componentRoot, page } = mountPagination({ action: "goToPage" });
    startStimulus({ runtime });
    await flushStimulus();

    // Morph the pagination (and its page button) out of the tree.
    morph(
      componentRoot,
      `<div data-lievit-component="com.example.List" data-lievit-snapshot="s2"><span>gone</span></div>`,
    );
    await flushStimulus();

    clickPage(page); // the detached node's click reaches no live controller
    await settle();
    expect(calledActions).toHaveLength(0);
  });
});
