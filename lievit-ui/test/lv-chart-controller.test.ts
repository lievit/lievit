/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-chart Stimulus controller -- the conversion of `registry/jte/chart.enhancer.ts`. This suite
 * drives the REAL @hotwired/stimulus Application started by startStimulus() (auto-loads controllers
 * by filename) over a DOM shaped exactly like chart.jte's interactive output (the `<figure>` carries
 * `data-controller="lv-chart"`, every mark carries the `data-action` descriptor + `data-point-*`, the
 * tooltip carries `data-lv-chart-target="tooltip"`). No mocked $lievit, no mocked runtime: a fetch
 * stub captures the actual `_calls` the runtime would POST, so the UNCONTROLLED doctrine (a chart is
 * a PARTIAL with no wire component => ZERO `/lievit/<id>/call`) is proven, not assumed.
 *
 * It mirrors chart.enhancer's behaviours assertion-for-assertion (tooltip show/hide on
 * pointer+focus, x-band highlight, keyboard navigation, lv-chart-mark-click), and adds the
 * morph-safety proof the enhancer test could not state: after a real wire morph the mark still fires
 * its click event EXACTLY once (no stacked listeners), and a mark removed by a morph fires nothing.
 *
 * Substrate: happy-dom + the real Stimulus Application; flushStimulus() awaits the MutationObserver.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

/** The exact action descriptor chart.jte stamps on every interactive mark. */
const MARK_ACTION =
  "pointerenter->lv-chart#markActivate focus->lv-chart#markActivate " +
  "pointerleave->lv-chart#markDeactivate blur->lv-chart#markDeactivate " +
  "click->lv-chart#markClick keydown->lv-chart#markKeydown";

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

interface MountOpts {
  /** "bar" (2 series x 3 points). The mark count is fixed; type only affects the class. */
  zoomable?: boolean;
  /** Wrap the figure in a container so a morph can REMOVE it (off-canvas removal test). */
  wrap?: boolean;
}

interface Mounted {
  figure: HTMLElement;
  wrapper: HTMLElement | null;
  tooltip: HTMLElement;
  svg: SVGSVGElement;
  /** marks[series][x] */
  marks: HTMLElement[][];
}

