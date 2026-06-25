<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  navigation-menu partial -- <nav> landmark with top-level items that reveal rich panels via
  native [popover] + the shared popover-anchor.enhancer.ts (UNCONTROLLED, no server round-trip
  just to open/close). Keyboard supplement (Esc, arrow keys, typeahead) via the
  lv-navigation-menu Stimulus controller (data-controller on the <nav>).

  TIER: PARTIAL + ENH (ADR-0012, v-next). The disclosure open/close is UNCONTROLLED:
    - Native `[popover]` closes on Esc + light-dismiss natively (browser built-in).
    - popover-anchor.enhancer.ts wires opener recording + focus return on close.
    - the lv-navigation-menu Stimulus controller adds supplemental arrow-key navigation + typeahead
      (APG Disclosure Navigation "nav" mode: focus moves, tabindex stays 0 on every item).
  No WIRE component; no server round-trip to open/close. This is the `navigation-menu-static`
  tier described in the spec, promoted to the primary v-next API because the UNCONTROLLED path
  is the correct default (APG Disclosure Navigation).

  STRUCTURE (scientific decision rule): WAI-ARIA APG Disclosure Navigation pattern
  (https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/examples/disclosure-navigation/).
  NOT role=menu / role=menubar -- those describe application-widget menus with mandatory arrow-key
  roving. This is a <nav> landmark with real <a href> links; AT announces "navigation", not "menu".
  Disclosure semantics: each item is either a plain <a> leaf link or a <button aria-expanded
  aria-controls> that reveals a panel. All top-level triggers/links stay in natural Tab order
  (tabindex not managed by the enhancer -- APG says Tab is primary, arrow keys are supplemental).

  A11y (APG Disclosure Navigation):
    - <nav aria-label> unique landmark name (required when multiple <nav> on page).
    - <ul role="list"> items in natural Tab order (tabindex="0" all, no roving tabindex regime).
    - Leaf <a>: aria-current="page" when href matches activeHref; aria-disabled="true" + no href
      when disabled.
    - Disclosure <button>: aria-expanded="true"/"false"; aria-controls="panel-<id>".
    - Panel <div id="panel-<id>">: hidden when closed (removed from Tab order); visible when open.
    - Badge <span>: aria-hidden="true" (decorative).
    - Icons: aria-hidden="true" (decorative, including chevron on trigger).
    - lv-navigation-menu controller supplies: Esc (optional escape action) + arrow-key supplement + typeahead.
    - popover-anchor.enhancer.ts supplies: opener recording + focus return on light-dismiss.
    - No focus-trap: panels are non-modal.

  Panels wired as [popover]:
    - Each panel div carries popover="auto" + data-lv-opener="<triggerId>" (popover-anchor reads it).
    - The trigger button carries popovertarget="panel-<id>" (native toggle binding).
    - Native browser: Esc closes the topmost [popover=auto]; light-dismiss (click outside) closes.
    - For the static variant, aria-expanded is toggled by a companion script-free CSS trick:
      :has([popover]:popover-open) is NOT available universally (2026 CSS WG, limited support);
      so aria-expanded is managed by the popover-anchor enhancer's ENHANCER_NEEDED note below.

  ENHANCER_NEEDED (see report): the popover-anchor.enhancer.ts needs an additive hook that
  toggles aria-expanded on the opener trigger whenever the popover's toggle event fires
  (newState "open" -> aria-expanded="true"; newState "closed" -> aria-expanded="false"). The
  current enhancer only records the opener + returns focus on close; it does NOT set aria-expanded.
  Until then, aria-expanded on the trigger reflects the SERVER-SET value (false on initial render);
  the visual open/close works, but aria-expanded lags the native popover state. Flag:
  ENHANCER_NEEDED: popover-anchor -- toggle aria-expanded on opener trigger on popover toggle event.

  KEYBOARD NAV ("nav" mode): real DOM focus moves on arrow keys, but NO roving tabindex (all items
  keep tabindex="0") -- the APG Disclosure Navigation supplemental pattern (arrow keys call
  element.focus(); tabindex and aria-activedescendant are never touched). This is owned by the
  lv-navigation-menu Stimulus controller. The data-lievit-collection* attributes below remain the
  config surface the controller reads (orientation, wrap, optional escape action); the old shared
  collection-nav.enhancer.ts (which still serves the Listbox/Menu/Tabs modes for other components)
  SKIPS this <nav> via its data-controller~="lv-navigation-menu" guard, so the keystroke is handled
  exactly once.

  Params:
    gg.jte.Content content      the <li> items -- compose from navigation-menu/link (leaf)
                                  and navigation-menu/menu (disclosure trigger+panel).
    String label = "Main"       aria-label on the <nav> landmark (required for uniqueness).
    String orientation = "horizontal"   "horizontal" | "vertical". Controls flex direction of
                                  the trigger list; vertical stacks items in a column.
    String size = "md"          "sm" | "md" | "lg" -- controls trigger min-height token.
    String cssClass = ""        extra utility classes on the <nav> root.
    String attrs = ""           TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @template.lievit.navigation-menu(label = "Primary", content = @`
      @template.lievit.navigation-menu.menu(id = "products", label = "Products", content = @`
        @template.lievit.navigation-menu.link(href = "/analytics", label = "Analytics",
            description = "Track everything", icon = "eye")
        @template.lievit.navigation-menu.link(href = "/engagement", label = "Engagement")
      `)
      @template.lievit.navigation-menu.link(href = "/docs", label = "Docs",
          activeHref = activeHref)
    `)
--%>
@param gg.jte.Content content
@param String label = "Main"
@param String orientation = "horizontal"
@param String size = "md"
@param String cssClass = ""
@param String attrs = ""

!{var _isHorizontal = !"vertical".equals(orientation);}
!{var _listDir = _isHorizontal ? "row" : "column";}
!{var _listAlign = _isHorizontal ? "center" : "stretch";}
!{var _minH = switch (size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-10)";
    default   -> "var(--lv-space-9)";
  };}
<%-- Pass the resolved trigger-height down as a CSS custom property so the sub-partials (link,
     menu) can consume --lv-nm-trigger-h without duplicating the size switch. --%>
!{var _sizeVar = "--lv-nm-trigger-h:" + _minH + ";";}

<nav
  data-slot="navigation-menu"
  data-variant="${orientation}"
  data-size="${size}"
  aria-label="${label}"
  data-controller="lv-navigation-menu"
  data-action="keydown->lv-navigation-menu#onKeydown"
  data-lievit-collection
  data-lievit-collection-orientation="${orientation}"
  data-lievit-collection-wrap="true"
  data-lievit-collection-mode="nav"
  class="${cssClass}"
  style="font-family:var(--lv-font-sans);font-size:var(--lv-text-sm);${_sizeVar}"
  $unsafe{attrs}
>
  <ul
    data-slot="navigation-menu-list"
    role="list"
    style="display:flex;flex-direction:${_listDir};align-items:${_listAlign};gap:var(--lv-space-1);list-style:none;margin:0;padding:0;"
  >${content}</ul>
</nav>
