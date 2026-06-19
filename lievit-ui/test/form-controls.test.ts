/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * The #1 dogfood finding: the TEXT form controls were NOT form-associated and emitted only
 * `lv-*` events, so a plain POST form (or lievit-kit `l:model`, which binds native input/change)
 * dropped the field. This pins the fix for each island:
 *   - POST form-association: the island submits its value under `name` (read via FormData), and
 *     `form.reset()` returns it to its initial value (formResetCallback);
 *   - native events for l:model: a native `input` (and `change`) event fires from the element on
 *     value change, so the default `l:model` binding picks it up.
 *
 * The runtime here is happy-dom, which does NOT implement ElementInternals (proven: attachInternals
 * is undefined and FormData ignores a custom element's setFormValue). Each island therefore renders a
 * hidden `<input name>` mirror as the portable fallback, which is exactly what makes FormData work
 * both here and in browsers without ElementInternals. The same `static formAssociated` + setFormValue
 * + formResetCallback path lights up real form-association where the platform supports it.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/rich-select/rich-select.js";

interface FormControlEl extends HTMLElement {
  value: string | string[];
  name: string;
  formResetCallback(): void;
  updateComplete: Promise<unknown>;
}

/**
 * Reset the form. happy-dom does not wire `form.reset()` to a custom element's `formResetCallback`
 * (it implements no form-association), so we drive the documented form-reset entry point directly;
 * in a real browser `form.reset()` invokes exactly this callback. We deliberately do NOT call
 * `form.reset()` here: in happy-dom it is a no-op for our (unregistered) control yet mutates shared
 * document state in a way that leaks across test files, so the direct lifecycle call is both the
 * faithful and the hermetic choice.
 */
function resetForm(_form: HTMLFormElement, el: FormControlEl) {
  el.formResetCallback();
}

afterEach(() => {
  document.body.innerHTML = "";
});

/** Mount an island inside a <form>, configured by `set`; returns both. */
async function mountInForm<T extends FormControlEl>(
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

describe("lv-rich-select form-association + native events", () => {
  const options = [
    { value: "r", label: "Red" },
    { value: "g", label: "Green" },
    { value: "b", label: "Blue" },
  ];

  test("single mode submits the selected value under name via FormData", async () => {
    const { form } = await mountInForm<FormControlEl>("lv-rich-select", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "color";
      e.value = "g";
    });
    expect(new FormData(form).get("color")).toBe("g");
  });

  test("multi mode submits one FormData entry per selected value", async () => {
    const { form } = await mountInForm<FormControlEl>("lv-rich-select", (e) => {
      (e as unknown as { options: typeof options; multiple: boolean }).options = options;
      (e as unknown as { multiple: boolean }).multiple = true;
      e.name = "colors";
      e.value = ["r", "b"];
    });
    expect(new FormData(form).getAll("colors")).toEqual(["r", "b"]);
  });

  test("selecting fires native input + change and updates FormData", async () => {
    const { form, el } = await mountInForm<FormControlEl>("lv-rich-select", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "color";
    });
    const native = recordNative(el);
    (el.querySelector(".lv-rs__trigger") as HTMLElement).click();
    await el.updateComplete;
    (el.querySelectorAll(".lv-rs__option")[2] as HTMLElement).click();
    await el.updateComplete;
    expect(el.value).toBe("b");
    expect(native.input).toBeGreaterThanOrEqual(1);
    expect(native.change).toBeGreaterThanOrEqual(1);
    expect(new FormData(form).get("color")).toBe("b");
  });

  test("form.reset() returns the selection to its initial value", async () => {
    const { form, el } = await mountInForm<FormControlEl>("lv-rich-select", (e) => {
      (e as unknown as { options: typeof options }).options = options;
      e.name = "color";
      e.value = "r";
    });
    (el.querySelector(".lv-rs__trigger") as HTMLElement).click();
    await el.updateComplete;
    (el.querySelectorAll(".lv-rs__option")[1] as HTMLElement).click();
    await el.updateComplete;
    expect(new FormData(form).get("color")).toBe("g");
    resetForm(form, el);
    await el.updateComplete;
    expect(el.value).toBe("r");
    expect(new FormData(form).get("color")).toBe("r");
  });
});
