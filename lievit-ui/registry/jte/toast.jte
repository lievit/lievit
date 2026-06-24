@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toast-item partial -- a single transient status announcement card.

  TIER: PARTIAL + ENH (toast.enhancer.ts). The message, variant, and identity come from the
  server (via the Lievit-Toast response header or a pre-rendered SSE fragment); the transience
  -- queue management, countdown timers, dismiss animation, bell counter -- is irreducible
  ephemeral client state that must survive across wire round-trips. The enhancer owns all of
  that; this partial is a pure static stamp the enhancer injects into the live-region
  sub-containers rendered by toast/region.jte.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Alert pattern (https://www.w3.org/WAI/ARIA/apg/patterns/alert/) for the
      live-region contract: disruptive variants (warning/destructive) use role=alert /
      aria-live=assertive (immediate AT interruption); non-disruptive variants (info/success)
      use role=status / aria-live=polite (announced when idle). The role is on the
      REGION sub-container (toast/region.jte), not on this item card, so the item is
      pure content inside the live region and AT announces its text on insertion.
    - react-aria useToast/useToastRegion interaction model as the pattern reference for focus
      pause-on-focus, Esc-dismiss, focus restore (no source copied).
    - Ant Design Notification as inventory reference: placement, duration, queue, action slot.
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI.

  A11y (WAI-ARIA Alert / status live region):
    - This item card has role="none" (it is content inside the live region -- no extra role).
    - The dismiss button: real <button type="button" aria-label="Dismiss notification">.
    - The action: <a href> or <button l:click> with visible label text (never icon-only).
    - No auto-focus: the APG Alert pattern is unambiguous -- toasts MUST NOT steal focus.
    - Esc-dismiss while focused inside the item is handled by toast.enhancer.ts.
    - Auto-dismiss is PAUSED while the item has focus (react-aria useToast model): the
      enhancer listens for focusin/focusout on the item and extends the timer accordingly.
    - data-toast-id lets the enhancer target this item for removal.
    - data-toast-duration carries the countdown in ms (0 = persistent).
    - data-variant lets the enhancer route the item to the correct live-region sub-container
      (polite for info/success, assertive for warning/destructive).

  Params:
    String variant                = "info"   intent: "info" | "success" | "warning" | "destructive".
                                             Drives the token pair + live-region routing.
    String message                           REQUIRED. Primary message text (HTML-escaped).
    String description            = null     Optional secondary line below the message.
    int duration                  = 5000     Auto-dismiss after this many ms; 0 = persistent.
    boolean dismissible           = true     Show the X close button.
    String toastId                = null     Server-assigned UUID; written as data-toast-id.
    String icon                   = null     Lucide slug override; null -> intent default icon.
    String action                 = null     Optional action label text.
    String actionHref             = null     If set, action renders as <a href> (navigation).
    String actionWireClick        = null     If set, action renders as <button l:click=...>.
    Map<String,String> actionWireArgs = {}   SAFE escaped per-action wire args as data-* on btn.
    String attrs                  = ""       TRUSTED raw ($unsafe) -- STATIC author-typed only.
    Map<String,String> dataAttrs  = {}       SAFE escaped dynamic data-* on root.

  Two escaping channels (XSS rule, mirrors button.jte):
    * attrs (TRUSTED, raw): $unsafe -- STATIC author-typed strings only. NEVER a DB value here.
    * dataAttrs / actionWireArgs (SAFE, escaped): each value via Escape.htmlAttribute.

  Usage:
    Rendered server-side and injected into the toast region by toast.enhancer.ts.
    The server produces this fragment via the Lievit-Toast response header payload,
    or as a pre-rendered SSE fragment. Direct call (rare -- for initial server-side rendering):
    @@template.lievit.toast(variant = "success", message = "Saved.", toastId = "abc-123")
    @@template.lievit.toast(variant = "destructive", message = "Failed.", dismissible = true,
        action = "Retry", actionWireClick = "retry")
--%>
@param String variant = "info"
@param String message
@param String description = null
@param int duration = 5000
@param boolean dismissible = true
@param String toastId = null
@param String icon = null
@param String action = null
@param String actionHref = null
@param String actionWireClick = null
@param java.util.Map<String, String> actionWireArgs = java.util.Map.of()
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Intent icon defaults per variant --%>
!{var resolvedIcon = (icon != null && !icon.isBlank()) ? icon : switch (variant) {
    case "success"     -> "circle-check";
    case "warning"     -> "triangle-alert";
    case "destructive" -> "circle-x";
    default            -> "info";
  };}

<%-- Accent border colour token per variant --%>
!{var accentColor = switch (variant) {
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-info)";
  };}

