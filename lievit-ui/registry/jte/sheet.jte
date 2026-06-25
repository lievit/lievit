@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sheet partial -- a headless CONTROLLED / UNCONTROLLED overlay panel that slides in
  from a viewport edge (right | left | top | bottom).

  TIER: PARTIAL + ENH (focus-trap.enhancer.ts). No Java component, no @Wire field, no
  _component/_instance params. The open-state belongs to the CALLER.

  CONTROLLED / UNCONTROLLED doctrine (architecture contract, "Overlay & stateful primitives"):
    UNCONTROLLED (default; closeAction = null):
      The trigger is a real <button command="show-modal" commandfor="${id}">. The browser opens
      the <dialog> as a true modal (top-layer, ::backdrop, native focus-trap, Escape). Zero JS
      required: the browser owns open/close. Close paths use <form method="dialog"> submits so
      every close is also JS-free. The focus-trap.enhancer.ts is NOT activated (data-lievit-focus-trap
      is omitted) because the browser's native modal already provides the trap.
    CONTROLLED (closeAction set, open from the parent @Wire field):
      The caller passes open="${myForm.sheetOpen()}" and closeAction="closeSheet". When open=true
      the <dialog> is rendered with the open attribute (visible, non-modal); a scrim div covers the
      viewport behind it; data-controller="lv-sheet" mounts the Stimulus controller (trap +
      scroll-lock + Esc-fires-closeAction via the shared FocusTrap + DismissableController bases).
      The X button and scrim fire l:click="${closeAction}" to drive the server round-trip that sets
      open=false. When open=false the <dialog> carries the hidden attribute (absent from the a11y
      tree and tab order) AND drops data-controller, so Stimulus tears the trap down (focus restored,
      scroll unlocked). This is the "form that stays open on validation errors" case: open survives
      the round-trip because the PARENT @Wire owns it.
  The two modes compose cleanly: pass trigger=null + a closeAction for pure controlled; pass a
  trigger + no closeAction for pure uncontrolled. Mixing both gives a dual-mode panel that can
  be opened by the trigger OR by a server fact.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
    - Same focus-trap enhancer seam as modal.jte and alert-dialog.jte: two data-attributes on the
      panel element, behaviour owned entirely by focus-trap.enhancer.ts (no behaviour in this file).
    - Ant Design Drawer: reference for placement (right/left/top/bottom), size variants (sm/md/lg/xl/full),
      scrollBody, header/footer slots (no code copied).
    - Styling: ORIGINAL over --lv-* OKLCH tokens; visual look inspired by Tailwind UI (no code copied).

  A11y (WAI-ARIA APG Dialog, Modal):
    - Scrim (controlled, open=true): aria-hidden="true", positioned behind the panel;
      click fires closeAction when closable.
    - Panel: role="dialog" aria-modal="true" aria-labelledby="${id}-title" (set when title is
      non-blank; else aria-label="Sheet" ensures the dialog always has an accessible name).
    - Title: id="${id}-title", wires the aria-labelledby relationship.
    - Subtitle: id="${id}-subtitle", wires aria-describedby.
    - Close button: real <button type="button"> with aria-label="Close" (icon-only: accessible
      name mandatory per APG). Controlled path fires l:click="${closeAction}". Uncontrolled path
      is a <form method="dialog"><button type="submit"> (native close, no JS).
    - Tab / Shift+Tab: in controlled mode, cycled within the panel by the lv-sheet Stimulus
      controller (shared FocusTrap); in uncontrolled mode, the browser's native modal dialog trap
      handles cycling.
    - Esc: controlled + closable: fires closeAction via the lv-sheet controller (FocusTrap onEscape
      -> DismissableController.dismissViaWire, gated by data-lv-wire-close).
      controlled + !closable: data-lv-wire-close is omitted; the controller is inert on Esc
      (the must-act pattern: Esc does nothing, ZERO wire call). Uncontrolled: the browser handles
      Esc natively.
    - Scroll lock: the lv-sheet controller (FocusTrap) sets overflow:hidden on body while the
      dialog is open (controlled); browser adds its own scroll lock for a native modal (uncontrolled).
    - Focus restore: the controller returns focus to the opener on disconnect (controlled);
      browser restores focus on native dialog close (uncontrolled).
    - Closed state (controlled, open=false): hidden attribute on <dialog> removes it from the
      a11y tree and tab order.

  Controller wiring (Stimulus, CSP-clean -- behaviour lives in lv-sheet-controller.ts):
    data-controller="lv-sheet"   on <dialog>  -- mounts the trap (stamped controlled + open only)
    data-lv-wire-close           on <dialog>  -- wire close action fired on Esc (controlled +
                                                 closable only); read by DismissableController.
    The controller composes the shared FocusTrap (trap + scroll-lock + return-focus) so this
    template carries NO behaviour. The sheet no longer uses focus-trap.enhancer.ts; the still-shared
    enhancer keeps serving modal/alert-dialog/drawer (which keep data-lievit-focus-trap).

  Overlay focus seam (keep clean):
    alert-dialog + modal + drawer still use the data-lievit-focus-trap enhancer attributes on their
    panel; sheet has migrated to the lv-sheet Stimulus controller. The CSS positioning differs per
    edge, not the controller. Do NOT add a third attribute for "modal vs non-modal": that is a
    rendering-layout concern, never a behavior one.

  TOKENS_NEEDED (net-new tokens to add to lievit-tokens.css before adopters can override sizes):
    --lv-sheet-width-sm   (20rem)   right/left placement sm width
    --lv-sheet-width-md   (30rem)   right/left placement md width
    --lv-sheet-width-lg   (40rem)   right/left placement lg width
    --lv-sheet-width-xl   (50rem)   right/left placement xl width
    --lv-sheet-height-sm  (15rem)   top/bottom placement sm height
    --lv-sheet-height-md  (22.5rem) top/bottom placement md height
    --lv-sheet-height-lg  (30rem)   top/bottom placement lg height
    --lv-sheet-height-xl  (37.5rem) top/bottom placement xl height
    --lv-sheet-header-height (4rem) sticky header height reference
    --lv-sheet-footer-height (4rem) sticky footer height reference
  Until these tokens are added, hardcoded values in the inline style serve as fallbacks.

  Params:
    String         id          = "lv-sheet"  unique id per page (aria-labelledby linkage +
                                              commandfor target for the uncontrolled trigger).
    gg.jte.Content trigger     = null         trigger content inside the open button; omit in
                                              pure controlled mode (caller places its own trigger).
    gg.jte.Content content                    the panel body, OWNED server-rendered (never a <slot>:
                                              this is the projection contract that kills the bug).
    String         title       = null         panel title text; renders sheet-title, wires
                                              aria-labelledby. When null falls back to aria-label.
    String         subtitle    = null         muted subtitle under title (sheet-subtitle),
                                              wires aria-describedby when set.
    gg.jte.Content footer      = null         footer action buttons; omitted when null.
    String         placement   = "right"      "right" | "left" | "top" | "bottom" -- edge to slide from.
    String         size        = "md"         "sm" | "md" | "lg" | "xl" | "full" -- panel dimension.
    boolean        closable    = true         show X button; allow Esc + scrim-click to close.
    boolean        scrollBody  = true         body scrolls independently, header/footer sticky.
                                              When false, the whole panel scrolls together.
    boolean        open        = false        CONTROLLED: true = panel is rendered open.
                                              In uncontrolled mode (no closeAction) leave at false.
    String         closeAction = null         SAFE wire action name; when set: activates controlled
                                              mode, emitted as l:click="${closeAction}" on the X
                                              button and scrim. Null = uncontrolled close paths.
    String         cssClass    = ""           extra utility classes on the wrapper span.

  Usage:
    Uncontrolled (zero-JS, browser-native):
      @@template.lievit.sheet(
        id        = "detail-sheet",
        placement = "right",
        trigger   = @@`View details`,
        title     = "Record detail",
        content   = @@`<dl>...the infolist...</dl>`,
        footer    = @@`<button type="button">Close</button>`
      )

    Controlled (server-owned open, e.g. a form that stays open on validation errors):
      @@template.lievit.sheet(
        id          = "filter-sheet",
        placement   = "left",
        size        = "sm",
        title       = "Filters",
        subtitle    = "Refine the table results.",
        content     = @@`<form id="filter-form">...</form>`,
        footer      = @@`<button l:click="applyFilters">Apply</button>`,
        closable    = true,
        open        = myForm.filterOpen(),
        closeAction = "closeFilters"
      )
