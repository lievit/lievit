/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * Native HTML `popover` API seam for lievit (#34 v-next shared enhancers). A panel element carrying
 * `popover` and `data-lv-opener="<triggerId>"` gets bookkeeping wired by this enhancer:
 *
 * 1. **Opener recording** — on `toggle` (newState `"open"`), the element with id
 *    `panel.dataset.lvOpener` is stored as the opener.
 * 2. **Focus return on light-dismiss** — on `toggle` (newState `"closed"`), if
 *    `document.activeElement` is NOT already the opener (i.e. the browser did not return focus
 *    automatically), call `opener.focus()`. Click-outside / light-dismiss is the case where the
 *    browser may NOT return focus.
 * 3. **Wire sync on light-dismiss (CONTROLLED overlays only)**: on `toggle` (newState
 *    `"closed"`), if the panel carries `data-lv-wire-close="<action>"`, call that wire action on
 *    the component that owns the panel. This keeps server state in sync when a wire-CONTROLLED
 *    overlay is dismissed via click-outside. An UNCONTROLLED panel (no `data-lv-wire-close`) fires
 *    NO wire call: its open state is browser-owned and the close is purely client-side. There is
 *    deliberately NO hardcoded `"close"` fallback; firing one on an uncontrolled overlay whose
 *    host has no matching `@LievitAction` produces a 410 UNKNOWN_COMPONENT / "page expired" dialog.
 * 4. **Autofocus delegation** — after a `toggle` open, if the panel contains an element with
 *    `data-lv-autofocus`, call `.focus()` on it (for panels that want to move focus inside, e.g. a
 *    search input in a popover dropdown, without relying on the `autofocus` attribute which has
 *    quirks in dynamically-added nodes).
 *
 * Attribute protocol on the PANEL element:
 * - `popover` — native HTML attribute; makes this a popover panel
 * - `data-lv-opener="<id>"` — id of the trigger element that opens this panel
 * - `data-lv-wire-close="<actionName>"`: wire action name to call on light-dismiss. PRESENT only
 *   on wire-CONTROLLED overlays (the templates emit it solely when the open state is server-owned).
 *   When ABSENT the overlay is uncontrolled and NO wire call fires. dropdown-menu controlled mode
 *   sets `data-lv-wire-close="${escapeAction}"` so the enhancer calls the caller-configured action
 *   (e.g. `"toggleOpen"`); uncontrolled mode omits the attribute entirely.
 *
 * Attribute protocol inside the panel:
 * - `data-lv-autofocus` — the element to focus after the panel opens
 *
 * Idempotency: a WeakSet tracks panels that already have the toggle listener wired.
 *
 * CSS Anchor Positioning polyfill: if `CSS.supports("position-area", "bottom")` returns false, an
 * external polyfill is needed.
 * @polyfill-placeholder — the polyfill is NOT bundled here; load it separately (e.g.
 *   `@oddbird/css-anchor-positioning` via a `<script>` tag or a dynamic import in your app's
 *   main.ts) before this enhancer activates.
 */

import type { LievitRuntime } from "../runtime.js";

const OPENER_ATTR = "data-lv-opener";
const AUTOFOCUS_ATTR = "data-lv-autofocus";
/**
 * Light-dismiss wire action name. PRESENT only on wire-CONTROLLED overlays (templates stamp it
 * when the open state is server-owned). When ABSENT the overlay is uncontrolled and the enhancer
 * fires NO wire call on close. There is no hardcoded default (the controlled/uncontrolled guard).
 */
const WIRE_CLOSE_ATTR = "data-lv-wire-close";

/** Panels that already have the toggle listener attached (idempotency guard). */
const wiredPanels = new WeakSet<Element>();

/** Opener element recorded when the panel last opened. */
const openerMap = new WeakMap<Element, HTMLElement>();

function wirePanel(panel: Element, runtime: LievitRuntime): void {
  if (wiredPanels.has(panel)) {
    return;
  }
  wiredPanels.add(panel);

  panel.addEventListener("toggle", (rawEvent: Event) => {
    // The native popover `toggle` event has `newState` and `oldState` on `ToggleEvent`; we cast
    // because the type may not be in all TS lib versions.
    const event = rawEvent as ToggleEvent;
    const newState: string | undefined = (event as unknown as { newState?: string }).newState ?? event.newState;

    if (newState === "open") {
      const openerId = (panel as HTMLElement).dataset?.lvOpener ??
        panel.getAttribute(OPENER_ATTR);
      if (openerId != null && openerId.length > 0) {
        const opener = document.getElementById(openerId);
        if (opener != null) {
          openerMap.set(panel, opener);
          // Additive: sync aria-expanded="true" on the opener when the panel opens.
          // Guard: only when the opener already carries an aria-expanded attribute (the trigger
          // opted in as a disclosure trigger). Never adds the attribute to a trigger that did
          // not declare it. This is additive and correct for all existing disclosure triggers
          // (navigation-menu, dropdown-menu, popover) that render aria-expanded="false" on the
          // server and expect the client to keep it in sync with the native popover state.
          if (opener.hasAttribute("aria-expanded")) {
            opener.setAttribute("aria-expanded", "true");
          }
        }
      }
      // Autofocus delegation: move focus to [data-lv-autofocus] if present.
      const autofocusTarget = panel.querySelector<HTMLElement>(`[${AUTOFOCUS_ATTR}]`);
      if (autofocusTarget != null) {
        // Defer slightly so the popover is fully shown before focus moves.
        queueMicrotask(() => autofocusTarget.focus());
      }
    } else if (newState === "closed") {
      const opener = openerMap.get(panel);
      openerMap.delete(panel);

      // Focus return: if the browser did not already return focus to the opener, do it.
      if (opener != null && document.activeElement !== opener) {
        opener.focus();
      }

      // Additive: sync aria-expanded="false" on the opener when the panel closes.
      // Guard: same as the open path — only when the opener already has aria-expanded.
      if (opener != null && opener.hasAttribute("aria-expanded")) {
        opener.setAttribute("aria-expanded", "false");
      }

      // Wire sync: call the light-dismiss action on the component owning the panel, but ONLY for
      // a wire-CONTROLLED overlay. Controlled/uncontrolled doctrine: the close action name is read
      // from data-lv-wire-close, which the templates stamp ONLY when the open state is server-owned
      // (dropdown-menu.jte / popover.jte emit it only when open/controlled). When the marker is
      // ABSENT the overlay is UNCONTROLLED: the native popover closes purely client-side and MUST
      // NOT round-trip. The previous hardcoded "close" fallback fired a spurious server call on
      // every uncontrolled close; on a host with no close() @LievitAction (e.g. a data table) that
      // maps to UNKNOWN_COMPONENT -> 410 -> a misleading "This page has expired" dialog.
      const closeAction =
        (panel as HTMLElement).dataset?.lvWireClose ??
        panel.getAttribute(WIRE_CLOSE_ATTR);
      if (closeAction != null && closeAction.length > 0) {
        const componentRoot = panel.closest("[data-lievit-component]") ?? panel;
        runtime.callAction(componentRoot, closeAction, { trigger: panel });
      }
    }
  });
}

/**
 * Installs the popover-anchor enhancer on a runtime. Scans for `[popover][data-lv-opener]`
 * elements on every component init and after every wire call.
 *
 * @param runtime the started runtime to extend
 * @returns an unsubscribe function
 */
export function installPopoverAnchor(runtime: LievitRuntime): () => void {
  function scanRoot(root: Element): void {
    // The root itself may be the panel, or panels may be inside it.
    const panels = Array.from(root.querySelectorAll<Element>(`[popover][${OPENER_ATTR}]`));
    if (root.hasAttribute("popover") && root.hasAttribute(OPENER_ATTR)) {
      panels.push(root);
    }
    for (const panel of panels) {
      wirePanel(panel, runtime);
    }
  }

  return runtime.use({
    onComponentInit(ctx) {
      scanRoot(ctx.root);
    },
    afterCall(outcome) {
      scanRoot(outcome.root);
    },
  });
}
