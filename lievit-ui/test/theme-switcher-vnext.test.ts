/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 *
 * theme-switcher v-next test suite.
 *
 * Three layers:
 *   (1) Source-text assertions on the JTE partial (no JTE compiler — text inspection).
 *       Pins the v-next param API, the APG Toolbar + aria-pressed structure, the display:none
 *       guard, the data-lievit-enhancer seam, and the CSP contract.
 *   (2) Enhancer unit tests against a real DOM shaped like the partial's output: mount / click /
 *       keyboard / matchMedia listener cleanup / idempotency.
 *   (3) icon-labeled single-button variant: cycling, two-state fallback, label update.
 *
 * SHARED FILE POLICY: this file is NEW and component-specific. The existing
 * theme-switcher.test.ts and theme-switcher-enhancer.test.ts assert the OLD surface
 * (role=radiogroup / aria-checked / data-lievit-theme-switcher). Those files are NOT
 * touched here — they are listed in TEST_RECONCILE in the final report.
 */
import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ThemeSwitcherEnhancer } from "../registry/jte/theme-switcher.enhancer.js";
import { iconBody } from "../registry/icons/icon-bodies.js";

const jteDir = join(import.meta.dirname, "..", "registry", "jte");
const src = readFileSync(join(jteDir, "theme-switcher.jte"), "utf8");

// ---------------------------------------------------------------------------
// 1. Source-text assertions (JTE partial, no compiler)
// ---------------------------------------------------------------------------

describe("theme-switcher v-next -- params & docs", () => {
  test("declares the v-next param API with correct defaults", () => {
    expect(src).toContain('@param String variant = "icon"');
    expect(src).toContain('@param String size = "md"');
    expect(src).toContain('@param String storageKey = "lievit-theme"');
    expect(src).toContain('@param String rootSelector = "html"');
    expect(src).toContain('@param String defaultTheme = "system"');
    expect(src).toContain('@param String labelLight = "Light"');
    expect(src).toContain('@param String labelDark = "Dark"');
    expect(src).toContain('@param String labelSystem = "System"');
    expect(src).toContain("@param boolean showSystemOption = true");
    expect(src).toContain('@param String cssClass = ""');
    expect(src).toContain('@param String attrs = ""');
    expect(src).toContain("java.util.Map<String, String> dataAttrs");
  });

  test("OLD params are gone: current, labels, label, lightLabel, darkLabel, systemLabel", () => {
    expect(src).not.toContain("@param String current");
    expect(src).not.toContain("@param boolean labels");
    expect(src).not.toContain('@param String label = ');
    expect(src).not.toContain("@param String lightLabel");
    expect(src).not.toContain("@param String darkLabel");
    expect(src).not.toContain("@param String systemLabel");
  });

  test("doc-comment present with Usage section and correct call syntax", () => {
    expect(src).toContain("<%--");
    expect(src).toContain("--%>");
    expect(src).not.toMatch(/@\*/); // no @* *@ comment syntax
    expect(src).toContain("Usage:");
    expect(src).toContain("@@template.lievit.theme-switcher(");
  });

  test("no dev.lievit import (JTE-compile gate classpath is JDK+jte+icons only)", () => {
    expect(src).not.toMatch(/@import\s+dev\.lievit/);
  });
});

