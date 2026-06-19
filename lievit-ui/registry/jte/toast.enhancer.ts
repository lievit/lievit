/*
 * Copyright 2026 Francesco Bilotta
 * Licensed under the Apache License, Version 2.0 (the "License").
 */

/**
 * toast enhancer (ADR-0012, server-first): the CSP-clean typed-TS that gives the server-rendered
 * `lievit/toast.jte` partial its two client behaviours: a dismiss button and an auto-dismiss timer.
 * The toast panel, its message, severity, role and live-region semantics are all server-rendered
 * HTML (the server renders the partial from a flash / notification); this module ONLY removes the
 * element on dismiss or after its duration, so there is zero inline script (the strict CSP refuses
 * inline `on*=` handlers; this attaches listeners in code instead) and zero wire round-trip (a
 * toast needs no server decision once shown).
 *
 * Behaviour mirrors the dropped `<lv-toast>` Lit island:
 *   - auto-dismiss: after `data-toast-duration` ms (0 = stay until dismissed);
 *   - dismiss button: clicking `[data-toast-dismiss]` removes the toast immediately;
 *   - removal cancels the pending timer (no double-remove).
 *
 * Idempotent: call {@link enhanceToast} once (it marks each root) and again after a DOM swap;
 * already-enhanced roots are skipped. {@link enhanceAllToasts} wires every toast on the page.
 */

const ENHANCED = "data-toast-enhanced";

/** Remove a toast from the DOM, cancelling its pending auto-dismiss timer first. */
function dismissToast(root: HTMLElement, timer?: ReturnType<typeof setTimeout>): void {
  if (timer !== undefined) {
    clearTimeout(timer);
  }
  root.remove();
}

/**
 * Enhance one toast root: wire its dismiss button + start its auto-dismiss timer. No-op if it is
 * already enhanced. A non-positive `data-toast-duration` means "stay until dismissed".
 *
 * @param root the `[data-lievit-toast]` element rendered by the toast partial
 */
export function enhanceToast(root: HTMLElement): void {
  if (root.hasAttribute(ENHANCED)) {
    return;
  }
  root.setAttribute(ENHANCED, "");

  const duration = Number(root.getAttribute("data-toast-duration") ?? "0");
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (Number.isFinite(duration) && duration > 0) {
    timer = setTimeout(() => dismissToast(root), duration);
  }

  const dismiss = root.querySelector<HTMLButtonElement>("[data-toast-dismiss]");
  dismiss?.addEventListener("click", () => dismissToast(root, timer));
}

/** Enhance every `[data-lievit-toast]` on the page (call on load + after DOM swaps). */
export function enhanceAllToasts(scope: ParentNode = document): void {
  scope
    .querySelectorAll<HTMLElement>("[data-lievit-toast]")
    .forEach((root) => enhanceToast(root));
}
