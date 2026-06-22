/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * theme-switcher enhancer (ADR-0012, server-first): the CSP-clean typed-TS that gives the
 * server-rendered `lievit/theme-switcher.jte` partial its irreducibly-client behaviour. The control
 * itself -- the radiogroup track, the three real <button role=radio> options, the server-owned
 * `current` painted JS-off via aria-checked + roving tabindex -- is all server-rendered HTML; this
 * module ONLY does the three things that cannot happen on the server: read the OS
 * `prefers-color-scheme`, persist the choice to localStorage, and toggle the documentElement theme
 * marker without a wire round-trip. Listeners are attached in code (the strict CSP refuses inline
 * `on*=` handlers); no inline script ships.
 *
 * The CHOSEN value is one of "light" | "dark" | "system"; "system" follows the OS via a matchMedia
 * listener, so the RESOLVED value (the one actually applied) is "light" | "dark". The token system
 * (lievit-tokens.css) keys dark mode on `.dark, [data-theme="dark"]`, so applying = toggling the
 * `dark` class on <html> and mirroring it as `data-theme="dark"|"light"` (both are honoured by the
 * same token block; mirroring keeps the marker inspectable + robust to either selector convention).
 *
 * Persistence: the CHOSEN value is written to localStorage under the root's `data-storage-key`
 * (default "lievit-theme"). On enhance, the persisted choice (if any) overrides the SSR `data-current`
 * + aria-checked + roving tabindex, then the resolved theme is applied. Choosing "system" registers a
 * matchMedia change listener so a later OS flip re-resolves live; choosing light/dark drops it.
 *
 * A11y (WAI-ARIA APG radiogroup): clicking or keyboard-selecting an option moves aria-checked to it,
 * makes it the single tabbable radio (roving tabindex), and focuses it. Arrow keys move + select the
 * next/previous option (wrapping); Home/End jump to the first/last; Space/Enter re-select the focused
 * option. This is the radiogroup keyboard contract (selection follows focus).
 *
 * Idempotent: call {@link enhanceThemeSwitcher} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped, so re-enhancing never stacks listeners. The matchMedia listener
 * a root owns is tracked on the element and torn down before a fresh one is bound, so toggling
 * in/out of "system" never leaks listeners either. {@link enhanceAllThemeSwitchers} wires every root.
 */

type Choice = "light" | "dark" | "system";
type Resolved = "light" | "dark";

const ENHANCED = "data-theme-switcher-enhanced";
const DARK_QUERY = "(prefers-color-scheme: dark)";

/** Holder for the per-root state the enhancer parks on the element (matchMedia teardown). */
interface ThemeRoot extends HTMLElement {
  _lvSystemMql?: MediaQueryList | null;
  _lvSystemListener?: ((e: MediaQueryListEvent) => void) | null;
}

/** Narrow an arbitrary string to a known Choice, defaulting to "system". */
function asChoice(value: string | null): Choice {
  return value === "light" || value === "dark" || value === "system" ? value : "system";
}

/** The three option buttons of a root, in document order. */
function optionsOf(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    root.querySelectorAll<HTMLButtonElement>('[data-slot="theme-switcher-option"]'),
  );
}

/** True if the OS currently prefers a dark colour scheme. */
function osPrefersDark(): boolean {
  return globalThis.matchMedia?.(DARK_QUERY).matches ?? false;
}

/** Resolve a chosen value to the theme actually applied ("system" follows the OS). */
function resolve(choice: Choice): Resolved {
  if (choice === "system") return osPrefersDark() ? "dark" : "light";
  return choice;
}

/**
 * Apply a resolved theme to the documentElement: toggle the `dark` class + mirror it as
 * `data-theme` (the token system keys dark mode on `.dark, [data-theme="dark"]`).
 */
function applyResolved(resolved: Resolved): void {
  const html = document.documentElement;
  html.classList.toggle("dark", resolved === "dark");
  html.setAttribute("data-theme", resolved);
}

/** Read the persisted chosen value for a root, if any (storage may be unavailable). */
function persisted(root: HTMLElement): Choice | null {
  const key = root.getAttribute("data-storage-key");
  if (!key) return null;
  try {
    const v = globalThis.localStorage?.getItem(key);
    return v === "light" || v === "dark" || v === "system" ? v : null;
  } catch {
    return null; // storage unavailable (private mode / SSR)
  }
}

