/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * lv-theme-switcher Stimulus controller -- the conversion exemplar's sibling for a FULLY
 * UNCONTROLLED, ZERO-WIRE component (the conversion of registry/jte/theme-switcher.enhancer.ts).
 *
 * Like the popover suite, it runs against the REAL @hotwired/stimulus Application started by
 * startStimulus() (controllers auto-load by filename) + the REAL lievit wire morph -- no mocked
 * $lievit, no mocked runtime. A fetch stub captures the actual `_calls` the runtime would POST, so
 * the uncontrolled doctrine ("a theme switch NEVER round-trips the wire") is proven, not asserted by
 * inspection: `calls.length === 0` after every click, keyboard activation, and cycle.
 *
 * It mirrors the old enhancer suites (theme-switcher-vnext.test.ts / theme-switcher-enhancer.test.ts)
 * scenario-for-scenario -- mount/display-guard, data-theme apply, persisted-overrides-default,
 * aria-pressed + roving tabindex, click, custom storageKey, system + matchMedia (mount-resolve,
 * OS-flip-while-system, OS-flip-ignored-after-explicit), APG keyboard, two-state, icon-labeled
 * cycling + label update -- and ADDS the proofs the enhancer test could not state: that Stimulus's
 * connect/disconnect makes idempotency + listener-cleanup FREE across a real morph (one gesture =>
 * one effect; a morphed-out root fires nothing and leaks no matchMedia listener).
 *
 * Substrate: happy-dom + flushStimulus() awaits the MutationObserver after startStimulus()/morph.
 */
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";

import { LievitRuntime } from "../runtime/runtime.js";
import { morph } from "../runtime/morph.js";
import { startStimulus, stopStimulus, flushStimulus } from "../runtime/stimulus/application.js";

// ---------------------------------------------------------------------------
// Substrate: a real runtime whose fetch stub records the wire calls.
// ---------------------------------------------------------------------------

function makeRuntime(): { runtime: LievitRuntime; calledActions: string[] } {
  const calledActions: string[] = [];
  const fetchImpl = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse((init?.body as string) ?? "{}") as Record<string, unknown>;
    const calls = body._calls as string[] | undefined;
    if (calls) {
      calledActions.push(...calls);
    }
    return new Response("<div></div>", { status: 200, headers: { "Lievit-Snapshot": "s2" } });
  });
  const runtime = new LievitRuntime({ fetchImpl: fetchImpl as unknown as typeof fetch });
  return { runtime, calledActions };
}

/** A controllable matchMedia mock -- flip `dark`, fire listeners with `flip()`, count live listeners. */
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

// ---------------------------------------------------------------------------
// Builders: DOM shaped EXACTLY as theme-switcher.jte emits it (data-controller +
// data-action + data-theme-option). The controller binds off these in the real app.
// ---------------------------------------------------------------------------

function applyCommonAttrs(
  el: HTMLElement,
  opts: {
    variant: string;
    storageKey: string;
    rootSelector: string;
    defaultTheme: string;
    showSystem: boolean;
  },
): void {
  el.setAttribute("data-slot", "theme-switcher");
  el.setAttribute("data-controller", "lv-theme-switcher");
  el.setAttribute("data-lievit-enhancer", "theme-switcher");
  el.setAttribute("data-variant", opts.variant);
  el.setAttribute("data-size", "md");
  el.setAttribute("data-storage-key", opts.storageKey);
  el.setAttribute("data-root-selector", opts.rootSelector);
  el.setAttribute("data-default-theme", opts.defaultTheme);
  el.setAttribute("data-show-system", String(opts.showSystem));
  el.style.display = "none";
}

