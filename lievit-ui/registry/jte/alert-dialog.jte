@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert-dialog partial -- a headless controlled/uncontrolled confirm overlay panel
  (role="alertdialog") that renders INSIDE a consuming dialog WIRE component's owned template
  region. The open-state lives in the parent DialogComponent's @Wire boolean open field; this
  partial controls only the alertdialog surface: title, description, confirm button, cancel
  button. NO @Wire field, NO Java component.

  TIER: PARTIAL (composes the dialog WIRE component + the shared focus-trap enhancer it
  already owns). The parent dialog shell provides the scrim + positioning overlay; this
  partial renders the alertdialog panel that goes inside that shell.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Alertdialog pattern (https://www.w3.org/WAI/ARIA/apg/patterns/alertdialog/)
      + APG Modal Dialog keyboard/focus spec (https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
      role="alertdialog" is MANDATORY (not role="dialog"): it signals both alert (demands immediate
      attention) AND dialog (traps focus). Screen readers announce the name + description text
      immediately on open without user navigation. A plain dialog must not be used here.
    - Inventory reference: Ant Design Modal confirm() API (destructive + warning variants,
      confirm/cancel pair, no arbitrary body content).
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; visual look inspired by Tailwind
      UI (NO code copied).

  A11y (WAI-ARIA APG Alertdialog, Modal):
    - Panel root: role="alertdialog" aria-modal="true" aria-labelledby="{titleId}"
      aria-describedby="{descId}". aria-describedby is MANDATORY here -- a missing one is an
      axe-core violation for role="alertdialog".
    - Title: real <h2 id="{titleId}"> (not a div). Semantic heading at level 2 (page h1 is outer
      context; the dialog is a subordinate section).
    - Description: real <p id="{descId}">. Must NOT be a complex structure; use dialog for that.
    - Icon slot wrapper (when used): aria-hidden="true" -- icon is decorative; title+description
      carry the accessible content.
    - Confirm button: <button type="button"> + l:click="{confirmWireClick}". No aria-label needed
      (visible label text). When loading: aria-busy="true" + disabled.
    - Cancel button: <button type="button"> + l:click="{cancelWireClick}" + data-initial-focus.
      Always enabled. Receives focus on open (least-destructive action, APG §initial focus for
      irreversible steps, matching React Aria AlertDialog autoFocus on cancel).
    - No close-X button: intentionally absent. User MUST choose one of the two labeled actions.
    - No scrim click-to-close: data-closable="false" on the panel root; the focus-trap enhancer
      reads this flag to suppress light-dismiss.
    - Esc routes to cancel: data-cancel-action="{cancelWireClick}" on the panel root; the
      focus-trap enhancer reads this to fire the cancel wire action on Esc (Esc == cancel,
      always deliberate, never a neutral dismiss).
    - Keyboard (owned by the focus-trap enhancer, not this partial):
        Tab         move focus to next tabbable inside panel, wraps at last
        Shift+Tab   move focus to previous tabbable inside panel, wraps at first
        Esc         fires cancelWireClick (via data-cancel-action)
        Enter/Space on confirm   activates confirm (native button)
        Enter/Space on cancel    activates cancel (native button)
    - Focus: initial focus -> cancel button (data-initial-focus). Trap: Tab+Shift+Tab cycle within
      panel only. Restore: on close (confirm or cancel), focus returns to the opener element. Scroll
      lock: body overflow:hidden while open. All owned by the shared focus-trap.enhancer.ts.

  CONTROLLED / UNCONTROLLED (overlay doctrine, architecture contract §OVERLAY):
    This partial is rendered inside the owning dialog WIRE template's conditional region. When the
    parent's open flag is true the template renders this partial; when false it is absent. The
    partial itself carries no open state. The consumer (a DialogComponent @Wire boolean open) owns
    open-state; it drives the server round-trip that shows or hides this panel. This is the
    CONTROLLED path by definition: open is a server fact owned by the parent component.

  Variants (the confirm button intent + optional icon tint):
    destructive (default) -- confirm=destructive (--lv-color-destructive/-fg), icon tint=destructive
    warning               -- confirm=primary with amber tint (--lv-color-warning/-fg), icon tint=warning
    default               -- confirm=primary (--lv-color-primary/-fg)

  Cancel button is always ghost (no fill) -- visual hierarchy: confirm=weighted, cancel=recessive.

  DOM ORDER: cancel first (gets data-initial-focus + receives initial focus); confirm second.
  Visual layout may reorder via flex; DOM order is canonical for a11y + screen-reader reading order.

  data-slot="alert-dialog" on the panel root (test targeting + adopter CSS hooks).
  data-variant="{variant}" on the panel root (CSS token switch for icon tint + border-accent).
  data-closable="false" on the panel root (focus-trap reads this to suppress scrim-click-to-close).
  data-cancel-action="{cancelWireClick}" on the panel root (focus-trap reads this on Esc).

  Wire args (both confirmWireArgs + cancelWireArgs): SAFE escaped channel. Each entry becomes
  data-<key>="<escaped-value>" via Escape.htmlAttribute, merged into the escaped data-* fragment
  (same pattern as button.jte wireArgs). NEVER put DB-derived per-row values through `attrs`.

  Params:
    String  title             (required) alert dialog accessible name. Rendered as <h2>; wires
                                          aria-labelledby. No default -- missing title = broken a11y.
    String  description       (required) alert message content. Rendered as <p>; wires aria-describedby.
                                          No default -- missing description = broken a11y for alertdialog.
    String  variant      = "destructive" intent: "destructive" | "warning" | "default"
    String  confirmLabel = "Confirm"     confirm action button label
    String  cancelLabel  = "Cancel"      cancel/dismiss action button label
    String  confirmWireClick  (required) wire action fired on confirm-button click (l:click)
    String  cancelWireClick   (required) wire action fired on cancel-button click (l:click)
    Map     confirmWireArgs = {}         SAFE escaped per-row args for the confirm action
    Map     cancelWireArgs  = {}         SAFE escaped per-row args for the cancel action
    boolean loading      = false         when true: confirm button shows spinner + aria-busy + disabled
    gg.jte.Content iconSlot = null       optional icon rendered left of title; icon container is
                                          aria-hidden (decorative). Pass @template.lievit.icon(...).
    String  cssClass     = ""            extra utility classes on the panel root
    String  attrs        = ""            TRUSTED raw ($unsafe) -- STATIC author-typed strings ONLY.
                                          Never feed user/DB data through this channel.

  Usage:
    @@template.lievit.alert-dialog(
      title = "Elimina attivita",
      description = "Questa azione non puo essere annullata.",
      variant = "destructive",
      confirmLabel = "Elimina",
      cancelLabel = "Annulla",
      confirmWireClick = "deleteActivity",
      cancelWireClick = "close",
      confirmWireArgs = java.util.Map.of("id", activity.id())
    )

    @@template.lievit.alert-dialog(
      title = "Conferma pagamento",
      description = "Il pagamento di 1.250 EUR sara addebitato immediatamente.",
      variant = "warning",
      confirmLabel = "Paga ora",
      cancelLabel = "Annulla",
      confirmWireClick = "submitPayment",
      cancelWireClick = "close",
      loading = ${form.submitting()},
      iconSlot = @@`@template.lievit.icon(name = "triangle-alert", size = "1.25rem")`
    )
--%>
@param String title
@param String description
@param String variant = "destructive"
@param String confirmLabel = "Confirm"
@param String cancelLabel = "Cancel"
@param String confirmWireClick
@param String cancelWireClick
@param java.util.Map<String, String> confirmWireArgs = java.util.Map.of()
@param java.util.Map<String, String> cancelWireArgs = java.util.Map.of()
@param boolean loading = false
@param gg.jte.Content iconSlot = null
@param String cssClass = ""
@param String attrs = ""

<%-- Derived IDs for aria-labelledby / aria-describedby. Using fixed IDs is safe here
     because an alert-dialog is modal: only one is present in the DOM at a time, so
     there is no collision risk. A consumer that renders multiple dialogs should pass
     cssClass with a unique data-testid instead. --%>
!{var titleId = "lv-alert-dialog-title";}
!{var descId  = "lv-alert-dialog-desc";}

<%-- Confirm button variant class: destructive uses --lv-color-destructive; warning uses
     --lv-color-warning (amber fill) which is distinct from primary; default uses primary.
     The class strings are COMPLETE + static (Tailwind scanner requirement). --%>
!{var confirmBg = switch (variant) {
    case "warning"  -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default         -> "var(--lv-color-primary)";
  };}
!{var confirmFg = switch (variant) {
    case "warning"  -> "var(--lv-color-warning-fg)";
    case "destructive" -> "var(--lv-color-destructive-fg)";
    default         -> "var(--lv-color-primary-fg)";
  };}

<%-- Icon tint colour follows the variant intent. Used on the icon slot wrapper. --%>
!{var iconTint = switch (variant) {
    case "warning"  -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default         -> "var(--lv-color-primary)";
  };}

<%-- Cancel button: always ghost (transparent fill, fg text, accent hover) --%>
!{var cancelBase = "inline-flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] whitespace-nowrap rounded-[var(--lv-radius-md)] border border-transparent leading-[var(--lv-leading)] cursor-pointer outline-none transition-[color,box-shadow] focus-visible:shadow-[var(--lv-ring)] disabled:opacity-50 disabled:cursor-not-allowed";}
!{var cancelClass = cancelBase + " h-[var(--lv-space-9)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] bg-transparent text-[var(--lv-color-fg)] border-transparent hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)]";}

<%-- Confirm button: same base shape, variant-driven fill. --%>
!{var confirmBase = cancelBase + " h-[var(--lv-space-9)] px-[var(--lv-space-4)] text-[length:var(--lv-text-sm)]";}

<%-- SAFE escaped data-* fragment for confirmWireArgs.
     Each entry: data-<key>="<Escape.htmlAttribute(value)>"; keys must be simple identifiers. --%>
!{var confirmAttrs_ = new StringOutput();}
!{for (var e : confirmWireArgs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      confirmAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), confirmAttrs_);
      confirmAttrs_.writeContent("\"");
    }
  }}
