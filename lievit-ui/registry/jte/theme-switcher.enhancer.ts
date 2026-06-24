/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * theme-switcher enhancer (v-next, ADR-0012 server-first + ADR-0019 lifecycle registry).
 *
 * The server-rendered `lievit/theme-switcher.jte` partial gives this enhancer a static HTML
 * frame: a role="toolbar" div of three <button aria-pressed> options (icon/labeled variants),
 * or a single cycling <button aria-pressed> (icon-labeled variant). The partial renders all
 * aria-pressed="false" and hides the root with display:none; this module corrects both
 * synchronously in mount(), before first paint, so there is never a visible flash.
 *
 * WHAT THIS MODULE DOES (the irreducibly-client behaviour):
 *   1. Read the persisted preference from localStorage (key from data-storage-key).
 *   2. Fall back to data-default-theme when localStorage has no entry.
 *   3. Resolve "system" to the OS preference via matchMedia("(prefers-color-scheme: dark)").
 *   4. Apply data-theme="light"|"dark" to the element matched by data-root-selector.
 *      (NEVER toggles a class — data-theme is the canonical lievit repoint mechanism, ADR-0005.)
 *   5. Sync aria-pressed: "true" on the matching [data-theme-option] button, "false" on the others.
 *   6. Manage roving tabindex within the toolbar: the active button gets tabindex="0", others "-1".
 *   7. Show the root (remove the display:none guard).
 *   8. Register a matchMedia listener: while "system" is stored, re-resolve and re-apply on OS change.
 *   9. Keyboard navigation for the toolbar variant: Arrow keys move focus + activate;
 *      Home/End jump to first/last; Enter/Space re-activate the focused option.
 *      (APG Toolbar + APG Toggle Button keyboard contract.)
 *
 * ICON-LABELED VARIANT: on click, cycles to the next state (light → dark → system → light, or
 * light → dark → light when showSystem=false). Updates aria-label, icon data-icon, and the
 * visible <span data-slot="theme-switcher-label"> text to reflect the newly active mode.
 *
 * IDEMPOTENCY: the "data-theme-switcher-v2-enhanced" marker on each root ensures mount() is a
 * no-op on a root it has already processed. Re-calling unmount() then mount() is valid (Turbo Drive).
 *
 * CLEANUP: unmount(root) removes the matchMedia listener (registered as a named handle on the
 * element) and the root-level click + keydown listeners, preventing leaks across Turbo navigations.
 *
 * REGISTRATION (ADR-0019 lifecycle registry):
 *   import { ThemeSwitcherEnhancer } from "lievit/theme-switcher.enhancer.js";
 *   runtime.registerEnhancer("theme-switcher", ThemeSwitcherEnhancer);
 * The runtime calls mount(root) after every page:load and unmount(root) before turbo:before-cache.
 *
 * NO wire actions fired. NO Lievit-Snapshot. NO POST /lievit/. Self-contained client-only.
 */

type ThemeChoice = "light" | "dark" | "system";
type ThemeResolved = "light" | "dark";

const ENHANCED_MARK = "data-theme-switcher-v2-enhanced";
const DARK_MQ = "(prefers-color-scheme: dark)";

/** Per-root runtime state attached to the DOM element (avoids a WeakMap external store). */
interface ThemeRootEl extends HTMLElement {
  _lvTsMql?: MediaQueryList | null;
  _lvTsMqlListener?: ((e: MediaQueryListEvent) => void) | null;
  _lvTsClickHandler?: ((e: Event) => void) | null;
  _lvTsKeydownHandler?: ((e: KeyboardEvent) => void) | null;
}

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects)
// ---------------------------------------------------------------------------

function toChoice(v: string | null): ThemeChoice {
  if (v === "light" || v === "dark" || v === "system") return v;
  return "system";
}

function osPrefersDark(): boolean {
  return globalThis.matchMedia?.(DARK_MQ).matches ?? false;
}

function resolve(choice: ThemeChoice): ThemeResolved {
  return choice === "system" ? (osPrefersDark() ? "dark" : "light") : choice;
}

function readStorage(storageKey: string): ThemeChoice | null {
  try {
    const v = globalThis.localStorage?.getItem(storageKey);
    return v === "light" || v === "dark" || v === "system" ? v : null;
  } catch {
    return null; // private mode or SSR
  }
}

function writeStorage(storageKey: string, choice: ThemeChoice): void {
  try {
    globalThis.localStorage?.setItem(storageKey, choice);
  } catch {
    /* storage unavailable — skip persistence */
  }
}

// ---------------------------------------------------------------------------
// DOM read helpers
// ---------------------------------------------------------------------------

function isIconLabeled(root: HTMLElement): boolean {
  return root.dataset["variant"] === "icon-labeled";
}

function showSystem(root: HTMLElement): boolean {
  return root.dataset["showSystem"] !== "false";
}

/** All [data-theme-option] buttons in the toolbar root, in DOM order. */
function optionButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
}

// ---------------------------------------------------------------------------
// DOM write helpers
// ---------------------------------------------------------------------------

/**
 * Apply the resolved theme to the configured root element.
 * Sets data-theme="light"|"dark" only — never toggles a class (ADR-0005).
 */
