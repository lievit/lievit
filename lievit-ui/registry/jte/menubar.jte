@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui menubar partial -- a horizontal bar of top-level menu buttons (APG Menubar pattern).

  TIER: PARTIAL (headless uncontrolled overlay, REFORGE-AGENT-BRIEF tier doctrine).

  UNCONTROLLED model: the bar itself carries no server-owned open state. Each top-level
  trigger in the `content` slot is an ordinary dropdown-menu (or a plain button/link)
  whose open/closed lifecycle is browser-owned via the native popover API + the
  collection-nav enhancer. No Java component, no wire round-trip to open or close a menu.
  Actions inside individual menu items carry their own l:click / href directives; THOSE
  are the server interactions. The bar is stateless.

  STRUCTURE: a single semantic landmark (nav or div) with role="menubar" + aria-label +
  aria-orientation="horizontal" that wraps the caller's top-level trigger items via the
  `content` Content slot. Each item inside the slot MUST carry:
    - role="menuitem" (or "menuitem" is implied by the platform for <button>/<a> within
      role="menubar", but explicit is clearer)
    - data-lievit-item (the collection-nav item selector)
    - tabindex="-1" (except the first item, which gets tabindex="0" as the roving seed)

  COLLECTION-NAV (horizontal roving-tabindex):
    The bar root carries data-lievit-collection + data-lievit-collection-orientation="horizontal"
    + data-lievit-collection-roving-tabindex="true" + data-lievit-collection-wrap="true".
    This makes the enhancer manage Left/Right Arrow roving across the top-level triggers,
    Home/End, and typeahead within the bar row.

  ENHANCER GAPS (ENHANCER_NEEDED -- do not hand-roll these):
    - Down/Up Arrow on a horizontal bar item should open the focused trigger's submenu and
      move focus into it. The current collection-nav does not fire a submenu-open event
      when orientation="horizontal" and ArrowDown is pressed (ArrowDown is not a navigation
      key in horizontal mode, so it falls through unhandled). A data-lievit-collection-down-opens
      hook is needed so the bar fires lv:collection-submenu-open on Down Arrow as well.
    - The two-axis hop (Right/Left Arrow while a vertical submenu is open closes the current
      submenu, moves to the next/previous top-level trigger, and opens its submenu) requires
      coordination between the horizontal collection-nav instance (bar) and each vertical
      collection-nav instance (submenu). The current enhancer's ArrowRight/Left in a vertical
      submenu fires the escape-action, which closes the submenu and returns focus to the
      bar trigger -- that IS the right intermediate step. The bar then receives focus, and
      subsequent Arrow keystrokes navigate the bar normally. Full "open-next-automatically"
      hop is not wired until the enhancer supports the two-axis handshake.
    See §ENHANCER_NEEDED in the structured report below.

  KEYBOARD (via collection-nav, horizontal mode):
    Bar context:
      Right Arrow          next top-level trigger (wraps to first)
      Left Arrow           previous top-level trigger (wraps to last)
      Home                 first top-level trigger
      End                  last top-level trigger
      typeahead            jump to trigger whose label starts with the typed char
      Down/Up Arrow        ENHANCER_NEEDED: should open the trigger's submenu
      Tab / Shift+Tab      exits the bar (no trap -- non-modal)
    Submenu context (owned by collection-nav on each dropdown-menu panel, vertical mode):
      Down/Up Arrow        roving within the submenu
      Home / End           first / last submenu item
      Esc                  close submenu + return focus to the top-level trigger
      Right/Left Arrow     close submenu + move to next/prev bar trigger
                           (ENHANCER_NEEDED: auto-open of next submenu)
      Tab / Shift+Tab      close ALL open submenus + exit bar
      typeahead            jump to submenu item starting with typed char
      Enter / Space        activate item or open nested submenu

  POPOVER SEAM: each dropdown-menu inside the content slot uses the native popover API for
  its panel (popover="auto"). The bar itself does not manage any popover.

  A11y (WAI-ARIA APG Menubar, https://www.w3.org/WAI/ARIA/apg/patterns/menubar/):
    - Bar container: role="menubar" aria-label aria-orientation="horizontal".
    - Top-level triggers: role="menuitem" (on <button> or <a> children inside the slot).
    - Roving tabindex: exactly one trigger has tabindex="0"; all others have tabindex="-1".
      The server renders the FIRST trigger with tabindex="0"; the enhancer manages subsequent
      roving as focus moves.
    - No focus trap: the menubar is non-modal. Tab exits the bar.

  COMPOSITION: the caller composes the content slot from multiple
  @template.lievit.dropdown-menu(...) calls (one per top-level menu). The dropdown-menu
  trigger element MUST additionally carry role="menuitem" + data-lievit-item so the
  collection-nav bar instance can discover it. Use the triggerClass / attrs channel on
  dropdown-menu to inject these.

  Sizes: size controls the bar block-size (height) via a CSS variable. Individual trigger
  items grow to fill the bar height via `height:100%` + `align-items:center` on the bar.

  Params:
    String           id          = "lv-menubar"  unique id for the bar element.
    String           ariaLabel                    accessible name for the role="menubar" container
                                                  (required; SR announces the bar by this name).
    String           size        = "md"           "sm" | "md" | "lg" -- bar block-size.
                                                  sm: --lv-space-8 (32px dense toolbar)
                                                  md: --lv-space-9 (36px, default)
                                                  lg: --lv-space-10 (40px prominent)
    gg.jte.Content   content                      top-level menu triggers (dropdown-menu instances
                                                  or plain button/link items). Each trigger MUST
                                                  carry role="menuitem" + data-lievit-item.
    String           cssClass    = ""             extra utility classes on the bar root.

  Usage:
    @@template.lievit.menubar(
      id = "app-menu",
      ariaLabel = "Application menu",
      content = @@`
        @@template.lievit.dropdown-menu(
          id = "file-menu",
          triggerClass = "h-full rounded-none px-[var(--lv-space-3)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:bg-[var(--lv-color-accent)]",
          trigger = @@`File`,
          content = @@`
            @@template.lievit.dropdown-menu.item(label = "New File", shortcut = "Ctrl+N")
            @@template.lievit.dropdown-menu.item(label = "Open...", shortcut = "Ctrl+O")
            @@template.lievit.dropdown-menu.separator()
            @@template.lievit.dropdown-menu.item(label = "Save", shortcut = "Ctrl+S")
          `
        )
        @@template.lievit.dropdown-menu(
          id = "edit-menu",
          triggerClass = "h-full rounded-none px-[var(--lv-space-3)] hover:bg-[var(--lv-color-accent)] hover:text-[var(--lv-color-accent-fg)] focus-visible:bg-[var(--lv-color-accent)]",
          trigger = @@`Edit`,
          content = @@`
            @@template.lievit.dropdown-menu.item(label = "Undo", shortcut = "Ctrl+Z")
            @@template.lievit.dropdown-menu.item(label = "Redo", shortcut = "Ctrl+Y")
          `
        )
      `
    )
--%>
@param String id = "lv-menubar"
@param String ariaLabel
@param String size = "md"
@param gg.jte.Content content
@param String cssClass = ""

!{var barHeight = switch (size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}
!{var textSize = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}

<%-- BAR CONTAINER:
     role="menubar" is the landmark for the APG Menubar pattern.
     aria-orientation="horizontal" is required: the APG mandates it for menubars (vertical is the
     default when omitted, so explicit "horizontal" is load-bearing for AT behaviour).
     data-lievit-collection activates collection-nav for Left/Right Arrow roving across top-level
     triggers (horizontal orientation, roving-tabindex model, wrap, manual-activation).
     data-size is the hook for adopter CSS or Tailwind variant overrides. --%>
<nav
  id="${id}"
  role="menubar"
  aria-label="${ariaLabel}"
  aria-orientation="horizontal"
  data-slot="menubar"
  data-size="${size}"
  data-lievit-collection
  data-lievit-collection-roving-tabindex="true"
  data-lievit-collection-orientation="horizontal"
  data-lievit-collection-wrap="true"
  class="flex flex-row items-stretch ${textSize} ${cssClass}"
  style="height:${barHeight};background:var(--lv-color-bg);color:var(--lv-color-fg);font-family:var(--lv-font-sans);"
>${content}</nav>
