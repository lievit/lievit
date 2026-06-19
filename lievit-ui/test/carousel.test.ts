/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach, vi } from "vitest";
import "../registry/components/carousel/carousel.js";

interface CarouselEl extends HTMLElement {
  index: number;
  orientation: "horizontal" | "vertical";
  loop: boolean;
  autoplay: number;
  label: string;
  next: () => void;
  prev: () => void;
  updateComplete: Promise<unknown>;
}

const flush = () => new Promise((r) => setTimeout(r, 0));

async function mount(slides = 3, set?: (el: CarouselEl) => void): Promise<CarouselEl> {
  const el = document.createElement("lv-carousel") as CarouselEl;
  el.innerHTML = Array.from({ length: slides }, (_, i) => `<div class="s">Slide ${i}</div>`).join("");
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  await flush();
  return el;
}

function viewport(el: CarouselEl): HTMLElement {
  return el.querySelector(".lv-carousel__viewport") as HTMLElement;
}
function prevBtn(el: CarouselEl): HTMLButtonElement {
  return el.querySelector(".lv-carousel__nav--prev") as HTMLButtonElement;
}
function nextBtn(el: CarouselEl): HTMLButtonElement {
  return el.querySelector(".lv-carousel__nav--next") as HTMLButtonElement;
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("lv-carousel light DOM + structure", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("adopts the host children as slides inside the viewport", async () => {
    const el = await mount(3);
    expect(viewport(el).children.length).toBe(3);
    expect(viewport(el).querySelectorAll(".s").length).toBe(3);
  });

  test("root is a carousel region with aria-roledescription", async () => {
    const el = await mount();
    const region = el.querySelector('[role="region"]')!;
    expect(region.getAttribute("aria-roledescription")).toBe("carousel");
  });

  test("each slide gets role=group + slide roledescription + N of M label", async () => {
    const el = await mount(3);
    const slides = Array.from(viewport(el).children);
    expect(slides.every((s) => s.getAttribute("role") === "group")).toBe(true);
    expect(slides[0].getAttribute("aria-roledescription")).toBe("slide");
    expect(slides[1].getAttribute("aria-label")).toBe("2 of 3");
  });

  test("emits Lucide arrow icons, not Font Awesome", async () => {
    const el = await mount();
    expect(el.querySelectorAll(".lv-carousel__nav svg").length).toBe(2);
    expect(el.querySelector(".fa, [class*='wa-']")).toBeNull();
  });

  test("has a live status region announcing the position", async () => {
    const el = await mount(3);
    const status = el.querySelector(".lv-carousel__status")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent?.trim()).toBe("Slide 1 of 3");
  });
});

describe("lv-carousel next/prev", () => {
  test("next() advances the index and emits lv-change", async () => {
    const el = await mount(3);
    let detail: { index: number } | null = null;
    el.addEventListener("lv-change", (e) => (detail = (e as CustomEvent).detail));
    nextBtn(el).click();
    await el.updateComplete;
    expect(el.index).toBe(1);
    expect(detail).toEqual({ index: 1 });
  });

  test("prev() goes back one slide", async () => {
    const el = await mount(3, (e) => (e.index = 2));
    prevBtn(el).click();
    await el.updateComplete;
    expect(el.index).toBe(1);
  });

  test("prev is disabled on the first slide, next on the last (no loop)", async () => {
    const el = await mount(3);
    expect(prevBtn(el).disabled).toBe(true);
    expect(nextBtn(el).disabled).toBe(false);
    el.index = 2;
    await el.updateComplete;
    expect(nextBtn(el).disabled).toBe(true);
  });

  test("loop wraps past the ends and keeps the buttons enabled", async () => {
    const el = await mount(3, (e) => (e.loop = true));
    expect(prevBtn(el).disabled).toBe(false);
    prevBtn(el).click();
    await el.updateComplete;
    expect(el.index).toBe(2);
    nextBtn(el).click();
    await el.updateComplete;
    expect(el.index).toBe(0);
  });

  test("the active slide is visible, the others are inert + aria-hidden", async () => {
    const el = await mount(3, (e) => (e.index = 1));
    const slides = Array.from(viewport(el).children) as HTMLElement[];
    expect(slides[1].getAttribute("aria-hidden")).toBe("false");
    expect(slides[0].getAttribute("aria-hidden")).toBe("true");
    expect(slides[0].hasAttribute("inert")).toBe(true);
  });
});

describe("lv-carousel keyboard", () => {
  function press(el: CarouselEl, key: string) {
    el.querySelector('[role="region"]')!.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true })
    );
  }

  test("ArrowRight advances, ArrowLeft goes back (horizontal)", async () => {
    const el = await mount(3, (e) => (e.index = 1));
    press(el, "ArrowRight");
    await el.updateComplete;
    expect(el.index).toBe(2);
    press(el, "ArrowLeft");
    await el.updateComplete;
    expect(el.index).toBe(1);
  });

  test("ArrowDown/ArrowUp drive a vertical carousel", async () => {
    const el = await mount(3, (e) => (e.orientation = "vertical"));
    press(el, "ArrowDown");
    await el.updateComplete;
    expect(el.index).toBe(1);
    press(el, "ArrowUp");
    await el.updateComplete;
    expect(el.index).toBe(0);
  });
});

describe("lv-carousel autoplay", () => {
  test("autoplay advances on the interval and stops on disconnect", async () => {
    vi.useFakeTimers();
    const el = document.createElement("lv-carousel") as CarouselEl;
    el.innerHTML = `<div>0</div><div>1</div><div>2</div>`;
    el.autoplay = 1000;
    el.loop = true;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.index).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(el.index).toBe(1);
    vi.advanceTimersByTime(1000);
    expect(el.index).toBe(2);
    el.remove();
    vi.advanceTimersByTime(2000);
    expect(el.index).toBe(2); // timer cleared on disconnect
  });
});
