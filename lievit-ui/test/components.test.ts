/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/button/button.js";
import "../registry/components/input/input.js";
import "../registry/components/textarea/textarea.js";
import "../registry/components/label/label.js";
import "../registry/components/badge/badge.js";
import "../registry/components/card/card.js";
import "../registry/components/separator/separator.js";
import "../registry/components/spinner/spinner.js";
import "../registry/components/alert/alert.js";

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
      "lv-button",
      "lv-input",
      "lv-textarea",
      "lv-label",
      "lv-badge",
      "lv-card",
      "lv-separator",
      "lv-spinner",
      "lv-alert",
    ]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

describe("lv-button", () => {
  test("renders a native button carrying the role for free", async () => {
    const el = await mount("lv-button");
    const btn = el.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.tagName).toBe("BUTTON");
  });

  test("variant maps to a token class", async () => {
    const el = await mount<HTMLElement & { variant: string }>("lv-button", (e) => {
      e.variant = "danger";
    });
    expect(el.querySelector("button")?.classList.contains("lv-btn--danger")).toBe(true);
  });

  test("disabled reflects onto the native button", async () => {
    const el = await mount<HTMLElement & { disabled: boolean }>("lv-button", (e) => {
      e.disabled = true;
    });
    expect((el.querySelector("button") as HTMLButtonElement).disabled).toBe(true);
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

describe("lv-card", () => {
  test("with a heading is a labelled region", async () => {
    const el = await mount<HTMLElement & { heading: string }>("lv-card", (e) => {
      e.heading = "Listings";
    });
    const region = el.querySelector('[role="region"]') as HTMLElement;
    expect(region).not.toBeNull();
    const labelledBy = region.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(el.querySelector(`#${labelledBy}`)?.textContent).toBe("Listings");
  });

  test("without a heading carries no region role", async () => {
    const el = await mount("lv-card");
    expect(el.querySelector('[role="region"]')).toBeNull();
  });
});

describe("lv-separator", () => {
  test("carries role=separator and orientation", async () => {
    const el = await mount<HTMLElement & { orientation: string }>("lv-separator", (e) => {
      e.orientation = "vertical";
    });
    const sep = el.querySelector('[role="separator"]') as HTMLElement;
    expect(sep.getAttribute("aria-orientation")).toBe("vertical");
  });
});

describe("lv-spinner", () => {
  test("carries role=status and an accessible label", async () => {
    const el = await mount<HTMLElement & { label: string }>("lv-spinner", (e) => {
      e.label = "Saving";
    });
    const status = el.querySelector('[role="status"]') as HTMLElement;
    expect(status.getAttribute("aria-label")).toBe("Saving");
  });
});

describe("lv-alert", () => {
  test("danger is assertive (role=alert)", async () => {
    const el = await mount<HTMLElement & { variant: string }>("lv-alert", (e) => {
      e.variant = "danger";
    });
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
  });

  test("info is polite (role=status)", async () => {
    const el = await mount<HTMLElement & { variant: string }>("lv-alert", (e) => {
      e.variant = "info";
    });
    expect(el.querySelector('[role="status"]')).not.toBeNull();
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  test("renders the heading when set", async () => {
    const el = await mount<HTMLElement & { heading: string }>("lv-alert", (e) => {
      e.heading = "Saved";
    });
    expect(el.querySelector(".lv-alert__heading")?.textContent).toBe("Saved");
  });
});
