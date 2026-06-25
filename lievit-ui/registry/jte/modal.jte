@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui modal partial -- a centred overlay dialog, headless CONTROLLED / UNCONTROLLED.

  TIER: PARTIAL + lv-modal Stimulus controller (controlled mode only). No Java component, no
  @Wire field, no _component/_instance params. The open-state belongs to the CALLER.

  CONTROLLED / UNCONTROLLED doctrine (architecture contract, "Overlay & stateful primitives"):
    UNCONTROLLED (default; closeAction = null):
      The trigger is a real <button command="show-modal" commandfor="${id}">. The browser opens
      the <dialog> as a true modal (top-layer, ::backdrop, native focus-trap, Escape). Zero JS
      required: the browser owns open/close. Close paths use <form method="dialog"> submits so
      every close is also JS-free. The lv-modal controller is NOT mounted (data-controller is
      omitted) because the browser's native modal already provides the trap.
    CONTROLLED (closeAction set, open from the parent @Wire field):
      The caller passes open="${myForm.dialogOpen()}" and closeAction="closeDialog". When open=true
      the <dialog> is rendered with the open attribute (visible, non-modal); a scrim div covers the
      viewport behind it; the lv-modal controller (data-controller + data-lv-modal-open-value)
      activates the shared FocusTrap (trap + scroll-lock + Esc-fires-closeAction via
      data-lv-wire-close). The X button and scrim fire l:click="${closeAction}" to drive the
      server round-trip that sets open=false. When open=false the <dialog> carries the hidden
      attribute (absent from the a11y tree and tab order). This is the "form that stays open on
      validation errors" case: open survives the round-trip because the PARENT @Wire owns it.
  The two modes compose cleanly: pass trigger=null + a closeAction for pure controlled; pass a
  trigger + no closeAction for pure uncontrolled. Mixing both gives a dual-mode dialog that can
  be opened by the trigger OR by a server fact.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
    - react-aria useDialog / FocusScope interaction model: keyboard map + focus order + ARIA
      wiring transcribed into ORIGINAL template + the lv-modal controller / FocusTrap (no code copied).
    - Ant Design Modal: inventory reference for sizes (sm/md/lg/xl), closable, header/body/footer
      slots, the "must-act" non-closable mode (no code copied).
    - Styling: ORIGINAL over --lv-* OKLCH tokens; visual look inspired by Tailwind UI (no code
      copied).

  A11y (WAI-ARIA APG Dialog, Modal):
    - Scrim (controlled, open=true): aria-hidden="true", positioned behind the panel;
      click fires closeAction when closable.
    - Panel: role="dialog" aria-modal="true" aria-labelledby="${id}-title" (set when heading
      is non-blank; else aria-label="Dialog" ensures the dialog always has an accessible name).
    - Title: id="${id}-title", wires the aria-labelledby relationship.
    - Description: id="${id}-description", wires aria-describedby.
    - Close button: real <button type="button"> with aria-label="Close" (icon-only: accessible
      name mandatory per APG). Controlled path fires l:click="${closeAction}". Uncontrolled path
      is a <form method="dialog"><button type="submit"> (native close, no JS).
    - Tab / Shift+Tab: in controlled mode, cycled within the panel by the lv-modal controller's
      FocusTrap; in uncontrolled mode, the browser's native modal dialog trap handles cycling.
    - Esc: controlled + closable: fires closeAction via data-lv-wire-close (the controller's
      DismissableController doctrine). controlled + !closable: data-lv-wire-close is omitted; the
      controller leaves Esc inert (the must-act pattern: Esc does nothing). Uncontrolled: the
      browser handles Esc natively.
    - Scroll lock: the FocusTrap adds overflow:hidden on body while the trap is active (controlled);
      browser adds its own scroll lock for a native modal (uncontrolled).
    - Focus restore: the FocusTrap returns focus to the opener on deactivation (controlled); browser
      restores focus on native dialog close (uncontrolled).
    - Closed state (controlled, open=false): hidden attribute on <dialog> removes it from the
      a11y tree and tab order.

  Controller wiring (CSP-clean Stimulus contract -- the lv-modal controller owns the focus mechanics):
    data-controller="lv-modal"   on <dialog>  -- mounts the controller (controlled mode only)
    data-lv-modal-open-value     on <dialog>  -- server-owned open state; the WIRE morph rewrites
                                                 it and Stimulus activates/deactivates the trap
    data-lv-wire-close           on <dialog>  -- the close action Escape fires (controlled+closable
                                                 only); absent => must-act => Escape inert.
  The controller composes the shared FocusTrap util (trap Tab + scroll-lock + return-focus) and the
  shared DismissableController doctrine (Escape fires the wire close ONLY when controlled). It
  replaced the focus-trap.enhancer.ts seam this template used; the X button + scrim keep their own
  l:click close (the WIRE runtime handles those directly, the controller does not duplicate them).

  Focus seam for alert-dialog + drawer/sheet (keep clean):
    alert-dialog + drawer/sheet still ride the shared focus-trap.enhancer.ts during the conversion
    fan-out (one component converted per PR); when they adopt lv-modal too they mount the same
    data-controller="lv-modal" + data-lv-modal-open-value + data-lv-wire-close contract. Do NOT add
    a third attribute for "modal vs non-modal": that is a rendering-layout concern, never a behavior
    one.

  Params:
    String         id          = "lv-modal"  unique id per page (aria-labelledby linkage +
                                              commandfor target for the uncontrolled trigger).
    gg.jte.Content trigger     = null         trigger content inside the open button; omit in
                                              pure controlled mode (caller places its own trigger).
    gg.jte.Content content                    the modal body, OWNED server-rendered (never a <slot>:
                                              this is the projection contract that kills the bug).
    String         heading     = null         dialog title text; renders dialog-title, wires
                                              aria-labelledby. When null falls back to aria-label.
    String         description = null         muted subtitle under title (dialog-description),
                                              wires aria-describedby when set.
    gg.jte.Content footer      = null         footer action buttons; omitted when null.
    String         size        = "md"         "sm" | "md" | "lg" | "xl" -- panel max-width.
    boolean        closable    = true         show X button; allow Esc + scrim-click to close.
    boolean        open        = false        CONTROLLED: true = panel is rendered open.
                                              In uncontrolled mode (no closeAction) leave at false.
    String         closeAction = null         SAFE wire action name; when set: activates controlled
                                              mode, emitted as l:click="${closeAction}" on the X
                                              button and scrim. Null = uncontrolled close paths.
    String         cssClass    = ""           extra utility classes on the wrapper span.

  Usage:
    Uncontrolled (zero-JS, browser-native):
      @@template.lievit.modal(
        id      = "edit-modal",
        trigger = @@`Edit record`,
        heading = "Edit record",
        content = @@`<p>Body, server-rendered.</p>`,
        footer  = @@`<button type="submit" form="edit-form">Save</button>`
      )

    Controlled (server-owned open, e.g. a form that stays open on validation errors):
      @@template.lievit.modal(
        id          = "confirm-modal",
        heading     = "Delete?",
        description = "This cannot be undone.",
        content     = @@`<p>Are you sure?</p>`,
        footer      = @@`<button l:click="confirmDelete">Delete</button>`,
        size        = "sm",
        closable    = false,
        open        = myForm.confirmOpen(),
        closeAction = "closeConfirm"
      )
