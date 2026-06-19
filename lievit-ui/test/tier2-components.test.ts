/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
import "../registry/components/toast/toast.js";

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

describe("tier-2 light DOM", () => {
  test("every tier-2 primitive renders into the light DOM (no shadow root to pierce)", async () => {
    for (const tag of ["lv-toast"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
  });
});

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