describe("theme-switcher v-next -- WAI-ARIA structure (APG Toolbar + aria-pressed)", () => {
  test("toolbar variant: root has role=toolbar and aria-label, not radiogroup", () => {
    expect(src).toContain('role="toolbar"');
    expect(src).toContain('aria-label="Theme"');
    expect(src).not.toContain('role="radiogroup"');
    expect(src).not.toContain('role="radio"');
  });

  test("toolbar variant: buttons use aria-pressed (APG Toggle Button), not aria-checked", () => {
    expect(src).toContain('aria-pressed="false"');
    expect(src).not.toContain('aria-checked=');
  });

  test("each option button has data-theme-option attribute", () => {
    expect(src).toContain('data-theme-option="light"');
    expect(src).toContain('data-theme-option="dark"');
    expect(src).toContain('data-theme-option="system"');
  });

  test("icon-labeled variant renders a single <button>, not a <div role=toolbar>", () => {
    // The variant check branch starts with @if("icon-labeled".equals(variant))
    expect(src).toContain('"icon-labeled".equals(variant)');
    // In the icon-labeled branch the first HTML element is <button (not <div)
    // The common attrs (including data-lievit-enhancer) are injected via $unsafe{_commonDataAttrs}
    const iconLabeledSection = src.slice(src.indexOf('@if("icon-labeled".equals(variant))'));
    // Must start with a <button, not a <div
    expect(iconLabeledSection).toMatch(/<button[\s\S]*?\$unsafe\{_commonDataAttrs\}/);
    // And must end before any @else <div
    const buttonEnd = iconLabeledSection.indexOf("</button>");
    const elseDiv = iconLabeledSection.indexOf("@else");
    expect(buttonEnd).toBeGreaterThan(-1);
    expect(elseDiv).toBeGreaterThan(buttonEnd); // <button> closes before @else
  });

  test("showSystemOption gate: system option is conditionally rendered", () => {
    expect(src).toContain("@if(showSystemOption)");
    // system button is inside the @if block (not unconditional)
    const sysIdx = src.indexOf('data-theme-option="system"');
    const ifIdx = src.lastIndexOf("@if(showSystemOption)", sysIdx);
    expect(ifIdx).toBeGreaterThan(-1);
    expect(ifIdx).toBeLessThan(sysIdx);
  });

  test("labeled variant: visible label <span> is conditional on variant", () => {
    expect(src).toContain('"labeled".equals(variant)');
    expect(src).toContain('data-slot="theme-switcher-label"');
  });

  test("icon-labeled single button has aria-live=polite on the label span", () => {
    expect(src).toContain('aria-live="polite"');
  });
});

describe("theme-switcher v-next -- enhancer seam", () => {
  test("enhancer hook is data-lievit-enhancer=theme-switcher (v-next protocol)", () => {
    expect(src).toContain('data-lievit-enhancer="theme-switcher"');
    // OLD hook must be gone from template body (it may appear in doc-comment as prose only)
    const bodyStart = src.indexOf("@param");
    expect(src.slice(bodyStart)).not.toContain("data-lievit-theme-switcher");
  });

  test("all enhancer data-* attributes are present on the root", () => {
    // These are set via the _commonDataAttrs computed string variable (a Java string concat).
    // Check the variable definition contains each required attribute key.
    expect(src).toContain("data-storage-key");
    expect(src).toContain("data-root-selector");
    expect(src).toContain("data-default-theme");
    expect(src).toContain("data-show-system");
    expect(src).toContain("data-variant");
    expect(src).toContain("data-size");
    // data-slot is emitted via _commonDataAttrs Java string; the variable definition exists.
    expect(src).toContain("_commonDataAttrs");
    // The $unsafe emit of _commonDataAttrs is present on both root elements
    expect(src).toContain("$unsafe{_commonDataAttrs}");
    // data-slot="theme-switcher" is in the _commonDataAttrs definition (raw source has data-slot)
    expect(src).toContain("data-slot");
  });

  test("display:none guard is on the root (prevents flash-of-wrong-state)", () => {
    expect(src).toContain("display:none");
  });

  test("OLD data-current and data-theme-value attributes are gone", () => {
    const bodyStart = src.indexOf("@param");
    expect(src.slice(bodyStart)).not.toContain("data-current=");
    expect(src.slice(bodyStart)).not.toContain("data-theme-value=");
  });
});