function buildToolbar(
  opts: {
    variant?: "icon" | "labeled";
    storageKey?: string;
    rootSelector?: string;
    defaultTheme?: "light" | "dark" | "system";
    showSystem?: boolean;
    parent?: ParentNode;
  } = {},
): HTMLElement {
  const {
    variant = "icon",
    storageKey = "lievit-theme",
    rootSelector = "html",
    defaultTheme = "system",
    showSystem = true,
    parent = document.body,
  } = opts;

  const root = document.createElement("div");
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Theme");
  applyCommonAttrs(root, { variant, storageKey, rootSelector, defaultTheme, showSystem });
  root.setAttribute("data-action", "keydown->lv-theme-switcher#handleKey");

  const options: Array<{ option: "light" | "dark" | "system"; label: string }> = [
    { option: "light", label: "Light" },
    { option: "dark", label: "Dark" },
    ...(showSystem ? [{ option: "system" as const, label: "System" }] : []),
  ];
  for (const { option, label } of options) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.setAttribute("data-theme-option", option);
    btn.setAttribute("data-action", "click->lv-theme-switcher#select");
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-pressed", "false");
    btn.setAttribute("tabindex", "-1");
    root.appendChild(btn);
  }
  parent.appendChild(root);
  return root;
}

function buildIconLabeled(
  opts: {
    storageKey?: string;
    rootSelector?: string;
    defaultTheme?: "light" | "dark" | "system";
    showSystem?: boolean;
    parent?: ParentNode;
  } = {},
): HTMLButtonElement {
  const {
    storageKey = "lievit-theme",
    rootSelector = "html",
    defaultTheme = "system",
    showSystem = true,
    parent = document.body,
  } = opts;

  const root = document.createElement("button");
  root.type = "button";
  applyCommonAttrs(root, {
    variant: "icon-labeled",
    storageKey,
    rootSelector,
    defaultTheme,
    showSystem,
  });
  root.setAttribute("data-action", "click->lv-theme-switcher#cycle");
  root.setAttribute("aria-pressed", "false");
  const initLabel = defaultTheme === "dark" ? "Dark" : defaultTheme === "light" ? "Light" : "System";
  root.setAttribute("aria-label", initLabel);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "lv-icon");
  svg.setAttribute("aria-hidden", "true");
  root.appendChild(svg);

  const span = document.createElement("span");
  span.setAttribute("data-slot", "theme-switcher-label");
  span.setAttribute("aria-live", "polite");
  span.textContent = initLabel;
  root.appendChild(span);

  parent.appendChild(root);
  return root;
}