--%>
@param String id = "lv-sheet"
@param gg.jte.Content trigger = null
@param gg.jte.Content content
@param String title = null
@param String subtitle = null
@param gg.jte.Content footer = null
@param String placement = "right"
@param String size = "md"
@param boolean closable = true
@param boolean scrollBody = true
@param boolean open = false
@param String closeAction = null
@param String cssClass = ""

!{var titleId      = id + "-title";}
!{var subtitleId   = id + "-subtitle";}
!{var hasTitle     = title    != null && !title.isEmpty();}
!{var hasSubtitle  = subtitle != null && !subtitle.isEmpty();}
!{var isControlled = closeAction != null && !closeAction.isEmpty();}
!{var isVertical   = placement.equals("top") || placement.equals("bottom");}
!{var panelWidth = switch (size) {
    case "sm"   -> "20rem";
    case "lg"   -> "40rem";
    case "xl"   -> "50rem";
    case "full" -> "100vw";
    default     -> "30rem";
  };}
!{var panelHeight = switch (size) {
    case "sm"   -> "15rem";
    case "lg"   -> "30rem";
    case "xl"   -> "37.5rem";
    case "full" -> "100vh";
    default     -> "22.5rem";
  };}
!{var panelPos = switch (placement) {
    case "left"   -> "inset:0 auto 0 0; height:100dvh; width:" + panelWidth + "; border-right:1px solid var(--lv-color-border);";
    case "top"    -> "inset:0 0 auto 0; width:100vw; height:" + panelHeight + "; border-bottom:1px solid var(--lv-color-border);";
    case "bottom" -> "inset:auto 0 0 0; width:100vw; height:" + panelHeight + "; border-top:1px solid var(--lv-color-border);";
    default       -> "inset:0 0 0 auto; height:100dvh; width:" + panelWidth + "; border-left:1px solid var(--lv-color-border);";
  };}

