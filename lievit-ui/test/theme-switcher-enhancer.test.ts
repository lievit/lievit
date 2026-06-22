/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * theme-switcher enhancer (ADR-0012, server-first): the segmented light/dark/system control is a JTE
 * partial (a WAI-ARIA radiogroup of three real <button role=radio> options, server-owned `current`
 * painted JS-off; pinned by the source-contract suite in theme-switcher.test.ts + the real-compiler
 * jte-compile smoke). THIS suite drives the ENHANCER against a real DOM shaped like the partial's
 * server output:
 *   (1) click applies the resolved theme to <html> + persists the chosen value;
 *   (2) on load the persisted choice overrides the SSR data-current and is applied;
 *   (3) "system" follows matchMedia, including a live OS flip;
 *   (4) APG radiogroup keyboard nav (arrows wrap + select, Home/End, Space/Enter);
 *   (5) re-enhancing is idempotent -- no stacked listeners (the round-2 bug class).
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import {
  enhanceThemeSwitcher,
  enhanceAllThemeSwitchers,
} from "../registry/jte/theme-switcher.enhancer.js";

/** A controllable matchMedia mock: flip `dark`, then `flip()` to fire the registered change listeners. */
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
    setDark: (v) => {
      dark = v;
    },
    flip: () => {
      const ev = { matches: dark } as MediaQueryListEvent;
      [...listeners].forEach((l) => l(ev));
    },
    liveListenerCount: () => listeners.length,
  };
}

/** Build a DOM matching the server-rendered theme-switcher partial for a given `current`. */
function renderSwitcher(
  opts: { current?: "light" | "dark" | "system"; storageKey?: string } = {},
): HTMLElement {
  const current = opts.current ?? "system";
  const storageKey = opts.storageKey ?? "lievit-theme";
  const root = document.createElement("div");
  root.setAttribute("data-slot", "theme-switcher");
  root.setAttribute("data-lievit-theme-switcher", "");
  root.setAttribute("data-storage-key", storageKey);
  root.setAttribute("data-current", current);
  root.setAttribute("role", "radiogroup");
  root.setAttribute("aria-label", "Tema");

  for (const value of ["light", "dark", "system"] as const) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-slot", "theme-switcher-option");
    btn.setAttribute("data-theme-value", value);
    btn.setAttribute("role", "radio");
    btn.setAttribute("aria-checked", value === current ? "true" : "false");
    btn.setAttribute("aria-label", value);
    btn.setAttribute("tabindex", value === current ? "0" : "-1");
    root.appendChild(btn);
  }
  document.body.appendChild(root);
  return root;
}

