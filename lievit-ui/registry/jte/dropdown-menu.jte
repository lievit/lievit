@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu (v-next) -- a trigger + a floating role="menu" panel.

  TIER: PARTIAL (headless controlled/uncontrolled overlay, REFORGE-AGENT-BRIEF tier doctrine).

  CONTROLLED / UNCONTROLLED model:
    - UNCONTROLLED (default, open=false): the panel is always in the DOM; the native HTML
      popover attribute controls its visibility (top-layer, light-dismiss, browser-managed
      aria-expanded on the trigger). Zero server round-trip to open. The trigger carries
      popovertarget to toggle the panel. Tab/Esc close via the platform + collection-nav.
    - CONTROLLED (open=true): the same panel element is rendered with the HTML popover "open"
      state forced, so it is visible. The caller binds `open` to its own Wire field. The
      caller's Wire component exposes an action (default name "close", or override via
      `escapeAction`) that flips open=false; the popover-anchor enhancer calls it on
      light-dismiss. In controlled mode the caller should NOT pass popovertarget on the
      trigger (it wires l:click to its own action instead); the trigger in this template
      omits popovertarget when open=true.
    - The open param distinguishes the TWO states: open=false (uncontrolled default -- panel in
      DOM, browser hides it) vs open=true (controlled -- panel in DOM, forced visible by adding
      the "open" attribute to the popover element). A controlled-but-closed state (panel absent
      from DOM) is expressed by the caller NOT rendering this template at all, or by using a JTE
      @if wrapping the whole @@template.lievit.dropdown-menu call in the caller's template.

  KEYBOARD (collection-nav.enhancer.ts, roving-tabindex + data-manual-activation="true"):
    - ArrowDown / ArrowUp: roving focus between enabled items; wraps at ends.
    - Home / End: jump to first / last enabled item.
    - Enter / Space: fires the item's own l:click action (manual-activation mode).
    - Esc: in CONTROLLED mode (open=true) fires data-lievit-collection-escape-action on the menu
      root (default "close") to sync server open-state; in UNCONTROLLED mode (open=false) the attr
      is absent, so Esc closes the native popover purely client-side (no wire round-trip).
    - Tab: exits the menu, focus leaves; non-modal (no focus trap, APG Menu + WCAG SC 2.1.2).
    ENHANCER_NEEDED -- roving-mode typeahead: the current collection-nav enhancer only runs
    typeahead in aria-activedescendant mode (the `else` branch in handleTypeahead); roving mode
    needs the same typeahead path gated on isRovingMode.
    ENHANCER_NEEDED -- submenu ArrowRight/Left: collection-nav does not yet support
    data-lievit-collection-submenu-action or ArrowRight-to-open / ArrowLeft-to-close.

  POPOVER SEAM (lv-popover Stimulus controller, converted from popover-anchor.enhancer.ts):
    - Panel carries data-controller="lv-popover" so the shared lv-popover controller owns the
      native-popover seam: opener recording, focus-return on light-dismiss, aria-expanded mirror,
      and the controlled/uncontrolled wire-close doctrine (via the DismissableController base).
      Stimulus connects/disconnects the controller across the wire morph + idiomorph + Turbo Drive,
      so there is no WeakSet/afterCall bookkeeping and no leaked listener. popover-anchor.enhancer.ts
      stays installed for not-yet-converted overlays and SKIPS this panel (its
      data-controller~="lv-popover" guard), so the close never fires twice while both paths coexist.
    - Panel carries popover="auto" + data-lv-opener="${triggerId}" for focus-return on close.
    - CONTROLLED/UNCONTROLLED wire-close: data-lv-wire-close="${escapeAction}" is stamped ONLY
      when open=true (controlled). On light-dismiss the controller reads that attribute and calls the
      named action on the component owning the panel, syncing server open-state. In UNCONTROLLED
      mode (open=false) the attribute is absent and the controller fires NO wire call -- the browser
      owns the open state and the close is purely client-side. This is the controlled/uncontrolled
      doctrine: an uncontrolled overlay must never round-trip a "close" to a host that may have no
      such @LievitAction (that mapped to 410 UNKNOWN_COMPONENT / "page expired" on data tables).
    - In controlled mode the caller's Wire component exposes the named action (default "close",
      override via escapeAction); the configurable name needs no controller patch.

  OVERLAY: CSS Anchor Positioning.
    - The trigger sets anchor-name; the panel sets position-anchor + position-area.
    - placement: "bottom-start" (default) | "bottom-end" | "top-start" | "top-end".
    - position-try-fallbacks:flip-block flips to the opposite block side when cramped.

  A11y (WAI-ARIA APG Menu Button):
    - Trigger: native <button> aria-haspopup="menu" aria-expanded aria-controls.
    - Panel: role="menu" aria-labelledby aria-orientation="vertical".
    - Items: role="menuitem" / menuitemcheckbox / menuitemradio (set by the item partial).
    - Separators: role="separator".
    - Groups: role="group" aria-labelledby (set by group partial).
    - Focus model: roving tabindex (collection-nav, data-manual-activation).
    - No focus trap (non-modal; Tab exits, WCAG SC 2.1.2).

  Params:
    String         id = "lv-dropdown-menu"    unique id for the panel element (popovertarget link).
    gg.jte.Content trigger                    content inside the trigger <button>.
    gg.jte.Content content                    menu items (compose from dropdown-menu/item + helpers).
    String         placement = "bottom-start" panel placement: "bottom-start" | "bottom-end" |
                                              "top-start" | "top-end".
    boolean        disabled = false           disables the trigger button.
    boolean        open = false               CONTROLLED mode: true = panel forced visible (the HTML
                                              popover open state). false = uncontrolled (browser owns).
    String         escapeAction = "close"     wire action name the collection-nav fires on Esc.
                                              Override to match your Wire component's action name.
    String         cssClass = ""             extra utility classes on the root wrapper.
    String         triggerClass = ""         extra utility classes on the trigger <button>.

  Usage (UNCONTROLLED -- default, browser owns open state):
    @@template.lievit.dropdown-menu(
      id = "user-menu",
      trigger = @@`Ada`,
      content = @@`
        @@template.lievit.dropdown-menu.item(href = "/profile", label = "Profile", icon = "user")
        @@template.lievit.dropdown-menu.separator()
        @@template.lievit.dropdown-menu.item(label = "Log out", icon = "log-out", formAction = "/logout")
      `
    )

  Usage (CONTROLLED -- caller Wire field owns the open state):
    @@template.lievit.dropdown-menu(
      id = "actions-menu",
      open = ${myWire.open()},
      escapeAction = "close",
      trigger = @@`<span l:click="toggleOpen">Actions</span>`,
      content = @@`...`
    )
