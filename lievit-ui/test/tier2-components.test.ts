/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/progress/progress.js";
import "../registry/components/toast/toast.js";
import "../registry/components/tooltip/tooltip.js";

async function mount<T extends HTMLElement>(tag: string, set?: (el: T) => void): Promise<T> {
  const el = document.createElement(tag) as T;
  set?.(el);
  document.body.appendChild(el);
  await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

// ---------------------------------------------------------------------------
// Light DOM check for all tier-2 primitives
// ---------------------------------------------------------------------------
describe("tier-2 light DOM", () => {
  test("every tier-2 primitive renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of [
      "lv-progress",
      "lv-toast",
      "lv-tooltip",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-progress
// ---------------------------------------------------------------------------
describe("lv-progress", () => {
  test("carries role=progressbar with aria-valuemin/max", async () => {
    const el = await mount("lv-progress");
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar).not.toBeNull();
    expect(bar.getAttribute("aria-valuemin")).toBe("0");
    expect(bar.getAttribute("aria-valuemax")).toBe("100");
  });

  test("determinate: aria-valuenow reflects the value", async () => {
    const el = await mount<HTMLElement & { value: number }>("lv-progress", (e) => {
      e.value = 42;
    });
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    expect(bar.getAttribute("aria-valuenow")).toBe("42");
  });

  test("indeterminate (value=-1): aria-valuenow is absent and bar has indeterminate class", async () => {
    const el = await mount<HTMLElement & { value: number }>("lv-progress", (e) => {
      e.value = -1;
    });
    const bar = el.querySelector('[role="progressbar"]') as HTMLElement;
    // aria-valuenow should be empty string for indeterminate
    const now = bar.getAttribute("aria-valuenow");
    expect(now === null || now === "").toBe(true);
    expect(el.querySelector(".lv-progress__bar--indeterminate")).not.toBeNull();
  });

  test("label is reflected via aria-label", async () => {
    const el = await mount<HTMLElement & { label: string }>("lv-progress", (e) => {
      e.label = "Uploading";
    });
    expect(el.querySelector('[role="progressbar"]')?.getAttribute("aria-label")).toBe("Uploading");
  });
});

// ---------------------------------------------------------------------------
// lv-toast
// ---------------------------------------------------------------------------
describe("lv-toast", () => {
  test("closed by default: no --open class", async () => {
    const el = await mount("lv-toast");
    expect(el.querySelector(".lv-toast--open")).toBeNull();
  });

  test("open renders the toast panel", async () => {
    const el = await mount<HTMLElement & { open: boolean }>("lv-toast", (e) => {
      e.open = true;
    });
    expect(el.querySelector(".lv-toast--open")).not.toBeNull();
  });

  test("danger variant uses role=alert (assertive)", async () => {
    const el = await mount<HTMLElement & { variant: string; open: boolean }>("lv-toast", (e) => {
      e.variant = "danger";
      e.open = true;
    });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  test("info variant uses role=status (polite)", async () => {
    const el = await mount<HTMLElement & { variant: string; open: boolean }>("lv-toast", (e) => {
      e.variant = "info";
      e.open = true;
    });
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  test("dismissible renders a dismiss button", async () => {
    const el = await mount<HTMLElement & { open: boolean; dismissible: boolean }>("lv-toast", (e) => {
      e.open = true;
      e.dismissible = true;
    });
    expect(el.querySelector(".lv-toast__dismiss")).not.toBeNull();
  });

  test("clicking dismiss emits lv-dismiss", async () => {
    let dismissed = false;
    const el = await mount<HTMLElement & { open: boolean; dismissible: boolean }>("lv-toast", (e) => {
      e.open = true;
      e.dismissible = true;
    });
    el.addEventListener("lv-dismiss", () => { dismissed = true; });
    (el.querySelector(".lv-toast__dismiss") as HTMLButtonElement).click();
    expect(dismissed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// lv-tooltip
// ---------------------------------------------------------------------------
describe("lv-tooltip", () => {
  test("renders a role=tooltip panel", async () => {
    const el = await mount<HTMLElement & { content: string }>("lv-tooltip", (e) => {
      e.content = "Save changes";
    });
    const tip = el.querySelector('[role="tooltip"]');
    expect(tip).not.toBeNull();
    expect(tip?.textContent).toBe("Save changes");
  });

  test("tooltip is hidden by default (no --visible class)", async () => {
    const el = await mount<HTMLElement & { content: string }>("lv-tooltip", (e) => {
      e.content = "Tip";
    });
    expect(el.querySelector(".lv-tooltip-panel--visible")).toBeNull();
  });

  test("trigger carries aria-describedby pointing at the tooltip id", async () => {
    const el = await mount<HTMLElement & { content: string }>("lv-tooltip", (e) => {
      e.content = "Helpful hint";
    });
    const trigger = el.querySelector(".lv-tooltip-trigger") as HTMLElement;
    const tipId = (el.querySelector('[role="tooltip"]') as HTMLElement).id;
    expect(trigger.getAttribute("aria-describedby")).toBe(tipId);
  });

  test("mouseenter shows the tooltip (--visible class)", async () => {
    const el = await mount<HTMLElement & { content: string }>("lv-tooltip", (e) => {
      e.content = "Tip";
    });
    const trigger = el.querySelector(".lv-tooltip-trigger") as HTMLElement;
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-tooltip-panel--visible")).not.toBeNull();
  });

  test("mouseleave hides the tooltip", async () => {
    const el = await mount<HTMLElement & { content: string }>("lv-tooltip", (e) => {
      e.content = "Tip";
    });
    const trigger = el.querySelector(".lv-tooltip-trigger") as HTMLElement;
    trigger.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    trigger.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-tooltip-panel--visible")).toBeNull();
  });
});
