@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu partial -- a trigger + a menu of REAL items (links / actions), with
  ZERO shipped JS. Server-first PARTIAL (ADR-0012, Wave 2/3): the Lit island is gone. Built on the
  SAME overlay seam as the popover partial (native `popover` attribute + CSS Anchor Positioning).

  TIER DECISION (why PARTIAL, not WIRE): a dropdown menu, once you accept the server-pure overlay,
  is "pure display, no client state" -- the items are server-owned DATA the controller already has,
  the entries are real <a href> / <button>, and "reveal the menu" needs no server round-trip and no
  durable state (the browser's native popover owns it). There is nothing to hold server-side: no
  @Wire field, no action, no wire component. gest already proves the appetite for this: its shell
  menus use native <details>/<summary> JS-off; this is the richer, top-layer, light-dismissing
  equivalent. Hence `registry:jte`. (Where a menu's ITEMS are a server feed -- a filtered command
  palette -- use the command WIRE component instead; this partial is the static-items case.)

  STRUCTURE (scientific decision rule): WAI-ARIA APG menu-button pattern (Radix DropdownMenu model,
  the source the dropped island cited), rendered with platform primitives:
    - SHOW/HIDE = the native HTML `popover` attribute. A <button popovertarget aria-haspopup=menu>
      toggles a `popover="auto"` panel: top-layer render (no z-index war, escapes overflow),
      light-dismiss on outside-click + Escape, aria-expanded wired by the browser. No JS, CSP-clean.
    - POSITION = CSS Anchor Positioning (anchor-name / position-anchor / position-area), the same
      mechanism the popover partial documents; flip-block flips the panel above when cramped.
    - ITEMS = real <a href> (the browser navigates, middle-click / open-in-new-tab work) or real
      <button> (a form action / l:click in the adopter's markup), each role="menuitem". This is the
      island's "slotted-nav real anchors" philosophy made the DEFAULT: compose real links, never
      re-render them from a data shape.
  Native <button> menu items + the platform popover beat a Lit reactive tree: the menu CANNOT fail
  to project (the whole point of the pivot), and the links work with JS off.

  Keyboard: Tab / Shift+Tab move through the real focusable items (the platform); Enter / Space
  activate them (an <a> navigates, a <button> submits). The APG arrow-key ROVING the island added
  is the one piece that needs JS; it is dropped by default for zero-JS purity. An adopter who wants
  roving drops a tiny CSP-clean typed-TS enhancer that listens for ArrowUp/Down on the panel (the
  documented escape-hatch, NOT a shipped Lit island).

  A11y (WAI-ARIA APG menu-button): trigger <button popovertarget aria-haspopup="menu"> (the browser
  adds aria-expanded while open); panel role="menu"; items role="menuitem" / "menuitemcheckbox" /
  "menuitemradio"; separators role="separator"; a disabled item carries aria-disabled.

  Params:
    String         id = "lv-dropdown-menu"  the panel id (the popovertarget link target). Unique/page.
    gg.jte.Content trigger                  the trigger CONTENT (label / icon) inside the <button>.
    gg.jte.Content content                  the menu items, composed from dropdown-menu/item +
                                            dropdown-menu/separator (OWNED, server-rendered, never <slot>).
    String         placement = "bottom"     "bottom" | "top": preferred side (flips when cramped).
    boolean        disabled = false         disables the trigger so the menu cannot open.
    String         cssClass = ""            extra utility classes on the wrapper.
    String         triggerClass = ""        extra utility classes on the trigger <button> itself
                                            (e.g. "w-full justify-between" for a full-width row trigger:
                                            the wrapper's w-full alone leaves the inline-flex button
                                            content-tight, so the button needs its own width token).

  Usage:
    @@template.lievit.dropdown-menu(
      id = "user-menu",
      trigger = @@`Ada`,
      content = @@`
        @@template.lievit.dropdown-menu.item(href = "/profile", label = "Profile", icon = "user")
        @@template.lievit.dropdown-menu.item(href = "/settings", label = "Settings", icon = "settings")
        @@template.lievit.dropdown-menu.separator()
        @@template.lievit.dropdown-menu.item(label = "Log out", icon = "log-out", formAction = "/logout")
      `
    )
--%>
@param String id = "lv-dropdown-menu"
@param gg.jte.Content trigger
@param gg.jte.Content content
@param String placement = "bottom"
@param boolean disabled = false
@param String cssClass = ""
@param String triggerClass = ""
!{var anchorName = "--" + id + "-anchor";}
!{var area = "top".equals(placement) ? "top span-all" : "bottom span-all";}

<span data-slot="dropdown-menu" class="relative inline-block ${cssClass}" style="font-family:var(--lv-font-sans);">
  <button
    type="button"
    data-slot="dropdown-menu-trigger"
    popovertarget="${id}"
    aria-haspopup="menu"
    disabled="${disabled}"
    class="inline-flex items-center gap-[var(--lv-space-1)] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-bg)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] ${triggerClass}"
    style="anchor-name:${anchorName};"
  >${trigger}</button>

  <div
    id="${id}"
    popover="auto"
    data-slot="dropdown-menu-content"
    role="menu"
    class="m-0 box-border min-w-[10rem] rounded-[var(--lv-radius-md)] border border-[var(--lv-color-border)] bg-[var(--lv-color-popover)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-popover-fg)] shadow-[var(--lv-shadow-md)]"
    style="position-anchor:${anchorName}; position-area:${area}; position-try-fallbacks:flip-block; margin-block:var(--lv-space-1); z-index:var(--lv-z-popover); font-family:var(--lv-font-sans);"
  >${content}</div>
</span>