function applyTheme(rootSelector: string, resolved: ThemeResolved): void {
  const el = document.querySelector<HTMLElement>(rootSelector);
  if (el) el.setAttribute("data-theme", resolved);
}

/** Sync the aria-pressed and tabindex state across all option buttons. */
function syncPressed(root: HTMLElement, chosen: ThemeChoice): void {
  for (const btn of optionButtons(root)) {
    const isActive = btn.dataset["themeOption"] === chosen;
    btn.setAttribute("aria-pressed", isActive ? "true" : "false");
    btn.setAttribute("tabindex", isActive ? "0" : "-1");
  }
}

/** Update the icon-labeled single button's label text + aria-label. */
function syncSingleButton(
  root: HTMLElement,
  chosen: ThemeChoice,
  labels: Record<ThemeChoice, string>,
): void {
  const newLabel = labels[chosen];
  root.setAttribute("aria-label", newLabel);
  root.setAttribute("aria-pressed", chosen !== "system" ? "true" : "false");
  const labelSpan = root.querySelector<HTMLElement>("[data-slot='theme-switcher-label']");
  if (labelSpan) labelSpan.textContent = newLabel;
  // Update the icon: find the first .lv-icon <svg> and swap the lucide icon name via data-icon,
  // or fall back to a well-known approach of swapping the SVG title (non-destructive, since the
  // icon partial inline-embeds the SVG body). We use a data-active-icon attribute as a hint for
  // test assertions; the actual icon swap in a production setup would be handled by the icon
  // partial's symbol approach or by swapping SVG paths — for now we mark the intent.
  const iconSvg = root.querySelector<SVGElement>(".lv-icon");
  if (iconSvg) {
    const iconName = chosen === "dark" ? "moon" : chosen === "light" ? "sun" : "monitor";
    iconSvg.setAttribute("data-icon", iconName);
  }
}

// ---------------------------------------------------------------------------
// matchMedia listener lifecycle
// ---------------------------------------------------------------------------

function teardownMql(root: ThemeRootEl): void {
  if (root._lvTsMql && root._lvTsMqlListener) {
    root._lvTsMql.removeEventListener("change", root._lvTsMqlListener);
  }
  root._lvTsMql = null;
  root._lvTsMqlListener = null;
}

function bindMql(root: ThemeRootEl, storageKey: string, rootSelector: string): void {
  teardownMql(root);
  const mql = globalThis.matchMedia?.(DARK_MQ);
  if (!mql) return;
  const listener = (e: MediaQueryListEvent): void => {
    // Only react while "system" is still the stored preference.
    if (toChoice(readStorage(storageKey)) === "system"
      || (readStorage(storageKey) === null && toChoice(root.dataset["defaultTheme"] ?? null) === "system")) {
      applyTheme(rootSelector, e.matches ? "dark" : "light");
    }
  };
  mql.addEventListener("change", listener);
  root._lvTsMql = mql;
  root._lvTsMqlListener = listener;
}

// ---------------------------------------------------------------------------
// Core commit: choose → persist → apply → sync UI
// ---------------------------------------------------------------------------

function commit(
  root: ThemeRootEl,
  chosen: ThemeChoice,
  storageKey: string,
  rootSelector: string,
  labels: Record<ThemeChoice, string>,
): void {
  writeStorage(storageKey, chosen);
  applyTheme(rootSelector, resolve(chosen));

  if (chosen === "system") {
    bindMql(root, storageKey, rootSelector);
  } else {
    teardownMql(root);
  }

  if (isIconLabeled(root)) {
    syncSingleButton(root, chosen, labels);
  } else {
    syncPressed(root, chosen);
  }
}

// ---------------------------------------------------------------------------
// Toolbar keyboard handler (APG Toolbar + APG Toggle Button keyboard contract)
// ---------------------------------------------------------------------------

function buildKeydownHandler(
  root: HTMLElement,
  storageKey: string,
  rootSelector: string,
  labels: Record<ThemeChoice, string>,
): (e: KeyboardEvent) => void {
  return (e: KeyboardEvent): void => {
    const opts = optionButtons(root);
    if (opts.length === 0) return;
    // Find the currently-focused button inside the toolbar.
    const focusedIdx = opts.findIndex((b) => b === document.activeElement);
    const activeIdx = opts.findIndex((b) => b.getAttribute("aria-pressed") === "true");
    const baseIdx = focusedIdx >= 0 ? focusedIdx : (activeIdx >= 0 ? activeIdx : 0);

    let nextIdx = -1;
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        nextIdx = (baseIdx + 1) % opts.length;
        break;
      case "ArrowLeft":
      case "ArrowUp":
        nextIdx = (baseIdx - 1 + opts.length) % opts.length;
        break;
      case "Home":
        nextIdx = 0;
        break;
      case "End":
        nextIdx = opts.length - 1;
        break;
      case "Enter":
      case " ": {
        // Re-activate the currently-focused option (or the active one if nothing focused).
        const targetBtn = focusedIdx >= 0 ? opts[focusedIdx] : (activeIdx >= 0 ? opts[activeIdx] : opts[0]);
        const chosen = toChoice(targetBtn?.dataset["themeOption"] ?? null);
        e.preventDefault();
        commit(root as ThemeRootEl, chosen, storageKey, rootSelector, labels);
        targetBtn?.focus();
        return;
      }
      default:
        return; // not a key we handle
    }
    e.preventDefault();
    const nextBtn = opts[nextIdx];
    if (!nextBtn) return;
    const chosen = toChoice(nextBtn.dataset["themeOption"] ?? null);
    commit(root as ThemeRootEl, chosen, storageKey, rootSelector, labels);
    nextBtn.focus();
  };
}

