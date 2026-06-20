@import io.lievit.component.ComponentMetadata
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert-dialog WIRE template -- a confirm modal whose open-state lives server-side in
  AlertDialogComponent (ADR-0012, Wave 3). Pairs with registry/wire/alert-dialog/AlertDialogComponent.java.

  TIER: WIRE. The open/closed state is server state (a @Wire boolean); the trigger fires the `open`
  action and the destructive action + cancel buttons fire `confirm` / `cancel` over the wire; the
  server re-renders this template and the client morphs it. No <slot>, no <lv-dialog>: this renders
  the dialog wire's STRUCTURE (overlay + panel + hidden-when-closed) directly, specialized to a
  confirm prompt. A wire template is rendered with ONLY its own @Wire fields + _component
  (JteTemplateAdapter, the Wave 0 finding), so one wire component cannot nest another as a live
  instance; "composing the dialog" therefore means rendering its overlay/panel structure here,
  owned and server-rendered, which is what this template does.

  STRUCTURE (scientific decision rule): WAI-ARIA APG Alert Dialog pattern, Radix AlertDialog as the
  a11y source (the same source the dropped Lit-island-backed partial cited):
    - the panel is role="alertdialog" + aria-modal="true" (NOT role="dialog": an alertdialog is an
      interruptive prompt requiring a response, so the backdrop does NOT dismiss it; the only exits
      are the explicit confirm / cancel buttons);
    - aria-labelledby -> the title id; aria-describedby -> the description id when set;
    - when closed the whole overlay is `hidden`, so it leaves the tab order + a11y tree;
    - the footer is two real <button>s: cancel (neutral/outline) + confirm (primary, or destructive
      red + a triangle-alert icon on the title when `destructive`). The cancel is listed first in
      the DOM; the confirm is the visually primary affordance (shadcn AlertDialogFooter order).
  Open-state is SERVER (wire); focus-trap + Escape are a tiny CSP-clean typed-TS enhancement
  (data-lv-alert-dialog hooks): zero open-state in the client, only the focus mechanics. Escape
  routes to `cancel`. Native <button>s + a server re-render beat a Lit reactive tree: the prompt
  cannot fail to project (the whole point of the pivot).

  A11y (WAI-ARIA APG Alert Dialog): div[role=alertdialog][aria-modal=true] labelled by the title +
  described by the description; closed overlay removed from the a11y tree via `hidden`; both buttons
  are real <button>s with a token focus ring.

  Params:
    open        boolean   modal open state (server-owned)
    title       String    the prompt headline; wired to aria-labelledby
    description String    supporting explanation; wired to aria-describedby (empty omits it)
    actionLabel String    the confirm button label
    cancelLabel String    the cancel button label
    destructive boolean   destructive styling (red confirm button + triangle-alert icon); locked
    confirmed   boolean   outcome flag the host reads after the round-trip (not rendered directly)
    _component  ComponentMetadata  always-present wire metadata (the className anchor)

  Usage (copy this template in; drive it from a trigger that fires the `open` action, e.g.
  a button with l:click="open" on the component that owns this prompt):
    @@template.lievit.alert-dialog(open = false, title = "Delete the contact?",
        description = "This cannot be undone.", actionLabel = "Delete", destructive = true, ...)
--%>
@param boolean open
@param String title
@param String description
@param String actionLabel
@param String cancelLabel
@param boolean destructive
@param boolean confirmed
@param ComponentMetadata _component
!{var cid = _component.className();}
!{var titleId = "lv-alert-dialog-title";}
!{var descId = "lv-alert-dialog-desc";}
!{var hasDesc = description != null && !description.isEmpty();}
<div
    data-lievit-component="${cid}"
    data-lv-alert-dialog
    data-lv-alert-dialog-destructive="${destructive ? "true" : "false"}"
    hidden="${!open}"
    class="fixed inset-0 flex items-center justify-center"
    style="z-index: var(--lv-z-modal, 9500); background: var(--lv-color-overlay); padding: var(--lv-space-4); font-family: var(--lv-font-sans);"
>
    <div
        data-lv-alert-dialog-panel
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="${titleId}"
        aria-describedby="${hasDesc ? descId : null}"
        class="relative flex flex-col"
        style="background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-lg); box-shadow: var(--lv-shadow-lg); width: min(90vw, 32rem); max-height: 85vh; overflow-y: auto; gap: var(--lv-space-4); padding: var(--lv-space-6);"
    >
        <div data-lv-alert-dialog-header class="flex flex-col" style="gap: var(--lv-space-2);">
            <h2
                id="${titleId}"
                data-lv-alert-dialog-title
                class="flex items-center"
                style="margin: 0; gap: var(--lv-space-2); font-size: var(--lv-text-lg); font-weight: var(--lv-font-semibold); color: var(--lv-color-fg);"
            >
                @if(destructive)
                    <span aria-hidden="true" class="flex items-center" style="color: var(--lv-color-destructive); flex-shrink: 0;">@template.icon(name = "triangle-alert", size = "1.25rem")</span>
                @endif
                ${title}
            </h2>
            @if(hasDesc)
                <p
                    id="${descId}"
                    data-lv-alert-dialog-description
                    style="margin: 0; font-size: var(--lv-text-sm); color: var(--lv-color-muted-fg); line-height: var(--lv-leading-relaxed);"
                >${description}</p>
            @endif
        </div>
        <div
            data-lv-alert-dialog-footer
            class="flex flex-col-reverse sm:flex-row sm:justify-end"
            style="gap: var(--lv-space-2);"
        >
            <button
                type="button"
                data-lv-alert-dialog-cancel
                data-lv-autofocus
                l:click="cancel"
                class="inline-flex items-center justify-center"
                style="height: var(--lv-space-10); padding: 0 var(--lv-space-4); background: var(--lv-color-bg); border: 1px solid var(--lv-color-input); border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); font-weight: var(--lv-font-medium); color: var(--lv-color-fg); box-shadow: var(--lv-shadow-xs); cursor: pointer;"
            >${cancelLabel}</button>
            <button
                type="button"
                data-lv-alert-dialog-action
                data-destructive="${destructive ? "true" : "false"}"
                l:click="confirm"
                class="inline-flex items-center justify-center"
                style="height: var(--lv-space-10); padding: 0 var(--lv-space-4); border: 0; border-radius: var(--lv-radius-md); font-size: var(--lv-text-sm); font-weight: var(--lv-font-medium); box-shadow: var(--lv-shadow-xs); cursor: pointer; background: ${destructive ? "var(--lv-color-destructive)" : "var(--lv-color-primary)"}; color: ${destructive ? "var(--lv-color-destructive-fg)" : "var(--lv-color-primary-fg)"};"
            >${actionLabel}</button>
        </div>
    </div>
</div>
