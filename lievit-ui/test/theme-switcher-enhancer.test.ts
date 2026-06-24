/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * theme-switcher enhancer (v-next, ADR-0012 server-first): selection applies + persists.
 *
 * v-next re-forge (Wave 4): the ARIA model changed from role=radiogroup / aria-checked /
 * data-theme-value to role=toolbar / aria-pressed / data-theme-option. applyTheme now sets
 * data-theme only (no .dark class toggle). The full new-surface contract is pinned by
 * test/theme-switcher-vnext.test.ts (all behavioural scenarios for the toolbar and
 * icon-labeled variants + keyboard + matchMedia + idempotency).
 *
 * THIS file: updated to the new DOM shape (aria-pressed / data-theme-option / data-theme)
 * so the legacy exports (enhanceThemeSwitcher, enhanceAllThemeSwitchers) are exercised
 * against the correct v-next DOM. Assertions that were specific to the old anti-patterns
 * (classList.toggle(".dark"), role=radio, aria-checked) are updated to the new correct
 * behavior with comments noting the deliberate removal.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  enhanceThemeSwitcher,
  enhanceAllThemeSwitchers,
} from "../registry/jte/theme-switcher.enhancer.js";

/** A controllable matchMedia mock. */
function installMatchMedia(initialDark: boolean): {
  setDark(v: boolean): void;
  flip(): void;
  liveListenerCount(): number;
} {
  let dark = initialDark;
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    media,
    get matches() {
      return dark;
    },
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.push(cb);
    },
    removeEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners = listeners.filter((l) => l !== cb);
    },
  })) as unknown as typeof window.matchMedia;
  return {
    setDark: (v) => { dark = v; },
    flip: () => {
      const ev = { matches: dark } as MediaQueryListEvent;
      [...listeners].forEach((l) => l(ev));
    },
    liveListenerCount: () => listeners.length,
  };
}

/**
 * Build a DOM matching the v-next server-rendered theme-switcher partial (toolbar variant).
 * v-next DOM shape: role=toolbar, aria-pressed buttons, data-theme-option, data-lievit-enhancer.
 */
function renderSwitcher(
  opts: {
    defaultTheme?: "light" | "dark" | "system";
    storageKey?: string;
    showSystem?: boolean;
  } = {},
): HTMLElement {
  const defaultTheme = opts.defaultTheme ?? "system";
  const storageKey = opts.storageKey ?? "lievit-theme";
  const showSystem = opts.showSystem !== false;

  const root = document.createElement("div");
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Theme");
  root.setAttribute("data-slot", "theme-switcher");
  root.setAttribute("data-lievit-enhancer", "theme-switcher");
  root.setAttribute("data-variant", "icon");
  root.setAttribute("data-size", "md");
  root.setAttribute("data-storage-key", storageKey);
  root.setAttribute("data-root-selector", "html");
  root.setAttribute("data-default-theme", defaultTheme);
  root.setAttribute("data-show-system", String(showSystem));
  root.style.display = "none";

  const options: Array<{ option: "light" | "dark" | "system"; label: string }> = [
    { option: "light", label: "Light" },
    { option: "dark", label: "Dark" },
    ...(showSystem ? [{ option: "system" as const, label: "System" }] : []),
  ];
  for (const { option, label } of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-theme-option", option);
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("tabindex", "-1");
    root.appendChild(btn);
  }
  document.body.appendChild(root);
  return root;
}