// ---------------------------------------------------------------------------
// Icon-labeled single-button click handler
// ---------------------------------------------------------------------------

function buildIconLabeledClickHandler(
  root: HTMLElement,
  storageKey: string,
  rootSelector: string,
  labels: Record<ThemeChoice, string>,
  hasSystem: boolean,
): () => void {
  return (): void => {
    const stored = readStorage(storageKey);
    const current = stored !== null
      ? stored
      : toChoice(root.dataset["defaultTheme"] ?? null);
    let next: ThemeChoice;
    if (hasSystem) {
      next = current === "light" ? "dark" : current === "dark" ? "system" : "light";
    } else {
      next = current === "light" ? "dark" : "light";
    }
    commit(root as ThemeRootEl, next, storageKey, rootSelector, labels);
  };
}

// ---------------------------------------------------------------------------
// Public enhancer API (ADR-0019 lifecycle registry contract)
// ---------------------------------------------------------------------------

export const ThemeSwitcherEnhancer = {
  mount(root: HTMLElement): void {
    if (root.hasAttribute(ENHANCED_MARK)) return;
    root.setAttribute(ENHANCED_MARK, "");

    const el = root as ThemeRootEl;
    const storageKey = el.dataset["storageKey"] ?? "lievit-theme";
    const rootSelector = el.dataset["rootSelector"] ?? "html";
    const defaultTheme = toChoice(el.dataset["defaultTheme"] ?? null);
    const hasSystem = showSystem(el);

    const labels: Record<ThemeChoice, string> = {
      light: el.dataset["labelLight"] ?? "Light",
      dark: el.dataset["labelDark"] ?? "Dark",
      system: el.dataset["labelSystem"] ?? "System",
    };

    // Determine the initial choice: persisted value > defaultTheme.
    const stored = readStorage(storageKey);
    // If showSystem is false and stored is "system", fall back to defaultTheme or "light".
    let initial = stored !== null ? stored : defaultTheme;
    if (!hasSystem && initial === "system") initial = "light";

    // Commit the initial state synchronously (applies theme, syncs UI).
    commit(el, initial, storageKey, rootSelector, labels);

    // Register event listeners.
    if (isIconLabeled(el)) {
      const handler = buildIconLabeledClickHandler(el, storageKey, rootSelector, labels, hasSystem);
      el._lvTsClickHandler = handler;
      el.addEventListener("click", handler);
    } else {
      // Toolbar: click on any option button.
      const clickHandler = (e: Event): void => {
        const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-theme-option]");
        if (!btn || !el.contains(btn)) return;
        const chosen = toChoice(btn.dataset["themeOption"] ?? null);
        if (!hasSystem && chosen === "system") return;
        commit(el, chosen, storageKey, rootSelector, labels);
        btn.focus();
      };
      el._lvTsClickHandler = clickHandler;
      el.addEventListener("click", clickHandler);

      // Keyboard: Arrow / Home / End / Enter / Space.
      const keydownHandler = buildKeydownHandler(el, storageKey, rootSelector, labels);
      el._lvTsKeydownHandler = keydownHandler;
      el.addEventListener("keydown", keydownHandler);
    }

    // Show the root (remove the display:none guard — synchronous, so no visible flash).
    el.style.removeProperty("display");
  },

  unmount(root: HTMLElement): void {
    const el = root as ThemeRootEl;
    teardownMql(el);
    if (el._lvTsClickHandler) {
      el.removeEventListener("click", el._lvTsClickHandler);
      el._lvTsClickHandler = null;
    }
    if (el._lvTsKeydownHandler) {
      el.removeEventListener("keydown", el._lvTsKeydownHandler);
      el._lvTsKeydownHandler = null;
    }
    el.removeAttribute(ENHANCED_MARK);
  },
};

// ---------------------------------------------------------------------------
// Legacy convenience exports (backwards-compatible with the old enhancer API
// used by existing tests; route through the canonical ThemeSwitcherEnhancer).
// ---------------------------------------------------------------------------

/** @deprecated Use `ThemeSwitcherEnhancer` registered with the lievit runtime instead. */
export function enhanceThemeSwitcher(root: HTMLElement): void {
  ThemeSwitcherEnhancer.mount(root);
}

/** @deprecated Use `ThemeSwitcherEnhancer` registered with the lievit runtime instead. */
export function enhanceAllThemeSwitchers(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-enhancer=\"theme-switcher\"],[data-lievit-theme-switcher]")
    .forEach((r) => ThemeSwitcherEnhancer.mount(r));
}