/** Persist the chosen value for a root (no-op if storage is unavailable). */
function persist(root: HTMLElement, choice: Choice): void {
  const key = root.getAttribute("data-storage-key");
  if (!key) return;
  try {
    globalThis.localStorage?.setItem(key, choice);
  } catch {
    /* storage unavailable: skip persistence */
  }
}

/** Mark one option selected: aria-checked + roving tabindex (the rest become unchecked + untabbable). */
function markSelected(root: HTMLElement, chosen: Choice): void {
  for (const opt of optionsOf(root)) {
    const isChosen = opt.getAttribute("data-theme-value") === chosen;
    opt.setAttribute("aria-checked", isChosen ? "true" : "false");
    opt.setAttribute("tabindex", isChosen ? "0" : "-1");
  }
  root.setAttribute("data-current", chosen);
}

/** Tear down any matchMedia listener a root holds (idempotent; safe before re-binding). */
function teardownSystemListener(root: ThemeRoot): void {
  if (root._lvSystemMql && root._lvSystemListener) {
    root._lvSystemMql.removeEventListener("change", root._lvSystemListener);
  }
  root._lvSystemMql = null;
  root._lvSystemListener = null;
}

/**
 * Make a root track the OS scheme so a live OS flip re-resolves while "system" is chosen. Tears down
 * any prior listener first (so re-selecting never stacks). No-op for an explicit light/dark choice.
 */
function bindSystemListener(root: ThemeRoot, chosen: Choice): void {
  teardownSystemListener(root);
  if (chosen !== "system") return;
  const mql = globalThis.matchMedia?.(DARK_QUERY);
  if (!mql) return;
  const listener = (e: MediaQueryListEvent): void => {
    // Only react while "system" is still the chosen value.
    if (asChoice(root.getAttribute("data-current")) === "system") {
      applyResolved(e.matches ? "dark" : "light");
    }
  };
  mql.addEventListener("change", listener);
  root._lvSystemMql = mql;
  root._lvSystemListener = listener;
}

/** Commit a chosen value: mark it selected, apply the resolved theme, persist, (re)bind system tracking. */
function select(root: ThemeRoot, chosen: Choice, focus = false): void {
  markSelected(root, chosen);
  applyResolved(resolve(chosen));
  persist(root, chosen);
  bindSystemListener(root, chosen);
  if (focus) {
    optionsOf(root)
      .find((o) => o.getAttribute("data-theme-value") === chosen)
      ?.focus();
  }
}

/** APG radiogroup keyboard nav: arrows move + select (wrapping), Home/End jump, Space/Enter re-select. */
function onKeydown(root: ThemeRoot, e: KeyboardEvent): void {
  const opts = optionsOf(root);
  if (opts.length === 0) return;
  const current = asChoice(root.getAttribute("data-current"));
  const idx = opts.findIndex((o) => o.getAttribute("data-theme-value") === current);
  let next = -1;
  switch (e.key) {
    case "ArrowRight":
    case "ArrowDown":
      next = (idx + 1 + opts.length) % opts.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      next = (idx - 1 + opts.length) % opts.length;
      break;
    case "Home":
      next = 0;
      break;
    case "End":
      next = opts.length - 1;
      break;
    case " ":
    case "Enter":
      next = idx >= 0 ? idx : 0;
      break;
    default:
      return; // not a key we handle
  }
  e.preventDefault();
  const value = asChoice(opts[next]?.getAttribute("data-theme-value"));
  select(root, value, true);
}

/** Enhance one theme-switcher root. No-op if already enhanced (never stacks listeners). */
export function enhanceThemeSwitcher(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) return;
  root.setAttribute(ENHANCED, "");
  const themeRoot = root as ThemeRoot;

  // Hydrate: a persisted choice overrides the SSR data-current; either way apply the resolved theme
  // on load + (re)bind system tracking. The persisted value is the source of truth across reloads.
  const initial = persisted(themeRoot) ?? asChoice(root.getAttribute("data-current"));
  select(themeRoot, initial);

  for (const opt of optionsOf(root)) {
    opt.addEventListener("click", () => {
      select(themeRoot, asChoice(opt.getAttribute("data-theme-value")), true);
    });
  }

  root.addEventListener("keydown", (e: KeyboardEvent) => onKeydown(themeRoot, e));
}

/** Enhance every `[data-lievit-theme-switcher]` root (call on load + after DOM swaps). */
export function enhanceAllThemeSwitchers(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-theme-switcher]")
    .forEach((root) => enhanceThemeSwitcher(root));
}
