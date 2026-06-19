/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/input/input.js";
import "../registry/components/textarea/textarea.js";
import "../registry/components/label/label.js";
import "../registry/components/badge/badge.js";

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

describe("light DOM", () => {
  test("every primitive renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of [
      "lv-input",
      "lv-textarea",
      "lv-label",
      "lv-badge",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

describe("lv-input", () => {
  test("emits a bubbling lv-input event with the new value (events up)", async () => {
    const el = await mount("lv-input");
    let detail: string | undefined;
    el.addEventListener("lv-input", (e) => {
      detail = (e as CustomEvent<string>).detail;
    });
    const input = el.querySelector("input") as HTMLInputElement;
    input.value = "parma";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    expect(detail).toBe("parma");
  });

  test("invalid sets aria-invalid and the invalid class", async () => {
    const el = await mount<HTMLElement & { invalid: boolean }>("lv-input", (e) => {
      e.invalid = true;
    });
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.classList.contains("lv-input--invalid")).toBe(true);
  });
});

describe("lv-textarea", () => {
  test("emits lv-input on change", async () => {
    const el = await mount("lv-textarea");
    let detail: string | undefined;
    el.addEventListener("lv-input", (e) => {
      detail = (e as CustomEvent<string>).detail;
    });
    const ta = el.querySelector("textarea") as HTMLTextAreaElement;
    ta.value = "note";
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    expect(detail).toBe("note");
  });
});

describe("lv-label", () => {
  test("renders a native label with the for association", async () => {
    const el = await mount<HTMLElement & { for: string }>("lv-label", (e) => {
      e.for = "email";
    });
    expect((el.querySelector("label") as HTMLLabelElement).htmlFor).toBe("email");
  });

  test("required marker is hidden from assistive tech", async () => {
    const el = await mount<HTMLElement & { required: boolean }>("lv-label", (e) => {
      e.required = true;
    });
    const marker = el.querySelector(".lv-label__required");
    expect(marker?.getAttribute("aria-hidden")).toBe("true");
  });
});

describe("lv-badge", () => {
  test("variant maps to a status token class", async () => {
    const el = await mount<HTMLElement & { variant: string }>("lv-badge", (e) => {
      e.variant = "success";
    });
    expect(el.querySelector(".lv-badge--success")).not.toBeNull();
  });
});
