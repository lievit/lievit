/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */
import { describe, test, expect, beforeEach } from "vitest";
import {
  adoptLightStyles,
  resetAdoptedStylesForTest,
} from "../registry/components/light-dom/light-dom.js";

beforeEach(() => {
  resetAdoptedStylesForTest();
  document.head.querySelectorAll("[data-lievit-ui]").forEach((n) => n.remove());
  document.adoptedStyleSheets = [];
});

describe("adoptLightStyles", () => {
  test("adopts a stylesheet on first call", () => {
    const before = document.adoptedStyleSheets.length;
    adoptLightStyles("lv-x", ".lv-x{color:red}");
    expect(document.adoptedStyleSheets.length).toBe(before + 1);
  });

  test("is idempotent for the same id (no double adoption)", () => {
    adoptLightStyles("lv-y", ".lv-y{}");
    const after1 = document.adoptedStyleSheets.length;
    adoptLightStyles("lv-y", ".lv-y{}");
    expect(document.adoptedStyleSheets.length).toBe(after1);
  });

  test("adopts distinct stylesheets for distinct ids", () => {
    const before = document.adoptedStyleSheets.length;
    adoptLightStyles("lv-a", ".lv-a{}");
    adoptLightStyles("lv-b", ".lv-b{}");
    expect(document.adoptedStyleSheets.length).toBe(before + 2);
  });

  test("falls back to a <style> element where Constructable Stylesheets are absent", () => {
    const proto = CSSStyleSheet.prototype as { replaceSync?: unknown };
    const original = Object.getOwnPropertyDescriptor(proto, "replaceSync");
    // simulate a DOM without constructable sheets (the fallback branch): make the
    // capability probe see a non-function replaceSync.
    Object.defineProperty(proto, "replaceSync", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      adoptLightStyles("lv-fallback", ".lv-fallback{color:var(--lv-color-fg)}");
      const style = document.head.querySelector('[data-lievit-ui="lv-fallback"]');
      expect(style).not.toBeNull();
      expect(style?.textContent).toContain("--lv-color-fg");
    } finally {
      if (original) {
        Object.defineProperty(proto, "replaceSync", original);
      }
    }
  });
});
