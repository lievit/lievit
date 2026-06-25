/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-theme-switcher` -- the three-state (light / dark / system) theme-preference control, as a
 * Stimulus controller (the conversion of `registry/jte/theme-switcher.enhancer.ts`). Mounted on the
 * control ROOT via `data-controller="lv-theme-switcher"`: the `role="toolbar"` div of three
 * `aria-pressed` option buttons (icon / labeled variants) OR the single cycling `<button>`
 * (icon-labeled variant). The control structure + the SSR initial state are server-rendered HTML;
 * this controller owns the irreducibly-client behaviour the server cannot know.
 *
 * It is a FULLY UNCONTROLLED, ZERO-WIRE component -- the theme preference is a client-side display
 * fact (localStorage), not a domain value the server owns. It therefore extends the plain Stimulus
 * {@link Controller} (NOT {@link DismissableController}): there is nothing to dismiss and it fires
 * NO `/lievit/<id>/call`. This is the trivial end of the controlled/uncontrolled doctrine: an
 * uncontrolled surface stays purely client-side (the controller test proves `calls.length === 0`
 * against the real runtime). The roving-tabindex focus management is component-specific (APG
 * Toolbar), not the shared return-focus/trap of the dismissable surfaces, so it stays here.
 *
 * What it does on `connect()` (the old enhancer's `mount`, minus the bookkeeping):
 *   1. Read the persisted preference from localStorage (key from `data-storage-key`), falling back
 *      to `data-default-theme` when absent.
 *   2. Resolve "system" to the OS preference via `matchMedia("(prefers-color-scheme: dark)")`.
 *   3. Apply `data-theme="light"|"dark"` to the element matched by `data-root-selector` (NEVER a
 *      class toggle -- `data-theme` is the canonical lievit repoint mechanism, ADR-0005).
 *   4. Sync `aria-pressed` + roving `tabindex` across the option buttons (toolbar), or the label +
 *      `aria-label` + icon (icon-labeled).
 *   5. Bind a `matchMedia` listener so that while "system" is stored the theme re-resolves on OS
 *      change; it is removed in `disconnect()`.
 *   6. Remove the `display:none` guard the partial rendered (synchronous, so no flash of wrong state).
 *
 * Wiring (CSP-clean, declared in the template as `data-action`, NOT inline handlers):
 *   - toolbar option button: `data-action="click->lv-theme-switcher#select"`.
 *   - toolbar root: `data-action="keydown->lv-theme-switcher#handleKey"` (APG keyboard contract;
 *     keydown bubbles from the focused option button to the root, so it is an element action, not a
 *     document-global one -- no `connect()` binding needed).
 *   - icon-labeled root button: `data-action="click->lv-theme-switcher#cycle"`.
 *
 * Morph-safety: the only `connect()`-bound listener is the global `matchMedia` change handler (a
 * window-global, the documented `connect()` case), torn down in `disconnect()`. Every element event
 * rides `data-action`, which Stimulus re-binds automatically after the wire morph. No
 * `data-*-enhanced` marker, no manual idempotency: Stimulus connects each element+identifier once
 * and disconnects on removal, so the round-2 listener-stacking bug class is structurally impossible.
 *
 * a11y source: WAI-ARIA APG Toolbar + APG Toggle Button (aria-pressed + roving tabindex).
 */

import { Controller } from "@hotwired/stimulus";

type ThemeChoice = "light" | "dark" | "system";
type ThemeResolved = "light" | "dark";

const DARK_MQ = "(prefers-color-scheme: dark)";

// ---------------------------------------------------------------------------
// Pure helpers (no side-effects, no DOM)
// ---------------------------------------------------------------------------

function toChoice(v: string | null | undefined): ThemeChoice {
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function osPrefersDark(): boolean {
  return globalThis.matchMedia?.(DARK_MQ).matches ?? false;
}

function resolve(choice: ThemeChoice): ThemeResolved {
  return choice === "system" ? (osPrefersDark() ? "dark" : "light") : choice;
}

export default class LvThemeSwitcherController extends Controller<HTMLElement> {
  /** The bound OS-preference media query + its change listener (window-global, torn down on disconnect). */
  private mql: MediaQueryList | null = null;
  private readonly mqlListener = (e: MediaQueryListEvent): void => this.onOsChange(e);

  connect(): void {
    const stored = this.readStorage();
    let initial = stored ?? this.defaultChoice;
    // showSystem=false collapses "system" to a concrete light start.
    if (!this.showSystem && initial === "system") {
      initial = "light";
    }
    this.commit(initial);
    // Remove the display:none guard the partial rendered (synchronous => no flash of wrong state).
    this.element.style.removeProperty("display");
  }

  disconnect(): void {
    this.teardownMql();
  }

  // --- actions (declared as data-action in the template) -------------------------------------

  /**
   * Toolbar: a click on an option button selects that theme. The action is bound on each
   * `[data-theme-option]` button, so `currentTarget` is the chosen button.
   */
  select(event: Event): void {
    const btn = (event.currentTarget as HTMLElement).closest<HTMLButtonElement>("[data-theme-option]");
    if (btn == null) {
      return;
    }
    const chosen = toChoice(btn.dataset["themeOption"]);
    if (!this.showSystem && chosen === "system") {
      return;
    }
    this.commit(chosen);
    btn.focus();
  }

  /**
   * icon-labeled single button: a click cycles to the next state
   * (light -> dark -> system -> light, or light -> dark -> light when showSystem=false).
   */
  cycle(): void {
    const current = this.readStorage() ?? this.defaultChoice;
    const next: ThemeChoice = this.showSystem
      ? current === "light"
        ? "dark"
        : current === "dark"
          ? "system"
          : "light"
      : current === "light"
        ? "dark"
        : "light";
    this.commit(next);
  }

  /**
   * Toolbar keyboard contract (APG Toolbar + APG Toggle Button): Arrow keys move focus + activate,
   * Home/End jump to first/last, Enter/Space re-activate the focused option. Bound on the toolbar
   * root; keydown bubbles up from the focused option button.
   */
  handleKey(event: KeyboardEvent): void {
    const opts = this.optionButtons();
    if (opts.length === 0) {
      return;
    }
    const focusedIdx = opts.findIndex((b) => b === document.activeElement);
    const activeIdx = opts.findIndex((b) => b.getAttribute("aria-pressed") === "true");
    const baseIdx = focusedIdx >= 0 ? focusedIdx : activeIdx >= 0 ? activeIdx : 0;

    let nextIdx = -1;
    switch (event.key) {
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
        const targetBtn = focusedIdx >= 0 ? opts[focusedIdx] : activeIdx >= 0 ? opts[activeIdx] : opts[0];
        event.preventDefault();
        this.commit(toChoice(targetBtn?.dataset["themeOption"]));
        targetBtn?.focus();
        return;
      }
      default:
        return; // not a key we handle
    }
    event.preventDefault();
    const nextBtn = opts[nextIdx];
    if (nextBtn == null) {
      return;
    }
    this.commit(toChoice(nextBtn.dataset["themeOption"]));
    nextBtn.focus();
  }

  // --- core commit: choose -> persist -> apply -> sync UI -------------------------------------

  private commit(chosen: ThemeChoice): void {
    this.writeStorage(chosen);
    this.applyTheme(resolve(chosen));

    if (chosen === "system") {
      this.bindMql();
    } else {
      this.teardownMql();
    }

    if (this.isIconLabeled) {
      this.syncSingleButton(chosen);
    } else {
      this.syncPressed(chosen);
    }
  }

  // --- DOM writes ------------------------------------------------------------------------------

  /** Apply the resolved theme to the configured root element (data-theme only; never a class). */
  private applyTheme(resolved: ThemeResolved): void {
    const el = document.querySelector<HTMLElement>(this.rootSelector);
    if (el != null) {
      el.setAttribute("data-theme", resolved);
    }
  }

  /** Sync aria-pressed + roving tabindex across all toolbar option buttons. */
  private syncPressed(chosen: ThemeChoice): void {
    for (const btn of this.optionButtons()) {
      const isActive = btn.dataset["themeOption"] === chosen;
      btn.setAttribute("aria-pressed", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    }
  }

  /** Update the icon-labeled single button's label text + aria-label + icon hint. */
  private syncSingleButton(chosen: ThemeChoice): void {
    const labels = this.labels;
    const newLabel = labels[chosen];
    this.element.setAttribute("aria-label", newLabel);
    this.element.setAttribute("aria-pressed", chosen !== "system" ? "true" : "false");

    const labelSpan = this.element.querySelector<HTMLElement>("[data-slot='theme-switcher-label']");
    if (labelSpan != null) {
      labelSpan.textContent = newLabel;
    }
    const iconSvg = this.element.querySelector<SVGElement>(".lv-icon");
    if (iconSvg != null) {
      iconSvg.setAttribute("data-icon", chosen === "dark" ? "moon" : chosen === "light" ? "sun" : "monitor");
    }
  }

  // --- matchMedia listener lifecycle -----------------------------------------------------------

  private bindMql(): void {
    this.teardownMql();
    const mql = globalThis.matchMedia?.(DARK_MQ);
    if (mql == null) {
      return;
    }
    mql.addEventListener("change", this.mqlListener);
    this.mql = mql;
  }

  private teardownMql(): void {
    this.mql?.removeEventListener("change", this.mqlListener);
    this.mql = null;
  }

  /** While "system" is still the active preference, re-resolve + re-apply on an OS scheme flip. */
  private onOsChange(e: MediaQueryListEvent): void {
    const stored = this.readStorage();
    const followsOs = stored === "system" || (stored == null && this.defaultChoice === "system");
    if (followsOs) {
      this.applyTheme(e.matches ? "dark" : "light");
    }
  }

  // --- config + storage reads ------------------------------------------------------------------

  private get storageKey(): string {
    return this.element.dataset["storageKey"] ?? "lievit-theme";
  }

  private get rootSelector(): string {
    return this.element.dataset["rootSelector"] ?? "html";
  }

  private get defaultChoice(): ThemeChoice {
    return toChoice(this.element.dataset["defaultTheme"]);
  }

  private get showSystem(): boolean {
    return this.element.dataset["showSystem"] !== "false";
  }

  private get isIconLabeled(): boolean {
    return this.element.dataset["variant"] === "icon-labeled";
  }

  /**
   * Option labels for the icon-labeled variant. The partial does not emit per-label data-* (the
   * toolbar variants render the labels in HTML directly), so these fall back to the English
   * defaults -- preserving the enhancer's exact behaviour.
   */
  private get labels(): Record<ThemeChoice, string> {
    return {
      light: this.element.dataset["labelLight"] ?? "Light",
      dark: this.element.dataset["labelDark"] ?? "Dark",
      system: this.element.dataset["labelSystem"] ?? "System",
    };
  }

  /** All [data-theme-option] buttons in the toolbar root, in DOM order (empty for icon-labeled). */
  private optionButtons(): HTMLButtonElement[] {
    return Array.from(this.element.querySelectorAll<HTMLButtonElement>("[data-theme-option]"));
  }

  private readStorage(): ThemeChoice | null {
    try {
      const v = globalThis.localStorage?.getItem(this.storageKey);
      return v === "light" || v === "dark" || v === "system" ? v : null;
    } catch {
      return null; // private mode / SSR
    }
  }

  private writeStorage(choice: ThemeChoice): void {
    try {
      globalThis.localStorage?.setItem(this.storageKey, choice);
    } catch {
      /* storage unavailable -- skip persistence */
    }
  }
}