const optBtn = (root: HTMLElement, option: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-theme-option="${option}"]`)!;
const htmlTheme = (): string | null => document.documentElement.getAttribute("data-theme");
const htmlHasDarkClass = (): boolean => document.documentElement.classList.contains("dark");
const press = (root: HTMLElement, key: string): void =>
  void root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
const settle = (): Promise<unknown> => new Promise((r) => setTimeout(r, 10));

beforeEach(() => {
  document.body.innerHTML = "";
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* no storage */
  }
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  stopStimulus();
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

describe("lv-theme-switcher — connect / display guard (real Stimulus)", () => {
  it("connect removes the display:none guard (root becomes visible)", async () => {
    installMatchMedia(false);
    const root = buildToolbar();
    expect(root.style.display).toBe("none");
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(root.style.display).not.toBe("none");
  });

  it("connect applies data-theme to <html> (never a class toggle)", async () => {
    installMatchMedia(false);
    buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("light");
    expect(htmlHasDarkClass(), "must NOT toggle .dark class").toBe(false);
  });

  it("connect: defaultTheme=dark applies data-theme=dark", async () => {
    installMatchMedia(false);
    buildToolbar({ defaultTheme: "dark" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("dark");
  });

  it("connect: system resolves via matchMedia (OS dark) => data-theme=dark", async () => {
    installMatchMedia(true);
    buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("dark");
  });

  it("connect: a persisted localStorage value overrides defaultTheme", async () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "dark");
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("dark");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
  });

  it("connect: aria-pressed=true on the active button, false on the others", async () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "system");
    const root = buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("false");
  });

  it("connect: roving tabindex — active button 0, others -1", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(optBtn(root, "light").getAttribute("tabindex")).toBe("0");
    expect(optBtn(root, "dark").getAttribute("tabindex")).toBe("-1");
    expect(optBtn(root, "system").getAttribute("tabindex")).toBe("-1");
  });
});

describe("lv-theme-switcher — click handling (real data-action)", () => {
  it("clicking dark sets aria-pressed + data-theme + persists", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "dark").click();
    expect(htmlTheme()).toBe("dark");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
  });

  it("clicking a button moves the roving tabindex + focus to it", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "light").click();
    expect(optBtn(root, "light").getAttribute("tabindex")).toBe("0");
    expect(optBtn(root, "system").getAttribute("tabindex")).toBe("-1");
    expect(htmlTheme()).toBe("light");
    expect(document.activeElement).toBe(optBtn(root, "light"));
  });

  it("clicking light leaves <html> light even when the OS prefers dark", async () => {
    installMatchMedia(true); // OS = dark
    const root = buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("dark"); // system resolved to dark on connect

    optBtn(root, "light").click();
    expect(htmlTheme()).toBe("light"); // explicit light wins over OS
  });

  it("a custom storage-key is honoured", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light", storageKey: "ht-theme" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "dark").click();
    expect(globalThis.localStorage?.getItem("ht-theme")).toBe("dark");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBeNull();
  });
});

describe("lv-theme-switcher — system + matchMedia", () => {
  it("system resolves to the current OS scheme on connect", async () => {
    installMatchMedia(true);
    buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("dark");
  });

  it("a live OS flip re-resolves while system is chosen", async () => {
    const mm = installMatchMedia(false);
    buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(htmlTheme()).toBe("light");

    mm.setDark(true);
    mm.flip();
    expect(htmlTheme()).toBe("dark");
  });

  it("an OS flip does NOT move the theme after an explicit choice", async () => {
    const mm = installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "system" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "light").click(); // explicit light
    mm.setDark(true);
    mm.flip();
    expect(htmlTheme()).toBe("light");
  });
});

describe("lv-theme-switcher — APG Toolbar keyboard navigation", () => {
  it("ArrowRight moves + activates the next option, wrapping at the end", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "light").focus();
    press(root, "ArrowRight"); // light -> dark
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(htmlTheme()).toBe("dark");

    optBtn(root, "dark").focus();
    press(root, "ArrowRight"); // dark -> system
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");

    optBtn(root, "system").focus();
    press(root, "ArrowRight"); // system -> light (wrap)
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("true");
    expect(htmlTheme()).toBe("light");
  });

  it("ArrowLeft moves + activates the previous option, wrapping at the start", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "light").focus();
    press(root, "ArrowLeft"); // light -> system (wrap)
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
  });

  it("Home selects the first option, End selects the last", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "dark" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "dark").focus();
    press(root, "Home");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("true");

    optBtn(root, "light").focus();
    press(root, "End");
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
  });

  it("Enter / Space re-select the currently focused option", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "dark" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    document.documentElement.removeAttribute("data-theme"); // force a stale <html>

    optBtn(root, "dark").focus();
    press(root, "Enter");
    expect(htmlTheme()).toBe("dark");
    document.documentElement.removeAttribute("data-theme");
    press(root, " ");
    expect(htmlTheme()).toBe("dark");
  });
});

describe("lv-theme-switcher — two-state (showSystem=false)", () => {
  it("only light and dark options are present", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light", showSystem: false });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(optBtn(root, "light")).toBeTruthy();
    expect(optBtn(root, "dark")).toBeTruthy();
    expect(root.querySelector('[data-theme-option="system"]')).toBeNull();
  });

  it("ArrowRight wraps light -> dark -> light (two-state)", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light", showSystem: false });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    optBtn(root, "light").focus();
    press(root, "ArrowRight"); // light -> dark
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    optBtn(root, "dark").focus();
    press(root, "ArrowRight"); // dark -> light (wrap, only 2 options)
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("lv-theme-switcher — icon-labeled single-button variant", () => {
  it("click cycles light -> dark -> system -> light (three-state)", async () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = buildIconLabeled({ defaultTheme: "light", showSystem: true });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    expect(root.getAttribute("aria-label")).toBe("Light");
    root.click(); // -> dark
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
    expect(root.getAttribute("aria-label")).toBe("Dark");
    expect(htmlTheme()).toBe("dark");
    root.click(); // -> system
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("system");
    expect(root.getAttribute("aria-label")).toBe("System");
    root.click(); // -> light (wrap)
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("light");
    expect(root.getAttribute("aria-label")).toBe("Light");
  });

  it("click cycles light -> dark -> light only when showSystem=false", async () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = buildIconLabeled({ defaultTheme: "light", showSystem: false });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    root.click(); // light -> dark
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
    root.click(); // dark -> light (wrap; system excluded)
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("light");
  });

  it("the label span text updates on each cycle", async () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = buildIconLabeled({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    const span = root.querySelector<HTMLElement>("[data-slot='theme-switcher-label']")!;
    expect(span.textContent).toBe("Light");
    root.click(); // -> dark
    expect(span.textContent).toBe("Dark");
    root.click(); // -> system
    expect(span.textContent).toBe("System");
  });

  it("connect removes display:none on the single button", async () => {
    installMatchMedia(false);
    const root = buildIconLabeled({ defaultTheme: "light" });
    expect(root.style.display).toBe("none");
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();
    expect(root.style.display).not.toBe("none");
  });
});

describe("lv-theme-switcher — uncontrolled doctrine (ZERO wire round-trip)", () => {
  it("no click / keyboard / cycle ever POSTs to the wire (calls stay empty)", async () => {
    const mm = installMatchMedia(false);
    const { runtime, calledActions } = makeRuntime();
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime });
    await flushStimulus();

    optBtn(root, "dark").click();
    optBtn(root, "system").focus();
    press(root, "ArrowRight");
    press(root, "Home");
    mm.setDark(true);
    mm.flip();

    await settle();
    expect(calledActions).toHaveLength(0);
  });

  it("the icon-labeled cycle never POSTs to the wire", async () => {
    installMatchMedia(false);
    const { runtime, calledActions } = makeRuntime();
    const root = buildIconLabeled({ defaultTheme: "light" });
    startStimulus({ runtime });
    await flushStimulus();

    root.click();
    root.click();
    root.click();

    await settle();
    expect(calledActions).toHaveLength(0);
  });
});

describe("lv-theme-switcher — morph-safety (real lievit morph)", () => {
  it("after a real morph, one click = one effect (no stacked listeners)", async () => {
    installMatchMedia(false);
    const root = buildToolbar({ defaultTheme: "light" });
    startStimulus({ runtime: makeRuntime().runtime });
    await flushStimulus();

    // A real wire morph re-renders the subtree (idiomorph). The markup is identical, so the
    // controller must NOT be double-connected and the click action must stay single-bound.
    morph(root, root.outerHTML);
    await flushStimulus();

    const spy = vi.spyOn(document.documentElement, "setAttribute");
    optBtn(root, "dark").click();
    const themeCalls = spy.mock.calls.filter(([attr]) => attr === "data-theme");
    expect(themeCalls.length, "setAttribute(data-theme) must fire exactly once").toBe(1);
    spy.mockRestore();
  });

  it("a root removed by a morph fires nothing and leaks no matchMedia listener", async () => {
    const mm = installMatchMedia(false);
    const { runtime, calledActions } = makeRuntime();
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-lievit-component", "com.example.T");
    wrapper.setAttribute("data-lievit-snapshot", "s1");
    document.body.appendChild(wrapper);
    const root = buildToolbar({ defaultTheme: "system", parent: wrapper });
    startStimulus({ runtime });
    await flushStimulus();
    expect(mm.liveListenerCount(), "system => one matchMedia listener live").toBe(1);

    // Morph the switcher OUT of the tree: Stimulus disconnect() must tear the listener down.
    morph(wrapper, '<div data-lievit-component="com.example.T" data-lievit-snapshot="s2"><span>gone</span></div>');
    await flushStimulus();
    expect(mm.liveListenerCount(), "disconnect tore the matchMedia listener down").toBe(0);

    // The detached button no longer reaches a live controller.
    document.documentElement.setAttribute("data-theme", "light");
    optBtn(root, "dark").click();
    await settle();
    expect(htmlTheme()).toBe("light");
    expect(calledActions).toHaveLength(0);
  });
});