--%>
@param String id = "lv-modal"
@param gg.jte.Content trigger = null
@param gg.jte.Content content
@param String heading = null
@param String description = null
@param gg.jte.Content footer = null
@param String size = "md"
@param boolean closable = true
@param boolean open = false
@param String closeAction = null
@param String cssClass = ""

!{var titleId      = id + "-title";}
!{var descId       = id + "-description";}
!{var hasHeading   = heading     != null && !heading.isEmpty();}
!{var hasDesc      = description != null && !description.isEmpty();}
!{var isControlled = closeAction != null && !closeAction.isEmpty();}
!{var maxW = switch (size) {
    case "sm" -> "24rem";
    case "lg" -> "36rem";
    case "xl" -> "42rem";
    default   -> "28rem";
  };}
!{var panelClass = "relative z-[var(--lv-z-modal)] flex w-[calc(100%-var(--lv-space-8))] max-h-[calc(100dvh-var(--lv-space-8))] flex-col overflow-hidden rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] text-[var(--lv-color-fg)] shadow-[var(--lv-shadow-xl)]";}

<span
  data-slot="modal"
  data-size="${size}"
  class="inline-block ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(trigger != null)
  <%-- Trigger button: uncontrolled path -- browser opens the <dialog> as a modal (no JS). --%>
  <button
    type="button"
    data-slot="dialog-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>
  @endif

  @if(isControlled && open)
  <%-- Controlled-mode scrim: full-viewport cover behind the panel when open=true. --%>
  <div
    data-slot="dialog-backdrop"
    aria-hidden="true"
    class="fixed inset-0 z-[var(--lv-z-overlay)] bg-[var(--lv-color-overlay)]"
    l:click="${closable ? closeAction : null}"
  ></div>
  @endif

  <%--
    The <dialog> element.

    UNCONTROLLED mode (isControlled=false):
      - No hidden attribute (browser manages show/hide via showModal()).
      - No data-controller (browser native modal trap handles Tab cycling).
      - No data-lv-wire-close (browser cancels on Esc natively).
      - Panel does NOT carry fixed positioning classes (browser top-layer handles it).

    CONTROLLED mode (isControlled=true):
      - hidden="${!open}" (smart attr: present=hidden when false; absent when true/visible).
      - data-controller="lv-modal" + data-lv-modal-open-value (the controller activates/deactivates
        the FocusTrap as the server flips open via the wire morph).
      - data-lv-wire-close="${closeAction}" only when closable (must-act: omit when not -> Esc inert).
      - Panel needs fixed centering CSS because <dialog open> is not in the top-layer.
  --%>
  <dialog
    id="${id}"
    data-slot="dialog"
    data-size="${size}"
    data-width="${size}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="${hasHeading ? titleId : null}"
    aria-label="${hasHeading ? null : "Dialog"}"
    aria-describedby="${hasDesc ? descId : null}"
    hidden="${isControlled && !open}"
    data-controller="${isControlled ? "lv-modal" : null}"
    data-lv-modal-open-value="${isControlled ? String.valueOf(open) : null}"
    data-lv-wire-close="${(isControlled && closable) ? closeAction : null}"
    class="${panelClass} ${isControlled ? "fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" : "m-auto"}"
    style="max-width:${maxW};"
  >
    <div data-slot="dialog-content" class="flex flex-col overflow-hidden">
      <%-- Header: title + description + optional close X button. --%>
      <div
        data-slot="dialog-header"
        class="flex shrink-0 items-start justify-between gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
      >
        <div class="flex flex-col gap-[var(--lv-space-1)]">
          @if(hasHeading)
          <h2
            data-slot="dialog-title"
            id="${titleId}"
            class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]"
          >${heading}</h2>
          @endif
          @if(hasDesc)
          <p
            data-slot="dialog-description"
            id="${descId}"
            class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]"
          >${description}</p>
          @endif
        </div>

        @if(closable)
        <%-- Close button: icon-only -> aria-label is mandatory (APG rule). --%>
        <%-- Controlled path: l:click="${closeAction}" fires the wire round-trip. --%>
        <%-- Uncontrolled path: <form method="dialog"><button type="submit"> closes natively. --%>
        @if(isControlled)
        <button
          type="button"
          data-slot="dialog-close"
          aria-label="Close"
          l:click="${closeAction}"
          class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        @else
        <form method="dialog" class="contents">
          <button
            type="submit"
            data-slot="dialog-close"
            aria-label="Close"
            class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
          ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </form>
        @endif
        @endif
      </div>

      <%-- Body: OWNED server-rendered content (never a native <slot>; the projection contract). --%>
      <div
        data-slot="dialog-body"
        class="flex-1 overflow-y-auto p-[var(--lv-space-6)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]"
      >${content}</div>

      @if(footer != null)
      <%-- Footer: caller-provided action buttons. --%>
      <div
        data-slot="dialog-footer"
        class="flex shrink-0 items-center justify-end gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
      >${footer}</div>
      @endif
    </div>
  </dialog>
</span>