const optionByOption = (root: HTMLElement, option: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-theme-option="${option}"]`)!;

/** v-next: theme is applied via data-theme attribute (not .dark class). */
const htmlTheme = (): string | null => document.documentElement.getAttribute("data-theme");
const isHtmlDark = (): boolean => htmlTheme() === "dark";

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* no storage */
  }
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.classList.remove("dark");
  document.documentElement.removeAttribute("data-theme");
});

describe("theme-switcher enhancer: selection applies + persists", () => {
  test("clicking the dark option applies the dark theme to <html> and persists the choice", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "system" });
    enhanceThemeSwitcher(root);

    optionByOption(root, "dark").click();

    // v-next: applyTheme sets data-theme (not .dark class toggle -- the old anti-pattern is corrected)
    expect(htmlTheme()).toBe("dark");
    expect(isHtmlDark()).toBe(true);
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
  });

  test("clicking an option moves aria-pressed + the roving tabindex + focus to it", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "system" });
    enhanceThemeSwitcher(root);

    const light = optionByOption(root, "light");
    light.click();

    // v-next: aria-pressed (not aria-checked) is the correct APG Toggle Button state attribute
    expect(light.getAttribute("aria-pressed")).toBe("true");
    expect(light.getAttribute("tabindex")).toBe("0");
    expect(optionByOption(root, "system").getAttribute("aria-pressed")).toBe("false");
    expect(optionByOption(root, "system").getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(light);
  });

  test("clicking light leaves <html> light even when the OS prefers dark", () => {
    installMatchMedia(true); // OS = dark
    const root = renderSwitcher({ defaultTheme: "system" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(true); // system resolved to dark on load

    optionByOption(root, "light").click();
    expect(isHtmlDark()).toBe(false); // explicit light wins over OS
    expect(htmlTheme()).toBe("light");
  });

  test("a custom storage-key is honoured", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "system", storageKey: "ht-theme" });
    enhanceThemeSwitcher(root);
    optionByOption(root, "dark").click();
    expect(globalThis.localStorage?.getItem("ht-theme")).toBe("dark");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBeNull();
  });
});

describe("theme-switcher enhancer: load restores the persisted choice", () => {
  test("a persisted choice overrides the SSR data-default-theme and is applied on enhance", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "dark");
    const root = renderSwitcher({ defaultTheme: "system" }); // default said system
    enhanceThemeSwitcher(root);

    expect(isHtmlDark()).toBe(true);
    expect(optionByOption(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(optionByOption(root, "dark").getAttribute("tabindex")).toBe("0");
  });
});

describe("theme-switcher enhancer: system follows matchMedia", () => {
  test("choosing system resolves to the current OS scheme", () => {
    installMatchMedia(true); // OS = dark
    const root = renderSwitcher({ defaultTheme: "light" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(false);

    optionByOption(root, "system").click();
    expect(isHtmlDark()).toBe(true); // system => OS dark
    expect(htmlTheme()).toBe("dark");
  });

  test("a live OS flip re-resolves while system is chosen", () => {
    const mm = installMatchMedia(false); // OS = light
    const root = renderSwitcher({ defaultTheme: "system" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(false);

    mm.setDark(true);
    mm.flip();
    expect(isHtmlDark()).toBe(true); // OS flipped to dark, system tracks it
  });
});

describe("theme-switcher enhancer: APG radiogroup keyboard nav", () => {
  function press(root: HTMLElement, key: string): void {
    root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  test("ArrowRight moves + selects the next option, wrapping at the end", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "light" });
    enhanceThemeSwitcher(root);

    optionByOption(root, "light").focus();
    press(root, "ArrowRight"); // light -> dark
    expect(htmlTheme()).toBe("dark");
    expect(optionByOption(root, "dark").getAttribute("aria-pressed")).toBe("true");

    optionByOption(root, "dark").focus();
    press(root, "ArrowRight"); // dark -> system
    expect(optionByOption(root, "system").getAttribute("aria-pressed")).toBe("true");

    optionByOption(root, "system").focus();
    press(root, "ArrowRight"); // system -> light (wrap)
    expect(optionByOption(root, "light").getAttribute("aria-pressed")).toBe("true");
    expect(htmlTheme()).toBe("light");
  });

  test("ArrowLeft moves + selects the previous option, wrapping at the start", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "light" });
    enhanceThemeSwitcher(root);

    optionByOption(root, "light").focus();
    press(root, "ArrowLeft"); // light -> system (wrap)
    expect(optionByOption(root, "system").getAttribute("aria-pressed")).toBe("true");
  });

  test("Home selects the first option, End selects the last", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "system" });
    enhanceThemeSwitcher(root);

    optionByOption(root, "system").focus();
    press(root, "End");
    expect(optionByOption(root, "system").getAttribute("aria-pressed")).toBe("true");

    optionByOption(root, "system").focus();
    press(root, "Home");
    expect(optionByOption(root, "light").getAttribute("aria-pressed")).toBe("true");
    expect(htmlTheme()).toBe("light");
  });

  test("Enter / Space re-select the currently focused option", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "dark" });
    enhanceThemeSwitcher(root);
    document.documentElement.removeAttribute("data-theme"); // force a stale <html>

    optionByOption(root, "dark").focus();
    press(root, "Enter"); // re-applies the current choice (dark)
    expect(isHtmlDark()).toBe(true);
    press(root, " "); // Space re-selects too (no throw, stays dark)
    expect(htmlTheme()).toBe("dark");
  });
});

describe("theme-switcher enhancer: idempotency (the round-2 bug class)", () => {
  test("re-enhancing the same root does not stack click listeners", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ defaultTheme: "light" });
    enhanceThemeSwitcher(root);
    enhanceThemeSwitcher(root); // second call must be a no-op
    enhanceThemeSwitcher(root);

    // Spy on the apply target: if listeners stacked, one click calls setAttribute N times.
    // v-next: applyTheme calls el.setAttribute("data-theme", resolved) — not classList.toggle.
    const spy = vi.spyOn(document.documentElement, "setAttribute");
    optionByOption(root, "dark").click();
    const themeCalls = spy.mock.calls.filter(([attr]) => attr === "data-theme");
    expect(themeCalls.length, "setAttribute(data-theme) must be called exactly once").toBe(1);
    spy.mockRestore();
  });

  test("enhanceAllThemeSwitchers wires every root on the page", () => {
    installMatchMedia(false);
    renderSwitcher({ defaultTheme: "light", storageKey: "a" });
    renderSwitcher({ defaultTheme: "light", storageKey: "b" });

    enhanceAllThemeSwitchers();

    // v-next: the enhanced-mark attribute is data-theme-switcher-v2-enhanced
    const roots = document.querySelectorAll("[data-lievit-enhancer='theme-switcher']");
    roots.forEach((r) => expect(r.hasAttribute("data-theme-switcher-v2-enhanced")).toBe(true));
  });
});