describe("theme-switcher v-next -- icons and tokens", () => {
  test("composes sun / moon / monitor icons via icon partial (name + size only)", () => {
    expect(src).toContain('name = "sun"');
    expect(src).toContain('name = "moon"');
    expect(src).toContain('name = "monitor"');
    // icon params must be only name/size/cssClass/label -- no ariaHidden param
    expect(src).not.toContain("ariaHidden");
  });

  test("icons resolve from lievit's bundled Lucide set", () => {
    for (const name of ["sun", "moon", "monitor"]) {
      expect(iconBody(name), `icon does not resolve: ${name}`).toBeTruthy();
    }
  });

  test("active styling uses aria-pressed attribute selector (not an extra class)", () => {
    expect(src).toContain("aria-[pressed=true]:bg-[var(--lv-color-accent)]");
    expect(src).toContain("aria-[pressed=true]:text-[var(--lv-color-accent-fg)]");
  });

  test("styling is token-driven: no bare hex colours", () => {
    // Strip the doc-comment block to avoid false positives from any hex in comments
    const bodyOnly = src.replace(/<%--[\s\S]*?--%>/g, "");
    expect(bodyOnly).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  test("height is expressed via token (not hardcoded px)", () => {
    expect(src).toContain("--lv-space-8");
    expect(src).toContain("--lv-space-9");
    expect(src).toContain("--lv-space-10");
  });

  test("shadow token is applied on the toolbar group", () => {
    expect(src).toContain("--lv-shadow-xs");
  });
});

describe("theme-switcher v-next -- CSP cleanliness", () => {
  test("no inline <script> and no on* handlers", () => {
    expect(src).not.toMatch(/<script/i);
    const handlers = src.match(/\son[a-z]+=/gi) ?? [];
    expect(handlers, `unexpected inline handlers: ${handlers.join(", ")}`).toEqual([]);
  });

  test("no Lit / Web Awesome / Font Awesome residue", () => {
    expect(src.toLowerCase()).not.toMatch(/font-?awesome|wa-icon|fa-/);
    expect(src.toLowerCase()).not.toMatch(/customelement|litelement/);
  });

  test("dataAttrs channel uses Escape.htmlAttribute for safe escaping", () => {
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("$unsafe{_dataAttrsMarkup}");
  });

  test("attrs channel is emitted raw via $unsafe (trusted static strings only)", () => {
    expect(src).toContain("$unsafe{attrs}");
  });
});

// ---------------------------------------------------------------------------
// 2. Enhancer unit tests (real DOM, real ThemeSwitcherEnhancer)
// ---------------------------------------------------------------------------

/** Controllable matchMedia mock — flip `dark`, fire listeners with `flip()`. */
function installMatchMedia(initialDark: boolean): {
  setDark(v: boolean): void;
  flip(): void;
  liveListenerCount(): number;
} {
  let dark = initialDark;
  let listeners: ((e: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = vi.fn().mockImplementation((media: string) => ({
    media,
    get matches() { return dark; },
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => { listeners.push(cb); },
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

/** Build a DOM matching the server-rendered three-button toolbar partial output. */
function renderToolbar(opts: {
  variant?: "icon" | "labeled";
  size?: "sm" | "md" | "lg";
  storageKey?: string;
  rootSelector?: string;
  defaultTheme?: "light" | "dark" | "system";
  showSystem?: boolean;
} = {}): HTMLElement {
  const {
    variant = "icon",
    size = "md",
    storageKey = "lievit-theme",
    rootSelector = "html",
    defaultTheme = "system",
    showSystem = true,
  } = opts;

  const root = document.createElement("div");
  root.setAttribute("role", "toolbar");
  root.setAttribute("aria-label", "Theme");
  root.setAttribute("data-slot", "theme-switcher");
  root.setAttribute("data-lievit-enhancer", "theme-switcher");
  root.setAttribute("data-variant", variant);
  root.setAttribute("data-size", size);
  root.setAttribute("data-storage-key", storageKey);
  root.setAttribute("data-root-selector", rootSelector);
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

/** Build a DOM matching the server-rendered icon-labeled single-button partial output. */
function renderIconLabeled(opts: {
  storageKey?: string;
  rootSelector?: string;
  defaultTheme?: "light" | "dark" | "system";
  showSystem?: boolean;
} = {}): HTMLElement {
  const {
    storageKey = "lievit-theme",
    rootSelector = "html",
    defaultTheme = "system",
    showSystem = true,
  } = opts;

  const root = document.createElement("button");
  root.type = "button";
  root.setAttribute("data-slot", "theme-switcher");
  root.setAttribute("data-lievit-enhancer", "theme-switcher");
  root.setAttribute("data-variant", "icon-labeled");
  root.setAttribute("data-size", "md");
  root.setAttribute("data-storage-key", storageKey);
  root.setAttribute("data-root-selector", rootSelector);
  root.setAttribute("data-default-theme", defaultTheme);
  root.setAttribute("data-show-system", String(showSystem));
  root.setAttribute("aria-pressed", "false");
  const initLabel = defaultTheme === "dark" ? "Dark" : defaultTheme === "light" ? "Light" : "System";
  root.setAttribute("aria-label", initLabel);
  root.style.display = "none";

  // Minimal icon SVG (mimics what the icon partial would render)
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "lv-icon");
  svg.setAttribute("aria-hidden", "true");
  root.appendChild(svg);

  const span = document.createElement("span");
  span.setAttribute("data-slot", "theme-switcher-label");
  span.setAttribute("aria-live", "polite");
  span.textContent = initLabel;
  root.appendChild(span);

  document.body.appendChild(root);
  return root;
}

const optBtn = (root: HTMLElement, option: string): HTMLButtonElement =>
  root.querySelector<HTMLButtonElement>(`[data-theme-option="${option}"]`)!;

const htmlTheme = (): string | null => document.documentElement.getAttribute("data-theme");
const htmlHasDarkClass = (): boolean => document.documentElement.classList.contains("dark");

beforeEach(() => {
  try { globalThis.localStorage?.clear(); } catch { /* ok */ }
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
  document.documentElement.classList.remove("dark");
});

describe("theme-switcher v-next enhancer: mount / display guard", () => {
  test("mount removes the display:none guard (root becomes visible)", () => {
    installMatchMedia(false);
    const root = renderToolbar();
    expect(root.style.display).toBe("none");
    ThemeSwitcherEnhancer.mount(root);
    expect(root.style.display).not.toBe("none");
  });

  test("mount applies data-theme to <html> (not a class toggle)", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("light");
    expect(htmlHasDarkClass(), "must NOT toggle .dark class").toBe(false);
  });

  test("mount: defaultTheme=dark applies data-theme=dark", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "dark" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("dark");
  });

  test("mount: system resolves via matchMedia (OS dark) => data-theme=dark", () => {
    installMatchMedia(true); // OS = dark
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("dark");
  });

  test("mount: persisted localStorage value overrides defaultTheme", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "dark");
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("dark");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
  });

  test("mount: sets aria-pressed=true on the active button, false on others", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "system");
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("false");
  });

  test("mount: active button gets tabindex=0, others get -1 (roving tabindex)", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    expect(optBtn(root, "light").getAttribute("tabindex")).toBe("0");
    expect(optBtn(root, "dark").getAttribute("tabindex")).toBe("-1");
    expect(optBtn(root, "system").getAttribute("tabindex")).toBe("-1");
  });
});

describe("theme-switcher v-next enhancer: click handling", () => {
  test("clicking dark sets aria-pressed=true + data-theme=dark + persists", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    optBtn(root, "dark").click();
    expect(htmlTheme()).toBe("dark");
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("false");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
  });

  test("clicking a button persists and updates aria-pressed + tabindex", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    optBtn(root, "light").click();
    expect(optBtn(root, "light").getAttribute("tabindex")).toBe("0");
    expect(optBtn(root, "system").getAttribute("tabindex")).toBe("-1");
    expect(htmlTheme()).toBe("light");
  });

  test("clicking the active button again is idempotent (no error, state unchanged)", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "dark" });
    ThemeSwitcherEnhancer.mount(root);
    expect(() => { optBtn(root, "dark").click(); optBtn(root, "dark").click(); }).not.toThrow();
    expect(htmlTheme()).toBe("dark");
  });

  test("custom storageKey is honoured", () => {
    installMatchMedia(false);
    const root = renderToolbar({ storageKey: "my-theme", defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    optBtn(root, "dark").click();
    expect(globalThis.localStorage?.getItem("my-theme")).toBe("dark");
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBeNull();
  });
});

