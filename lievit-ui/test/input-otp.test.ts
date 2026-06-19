/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * <lv-input-otp> (issue #447): segmented one-time-code input. Pins the value/form contract,
 * typing + auto-advance, paste-fill, backspace navigation, character filtering, and ARIA.
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/input-otp/input-otp.js";

type OtpEl = HTMLElement & {
  length: number;
  value: string;
  type: "numeric" | "alphanumeric" | "alpha";
  name: string;
  mask: boolean;
  disabled: boolean;
  invalid: boolean;
  updateComplete: Promise<unknown>;
};

async function mount(set?: (el: OtpEl) => void): Promise<OtpEl> {
  const el = document.createElement("lv-input-otp") as OtpEl;
  set?.(el);
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
}

function slots(el: OtpEl): HTMLInputElement[] {
  return Array.from(el.querySelectorAll<HTMLInputElement>(".lv-otp__slot"));
}

/** Simulate typing one character into a slot (sets value then fires input). */
async function typeInto(el: OtpEl, index: number, ch: string) {
  const input = slots(el)[index];
  input.value = ch;
  input.dispatchEvent(new InputEvent("input", { bubbles: true }));
  await el.updateComplete;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("lv-input-otp light DOM + structure", () => {
  test("renders into the light DOM (no shadow root)", async () => {
    const el = await mount();
    expect(el.shadowRoot).toBeNull();
  });

  test("renders `length` slots inside a role=group", async () => {
    const el = await mount((e) => { e.length = 4; });
    expect(slots(el).length).toBe(4);
    expect(el.querySelector('[role="group"]')).not.toBeNull();
  });

  test("each slot is aria-labelled Character N of M", async () => {
    const el = await mount((e) => { e.length = 3; });
    const labels = slots(el).map((s) => s.getAttribute("aria-label"));
    expect(labels).toEqual(["Character 1 of 3", "Character 2 of 3", "Character 3 of 3"]);
  });

  test("first slot advertises autocomplete=one-time-code", async () => {
    const el = await mount();
    expect(slots(el)[0].getAttribute("autocomplete")).toBe("one-time-code");
    expect(slots(el)[1].getAttribute("autocomplete")).toBe("off");
  });

  test("a hidden input mirrors the value under the given name (form submission)", async () => {
    const el = await mount((e) => { e.name = "otp"; e.value = "123"; });
    const hidden = el.querySelector('input[type="hidden"]') as HTMLInputElement;
    expect(hidden.name).toBe("otp");
    expect(hidden.value).toBe("123");
  });

  test("submits its value under name via FormData inside a form", async () => {
    const form = document.createElement("form");
    const el = await mount((e) => { e.name = "otp"; e.value = "456"; });
    form.appendChild(el);
    document.body.appendChild(form);
    await el.updateComplete;
    expect(new FormData(form).get("otp")).toBe("456");
  });

  test("form.reset() returns the value to its initial value (formResetCallback)", async () => {
    const form = document.createElement("form");
    const el = await mount((e) => { e.length = 3; e.name = "otp"; e.value = "12"; });
    form.appendChild(el);
    document.body.appendChild(form);
    await el.updateComplete;
    await typeInto(el, 2, "3");
    expect(el.value).toBe("123");
    // happy-dom does not wire form.reset() to a custom element's formResetCallback (no form-association
    // support), so drive the documented reset entry point directly; a real browser calls it on reset.
    (el as unknown as { formResetCallback(): void }).formResetCallback();
    await el.updateComplete;
    expect(el.value).toBe("12");
    expect(new FormData(form).get("otp")).toBe("12");
  });
});

describe("lv-input-otp typing + value", () => {
  test("typing a digit fills the slot, emits lv-input, advances focus", async () => {
    const el = await mount((e) => { e.length = 4; });
    let lastInput = "";
    el.addEventListener("lv-input", (ev) => { lastInput = (ev as CustomEvent).detail; });
    await typeInto(el, 0, "5");
    expect(el.value).toBe("5");
    expect(lastInput).toBe("5");
    expect(document.activeElement).toBe(slots(el)[1]);
  });

  test("typing fires a native input event (l:model binds)", async () => {
    const el = await mount((e) => { e.length = 4; });
    let nativeInputs = 0;
    el.addEventListener("input", () => nativeInputs++);
    await typeInto(el, 0, "7");
    expect(nativeInputs).toBeGreaterThanOrEqual(1);
  });

  test("completing the code fires a native change event (l:model.lazy binds)", async () => {
    const el = await mount((e) => { e.length = 2; });
    let nativeChanges = 0;
    el.addEventListener("change", () => nativeChanges++);
    await typeInto(el, 0, "1");
    await typeInto(el, 1, "2");
    expect(nativeChanges).toBeGreaterThanOrEqual(1);
  });

  test("filling every slot emits lv-complete once with the full value", async () => {
    const el = await mount((e) => { e.length = 3; });
    const completed: string[] = [];
    el.addEventListener("lv-complete", (ev) => { completed.push((ev as CustomEvent).detail); });
    await typeInto(el, 0, "1");
    await typeInto(el, 1, "2");
    await typeInto(el, 2, "3");
    expect(el.value).toBe("123");
    expect(completed).toEqual(["123"]);
  });

  test("numeric type rejects non-digits (slot restored, value unchanged)", async () => {
    const el = await mount((e) => { e.length = 4; e.type = "numeric"; });
    await typeInto(el, 0, "a");
    expect(el.value).toBe("");
    expect(slots(el)[0].value).toBe("");
  });

  test("alpha type accepts a letter", async () => {
    const el = await mount((e) => { e.length = 4; e.type = "alpha"; });
    await typeInto(el, 0, "q");
    expect(el.value).toBe("q");
  });
});

describe("lv-input-otp paste-fill", () => {
  test("pasting distributes filtered characters across slots from the focused one", async () => {
    const el = await mount((e) => { e.length = 6; e.type = "numeric"; });
    let lastInput = "";
    el.addEventListener("lv-input", (ev) => { lastInput = (ev as CustomEvent).detail; });
    const dt = new DataTransfer();
    dt.setData("text", "12-34-56");
    slots(el)[0].dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).toBe("123456");
    expect(lastInput).toBe("123456");
  });

  test("paste into the middle starts filling at the focused slot", async () => {
    const el = await mount((e) => { e.length = 6; e.value = "12"; e.type = "numeric"; });
    const dt = new DataTransfer();
    dt.setData("text", "9999");
    slots(el)[2].dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).toBe("129999");
  });
});

