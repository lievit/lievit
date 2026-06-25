<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui drawer partial -- headless CONTROLLED / UNCONTROLLED side-panel overlay.

  TIER: PARTIAL + CTRL (lv-drawer Stimulus controller). No Java component, no @Wire field, no
  _component/_instance/_componentSnapshot params. The open-state belongs to the CALLER.

  CONTROLLED / UNCONTROLLED doctrine (architecture contract, "Overlay & stateful primitives"):
    UNCONTROLLED (default; open=false, closeAction=null, no trigger rendered externally):
      Pass a `trigger` Content slot: a real <button command="show-modal" commandfor="${id}">
      opens the <dialog> as a modal. The browser owns top-layer rendering, native focus-trap,
      ::backdrop, and Escape. Close paths use <form method="dialog"> submits -- zero JS, no
      enhancer, CSP-clean by construction.
    CONTROLLED (closeAction set, open driven by the caller's @Wire boolean):
      Pass open="${myComponent.drawerOpen()}" and closeAction="closeDrawer". When open=true:
      the panel is rendered visible; a scrim div covers the page; data-controller="lv-drawer"
      mounts the Stimulus focus-trap controller (Tab cycling, scroll-lock, Esc fires
      closeAction via the controlled/uncontrolled doctrine, return-focus on close). When
      open=false: the panel and scrim carry the `hidden` smart-attribute (absent from the
      a11y tree and tab order) and the controller drops the trap. This is the "filter panel
      that must survive a round-trip" case: open survives the morph because the CALLER @Wire
      owns it.
  The two modes compose cleanly: a trigger + no closeAction = pure uncontrolled; no trigger
  + closeAction = pure controlled. Passing both gives a drawer that the trigger OR the server
  can open.

  DRAWER vs MODAL seam (keep this clean -- do NOT add a third mechanism):
    The drawer is the Dialog pattern rendered to a viewport EDGE instead of the centre. It
    shares the SAME focus-mechanics (Tab trap + scroll-lock + Esc-to-close + return-focus) and
    the SAME scrim element pattern as modal. The drawer realises those mechanics through the
    lv-drawer Stimulus controller (the shared FocusTrap + DismissableController base); modal and
    alert-dialog still compose the legacy data-lievit-focus-trap enhancer until their own
    conversion. The only visual deltas are:
      - data-slot="drawer" (not "dialog") + data-placement + data-size for CSS edge-anchoring.
      - Placement-aware corner radius (inward-facing corners get --lv-radius-lg; edge-flush
        corners are square) expressed as CSS [data-placement] rules in drawer.css.
      - Modal=false variant: no controller (data-controller omitted), no trap, no scrim.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
      The drawer IS a Dialog in the ARIA sense. Every a11y rule is identical to dialog;
      placement is purely visual.
    - APG Dialog (Non-modal) for modal=false: no trap, no scrim, page remains interactive.
    - react-aria useDialog / FocusScope interaction model: keyboard map + focus order
      transcribed into ORIGINAL template + the lv-drawer controller (no react-aria code copied).
    - Ant Design Drawer: feature inventory reference (placement, sizes, closable, push,
      destroyOnClose -- no Ant Design code copied).
    - Styling: ORIGINAL over --lv-* OKLCH tokens; visual look inspired by Tailwind UI
      slide-over (no Tailwind UI code copied).

  A11y (WAI-ARIA APG Dialog, Modal):
    - Panel root: role="dialog". modal=true -> also aria-modal="true" (tells AT that content
      behind the panel is inert). modal=false -> omit aria-modal (APG non-modal variant: the
      AT tree is NOT constrained; user navigates both panel and page freely).
    - aria-labelledby="${id}-title" on the panel -> <h2 id="${id}-title"> inside the header.
      Falls back to aria-label="Drawer" when title is blank (no nameless dialog).
    - aria-describedby NOT auto-wired: rich body content announced as a single string is
      worse for AT than no description (APG explicit guidance); the caller adds it in their
      owned body when there is a single-sentence purpose description.
    - Close button: real <button type="button"> aria-label="Close" (icon-only: accessible
      name mandatory). Controlled path: l:click="${closeAction}". Uncontrolled path:
      <form method="dialog"><button type="submit">.
    - Scrim (modal=true, controlled, open=true): aria-hidden="true"; l:click fires
      closeAction when closable=true. Not focusable.
    - Tab / Shift+Tab: modal=true + controlled -> the lv-drawer controller's FocusTrap traps
      cycling within the panel. modal=false, or uncontrolled -> native platform Tab (no trap).
    - Esc: controlled + closable -> the controller fires closeAction through the shared
      controlled/uncontrolled doctrine (data-lv-wire-close present). controlled + !closable ->
      data-lv-wire-close omitted; Esc is inert (must-act pattern, the trap still holds).
      Uncontrolled: the browser handles Esc natively (native modal dialog).
    - Scroll lock: the controller's FocusTrap sets overflow:hidden on body while the trap is
      active (controlled, modal=true). Browser adds its own for native modal (uncontrolled).
    - Focus restore: the FocusTrap returns focus to the opener on deactivation (controlled).
      Browser restores on native dialog close (uncontrolled).
    - Closed state (controlled, open=false): hidden on panel + scrim removes them from the
      a11y tree and tab order; data-lv-drawer-open-value flips to false and the trap is dropped.

  Controller wiring (data-attribute contract -- the lv-drawer Stimulus controller):
    data-controller="lv-drawer"  on the panel element -- mounts the controller (controlled + modal)
    data-lv-drawer-open-value    on the panel element -- boolean open state; drives trap activation
    data-lv-wire-close           on the panel element -- wire close action on Esc (closable only)
    data-initial-focus           inside the body markup -- receives initial focus first (caller opt-in)

  Focus-mechanics seam (one shared base -- keep clean):
    The Tab trap + scroll-lock + return-focus + initial-focus priority live ONCE in the shared
    FocusTrap (runtime/stimulus/base/focus-trap.ts); the controlled/uncontrolled close doctrine
    lives ONCE in DismissableController. drawer mounts data-controller="lv-drawer" (controlled +
    modal mode only); modal + alert-dialog still compose the legacy data-lievit-focus-trap
    enhancer until their own conversion. Do NOT add a per-component attribute to vary modal vs
    non-modal: omit data-controller entirely for non-modal -- that IS the parameterisation.

  DestroyOnClose: when destroyOnClose=true, the panel subtree is absent from the template
  output when open=false (the @if(open || !destroyOnClose) guard). When false (default), the
  panel is present with `hidden` so the server can trigger openDrawer without a fresh mount.
  The scrim always follows the same presence rule as the panel.

  Push (layout-shift mode, non-modal only): data-push is stamped on the panel when
  push=true + modal=false. CSS [data-push="true"] shifts the page content via a sibling
  CSS selector (the page layout adjusts to accommodate the panel). The template does not
  inline the shift style; the push CSS lives in drawer.css. push=true is ignored when
  modal=true (a modal overlay always covers; a server-side warning is the Java guard's job).

  Params:
    String         id             = "lv-drawer"  unique id per page (commandfor target + titleId linkage).
    String         title          = null          the panel accessible name -> <h2 aria-labelledby>.
                                                  Falls back to aria-label="Drawer" when null/blank.
    String         placement      = "right"       "right" | "left" | "top" | "bottom" -- edge to slide from.
    String         size           = "md"          "sm" | "md" | "lg" | "xl" | "full" -- panel dimension.
    boolean        modal          = true          true: scrim + focus-trap + scroll-lock + inert;
                                                  false: no scrim, no trap, page interactive (APG non-modal).
    boolean        closable       = true          show X button + allow Esc/scrim-click to close.
    boolean        push           = false         true: page shifts by panel size (non-modal only).
    boolean        destroyOnClose = false         true: panel absent from DOM when closed; false: hidden.
    boolean        open           = false         CONTROLLED: true = panel visible. In uncontrolled mode
                                                  (no closeAction) leave at false.
    String         closeAction    = null          SAFE wire action name; when set: controlled mode is active;
                                                  emitted as l:click="${closeAction}" on X button and scrim.
                                                  Null = uncontrolled (native <dialog> + <form method="dialog">).
    gg.jte.Content trigger        = null          trigger slot inside the open button; omit in pure controlled.
    gg.jte.Content content                        the drawer body, OWNED server-rendered (never a <slot>:
                                                  the projection contract that kills the empty-body bug class).
    gg.jte.Content footer         = null          footer action buttons; omitted when null.
    String         cssClass       = ""            extra utility classes on the wrapper span.

  Usage:
    Uncontrolled (zero-JS, browser-native, modal):
      @@template.lievit.drawer(
        id        = "filter-panel",
        placement = "right",
        trigger   = @@`Open filters`,
        title     = "Filter records",
        content   = @@`<p>Body, server-rendered.</p>`,
        footer    = @@`<button type="submit" form="filter-form">Apply</button>`
      )

    Controlled (server-owned open, caller @Wire drives open state):
      @@template.lievit.drawer(
        id          = "detail-panel",
        placement   = "right",
        title       = "Record detail",
        content     = @@`<dl>...infolist...</dl>`,
        size        = "lg",
        closable    = true,
        open        = myComponent.drawerOpen(),
        closeAction = "closeDrawer"
      )
--%>
@import gg.jte.Content
@param String id = "lv-drawer"
@param String title = null
@param String placement = "right"
@param String size = "md"
@param boolean modal = true
@param boolean closable = true
@param boolean push = false
@param boolean destroyOnClose = false
@param boolean open = false
@param String closeAction = null
@param gg.jte.Content trigger = null
@param gg.jte.Content content
@param gg.jte.Content footer = null
@param String cssClass = ""

!{var titleId       = id + "-title";}
!{var hasTitle      = title != null && !title.isBlank();}
!{var isControlled  = closeAction != null && !closeAction.isEmpty();}
!{var trapModal     = isControlled && modal;}
!{var showPanel     = open || !destroyOnClose;}
<%-- Resolve placement to one of the four canonical edges. --%>
!{var edge = switch (placement) {
    case "left", "top", "bottom" -> placement;
    default -> "right";
  };}
<%-- Resolve size to the five canonical values. --%>
!{var sizeVal = switch (size) {
    case "sm", "lg", "xl", "full" -> size;
    default -> "md";
  };}
<%-- Panel dimension token: left/right = width; top/bottom = height.
     Net-new --lv-space-drawer-* tokens are TOKENS_NEEDED (not yet in lievit-tokens.css);
     meanwhile fall back to fixed inline values so the component renders correctly.
     Replace the inline values with var(--lv-space-drawer-*) once the tokens are added.
     --lv-motion-slide is also TOKENS_NEEDED; fall back to --lv-duration-slow meanwhile. --%>
!{var panelDim = switch (sizeVal) {
    case "sm"   -> "320px";
    case "lg"   -> "640px";
    case "xl"   -> "800px";
    case "full" -> ("left".equals(edge) || "right".equals(edge)) ? "100vw" : "100dvh";
    default     -> "480px";
  };}
<%-- Push flag: only meaningful when modal=false; ignored (server validates) for modal=true. --%>
!{var pushActive = push && !modal;}

<span
  data-slot="drawer"
  data-placement="${edge}"
  data-size="${sizeVal}"
  class="inline-block ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(trigger != null)
  <%-- Trigger button: uncontrolled path -- browser opens the <dialog> as a modal (no JS). --%>
  <button
    type="button"
    data-slot="drawer-trigger"
    command="show-modal"
    commandfor="${id}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
  >${trigger}</button>
  @endif

  @if(isControlled && modal && open)
  <%-- Controlled-mode scrim: full-viewport cover behind the panel when modal=true + open=true. --%>
  <div
    data-slot="drawer-scrim"
    aria-hidden="true"
    class="fixed inset-0 z-[var(--lv-z-overlay)] bg-[var(--lv-color-overlay)]"
    l:click="${closable ? closeAction : null}"
  ></div>
  @endif

  <%--
    The panel element.

    UNCONTROLLED mode (isControlled=false):
      - No hidden attribute (browser manages show/hide via showModal()).
      - No data-controller="lv-drawer" (browser native modal trap handles Tab cycling).
      - No data-lv-wire-close (browser cancels on Esc natively).
      - Panel is a <dialog> element (native top-layer, native backdrop).

    CONTROLLED mode (isControlled=true):
      - Panel is a positioned <div role="dialog"> (not a <dialog>: the controlled open/hidden
        cycle uses the HTML hidden attribute, not the dialog open attribute, so a <div> is
        correct -- the <dialog> element's showModal() / close() API is not called).
      - hidden="${!open}" when destroyOnClose=false (smart attr: bare hidden when !open).
      - Subtree absent from output when destroyOnClose=true + !open (the @if guard).
      - data-controller="lv-drawer" (mounts the Stimulus focus-trap controller: Tab cycle +
        scroll-lock + return-focus, held while open) when trapModal (controlled + modal).
      - data-lv-drawer-open-value="${open}" drives trap activation: the morph flips it, Stimulus
        re-fires openValueChanged, the trap is held while true and dropped while false.
      - data-lv-wire-close="${closeAction}" when modal=true + closable=true: the controller's
        Escape path fires it via the shared controlled/uncontrolled doctrine. Omitted when
        !closable => Escape is inert (must-act), the trap still holds.
      - data-push="${pushActive}" when push=true + modal=false (layout-shift CSS hook).
      - Positioned at the chosen edge via CSS [data-placement] + [data-size] in drawer.css.
  --%>
  @if(isControlled)
    @if(showPanel)
    <div
      id="${id}"
      data-slot="drawer-panel"
      data-placement="${edge}"
      data-size="${sizeVal}"
      data-modal="${modal}"
      data-push="${pushActive}"
      role="dialog"
      aria-modal="${modal ? "true" : null}"
      aria-labelledby="${hasTitle ? titleId : null}"
      aria-label="${hasTitle ? null : "Drawer"}"
      hidden="${!open}"
      data-controller="${trapModal ? "lv-drawer" : null}"
      data-lv-drawer-open-value="${trapModal ? (open ? "true" : "false") : null}"
      data-lv-wire-close="${(trapModal && closable) ? closeAction : null}"
      class="fixed z-[var(--lv-z-modal)] flex flex-col overflow-hidden bg-[var(--lv-color-popover)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-xl)]"
      style="--drawer-dim:${panelDim};"
    >
      <%-- Header: title + optional close X button. --%>
      <div
        data-slot="drawer-header"
        class="flex shrink-0 items-start justify-between gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
      >
        <h2
          data-slot="drawer-title"
          id="${titleId}"
          class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]"
        >${hasTitle ? title : ""}</h2>
        @if(closable)
        <%-- Controlled close button: l:click fires the wire round-trip. Icon-only: aria-label mandatory. --%>
        <button
          type="button"
          data-slot="drawer-close"
          aria-label="Close"
          l:click="${closeAction}"
          class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        @endif
      </div>

      <%-- Body: OWNED server-rendered content (never a native slot; the projection contract). --%>
      <div
        data-slot="drawer-body"
        class="flex-1 overflow-y-auto p-[var(--lv-space-6)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]"
      >${content}</div>

      @if(footer != null)
      <%-- Footer: caller-provided action buttons. --%>
      <div
        data-slot="drawer-footer"
        class="flex shrink-0 items-center justify-end gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
      >${footer}</div>
      @endif
    </div>
    @endif
  @else
  <%-- Uncontrolled mode: native <dialog> element (browser owns top-layer + focus-trap + Esc). --%>
  <dialog
    id="${id}"
    data-slot="drawer-panel"
    data-placement="${edge}"
    data-size="${sizeVal}"
    data-modal="true"
    role="dialog"
    aria-modal="true"
    aria-labelledby="${hasTitle ? titleId : null}"
    aria-label="${hasTitle ? null : "Drawer"}"
    class="m-0 flex flex-col overflow-hidden bg-[var(--lv-color-popover)] p-0 text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-xl)]"
    style="--drawer-dim:${panelDim};"
  >
    @if(closable && modal)
    <%-- Backdrop-dismiss (uncontrolled): a full-bleed <form method="dialog"> button behind the panel. --%>
    <form method="dialog" data-slot="drawer-backdrop-form">
      <button
        type="submit"
        data-slot="drawer-scrim"
        aria-label="Close"
        class="fixed inset-0 -z-[1] block h-full w-full cursor-default border-0 bg-[var(--lv-color-overlay)] p-0"
      ></button>
    </form>
    @endif

    <%-- Header. --%>
    <div
      data-slot="drawer-header"
      class="flex shrink-0 items-start justify-between gap-[var(--lv-space-3)] border-b border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
    >
      <h2
        data-slot="drawer-title"
        id="${titleId}"
        class="m-0 text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] text-[var(--lv-color-fg)]"
      >${hasTitle ? title : ""}</h2>
      @if(closable)
      <%-- Uncontrolled close button: <form method="dialog"> native close (no JS). --%>
      <form method="dialog" class="contents">
        <button
          type="submit"
          data-slot="drawer-close"
          aria-label="Close"
          class="inline-flex shrink-0 items-center justify-center rounded-[var(--lv-radius-sm)] border-0 bg-transparent p-[var(--lv-space-1)] text-[var(--lv-color-muted-fg)] transition-[color,box-shadow] duration-[var(--lv-duration-fast)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
        ><svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" width="1.25rem" height="1.25rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      </form>
      @endif
    </div>

    <%-- Body: OWNED server-rendered content. --%>
    <div
      data-slot="drawer-body"
      class="flex-1 overflow-y-auto p-[var(--lv-space-6)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading)] text-[var(--lv-color-fg)]"
    >${content}</div>

    @if(footer != null)
    <div
      data-slot="drawer-footer"
      class="flex shrink-0 items-center justify-end gap-[var(--lv-space-2)] border-t border-[var(--lv-color-border)] px-[var(--lv-space-6)] py-[var(--lv-space-4)]"
    >${footer}</div>
    @endif
  </dialog>
  @endif
</span>
