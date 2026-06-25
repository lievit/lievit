/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * `lv-pagination` -- the pagination page-click seam, as a Stimulus controller (the conversion of
 * `runtime/features/pagination.ts`, the old `l:page` wire directive). Mounted on the pagination
 * ROOT via `data-controller="lv-pagination"`; the <nav> landmark, the <ol>/<li> list, the real
 * <a href> / <button> page elements and `aria-current` are all server-rendered HTML
 * (`pagination.jte`). This controller ONLY drives the wire on a page click and scrolls the
 * component back to the top afterwards -- exactly what the `l:page` directive did.
 *
 * Each interactive page element carries its own action params (the per-element shape the old
 * directive read off each `l:page` attribute):
 * - `data-action="click->lv-pagination#goto"`  -- binds the click (CSP-clean, re-bound on morph)
 * - `data-lv-pagination-action-param="<wireAction>"`  -- the wire action name (e.g. `goToPage`).
 *   PRESENT only on a wire-CONTROLLED page element (wire mode). Its presence is what makes the
 *   click drive the wire; ABSENT (a URL-mode <a href>) => no `data-action` reaches here at all and,
 *   even if it did, {@link callWire} no-ops on a blank action, so Turbo Drive / native navigation is
 *   never stolen. That is the controlled/uncontrolled doctrine for pagination: a page click round-
 *   trips the wire ONLY in wire mode; URL mode navigates with ZERO `/lievit/<id>/call`.
 * - `data-lv-pagination-arg-param="<n>"`  -- OPTIONAL explicit page argument; when set the call
 *   becomes `action(n)` (mirrors the directive's `l:page.arg`). pagination.jte omits it (the page
 *   number rides `data-page`, read server-side from the trigger), so the call stays a bare action.
 * - `data-lv-pagination-no-scroll-param="true"`  -- OPTIONAL; suppresses the scroll-to-top (the
 *   directive's `l:page.no-scroll` modifier).
 *
 * Morph-safety: there is NO `connect()`/`disconnect()` and NO manual listener here. The single
 * `data-action` binding is owned by Stimulus's action observer, which re-binds it automatically
 * when the wire morph re-renders a page element and tears it down when one is removed. That
 * replaces the old `data-lievit-rt-page-bound` marker and the per-node idempotency bookkeeping --
 * the whole reason for the migration.
 */

import { Controller, type ActionEvent } from "@hotwired/stimulus";
import { callWire } from "../bridge.js";

/** The component-root marker the runtime stamps; the wire call + the scroll target resolve to it. */
const COMPONENT_SELECTOR = "[data-lievit-component]";

/** The action-params shape a page element declares (typecast by Stimulus from `data-*-param`). */
interface PaginationParams {
  /** The wire action name; blank/absent => uncontrolled (no call). */
  readonly action?: unknown;
  /** Optional explicit page argument; when finite, the call becomes `action(arg)`. */
  readonly arg?: unknown;
  /** When `true`, suppress the post-change scroll-to-top. */
  readonly noScroll?: unknown;
}

export default class LvPaginationController extends Controller<HTMLElement> {
  /**
   * Drives the wire for a page click and scrolls the component to the top, the conversion of the
   * `l:page` directive's click handler. Bound via `data-action="click->lv-pagination#goto"` on each
   * wire-mode page element.
   *
   * @param event the Stimulus action event; `currentTarget` is the clicked page element and
   *   `params` carries this element's `action` / `arg` / `noScroll`.
   */
  goto(event: ActionEvent): void {
    const el = event.currentTarget as HTMLElement;
    const params = event.params as PaginationParams;

    const action = this.composeAction(params);
    // Controlled/uncontrolled doctrine: only a wire-CONTROLLED page element (one that declared an
    // action) drives the wire. An uncontrolled element does nothing here -> its default behaviour
    // (href navigation / Turbo Drive) proceeds untouched, ZERO round-trip.
    if (action == null) {
      return;
    }
    event.preventDefault();
    callWire(el, action, { trigger: el, page: true });
    if (params.noScroll !== true) {
      this.scrollComponentToTop(el);
    }
  }

  /**
   * Builds the wire action string from a page element's params, mirroring the old directive:
   * `action` alone, or `action(arg)` when an explicit, finite page argument is declared. Returns
   * `null` when no action name is present (the uncontrolled case).
   *
   * @param params the clicked element's action params
   * @returns the action string to send on the wire, or `null` for an uncontrolled click
   */
  private composeAction(params: PaginationParams): string | null {
    const name = typeof params.action === "string" ? params.action.trim() : "";
    if (name.length === 0) {
      return null;
    }
    const arg = params.arg;
    if (arg != null && arg !== "") {
      const n = Number(arg);
      if (Number.isFinite(n)) {
        return `${name}(${JSON.stringify(n)})`;
      }
    }
    return name;
  }

  /**
   * Scrolls the enclosing lievit component back to the top after a page change (matching Livewire
   * + the old directive's default). A no-op when the element is not inside a component or the
   * environment lacks `scrollIntoView` (e.g. some test substrates).
   *
   * @param el the clicked page element
   */
  private scrollComponentToTop(el: Element): void {
    const root = el.closest<HTMLElement>(COMPONENT_SELECTOR);
    if (root != null && typeof root.scrollIntoView === "function") {
      root.scrollIntoView({ block: "start" });
    }
  }
}
