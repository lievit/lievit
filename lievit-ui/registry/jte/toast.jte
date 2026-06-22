@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toast partial -- a transient overlay notification rendered SERVER-SIDE (ADR-0012).
  Pairs with registry/jte/toast.enhancer.ts (the CSP-clean auto-dismiss timer) and the
  toast/viewport.jte stack container.

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
  assertive (role="alert" + aria-live="assertive"), informational kinds (info / success / default /
  loading) are polite (role="status" + aria-live="polite"), so a screen reader interrupts only for
  the urgent kinds. aria-atomic="true" so the whole toast is announced as a unit. A leading severity
  icon (Lucide) + the tinted border/background come from one severity token via color-mix, coherent
  with alert.jte; the neutral `default` reads the surface/border tokens (sonner's --normal-bg) with
  no tint, and `loading` swaps the icon for the spinner partial.

  VARIANTS vs sonner: severity (info/success/warning/danger) drives colour + role + icon; `default`
  is the neutral sonner toast (surface fill, polite); `loading` shows a spinner (a pending op, no
  auto-dismiss by default); `promise` is the server-first render of sonner's toast.promise -- the
  same toast where the OUTCOME is already known server-side (the op resolved or rejected before the
  response), so it renders the resolved (success) or rejected (danger) state directly as markup via
  the `promiseState` param, no client polling.

  STACKING + POSITION: a single toast is `fixed` to one of the six sonner corners (position =
  {top|bottom}-{left|center|right}). To show SEVERAL at once, render them inside
  @template.lievit.toast.viewport(position=...) (data-slot="toast-viewport"), which owns the fixed
  corner + the gap-stacked column; pass standalone=false on each toast so it flows inside the
  viewport instead of fixing itself.

  A11y (WAI-ARIA alert/status): danger|warning => role="alert" (assertive); everything else =>
  role="status" (polite); aria-atomic="true". The dismiss button carries an accessible label and
  its glyph is aria-hidden.

  Params:
    String variant      = "info"   "default" | "info" | "success" | "warning" | "danger" | "loading" |
                                   "promise" (drives colour + role + icon).
    String promiseState = "success"  for variant="promise": the resolved outcome to render now,
                                   "success" or "danger" (else treated as success).
    String heading      = null     optional bold heading rendered above the message.
    gg.jte.Content content          the message body (the flash text).
    gg.jte.Content actions = null  optional action region (data-slot="toast-actions") rendered below
                                   the message body -- a row of buttons/links (e.g. "Mark all read",
                                   "Undo"). The kit notification toast needs this; without it gest had
                                   to render the actions INSIDE content. Purely additive (null = no row).
    boolean dismissible = true     render a dismiss (x) button the enhancer wires.
    int duration        = 4000     auto-dismiss after this many ms (0 = stay until dismissed).
    boolean standalone  = true     true => the toast fixes itself to `position`; false => it flows
                                   inside a @template.lievit.toast.viewport.
    String position     = "bottom-right"  one of: top-left | top-center | top-right |
                                   bottom-left | bottom-center | bottom-right (standalone only).
    String cssClass     = ""       extra utility classes on the toast.

  Usage (render it from the server's flash, then import the enhancer once and call it on load):
    @@if(flash != null)
      @@template.lievit.toast(variant = flash.level(), content = @@`${flash.message()}`)
    @@endif
    import { enhanceAllToasts } from "./lievit/toast.enhancer.js"; enhanceAllToasts();

  Usage (stack several, one corner):
    @@template.lievit.toast.viewport(position = "top-right", content = @@`
      @@template.lievit.toast(standalone = false, variant = "success", content = @@`Saved.`)
      @@template.lievit.toast(standalone = false, variant = "loading", duration = 0, content = @@`Uploading...`)
    `)

  Usage (a notification toast with an actions row):
    @@template.lievit.toast(variant = "info", heading = "3 new notifications",
      content = @@`You have unread items.`,
      actions = @@`@@template.lievit.button(variant = "ghost", size = "sm", content = @@`Mark all read`)`)
--%>
@param String variant = "info"
@param String promiseState = "success"
@param String heading = null
@param gg.jte.Content content
@param gg.jte.Content actions = null
@param boolean dismissible = true
@param int duration = 4000
@param boolean standalone = true
@param String position = "bottom-right"
@param String cssClass = ""

<%-- promise resolves server-side to a concrete severity; loading is neutral; default is the sonner neutral toast. --%>
!{var effective = "promise".equals(variant) ? ("danger".equals(promiseState) ? "danger" : "success") : variant;}
!{var urgent = "danger".equals(effective) || "warning".equals(effective);}
!{var neutral = "default".equals(effective) || "loading".equals(effective);}
!{var tone = switch (effective) {
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger"  -> "var(--lv-color-danger)";
    case "default" -> "var(--lv-color-border)";
    case "loading" -> "var(--lv-color-border)";
    default        -> "var(--lv-color-info)";
  };}
!{var glyph = switch (effective) {
    case "success" -> "circle-check";
    case "warning" -> "triangle-alert";
    case "danger"  -> "circle-x";
    default        -> "info";
  };}
<%-- neutral toasts read the surface fill (sonner --normal-bg); severities tint the bg from the tone token. --%>
!{var bg = neutral ? "var(--lv-color-surface)" : "color-mix(in srgb, " + tone + " 12%, var(--lv-color-bg))";}
<%-- standalone toasts fix themselves to one of the six sonner corners; inside a viewport they flow. --%>
!{var posStyle = switch (position) {
    case "top-left"      -> "top: var(--lv-space-4); left: var(--lv-space-4);";
    case "top-center"    -> "top: var(--lv-space-4); left: 50%; transform: translateX(-50%);";
    case "top-right"     -> "top: var(--lv-space-4); right: var(--lv-space-4);";
    case "bottom-left"   -> "bottom: var(--lv-space-4); left: var(--lv-space-4);";
    case "bottom-center" -> "bottom: var(--lv-space-4); left: 50%; transform: translateX(-50%);";
    default              -> "bottom: var(--lv-space-4); right: var(--lv-space-4);"; // bottom-right
  };}
!{var placement = standalone ? "position: fixed; z-index: var(--lv-z-toast, 9000); " + posStyle : "position: relative;";}

<div
  data-lievit-toast
  data-slot="toast"
  data-variant="${variant}"
  data-position="${standalone ? position : null}"
  data-toast-duration="${duration}"
  role="${urgent ? "alert" : "status"}"
  aria-live="${urgent ? "assertive" : "polite"}"
  aria-atomic="true"
  class="flex items-start gap-[var(--lv-space-3)] rounded-[var(--lv-radius-md)] border px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)] ${cssClass}"
  style="${placement} min-width: 16rem; max-width: 24rem; font-family: var(--lv-font-sans); border-color: ${tone}; background: ${bg}; box-shadow: var(--lv-shadow-md);"
>
  @if("loading".equals(effective))
    <span aria-hidden="true" data-toast-icon class="flex items-center" style="flex-shrink: 0;">@template.lievit.spinner(label = "Loading")</span>
  @else
    <span aria-hidden="true" data-toast-icon class="flex items-center" style="color: ${tone}; flex-shrink: 0;">@template.lievit.icon(name = glyph, size = "1.25rem")</span>
  @endif
  <div data-toast-body class="min-w-0" style="flex: 1;">
    @if(heading != null && !heading.isBlank())
      <div data-toast-heading class="mb-[var(--lv-space-1)] font-[var(--lv-font-semibold)]">${heading}</div>
    @endif
    ${content}
    @if(actions != null)
      <div data-toast-actions data-slot="toast-actions" class="mt-[var(--lv-space-2)] flex flex-wrap items-center gap-[var(--lv-space-2)]">${actions}</div>
    @endif
  </div>
  @if(dismissible)
    <button
      type="button"
      data-toast-dismiss
      aria-label="Dismiss notification"
      class="flex items-center justify-center"
      style="flex-shrink: 0; background: transparent; border: 0; padding: var(--lv-space-1); margin: calc(-1 * var(--lv-space-1)); color: inherit; opacity: 0.7; cursor: pointer; border-radius: var(--lv-radius-sm); line-height: 1;"
    >@template.lievit.icon(name = "x", size = "1rem")</button>
  @endif
</div>
