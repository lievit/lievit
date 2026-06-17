/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/checkbox/checkbox.js";
import "../registry/components/switch/switch.js";
import "../registry/components/progress/progress.js";
import "../registry/components/field/field.js";
import "../registry/components/toast/toast.js";
import "../registry/components/tooltip/tooltip.js";
import "../registry/components/select/select.js";

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
      "lv-checkbox",
      "lv-switch",
      "lv-progress",
      "lv-field",
      "lv-toast",
      "lv-tooltip",
      "lv-select",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

// ---------------------------------------------------------------------------
// lv-checkbox
// ---------------------------------------------------------------------------
describe("lv-checkbox", () => {
  test("renders a native input[type=checkbox]", async () => {
    const el = await mount("lv-checkbox");
    const input = el.querySelector("input[type=checkbox]");
    expect(input).not.toBeNull();
  });

  test("checked reflects onto the native input", async () => {
    const el = await mount<HTMLElement & { checked: boolean }>("lv-checkbox", (e) => {
      e.checked = true;
    });
    const input = el.querySelector("input") as HTMLInputElement;
    expect(input.checked).toBe(true);
  });

  test("emits bubbling lv-change with the new boolean value", async () => {
    const el = await mount("lv-checkbox");
    let detail: unknown;
    el.addEventListener("lv-change", (e) => {
      detail = (e as CustomEvent).detail;
    });
    const input = el.querySelector("input") as HTMLInputElement;
    input.checked = true;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    expect(detail).toBe(true);
  });

  test("disabled reflects onto the native input", async () => {
    const el = await mount<HTMLElement & { disabled: boolean }>("lv-checkbox", (e) => {
      e.disabled = true;
    });
    expect((el.querySelector("input") as HTMLInputElement).disabled).toBe(true);
  });

  test("label renders a visible text span", async () => {
    const el = await mount<HTMLElement & { label: string }>("lv-checkbox", (e) => {
      e.label = "Accept terms";
    });
    expect(el.querySelector(".lv-checkbox__label")?.textContent).toBe("Accept terms");
  });
});