/** Build a `data-controller="lv-chart"` figure exactly as chart.jte emits it for interactive=true. */
function mountChart(opts: MountOpts = {}): Mounted {
  // 2 series, 3 x-points. aria-label = "<x>: <y>".
  const yByMark = [
    [10, 25, 30],
    [5, 15, 20],
  ];
  const labels = ["Jan", "Feb", "Mar"];
  let marksHtml = "";
  for (let s = 0; s < yByMark.length; s++) {
    for (let x = 0; x < yByMark[s]!.length; x++) {
      const y = yByMark[s]![x]!;
      marksHtml +=
        `<rect class="lv-chart__bar" data-slot="lv-chart__bar" ` +
        `aria-label="${labels[x]}: ${y}" ` +
        `data-point-series="${s}" data-point-x="${x}" data-point-y="${y}" data-point-index="${x}" ` +
        `tabindex="0" role="img" id="m-${s}-${x}" ` +
        `data-action="${MARK_ACTION}"></rect>`;
    }
  }

  const svgAction = opts.zoomable
    ? `data-action="pointerdown->lv-chart#brushStart pointermove->lv-chart#brushMove pointerup->lv-chart#brushEnd"`
    : "";

  const figureHtml =
    `<figure id="the-chart" data-slot="chart" data-chart-type="bar" ` +
    `data-controller="lv-chart" data-lievit-enhancer="chart" ` +
    `data-tooltip-id="the-chart-tooltip"` +
    (opts.zoomable ? ` data-chart-zoomable="true"` : "") +
    ` class="lv-chart">` +
    `<svg role="img" viewBox="0 0 1000 300" ${svgAction}><title id="t">Sales</title>${marksHtml}</svg>` +
    `<div id="the-chart-tooltip" class="lv-chart__tooltip" role="tooltip" aria-live="off" ` +
    `data-lv-chart-target="tooltip" hidden></div>` +
    `</figure>`;

  let wrapper: HTMLElement | null = null;
  if (opts.wrap === true) {
    wrapper = document.createElement("div");
    wrapper.id = "wrap";
    wrapper.innerHTML = figureHtml;
    document.body.appendChild(wrapper);
  } else {
    const holder = document.createElement("div");
    holder.innerHTML = figureHtml;
    document.body.appendChild(holder.firstElementChild!);
  }

  const figure = document.getElementById("the-chart") as HTMLElement;
  const tooltip = document.getElementById("the-chart-tooltip") as HTMLElement;
  const svg = figure.querySelector("svg") as unknown as SVGSVGElement;
  const marks: HTMLElement[][] = [[], []];
  for (let s = 0; s < 2; s++) {
    for (let x = 0; x < 3; x++) {
      marks[s]![x] = document.getElementById(`m-${s}-${x}`) as HTMLElement;
    }
  }
  return { figure, wrapper, tooltip, svg, marks };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("lv-chart controller — tooltip + highlight (real Stimulus)", () => {
  it("pointerenter on a mark shows the tooltip with the mark's aria-label", async () => {
    const { runtime } = makeRuntime();
    const { marks, tooltip } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    marks[0]![1]!.dispatchEvent(new Event("pointerenter"));

    expect(tooltip.hasAttribute("data-open")).toBe(true);
    expect(tooltip.hasAttribute("hidden")).toBe(false);
    expect(tooltip.textContent).toBe("Feb: 25");
    expect(marks[0]![1]!.getAttribute("aria-describedby")).toBe("the-chart-tooltip");
  });

  it("focus on a mark shows the tooltip too (keyboard parity with hover)", async () => {
    const { runtime } = makeRuntime();
    const { marks, tooltip } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    marks[1]![2]!.dispatchEvent(new Event("focus"));
    expect(tooltip.hasAttribute("data-open")).toBe(true);
    expect(tooltip.textContent).toBe("Mar: 20");
  });

  it("pointerleave hides the tooltip + clears highlight after the anti-flicker delay", async () => {
    vi.useFakeTimers();
    const { runtime } = makeRuntime();
    const { marks, tooltip } = mountChart();
    startStimulus({ runtime });
    await vi.advanceTimersByTimeAsync(0); // flush Stimulus MutationObserver under fake timers

    marks[0]![0]!.dispatchEvent(new Event("pointerenter"));
    expect(tooltip.hasAttribute("data-open")).toBe(true);

    marks[0]![0]!.dispatchEvent(new Event("pointerleave"));
    // Still open until the 60ms timer fires.
    expect(tooltip.hasAttribute("data-open")).toBe(true);
    await vi.advanceTimersByTimeAsync(60);
    expect(tooltip.hasAttribute("data-open")).toBe(false);
    expect(tooltip.hasAttribute("hidden")).toBe(true);
    expect(marks[0]![0]!.hasAttribute("aria-describedby")).toBe(false);
  });

  it("pointerenter highlights the same x-band and dims the rest", async () => {
    const { runtime } = makeRuntime();
    const { marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    // Enter the x=1 mark of series 0: every x=1 mark highlighted, every other mark dimmed.
    marks[0]![1]!.dispatchEvent(new Event("pointerenter"));

    expect(marks[0]![1]!.getAttribute("data-highlighted")).toBe("true");
    expect(marks[1]![1]!.getAttribute("data-highlighted")).toBe("true");
    expect(marks[0]![0]!.getAttribute("data-dim")).toBe("true");
    expect(marks[0]![2]!.getAttribute("data-dim")).toBe("true");
    expect(marks[1]![0]!.getAttribute("data-dim")).toBe("true");
    expect(marks[0]![1]!.hasAttribute("data-dim")).toBe(false);
  });

  it("document Escape dismisses an open (hover) tooltip (focus left untouched)", async () => {
    const { runtime } = makeRuntime();
    const { marks, tooltip } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    const mark = marks[0]![2]!;
    mark.dispatchEvent(new Event("pointerenter"));
    expect(tooltip.hasAttribute("data-open")).toBe(true);

    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(tooltip.hasAttribute("data-open")).toBe(false);
    expect(tooltip.hasAttribute("hidden")).toBe(true);
    // The mark is no longer linked to the dismissed tooltip.
    expect(mark.hasAttribute("aria-describedby")).toBe(false);
  });

  it("markKeydown Escape dismisses the tooltip for a focused mark", async () => {
    const { runtime } = makeRuntime();
    const { marks, tooltip } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    const mark = marks[1]![0]!;
    mark.dispatchEvent(new Event("focus"));
    expect(tooltip.hasAttribute("data-open")).toBe(true);

    mark.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(tooltip.hasAttribute("data-open")).toBe(false);
  });
});

describe("lv-chart controller — keyboard navigation", () => {
  function key(el: Element, k: string): void {
    el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
  }

  it("ArrowRight / ArrowLeft move focus along the series", async () => {
    const { runtime } = makeRuntime();
    const { marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    const next = vi.spyOn(marks[0]![1]!, "focus");
    key(marks[0]![0]!, "ArrowRight");
    expect(next).toHaveBeenCalledTimes(1);

    const prev = vi.spyOn(marks[0]![0]!, "focus");
    key(marks[0]![1]!, "ArrowLeft");
    expect(prev).toHaveBeenCalledTimes(1);
  });

  it("Home / End jump to the first / last mark in the series", async () => {
    const { runtime } = makeRuntime();
    const { marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    const first = vi.spyOn(marks[0]![0]!, "focus");
    const last = vi.spyOn(marks[0]![2]!, "focus");
    key(marks[0]![1]!, "Home");
    expect(first).toHaveBeenCalledTimes(1);
    key(marks[0]![1]!, "End");
    expect(last).toHaveBeenCalledTimes(1);
  });

  it("ArrowDown moves to the same x-position in the adjacent series", async () => {
    const { runtime } = makeRuntime();
    const { marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    const adjacent = vi.spyOn(marks[1]![1]!, "focus");
    key(marks[0]![1]!, "ArrowDown");
    expect(adjacent).toHaveBeenCalledTimes(1);
  });
});

describe("lv-chart controller — lv-chart-mark-click + the UNCONTROLLED doctrine (zero wire calls)", () => {
  it("click on a mark dispatches lv-chart-mark-click with the datum detail", async () => {
    const { runtime } = makeRuntime();
    const { figure, marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    let detail: Record<string, string> | null = null;
    figure.addEventListener("lv-chart-mark-click", (e) => {
      detail = (e as CustomEvent).detail as Record<string, string>;
    });

    marks[1]![2]!.dispatchEvent(new Event("click", { bubbles: true }));
    expect(detail).toEqual({ series: "1", x: "2", y: "20", index: "2" });
  });

  it("Enter / Space activate a focused mark (same custom event as a click)", async () => {
    const { runtime } = makeRuntime();
    const { figure, marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    let count = 0;
    figure.addEventListener("lv-chart-mark-click", () => {
      count++;
    });

    marks[0]![0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    marks[0]![0]!.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(count).toBe(2);
  });

  it("no interaction round-trips the wire (a chart is uncontrolled: ZERO /lievit/<id>/call)", async () => {
    const { runtime, calledActions } = makeRuntime();
    const { figure, marks } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    // Drive every behaviour: hover, focus, highlight, click, keyboard nav, activate, Escape.
    marks[0]![0]!.dispatchEvent(new Event("pointerenter"));
    marks[0]![0]!.dispatchEvent(new Event("focus"));
    marks[0]![0]!.dispatchEvent(new Event("click", { bubbles: true }));
    marks[0]![0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    marks[0]![1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    void figure;

    await new Promise((r) => setTimeout(r, 10));
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-chart controller — morph-safety (real lievit morph)", () => {
  it("after a real morph one click fires lv-chart-mark-click EXACTLY once (no stacked listeners)", async () => {
    const { runtime } = makeRuntime();
    const { figure } = mountChart();
    startStimulus({ runtime });
    await flushStimulus();

    let count = 0;
    document.body.addEventListener("lv-chart-mark-click", () => {
      count++;
    });

    // A real wire morph re-renders the figure's children (idiomorph). The figure (controller root)
    // is preserved, so Stimulus must NOT double-connect and the data-action must stay single-bound.
    morph(figure, figure.outerHTML);
    await flushStimulus();

    const reRendered = document.getElementById("m-0-1")!;
    reRendered.dispatchEvent(new Event("click", { bubbles: true }));

    expect(count).toBe(1);
  });

  it("a mark removed by a morph fires nothing (disconnect tears the listeners down)", async () => {
    const { runtime } = makeRuntime();
    const { wrapper, marks, tooltip } = mountChart({ wrap: true });
    startStimulus({ runtime });
    await flushStimulus();

    const detachedMark = marks[0]![0]!;

    // Morph the figure out of the wrapper entirely.
    morph(wrapper!, `<div id="wrap"><span>gone</span></div>`);
    await flushStimulus();

    // The detached mark's listeners are gone with the disconnected controller: no tooltip, no throw.
    detachedMark.dispatchEvent(new Event("pointerenter"));
    expect(tooltip.hasAttribute("data-open")).toBe(false);
  });
});

describe("lv-chart controller — zoom / pan (only when zoomable)", () => {
  it("a brush drag applies a zoom transform and injects a Reset zoom button", async () => {
    const { runtime } = makeRuntime();
    const { figure, svg } = mountChart({ zoomable: true });
    startStimulus({ runtime });
    await flushStimulus();

    // getBoundingClientRect is 0-sized in happy-dom; clientX still drives a >8px brush via the math.
    svg.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 100, bubbles: true }));
    svg.dispatchEvent(new MouseEvent("pointermove", { clientX: 400, bubbles: true }));
    svg.dispatchEvent(new MouseEvent("pointerup", { clientX: 400, bubbles: true }));

    const reset = figure.querySelector(".lv-chart__zoom-reset") as HTMLButtonElement | null;
    expect(reset).not.toBeNull();
    expect(svg.style.transform).not.toBe("");

    // Clicking Reset clears the transform and removes itself.
    reset!.click();
    expect(figure.querySelector(".lv-chart__zoom-reset")).toBeNull();
    expect(svg.style.transform).toBe("");
  });

  it("a non-zoomable chart has no brush wiring on the SVG", async () => {
    const { runtime } = makeRuntime();
    const { svg, figure } = mountChart({ zoomable: false });
    startStimulus({ runtime });
    await flushStimulus();

    svg.dispatchEvent(new MouseEvent("pointerdown", { button: 0, clientX: 100, bubbles: true }));
    svg.dispatchEvent(new MouseEvent("pointerup", { clientX: 400, bubbles: true }));
    expect(figure.querySelector(".lv-chart__zoom-reset")).toBeNull();
  });
});
