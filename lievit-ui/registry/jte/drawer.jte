<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui drawer partial -- headless CONTROLLED / UNCONTROLLED side-panel overlay.

  TIER: PARTIAL + ENH (focus-trap.enhancer.ts). No Java component, no @Wire field, no
  _component/_instance/_componentSnapshot params. The open-state belongs to the CALLER.

  CONTROLLED / UNCONTROLLED doctrine (architecture contract, "Overlay & stateful primitives"):
    UNCONTROLLED (default; open=false, closeAction=null, no trigger rendered externally):
      Pass a `trigger` Content slot: a real <button command="show-modal" commandfor="${id}">
      opens the <dialog> as a modal. The browser owns top-layer rendering, native focus-trap,
      ::backdrop, and Escape. Close paths use <form method="dialog"> submits -- zero JS, no
      enhancer, CSP-clean by construction.
    CONTROLLED (closeAction set, open driven by the caller's @Wire boolean):
      Pass open="${myComponent.drawerOpen()}" and closeAction="closeDrawer". When open=true:
      the panel is rendered visible; a scrim div covers the page; data-lievit-focus-trap
      activates the shared focus-trap enhancer (Tab cycling, scroll-lock, Esc fires
      closeAction, inert on behind-content). When open=false: the panel and scrim carry
      the `hidden` smart-attribute (absent from the a11y tree and tab order). This is the
      "filter panel that must survive a round-trip" case: open survives the morph because
      the CALLER @Wire owns it.
  The two modes compose cleanly: a trigger + no closeAction = pure uncontrolled; no trigger
  + closeAction = pure controlled. Passing both gives a drawer that the trigger OR the server
  can open.

  DRAWER vs MODAL seam (keep this clean -- do NOT add a third mechanism):
    The drawer is the Dialog pattern rendered to a viewport EDGE instead of the centre. It
    shares the SAME focus-trap.enhancer.ts (data-lievit-focus-trap + data-lievit-escape-action
    on the panel root) and the SAME scrim element pattern as modal. The only deltas are:
      - data-slot="drawer" (not "dialog") + data-placement + data-size for CSS edge-anchoring.
      - Placement-aware corner radius (inward-facing corners get --lv-radius-lg; edge-flush
        corners are square) expressed as CSS [data-placement] rules in drawer.css.
      - Modal=false variant: no trap activation (data-lievit-focus-trap omitted), no scrim.
    alert-dialog, modal, drawer/sheet all compose the SAME two enhancer attributes. One shared
    enhancer, zero forks.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Dialog (Modal): https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
      The drawer IS a Dialog in the ARIA sense. Every a11y rule is identical to dialog;
      placement is purely visual.
    - APG Dialog (Non-modal) for modal=false: no trap, no scrim, page remains interactive.
    - react-aria useDialog / FocusScope interaction model: keyboard map + focus order
      transcribed into ORIGINAL template + focus-trap.enhancer.ts (no react-aria code copied).
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
    - Page content behind the panel (modal=true, controlled): the focus-trap enhancer adds
      `inert` on the sibling content container while open (stronger than aria-hidden alone).
    - Tab / Shift+Tab: modal=true + controlled -> focus-trap.enhancer.ts traps cycling
      within the panel. modal=false, or uncontrolled -> native platform Tab (no trap).
    - Esc: controlled + closable -> fires closeAction via data-lievit-escape-action.
      controlled + !closable -> escape-action attr omitted; Esc is inert (must-act pattern).
      Uncontrolled: the browser handles Esc natively (native modal dialog).
    - Scroll lock: enhancer adds overflow:hidden on body while trap is active (controlled,
      modal=true). Browser adds its own scroll lock for native modal (uncontrolled modal).
    - Focus restore: enhancer returns focus to the opener on deactivation (controlled).
      Browser restores on native dialog close (uncontrolled).
    - Closed state (controlled, open=false): hidden on panel + scrim removes them from the
      a11y tree and tab order.

  Enhancer wiring (data-attribute contract -- do NOT edit focus-trap.enhancer.ts):
    data-lievit-focus-trap       on the panel element -- activates trap (controlled + modal only)
    data-lievit-escape-action    on the panel element -- wire action name on Esc (closable only)
    data-initial-focus           inside the body markup -- receives initial focus first (caller opt-in)

  Focus-trap seam (alert-dialog + modal compose the SAME two attributes -- keep clean):
    alert-dialog: data-lievit-focus-trap + data-lievit-escape-action on its panel root.
    modal: same two attributes on its <dialog> element.
    drawer: same two attributes on its panel div (controlled + modal mode only).
    Do NOT add a per-component attribute to vary modal vs non-modal: omit the attrs entirely
    for non-modal -- that IS the parameterisation.

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
      - No data-lievit-focus-trap (browser native modal trap handles Tab cycling).
      - No data-lievit-escape-action (browser cancels on Esc natively).
      - Panel is a <dialog> element (native top-layer, native backdrop).

    CONTROLLED mode (isControlled=true):
      - Panel is a positioned <div role="dialog"> (not a <dialog>: the controlled open/hidden
        cycle uses the HTML hidden attribute, not the dialog open attribute, so a <div> is
        correct -- the <dialog> element's showModal() / close() API is not called).
      - hidden="${!open}" when destroyOnClose=false (smart attr: bare hidden when !open).
      - Subtree absent from output when destroyOnClose=true + !open (the @if guard).
      - data-lievit-focus-trap="" (activates enhancer trap + scroll-lock) when modal=true.
      - data-lievit-escape-action="${closeAction}" when modal=true + closable=true.
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
      data-lievit-focus-trap="${trapModal ? "" : null}"
      data-lievit-escape-action="${(trapModal && closable) ? closeAction : null}"
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