!{var confirmDataAttrsMarkup = confirmAttrs_.toString();}

<%-- SAFE escaped data-* fragment for cancelWireArgs. Same allowlist + escaper. --%>
!{var cancelAttrs_ = new StringOutput();}
!{for (var e : cancelWireArgs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      cancelAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), cancelAttrs_);
      cancelAttrs_.writeContent("\"");
    }
  }}
!{var cancelDataAttrsMarkup = cancelAttrs_.toString();}

<%-- The panel root: role="alertdialog" + all mandatory ARIA + the focus-mechanics protocol.
     Owned by the `lv-alert-dialog` Stimulus controller (data-controller): it composes the shared
     FocusTrap (Tab cycle + scroll-lock + initial focus on cancel + return-focus on close) and
     routes Escape to the wire. Escape == cancel: the action rides data-lv-wire-close, fired ONLY
     because an alert-dialog is wire-CONTROLLED by definition (open state is a server fact) -- the
     controlled/uncontrolled doctrine lives in DismissableController, not here.
     data-lievit-focus-trap / -escape-action remain for the shared focus-trap enhancer's family
     contract (golden), but are INERT for this instance: the enhancer skips any element carrying
     data-controller~="lv-alert-dialog" (coexistence guard, until the whole overlay family migrates).
     Max-width fixed at max-w-sm (the bounded-content contract from §3). --%>
