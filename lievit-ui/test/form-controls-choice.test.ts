/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * Sibling of form-controls.test.ts for the CHOICE islands (checkbox, switch, radio-group,
 * slider). Same dogfood finding: these were NOT form-associated and emitted only `lv-*`
 * events, so a plain POST form (or lievit-kit `l:model`, which binds native input/change)
 * dropped the field. This pins the fix per island:
 *   - POST form-association: the island submits under `name` (read via FormData) -- the boolean
 *     controls contribute their value only when checked (native checkbox semantics), the
 *     value-bearing ones submit their selected/numeric value; `formResetCallback()` restores
 *     the initial state;
 *   - native events for l:model: a native `change` (slider also `input`) event fires from the
 *     element on change, so the default `l:model` binding picks it up.
 *
 * The runtime here is happy-dom, which does NOT implement ElementInternals, so each island
 * renders a hidden `<input name>` mirror as the portable fallback; that is what makes FormData
 * work here and in browsers without ElementInternals. We invoke `formResetCallback()` directly
 * rather than `form.reset()` (a no-op for unregistered controls in happy-dom that also leaks
 * shared document state across files); in a real browser `form.reset()` invokes exactly this.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/checkbox/checkbox.js";
import "../registry/components/switch/switch.js";
import "../registry/components/radio-group/radio-group.js";
import "../registry/components/slider/slider.js";

interface ChoiceEl extends HTMLElement {
  name: string;
  formResetCallback(): void;
  updateComplete: Promise<unknown>;
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** Mount an island inside a <form>, configured by `set`; returns both. */
async function mountInForm<T extends ChoiceEl>(
  tag: string,
  set?: (el: T) => void
): Promise<{ form: HTMLFormElement; el: T }> {
  const form = document.createElement("form");
  form.method = "post";
  const el = document.createElement(tag) as T;
  set?.(el);
  form.appendChild(el);
  document.body.appendChild(form);
  await el.updateComplete;
  return { form, el };
}

/** Records native input/change events fired from the element. */
function recordNative(el: HTMLElement): { input: number; change: number } {
  const counts = { input: 0, change: 0 };
  el.addEventListener("input", () => counts.input++);
  el.addEventListener("change", () => counts.change++);
  return counts;
}

describe("lv-checkbox form-association + native events", () => {
  test("absent from FormData when unchecked", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-checkbox", (e) => {
      e.name = "agree";
    });
    expect(new FormData(form).get("agree")).toBeNull();
  });

  test("submits its value (default 'on') under name when checked", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-checkbox", (e) => {
      e.name = "agree";
      (e as unknown as { checked: boolean }).checked = true;
    });
    expect(new FormData(form).get("agree")).toBe("on");
  });

  test("submits a custom value when checked", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-checkbox", (e) => {
      e.name = "agree";
      (e as unknown as { value: string }).value = "yes";
      (e as unknown as { checked: boolean }).checked = true;
    });
    expect(new FormData(form).get("agree")).toBe("yes");
  });

  test("toggling fires a native change and updates FormData", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-checkbox", (e) => {
      e.name = "agree";
    });
    const native = recordNative(el);
    const inner = el.querySelector("input") as HTMLInputElement;
    inner.checked = true;
    inner.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect((el as unknown as { checked: boolean }).checked).toBe(true);
    expect(native.change).toBeGreaterThanOrEqual(1);
    expect(new FormData(form).get("agree")).toBe("on");
  });

  test("formResetCallback restores the initial checked state", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-checkbox", (e) => {
      e.name = "agree";
    });
    const inner = el.querySelector("input") as HTMLInputElement;
    inner.checked = true;
    inner.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect(new FormData(form).get("agree")).toBe("on");
    el.formResetCallback();
    await el.updateComplete;
    expect((el as unknown as { checked: boolean }).checked).toBe(false);
    expect(new FormData(form).get("agree")).toBeNull();
  });
});