// ---------------------------------------------------------------------------
// lv-switch
// ---------------------------------------------------------------------------
describe("lv-switch", () => {
  test("renders a button with role=switch", async () => {
    const el = await mount("lv-switch");
    const btn = el.querySelector('[role="switch"]');
    expect(btn).not.toBeNull();
  });

  test("checked maps to aria-checked=true", async () => {
    const el = await mount<HTMLElement & { checked: boolean }>("lv-switch", (e) => {
      e.checked = true;
    });
    expect(el.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("true");
  });

  test("unchecked maps to aria-checked=false", async () => {
    const el = await mount("lv-switch");
    expect(el.querySelector('[role="switch"]')?.getAttribute("aria-checked")).toBe("false");
  });

  test("click emits lv-change and toggles checked", async () => {
    const el = await mount("lv-switch");
    let detail: unknown;
    el.addEventListener("lv-change", (e) => {
      detail = (e as CustomEvent).detail;
    });
    const btn = el.querySelector("button") as HTMLButtonElement;
    btn.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(detail).toBe(true);
  });

  test("disabled prevents toggle", async () => {
    const el = await mount<HTMLElement & { checked: boolean; disabled: boolean }>("lv-switch", (e) => {
      e.disabled = true;
    });
    el.querySelector("button")?.click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect((el as HTMLElement & { checked: boolean }).checked).toBe(false);
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
// lv-field
// ---------------------------------------------------------------------------
describe("lv-field", () => {
  test("renders a native label when `label` is set", async () => {
    const el = await mount<HTMLElement & { label: string; for: string }>("lv-field", (e) => {
      e.label = "Email";
      e.for = "email-input";
    });
    const labelEl = el.querySelector("label") as HTMLLabelElement;
    expect(labelEl).not.toBeNull();
    expect(labelEl.htmlFor).toBe("email-input");
    expect(labelEl.textContent?.trim()).toContain("Email");
  });

  test("required marker is hidden from assistive tech", async () => {
    const el = await mount<HTMLElement & { label: string; required: boolean }>("lv-field", (e) => {
      e.label = "Name";
      e.required = true;
    });
    expect(el.querySelector(".lv-field__required")?.getAttribute("aria-hidden")).toBe("true");
  });

  test("error renders a role=alert span", async () => {
    const el = await mount<HTMLElement & { error: string }>("lv-field", (e) => {
      e.error = "Required field";
    });
    const errEl = el.querySelector('[role="alert"]');
    expect(errEl).not.toBeNull();
    expect(errEl?.textContent).toBe("Required field");
  });

  test("hint renders when no error is set", async () => {
    const el = await mount<HTMLElement & { hint: string }>("lv-field", (e) => {
      e.hint = "Use your work email";
    });
    expect(el.querySelector(".lv-field__hint")?.textContent).toBe("Use your work email");
  });

  test("error suppresses hint", async () => {
    const el = await mount<HTMLElement & { hint: string; error: string }>("lv-field", (e) => {
      e.hint = "Hint text";
      e.error = "Error text";
    });
    expect(el.querySelector(".lv-field__hint")).toBeNull();
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
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

// ---------------------------------------------------------------------------
// lv-select
// ---------------------------------------------------------------------------
type LvSelectEl = HTMLElement & {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value: string;
  placeholder: string;
  disabled: boolean;
};

describe("lv-select", () => {
  const opts = [
    { value: "a", label: "Alpha" },
    { value: "b", label: "Beta" },
    { value: "c", label: "Gamma", disabled: true },
  ];

  test("renders a combobox trigger and a listbox", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
    });
    expect(el.querySelector('[role="combobox"]')).not.toBeNull();
    expect(el.querySelector('[role="listbox"]')).not.toBeNull();
  });

  test("listbox is hidden by default (no --open class)", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
    });
    expect(el.querySelector(".lv-select__listbox--open")).toBeNull();
  });

  test("clicking trigger opens the listbox", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-select__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-select__listbox--open")).not.toBeNull();
    expect(el.querySelector('[role="combobox"]')?.getAttribute("aria-expanded")).toBe("true");
  });

  test("clicking an option selects it, emits lv-change, and closes", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
    });
    let changeDetail: unknown;
    el.addEventListener("lv-change", (e) => { changeDetail = (e as CustomEvent).detail; });

    // open
    (el.querySelector(".lv-select__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    // click first option
    const optEls = el.querySelectorAll('[role="option"]');
    (optEls[0] as HTMLElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    expect(changeDetail).toBe("a");
    expect(el.value).toBe("a");
    expect(el.querySelector(".lv-select__listbox--open")).toBeNull();
  });

  test("disabled option cannot be selected", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
    });
    (el.querySelector(".lv-select__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll('[role="option"]');
    (optEls[2] as HTMLElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    // value stays empty (not selected)
    expect(el.value).toBe("");
  });

  test("options have role=option and aria-selected", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
      e.value = "b";
    });
    (el.querySelector(".lv-select__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;

    const optEls = el.querySelectorAll('[role="option"]');
    expect(optEls[0].getAttribute("aria-selected")).toBe("false");
    expect(optEls[1].getAttribute("aria-selected")).toBe("true");
  });

  test("placeholder shown when no value selected", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
      e.placeholder = "Pick one";
    });
    expect(el.querySelector(".lv-select__placeholder")?.textContent).toBe("Pick one");
  });

  test("disabled prevents the listbox from opening", async () => {
    const el = await mount<LvSelectEl>("lv-select", (e) => {
      e.options = opts;
      e.disabled = true;
    });
    (el.querySelector(".lv-select__trigger") as HTMLButtonElement).click();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.querySelector(".lv-select__listbox--open")).toBeNull();
  });
});