<div
  role="alertdialog"
  aria-modal="true"
  aria-labelledby="${titleId}"
  aria-describedby="${descId}"
  data-slot="alert-dialog"
  data-variant="${variant}"
  data-closable="false"
  data-cancel-action="${cancelWireClick}"
  data-controller="lv-alert-dialog"
  data-lv-wire-close="${cancelWireClick}"
  data-lievit-focus-trap
  data-lievit-escape-action="${cancelWireClick}"
  class="relative flex w-full flex-col gap-[var(--lv-space-4)] rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] p-[var(--lv-space-6)] shadow-[var(--lv-shadow-xl)] ${cssClass}"
  style="font-family:var(--lv-font-sans);color:var(--lv-color-popover-fg);max-width:24rem;z-index:var(--lv-z-modal);"
  $unsafe{attrs}
>
  <%-- Header: optional icon + title --%>
  <div data-slot="alert-dialog-header" class="flex items-start gap-[var(--lv-space-3)]">
    @if(iconSlot != null)
      <span
        aria-hidden="true"
        data-slot="alert-dialog-icon"
        class="mt-[0.125rem] shrink-0 inline-flex items-center"
        style="color:${iconTint};"
      >${iconSlot}</span>
    @endif
    <h2
      id="${titleId}"
      data-slot="alert-dialog-title"
      class="m-0 text-[length:var(--lv-text-base)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]"
    >${title}</h2>
  </div>

  <%-- Description: the aria-describedby target. MANDATORY for role="alertdialog". --%>
  <p
    id="${descId}"
    data-slot="alert-dialog-description"
    class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]"
  >${description}</p>

  <%-- Action pair: cancel FIRST in DOM (data-initial-focus -> receives focus on open),
       confirm SECOND. flex-row-reverse reverses the visual order so confirm appears on the
       left (the more prominent position in LTR); DOM order is canonical for a11y (initial
       focus placement) + screen-reader linear reading order.
       APG: "focus the least destructive action on open for irreversible steps" = cancel. --%>
  <div data-slot="alert-dialog-actions" class="flex flex-row-reverse gap-[var(--lv-space-3)] sm:justify-start">
    <%-- Cancel button: ghost, always enabled, FIRST in DOM, receives initial focus on open. --%>
    <button
      type="button"
      data-slot="alert-dialog-cancel"
      data-initial-focus
      l:click="${cancelWireClick}"
      $unsafe{cancelDataAttrsMarkup}
      class="${cancelClass}"
    >${cancelLabel}</button>
    <%-- Confirm button: variant-driven fill, may be loading. SECOND in DOM.
       Hover: CSS [data-variant] attribute selector in alert-dialog.css drives the hover tint
       via --lv-* tokens (no inline on* handlers -- the strict CSP refuses them). --%>
    <button
      type="button"
      data-slot="alert-dialog-confirm"
      data-variant="${variant}"
      data-loading="${loading}"
      disabled="${loading}"
      aria-busy="${loading ? "true" : null}"
      l:click="${confirmWireClick}"
      $unsafe{confirmDataAttrsMarkup}
      class="${confirmBase}"
      style="background:${confirmBg};color:${confirmFg};"
    >@if(loading)<span data-slot="confirm-spinner" aria-hidden="true" class="inline-block size-[1em] animate-spin rounded-[var(--lv-radius-full)] border-2 border-current border-t-transparent motion-reduce:animate-none"></span>@endif${confirmLabel}</button>
  </div>
</div>
