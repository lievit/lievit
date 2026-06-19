/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-chart> (issue #457): native-SVG charting wrapper. Pins light-DOM, the role=img + label,
 * the visually-hidden data table, bar/line/area rendering per series, token colours, and the
 * hover/focus tooltip + lv-point contract.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/chart/chart.js";

type ChartEl = HTMLElement & {
  type: "bar" | "line" | "area";
  categories: string[];
  series: Array<{ key: string; label?: string; data: number[]; color?: string }>;
  label: string;
  legend: boolean;
  updateComplete: Promise<unknown>;
};

const categories = ["Jan", "Feb", "Mar"];
const series = [
  { key: "sales", label: "Sales", data: [10, 30, 20] },
  { key: "leads", label: "Leads", data: [5, 15, 25] },
];

async function mount(set?: (el: ChartEl) => void): Promise<ChartEl> {
  const el = document.createElement("lv-chart") as ChartEl;
  el.categories = categories;
  el.series = series;
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-chart", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("the svg has role=img and the accessible label", async () => {
    const el = await mount((e) => {
      e.label = "Quarterly revenue";
    });
    const svg = el.querySelector("svg");
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-label")).toBe("Quarterly revenue");
  });

  test("bar variant renders one rect per (series x category)", async () => {
    const el = await mount((e) => {
      e.type = "bar";
    });
    const bars = el.querySelectorAll(".lv-chart__bar");
    expect(bars.length).toBe(series.length * categories.length);
  });

  test("line variant renders one path + dots per series", async () => {
    const el = await mount((e) => {
      e.type = "line";
    });
    // 2 series -> 2 line paths
    const paths = el.querySelectorAll("path[stroke-width='2']");
    expect(paths.length).toBe(2);
    // visible dots: one per point per series
    expect(el.querySelectorAll(".lv-chart__dot").length).toBe(series.length * categories.length);
  });

  test("area variant adds a filled area path per series", async () => {
    const el = await mount((e) => {
      e.type = "area";
    });
    const areas = el.querySelectorAll("path[fill-opacity='0.18']");
    expect(areas.length).toBe(2);
  });

  test("series colours default to the --lv-color-chart-N tokens", async () => {
    const el = await mount((e) => {
      e.type = "bar";
    });
    const firstBar = el.querySelector(".lv-chart__bar");
    expect(firstBar?.getAttribute("fill")).toBe("var(--lv-color-chart-1)");
  });

  test("a visually-hidden data table mirrors the series for screen readers", async () => {
    const el = await mount();
    const table = el.querySelector("table.lv-chart__sr");
    expect(table).not.toBeNull();
    // header: Category + one column per series
    expect(table?.querySelectorAll("thead th").length).toBe(1 + series.length);
    // one body row per category
    expect(table?.querySelectorAll("tbody tr").length).toBe(categories.length);
    // a known cell value is present
    expect(table?.textContent).toContain("30");
  });

  test("legend renders one entry per series and can be turned off", async () => {
    const el = await mount();
    expect(el.querySelectorAll(".lv-chart__legend-item").length).toBe(2);
    el.legend = false;
    await el.updateComplete;
    expect(el.querySelector(".lv-chart__legend")).toBeNull();
  });

  test("hovering a bar shows the token-styled tooltip and emits lv-point", async () => {
    let detail: unknown;
    const el = await mount((e) => {
      e.type = "bar";
    });
    el.addEventListener("lv-point", (ev) => {
      detail = (ev as CustomEvent).detail;
    });
    expect(el.querySelector(".lv-chart__tooltip")).toBeNull();
    const bar = el.querySelector(".lv-chart__bar") as SVGElement;
    bar.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await el.updateComplete;
    expect(el.querySelector(".lv-chart__tooltip")).not.toBeNull();
    expect((detail as { series: string }).series).toBe("sales");
    expect((detail as { category: string }).category).toBe("Jan");
    expect((detail as { value: number }).value).toBe(10);
  });

  test("each bar is focusable and carries an aria-label with its value", async () => {
    const el = await mount((e) => {
      e.type = "bar";
    });
    const bar = el.querySelector(".lv-chart__bar") as SVGElement;
    expect(bar.getAttribute("tabindex")).toBe("0");
    expect(bar.getAttribute("aria-label")).toContain("Sales");
    expect(bar.getAttribute("aria-label")).toContain("10");
  });
});