<%-- Icon foreground colour token per variant --%>
!{var iconColor = switch (variant) {
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "var(--lv-color-info)";
  };}

<%-- SAFE dynamic data-* attributes on the root (key must be a simple identifier). --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- SAFE dynamic data-* attributes on the action wire button. --%>
!{var wireArgs_ = new StringOutput();}
!{for (var e : actionWireArgs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      wireArgs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), wireArgs_);
      wireArgs_.writeContent("\"");
    }
  }}
!{var wireArgsMarkup = wireArgs_.toString();}

<div
  data-slot="toast-item"
  data-variant="${variant}"
  data-toast-id="${toastId}"
  data-toast-duration="${duration}"
  role="none"
  class="pointer-events-auto flex items-start gap-[var(--lv-space-3)] rounded-[var(--lv-radius-lg)] bg-[var(--lv-color-bg)] border border-[var(--lv-color-border)] border-l-4 shadow-[var(--lv-shadow-md)] p-[var(--lv-space-4)]"
  style="min-width:var(--lv-space-72,18rem);max-width:var(--lv-space-96,24rem);font-family:var(--lv-font-sans);border-left-color:${accentColor};"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  <span
    aria-hidden="true"
    class="shrink-0"
    style="width:var(--lv-space-5,1.25rem);height:var(--lv-space-5,1.25rem);color:${iconColor};display:flex;align-items:center;justify-content:center;"
  >@template.lievit.icon(name = resolvedIcon, size = "var(--lv-space-5,1.25rem)")</span>

  <div data-slot="toast-body" class="flex-1 min-w-0" style="display:flex;flex-direction:column;gap:var(--lv-space-1);">
    <p
      data-slot="toast-message"
      style="margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);line-height:var(--lv-leading-tight);color:var(--lv-color-fg);"
    >${message}</p>
    @if(description != null)
      <p
        data-slot="toast-description"
        style="margin:0;font-size:var(--lv-text-xs);line-height:var(--lv-leading);color:var(--lv-color-muted);"
      >${description}</p>
    @endif
    @if(action != null)
      @if(actionHref != null)
        <a
          href="${actionHref}"
          style="display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);outline:none;"
          class="focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]"
        >${action}</a>
      @else
        @if(actionWireClick != null)
          <button
            type="button"
            l:click="${actionWireClick}"
            style="display:inline-block;margin-top:var(--lv-space-1);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);text-decoration:underline;color:var(--lv-color-primary);background:none;border:0;padding:0;cursor:pointer;outline:none;"
            class="focus-visible:shadow-[var(--lv-ring)] rounded-[var(--lv-radius-sm)]"
            $unsafe{wireArgsMarkup}
          >${action}</button>
        @endif
      @endif
    @endif
  </div>

  @if(dismissible)
    <button
      type="button"
      data-slot="toast-dismiss"
      aria-label="Dismiss notification"
      class="shrink-0 rounded-[var(--lv-radius-sm)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      style="background:none;border:0;padding:var(--lv-space-1);cursor:pointer;color:var(--lv-color-muted);display:flex;align-items:center;justify-content:center;margin:calc(-1 * var(--lv-space-1));"
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
  @endif
</div>