const optionByValue = (root: HTMLElement, value: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-theme-value="${value}"]`)!;

const isHtmlDark = (): boolean => document.documentElement.classList.contains("dark");

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
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);

    optionByValue(root, "dark").click();

    expect(isHtmlDark()).toBe(true);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
  });

  test("clicking an option moves aria-checked + the roving tabindex + focus to it", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);

    const light = optionByValue(root, "light");
    light.click();

    expect(light.getAttribute("aria-checked")).toBe("true");
    expect(light.getAttribute("tabindex")).toBe("0");
    expect(optionByValue(root, "system").getAttribute("aria-checked")).toBe("false");
    expect(optionByValue(root, "system").getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(light);
  });

  test("clicking light leaves <html> light even when the OS prefers dark", () => {
    installMatchMedia(true); // OS = dark
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(true); // system resolved to dark on load

    optionByValue(root, "light").click();
    expect(isHtmlDark()).toBe(false); // explicit light wins over OS
  });

  test("a custom storage-key is honoured", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "system", storageKey: "ht-theme" });
    enhanceThemeSwitcher(root);
    optionByValue(root, "dark").click();
    expect(globalThis.localStorage?.getItem("ht-theme")).toBe("dark");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBeNull();
  });
});

describe("theme-switcher enhancer: load restores the persisted choice", () => {
  test("a persisted choice overrides the SSR data-current and is applied on enhance", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "dark");
    const root = renderSwitcher({ current: "system" }); // SSR said system
    enhanceThemeSwitcher(root);

    expect(isHtmlDark()).toBe(true);
    expect(optionByValue(root, "dark").getAttribute("aria-checked")).toBe("true");
    expect(optionByValue(root, "dark").getAttribute("tabindex")).toBe("0");
    expect(root.getAttribute("data-current")).toBe("dark");
  });

  test("with no persisted choice the SSR data-current is applied", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "light" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(false);
    expect(optionByValue(root, "light").getAttribute("aria-checked")).toBe("true");
  });
});

describe("theme-switcher enhancer: system follows matchMedia", () => {
  test("choosing system resolves to the current OS scheme", () => {
    installMatchMedia(true); // OS = dark
    const root = renderSwitcher({ current: "light" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(false);

    optionByValue(root, "system").click();
    expect(isHtmlDark()).toBe(true); // system => OS dark
  });

  test("a live OS flip re-resolves while system is chosen", () => {
    const mm = installMatchMedia(false); // OS = light
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);
    expect(isHtmlDark()).toBe(false);

    mm.setDark(true);
    mm.flip();
    expect(isHtmlDark()).toBe(true); // OS flipped to dark, system tracks it
  });

  test("an OS flip does NOT move the theme once an explicit choice is made", () => {
    const mm = installMatchMedia(false);
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);

    optionByValue(root, "light").click(); // explicit light, drops system tracking
    mm.setDark(true);
    mm.flip();
    expect(isHtmlDark()).toBe(false); // still light: not following the OS anymore
  });
});

describe("theme-switcher enhancer: APG radiogroup keyboard nav", () => {
  function press(root: HTMLElement, key: string): void {
    root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  test("ArrowRight moves + selects the next option, wrapping at the end", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "light" });
    enhanceThemeSwitcher(root);

    press(root, "ArrowRight"); // light -> dark
    expect(root.getAttribute("data-current")).toBe("dark");
    expect(isHtmlDark()).toBe(true);

    press(root, "ArrowRight"); // dark -> system
    expect(root.getAttribute("data-current")).toBe("system");

    press(root, "ArrowRight"); // system -> light (wrap)
    expect(root.getAttribute("data-current")).toBe("light");
  });

  test("ArrowLeft moves + selects the previous option, wrapping at the start", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "light" });
    enhanceThemeSwitcher(root);

    press(root, "ArrowLeft"); // light -> system (wrap)
    expect(root.getAttribute("data-current")).toBe("system");
  });

  test("Home selects the first option, End selects the last", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);

    press(root, "End");
    expect(root.getAttribute("data-current")).toBe("system");
    press(root, "Home");
    expect(root.getAttribute("data-current")).toBe("light");
  });

  test("Enter / Space re-select the currently focused option", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "dark" });
    enhanceThemeSwitcher(root);
    document.documentElement.classList.remove("dark"); // force a stale <html>

    press(root, "Enter"); // re-applies the current choice (dark)
    expect(isHtmlDark()).toBe(true);
    press(root, " "); // Space re-selects too (no throw, stays dark)
    expect(root.getAttribute("data-current")).toBe("dark");
  });
});

describe("theme-switcher enhancer: idempotency (the round-2 bug class)", () => {
  test("re-enhancing the same root does not stack click listeners", () => {
    installMatchMedia(false);
    const root = renderSwitcher({ current: "light" });
    enhanceThemeSwitcher(root);
    enhanceThemeSwitcher(root); // second call must be a no-op
    enhanceThemeSwitcher(root);

    // Spy on the apply target: if listeners stacked, one click toggles classList N times.
    const toggleSpy = vi.spyOn(document.documentElement.classList, "toggle");
    optionByValue(root, "dark").click();
    expect(toggleSpy).toHaveBeenCalledTimes(1);
    toggleSpy.mockRestore();
  });

  test("re-selecting system repeatedly does not stack matchMedia listeners", () => {
    const mm = installMatchMedia(false);
    const root = renderSwitcher({ current: "system" });
    enhanceThemeSwitcher(root);

    // Toggle in and out of system several times; each select tears the old listener down first.
    optionByValue(root, "system").click();
    optionByValue(root, "light").click();
    optionByValue(root, "system").click();
    optionByValue(root, "dark").click();
    optionByValue(root, "system").click();

    expect(mm.liveListenerCount()).toBe(1); // exactly one live OS listener, never an accumulation
  });

  test("enhanceAllThemeSwitchers wires every root on the page", () => {
    installMatchMedia(false);
    renderSwitcher({ current: "light", storageKey: "a" });
    renderSwitcher({ current: "light", storageKey: "b" });

    enhanceAllThemeSwitchers();

    const roots = document.querySelectorAll("[data-lievit-theme-switcher]");
    roots.forEach((r) => expect(r.hasAttribute("data-theme-switcher-enhanced")).toBe(true));
  });
});