<span
  data-slot="sheet"
  data-placement="${placement}"
  class="inline-block ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(trigger != null)
  <%-- Trigger button: uncontrolled path -- browser opens the <dialog> as a modal (no JS). --%>
  <button
    type="button"
    data-slot="sheet-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>
  @endif

  @if(isControlled && open)
  <%-- Controlled-mode scrim: full-viewport cover behind the panel when open=true. --%>
  <div
    data-slot="sheet-backdrop"
    aria-hidden="true"
    class="fixed inset-0 z-[var(--lv-z-overlay)] bg-[var(--lv-color-overlay)]"
    l:click="${closable ? closeAction : null}"
  ></div>
  @endif

  <%--
    The <dialog> element.

    UNCONTROLLED mode (isControlled=false):
      - No hidden attribute (browser manages show/hide via showModal()).
      - No data-lievit-focus-trap (browser native modal trap handles Tab cycling).
      - No data-lievit-escape-action (browser cancels on Esc natively).
      - Panel does NOT carry fixed positioning classes (browser top-layer handles it).

    CONTROLLED mode (isControlled=true):
      - hidden="${isControlled && !open}" (smart attr: present=hidden when false; absent when true/visible).
      - data-lievit-focus-trap="" (enhancer activates trap + scroll-lock on mount).
      - data-lievit-escape-action="${closeAction}" only when closable (must-act: omit when not).
      - Panel needs fixed edge-anchoring CSS because <dialog open> is not in the top-layer.
  --%>
  <dialog
    id="${id}"
    data-slot="sheet-panel"
    data-placement="${placement}"
    data-size="${size}"
    data-closable="${closable}"
    role="dialog"
    aria-modal="true"
    aria-labelledby="${hasTitle ? titleId : null}"
    aria-label="${hasTitle ? null : "Sheet"}"
    aria-describedby="${hasSubtitle ? subtitleId : null}"
    tabindex="-1"
    hidden="${isControlled && !open}"
    data-controller="${(isControlled && open) ? "lv-sheet" : null}"
    data-lv-wire-close="${(isControlled && closable) ? closeAction : null}"
    class="m-0 box-border flex max-w-none flex-col border-0 bg-[var(--lv-color-popover)] p-0 text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-xl)] ${scrollBody ? "" : "overflow-y-auto"}"
    style="${panelPos} z-index:var(--lv-z-modal);"
  >
    <%-- Header: title + subtitle + optional close X button. --%>
    <div
      data-slot="sheet-header"
      class="flex shrink-0 items-start justify-between gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
    >
      <div class="flex flex-col gap-[var(--lv-space-1)]">
        @if(hasTitle)
        <h2
          data-slot="sheet-title"
          id="${titleId}"
          class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]"
        >${title}</h2>
        @endif
        @if(hasSubtitle)
        <p
          data-slot="sheet-subtitle"
          id="${subtitleId}"
          class="m-0 text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] text-[var(--lv-color-muted-fg)]"
        >${subtitle}</p>
        @endif
      </div>

      @if(closable)
      <%-- Close button: icon-only -> aria-label is mandatory (APG rule). --%>
      <%-- Controlled path: l:click="${closeAction}" fires the wire round-trip. --%>
      <%-- Uncontrolled path: <form method="dialog"><button type="submit"> closes natively. --%>
      @if(isControlled)
      <button
        type="button"
        data-slot="sheet-close"
        aria-label="Close"
        l:click="${closeAction}"
        class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
      ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      @else
      <form method="dialog" class="contents">
        <button
          type="submit"
          data-slot="sheet-close"
          aria-label="Close"
          class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </form>
      @endif
      @endif
    </div>

    <%-- Body: OWNED server-rendered content (never a native <slot>; the projection contract). --%>
    <div
      data-slot="sheet-body"
      class="${scrollBody ? "flex-1 overflow-y-auto" : ""} p-[var(--lv-space-6)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]"
    >${content}</div>

    @if(footer != null)
    <%-- Footer: caller-provided action buttons. --%>
    <div
      data-slot="sheet-footer"
      class="flex shrink-0 items-center justify-end gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
    >${footer}</div>
    @endif
  </dialog>
</span>
