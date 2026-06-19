@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toast partial -- a transient overlay notification rendered SERVER-SIDE (ADR-0012).
  Pairs with registry/jte/toast.enhancer.ts (the CSP-clean auto-dismiss timer).

  TIER: PARTIAL (+ enhancer). A toast is the visible form of a server-side flash / notification: the
  server already knows the message + severity (a PRG flash attribute, or a NotificationBell push),
  so the open-state and the text are server-held and the server renders the whole panel when there
  is something to show. There is nothing for the server to DECIDE between renders, so this is NOT a
  wire component: round-tripping the open-state over the wire would be chat for no gain. The host
  page renders this partial only when a flash/notification exists (e.g. `@if(flash != null)`), so
  "open" is simply "rendered". The only client bit is the auto-dismiss timer + the dismiss button's
  fade-out, which is a tiny typed-TS enhancer the strict CSP accepts (no inline on* handlers).

  STRUCTURE (scientific decision rule): WAI-ARIA alert / status live-region pattern (the same model
  the dropped <lv-toast> Lit island cited, and the alert partial uses): the live-region ROLE is the
  load-bearing decision and is taken from the APG -> time-sensitive kinds (danger / warning) are
  assertive (role="alert" + aria-live="assertive"), informational kinds (info / success) are polite
  (role="status" + aria-live="polite"), so a screen reader interrupts only for the urgent kinds.
  aria-atomic="true" so the whole toast is announced as a unit. A leading severity icon (Lucide) +
  the tinted border/background come from one severity token via color-mix, coherent with alert.jte.
  The dismiss is a real <button> (CSP-clean, keyboard-safe); the enhancer wires its click + the
  auto-dismiss timeout off the data attributes.

  A11y (WAI-ARIA alert/status): danger|warning => role="alert" (assertive); info|success =>
  role="status" (polite); aria-atomic="true". The dismiss button carries an accessible label and
  its glyph is aria-hidden.

  Params:
    String variant      = "info"   "info" | "success" | "warning" | "danger" (drives colour + role + icon).
    String heading      = null     optional bold heading rendered above the message.
    gg.jte.Content content          the message body (the flash text).
    boolean dismissible = true     render a dismiss (x) button the enhancer wires.
    int duration        = 4000     auto-dismiss after this many ms (0 = stay until dismissed).
    String cssClass     = ""       extra utility classes on the toast.

  Usage (render it from the server's flash, then import the enhancer once and call it on load):
    @@if(flash != null)
      @@template.lievit.toast(variant = flash.level(), content = @@`${flash.message()}`)
    @@endif
    import { enhanceAllToasts } from "./lievit/toast.enhancer.js"; enhanceAllToasts();
--%>
@param String variant = "info"
@param String heading = null
@param gg.jte.Content content
@param boolean dismissible = true
@param int duration = 4000
@param String cssClass = ""

!{var urgent = "danger".equals(variant) || "warning".equals(variant);}
!{var tone = switch (variant) {
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger"  -> "var(--lv-color-danger)";
    default        -> "var(--lv-color-info)";
  };}
!{var glyph = switch (variant) {
    case "success" -> "circle-check";
    case "warning" -> "triangle-alert";
    case "danger"  -> "circle-x";
    default        -> "info";
  };}

<div
  data-lievit-toast
  data-slot="toast"
  data-variant="${variant}"
  data-toast-duration="${duration}"
  role="${urgent ? "alert" : "status"}"
  aria-live="${urgent ? "assertive" : "polite"}"
  aria-atomic="true"
  class="fixed flex items-start gap-[var(--lv-space-3)] rounded-[var(--lv-radius-md)] border px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)] ${cssClass}"
  style="bottom: var(--lv-space-4); right: var(--lv-space-4); min-width: 16rem; max-width: 24rem; z-index: var(--lv-z-toast, 9000); font-family: var(--lv-font-sans); border-color: ${tone}; background: color-mix(in srgb, ${tone} 12%, var(--lv-color-bg)); box-shadow: var(--lv-shadow-md);"
>
  <span aria-hidden="true" data-toast-icon class="flex items-center" style="color: ${tone}; flex-shrink: 0;">@template.icon(name = glyph, size = "1.25rem")</span>
  <div data-toast-body class="min-w-0" style="flex: 1;">
    @if(heading != null && !heading.isBlank())
      <div data-toast-heading class="mb-[var(--lv-space-1)] font-[var(--lv-font-semibold)]">${heading}</div>
    @endif
    ${content}
  </div>
  @if(dismissible)
    <button
      type="button"
      data-toast-dismiss
      aria-label="Dismiss notification"
      class="flex items-center justify-center"
      style="flex-shrink: 0; background: transparent; border: 0; padding: var(--lv-space-1); margin: calc(-1 * var(--lv-space-1)); color: inherit; opacity: 0.7; cursor: pointer; border-radius: var(--lv-radius-sm); line-height: 1;"
    >@template.icon(name = "x", size = "1rem")</button>
  @endif
</div>