describe("lv-input-otp keyboard navigation", () => {
  test("Backspace on a filled slot clears it", async () => {
    const el = await mount((e) => { e.length = 4; e.value = "12"; });
    slots(el)[1].dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).toBe("1");
  });

  test("Backspace on an empty slot steps back and clears the previous", async () => {
    const el = await mount((e) => { e.length = 4; e.value = "12"; });
    slots(el)[2].dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(el.value).toBe("1");
    expect(document.activeElement).toBe(slots(el)[1]);
  });

  test("ArrowRight / ArrowLeft move focus between slots", async () => {
    const el = await mount((e) => { e.length = 4; });
    slots(el)[0].focus();
    slots(el)[0].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(document.activeElement).toBe(slots(el)[1]);
    slots(el)[1].dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true, cancelable: true }));
    await el.updateComplete;
    expect(document.activeElement).toBe(slots(el)[0]);
  });
});

describe("lv-input-otp states", () => {
  test("disabled disables every slot", async () => {
    const el = await mount((e) => { e.disabled = true; });
    expect(slots(el).every((s) => s.disabled)).toBe(true);
  });

  test("invalid sets aria-invalid on the group", async () => {
    const el = await mount((e) => { e.invalid = true; });
    expect(el.querySelector('[role="group"]')?.getAttribute("aria-invalid")).toBe("true");
  });

  test("mask renders password slots", async () => {
    const el = await mount((e) => { e.mask = true; });
    expect(slots(el).every((s) => s.type === "password")).toBe(true);
  });
});
