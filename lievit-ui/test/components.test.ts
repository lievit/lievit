/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, afterEach } from "vitest";
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
    for (const tag of ["lv-badge"]) {
      const el = await mount(tag);
      expect(el.shadowRoot, `${tag} must be light-DOM`).toBeNull();
    }
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