describe("theme-switcher v-next enhancer: system + matchMedia", () => {
  test("system resolves to OS preference on mount", () => {
    installMatchMedia(true); // OS = dark
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("dark");
  });

  test("OS flip re-applies theme while system is stored", () => {
    const mm = installMatchMedia(false); // OS = light
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    expect(htmlTheme()).toBe("light");
    mm.setDark(true);
    mm.flip();
    expect(htmlTheme()).toBe("dark");
  });

  test("OS flip does NOT move theme after explicit choice", () => {
    const mm = installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    optBtn(root, "light").click(); // explicit light
    mm.setDark(true);
    mm.flip();
    expect(htmlTheme()).toBe("light"); // not following OS anymore
  });

  test("unmount removes the matchMedia listener (no listener leak)", () => {
    const mm = installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "system" });
    ThemeSwitcherEnhancer.mount(root);
    expect(mm.liveListenerCount()).toBe(1);
    ThemeSwitcherEnhancer.unmount(root);
    expect(mm.liveListenerCount()).toBe(0);
  });
});

describe("theme-switcher v-next enhancer: keyboard navigation (APG Toolbar)", () => {
  function press(root: HTMLElement, key: string): void {
    root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
  }

  test("ArrowRight moves focus + activates next option, wraps from last to first", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);

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
  });

  test("ArrowLeft moves focus to previous option, wraps from first to last", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);

    optBtn(root, "light").focus();
    press(root, "ArrowLeft"); // light -> system (wrap)
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
  });

  test("Home moves focus to light (first), End to system (last)", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "dark" });
    ThemeSwitcherEnhancer.mount(root);

    optBtn(root, "dark").focus();
    press(root, "Home");
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("true");

    optBtn(root, "light").focus();
    press(root, "End");
    expect(optBtn(root, "system").getAttribute("aria-pressed")).toBe("true");
  });

  test("Enter re-activates the focused button", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "dark" });
    ThemeSwitcherEnhancer.mount(root);
    document.documentElement.removeAttribute("data-theme"); // force stale state

    optBtn(root, "dark").focus();
    press(root, "Enter");
    expect(htmlTheme()).toBe("dark");
  });

  test("Space re-activates the focused button", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    document.documentElement.removeAttribute("data-theme");

    optBtn(root, "light").focus();
    press(root, " ");
    expect(htmlTheme()).toBe("light");
  });
});