--%>
@param String id = "lv-dropdown-menu"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String placement = "bottom-start"
@param boolean disabled = false
@param boolean open = false
@param String escapeAction = "close"
@param String cssClass = ""
@param String triggerClass = ""

!{var triggerId = id + "-trigger";}
!{var anchorName = "--" + id + "-anchor";}
<%-- Map placement to CSS Anchor Positioning position-area values.
     "span-right" extends the panel rightward from the anchor's left edge (start-aligned).
     "span-left"  extends the panel leftward from the anchor's right edge (end-aligned). --%>
!{var positionArea = switch (placement) {
    case "bottom-end" -> "bottom span-left";
    case "top-start"  -> "top span-right";
    case "top-end"    -> "top span-left";
    default           -> "bottom span-right";
  };}

<span
  data-slot="dropdown-menu"
  data-open="${open ? "true" : "false"}"
  class="relative inline-block ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <%-- TRIGGER: real <button> so Enter/Space + focus are platform-native.
       Uncontrolled (open=false): popovertarget="${id}" lets the browser toggle the panel.
       Controlled (open=true): popovertarget is omitted (null drops the attr in JTE smart-
       attribute mode); the caller's trigger content carries the l:click wire action.
       aria-expanded: in uncontrolled mode the browser also syncs it; we set it from the param
       so the SSR HTML is accurate. In controlled mode it reflects the server-owned open state. --%>
  <button
    id="${triggerId}"
    type="button"
    data-slot="dropdown-menu-trigger"
    popovertarget="${open ? null : id}"
    aria-haspopup="menu"
    aria-expanded="${open ? "true" : "false"}"
    aria-controls="${id}"
    disabled="${disabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] ${triggerClass}"
    style="anchor-name:${anchorName};"
  >${trigger}</button>

  <%-- MENU PANEL: popover="auto" in both modes.
       Uncontrolled mode (open=false): the panel is always in the DOM; the native popover
       hides it until the trigger fires. top-layer render escapes overflow:hidden ancestors.
       Controlled mode (open=true): the "open" attribute on the popover element forces the
       panel visible (the HTML popover open state); the caller's Wire field drives re-render.
       data-lv-opener links the popover-anchor enhancer so focus returns to the trigger on close.
       data-lievit-collection activates collection-nav in roving-tabindex mode for keyboard nav. --%>
  <div
    id="${id}"
    popover="auto"
    data-controller="lv-popover"
    open="${open}"
    data-slot="dropdown-menu-content"
    role="menu"
    aria-labelledby="${triggerId}"
    aria-orientation="vertical"
    data-lv-opener="${triggerId}"
    data-lv-wire-close="${open ? escapeAction : null}"
    data-lievit-collection
    data-lievit-collection-roving-tabindex="true"
    data-lievit-collection-orientation="vertical"
    data-lievit-collection-wrap="true"
    data-lievit-collection-escape-action="${open ? escapeAction : null}"
    data-manual-activation="true"
    class="m-0 box-border min-w-[10rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)] outline-none"
    style="position-anchor:${anchorName};position-area:${positionArea};position-try-fallbacks:flip-block;margin-block:var(--lv-space-1);z-index:var(--lv-z-popover);font-family:var(--lv-font-sans);"
  >${content}</div>
</span>