describe("lv-switch form-association + native events", () => {
  test("absent from FormData when off", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-switch", (e) => {
      e.name = "notify";
    });
    expect(new FormData(form).get("notify")).toBeNull();
  });

  test("submits its value (default 'on') under name when on", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-switch", (e) => {
      e.name = "notify";
      (e as unknown as { checked: boolean }).checked = true;
    });
    expect(new FormData(form).get("notify")).toBe("on");
  });

  test("toggling fires a native change and updates FormData", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-switch", (e) => {
      e.name = "notify";
    });
    const native = recordNative(el);
    (el.querySelector(".lv-switch") as HTMLElement).click();
    await el.updateComplete;
    expect((el as unknown as { checked: boolean }).checked).toBe(true);
    expect(native.change).toBeGreaterThanOrEqual(1);
    expect(new FormData(form).get("notify")).toBe("on");
  });

  test("formResetCallback restores the initial state", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-switch", (e) => {
      e.name = "notify";
      (e as unknown as { checked: boolean }).checked = true;
    });
    (el.querySelector(".lv-switch") as HTMLElement).click();
    await el.updateComplete;
    expect(new FormData(form).get("notify")).toBeNull();
    el.formResetCallback();
    await el.updateComplete;
    expect((el as unknown as { checked: boolean }).checked).toBe(true);
    expect(new FormData(form).get("notify")).toBe("on");
  });
});

describe("lv-radio-group form-association + native events", () => {
  const options = [
    { value: "s", label: "Small" },
    { value: "m", label: "Medium" },
    { value: "l", label: "Large" },
  ];

  test("submits the selected value under name via FormData", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-radio-group", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "size";
      (e as unknown as { value: string }).value = "m";
    });
    expect(new FormData(form).get("size")).toBe("m");
  });

  test("empty FormData value when nothing is selected", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-radio-group", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "size";
    });
    expect(new FormData(form).get("size")).toBe("");
  });

  test("selecting an option fires native input + change and updates FormData", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-radio-group", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "size";
    });
    const native = recordNative(el);
    (el.querySelectorAll(".lv-radio-option")[2] as HTMLElement).click();
    await el.updateComplete;
    expect((el as unknown as { value: string }).value).toBe("l");
    expect(native.input).toBeGreaterThanOrEqual(1);
    expect(native.change).toBeGreaterThanOrEqual(1);
    expect(new FormData(form).get("size")).toBe("l");
  });

  test("formResetCallback restores the initial selection", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-radio-group", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "size";
      (e as unknown as { value: string }).value = "s";
    });
    (el.querySelectorAll(".lv-radio-option")[1] as HTMLElement).click();
    await el.updateComplete;
    expect(new FormData(form).get("size")).toBe("m");
    el.formResetCallback();
    await el.updateComplete;
    expect((el as unknown as { value: string }).value).toBe("s");
    expect(new FormData(form).get("size")).toBe("s");
  });
});

describe("lv-slider form-association + native events", () => {
  test("submits its numeric value as a string under name via FormData", async () => {
    const { form } = await mountInForm<ChoiceEl>("lv-slider", (e) => {
      e.name = "volume";
      (e as unknown as { value: number }).value = 42;
    });
    expect(new FormData(form).get("volume")).toBe("42");
  });

  test("dragging fires native input and updates FormData", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-slider", (e) => {
      e.name = "volume";
    });
    const native = recordNative(el);
    const inner = el.querySelector("input") as HTMLInputElement;
    inner.value = "70";
    inner.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect((el as unknown as { value: number }).value).toBe(70);
    expect(native.input).toBeGreaterThanOrEqual(1);
    expect(new FormData(form).get("volume")).toBe("70");
  });

  test("committing fires a native change event", async () => {
    const { el } = await mountInForm<ChoiceEl>("lv-slider", (e) => {
      e.name = "volume";
    });
    const native = recordNative(el);
    const inner = el.querySelector("input") as HTMLInputElement;
    inner.value = "55";
    inner.dispatchEvent(new Event("change", { bubbles: true }));
    await el.updateComplete;
    expect(native.change).toBeGreaterThanOrEqual(1);
    expect((el as unknown as { value: number }).value).toBe(55);
  });

  test("formResetCallback restores the initial value", async () => {
    const { form, el } = await mountInForm<ChoiceEl>("lv-slider", (e) => {
      e.name = "volume";
      (e as unknown as { value: number }).value = 10;
    });
    const inner = el.querySelector("input") as HTMLInputElement;
    inner.value = "90";
    inner.dispatchEvent(new Event("input", { bubbles: true }));
    await el.updateComplete;
    expect(new FormData(form).get("volume")).toBe("90");
    el.formResetCallback();
    await el.updateComplete;
    expect((el as unknown as { value: number }).value).toBe(10);
    expect(new FormData(form).get("volume")).toBe("10");
  });
});