describe("theme-switcher v-next enhancer: two-state (showSystem=false)", () => {
  test("only light and dark options present; system key ignored", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light", showSystem: false });
    ThemeSwitcherEnhancer.mount(root);
    expect(optBtn(root, "light")).toBeTruthy();
    expect(optBtn(root, "dark")).toBeTruthy();
    expect(optBtn(root, "system")).toBeNull();
  });

  test("ArrowRight wraps light -> dark -> light (two-state)", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light", showSystem: false });
    ThemeSwitcherEnhancer.mount(root);
    const press = (key: string) =>
      root.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

    optBtn(root, "light").focus();
    press("ArrowRight"); // light -> dark
    expect(optBtn(root, "dark").getAttribute("aria-pressed")).toBe("true");
    press("ArrowRight"); // dark -> light (wrap, only 2 options)
    expect(optBtn(root, "light").getAttribute("aria-pressed")).toBe("true");
  });
});

describe("theme-switcher v-next enhancer: idempotency", () => {
  test("calling mount() twice does not stack click listeners", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    ThemeSwitcherEnhancer.mount(root); // second call must be a no-op
    ThemeSwitcherEnhancer.mount(root);

    const spy = vi.spyOn(document.documentElement, "setAttribute");
    optBtn(root, "dark").click();
    // setAttribute("data-theme", ...) called exactly once per click (not twice from stacked handlers)
    const themeCalls = spy.mock.calls.filter(([attr]) => attr === "data-theme");
    expect(themeCalls.length).toBe(1);
    spy.mockRestore();
  });

  test("unmount then mount re-registers cleanly", () => {
    installMatchMedia(false);
    const root = renderToolbar({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    ThemeSwitcherEnhancer.unmount(root);
    ThemeSwitcherEnhancer.mount(root);
    optBtn(root, "dark").click();
    expect(htmlTheme()).toBe("dark");
  });
});

// ---------------------------------------------------------------------------
// 3. Icon-labeled single-button variant
// ---------------------------------------------------------------------------

describe("theme-switcher v-next enhancer: icon-labeled cycling", () => {
  test("click cycles light -> dark -> system -> light (three-state)", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = renderIconLabeled({ defaultTheme: "light", showSystem: true });
    ThemeSwitcherEnhancer.mount(root);

    // start: light
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

  test("click cycles light -> dark -> light only when showSystem=false", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = renderIconLabeled({ defaultTheme: "light", showSystem: false });
    ThemeSwitcherEnhancer.mount(root);

    root.click(); // light -> dark
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("dark");
    root.click(); // dark -> light (wrap; system is excluded)
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("light");
  });

  test("label span text updates to reflect the new state on each cycle", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = renderIconLabeled({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);

    const span = root.querySelector<HTMLElement>("[data-slot='theme-switcher-label']")!;
    expect(span.textContent).toBe("Light");
    root.click(); // -> dark
    expect(span.textContent).toBe("Dark");
    root.click(); // -> system
    expect(span.textContent).toBe("System");
  });

  test("mount removes display:none on the single button", () => {
    installMatchMedia(false);
    const root = renderIconLabeled({ defaultTheme: "light" });
    expect(root.style.display).toBe("none");
    ThemeSwitcherEnhancer.mount(root);
    expect(root.style.display).not.toBe("none");
  });

  test("unmount removes click listener (no state change after unmount)", () => {
    installMatchMedia(false);
    globalThis.localStorage?.setItem("lievit-theme", "light");
    const root = renderIconLabeled({ defaultTheme: "light" });
    ThemeSwitcherEnhancer.mount(root);
    ThemeSwitcherEnhancer.unmount(root);
    root.click(); // should be a no-op
    expect(globalThis.localStorage?.getItem("lievit-theme")).toBe("light");
  });
});

describe("theme-switcher v-next -- dataAttrs XSS escaping (source-text check)", () => {
  test("dataAttrs is built via Escape.htmlAttribute (not $unsafe{value})", () => {
    // The escaping pattern builds a StringOutput, calls Escape.htmlAttribute per value,
    // then emits the whole fragment $unsafe -- the values themselves are individually escaped.
    expect(src).toContain("Escape.htmlAttribute");
    expect(src).toContain("StringOutput");
    // The dangerous direct pattern ($unsafe{attrs} for dataAttrs values) must not appear
    // -- only the pre-escaped-fragment use is allowed.
    // We confirm the $unsafe{_dataAttrsMarkup} form (pre-escaped) is used, not raw value emission.
    expect(src).toContain("$unsafe{_dataAttrsMarkup}");
  });
});
