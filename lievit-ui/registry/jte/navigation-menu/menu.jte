@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui navigation-menu/menu partial -- one top-level navigation-menu entry that reveals a
  rich panel of links on hover / focus-within, CSS-only (Wave 2, server-first, no JS, no state).

  TIER: STATIC presentational -> JTE partial. The "open" of the panel is a CSS group-hover /
  group-focus-within reveal (the same disclosure the hover-card partial uses), so there is no
  client state and no server round-trip: nothing to hold in a @Wire field. `open` is an optional
  SSR hint (render the panel open for a no-hover/forced-open server render or a test); the live
  open/close is CSS. This is why navigation-menu is a PARTIAL, not a WIRE component.

  STRUCTURE (Radix NavigationMenu trigger model): a real <button aria-expanded aria-controls>
  inside a `group` <li>; the panel is a sibling <div role="region" aria-label> of real <a> links
  (navigation-menu/link, inPanel=true). CSS reveals the panel when the group is hovered or holds
  focus (group-hover / group-focus-within). The panel sits in normal flow under its trigger
  (absolute, top-full), so no @floating-ui/dom / Anchor Positioning is needed; a small padding
  bridge keeps the trigger->panel gap crossable. The trigger carries NO aria-expanded: a CSS-only
  :hover / :focus-within reveal has no JS to keep the attribute in sync, so a frozen SSR
  aria-expanded would LIE to assistive tech (claim "collapsed" while the panel is visibly open).
  We drop it and keep aria-haspopup + aria-controls; the platform exposes the revealed links via
  focus order. An adopter who wants a live aria-expanded converts the reveal to a JS disclosure.

  A11y: <button aria-haspopup="true" aria-controls> + <div role="region" aria-label>; the links
  inside are real anchors. Keyboard users reach the panel via Tab (:focus-within reveals it), so no
  custom key handler is needed; Escape is the browser's blur.

  Params:
    String key                 a stable key (used in the trigger/panel ids).
    String label               the trigger label.
    boolean open = false       SSR hint: render the panel visible server-side (no-hover render / a test).
    gg.jte.Content content     the in-panel links (navigation-menu/link with inPanel = true).
    String cssClass = ""       extra utility classes on the <li>.

  Usage:
    @@template.lievit.navigation-menu.menu(key = "products", label = "Products", content = @@`
      @@template.lievit.navigation-menu.link(href = "/analytics", label = "Analytics", icon = "eye", inPanel = true)
    `)
--%>
@param String key
@param String label
@param boolean open = false
@param gg.jte.Content content
@param String cssClass = ""
!{var triggerId = "navigation-menu-trigger-" + key;}
!{var panelId = "navigation-menu-panel-" + key;}
<li data-slot="navigation-menu-item" data-key="${key}" class="group ${cssClass}" style="position: relative;">
    <button
        type="button"
        id="${triggerId}"
        data-slot="navigation-menu-trigger"
        aria-haspopup="true"
        aria-controls="${panelId}"
        class="inline-flex items-center"
        style="gap: var(--lv-space-1); padding: var(--lv-space-2) var(--lv-space-3); border-radius: var(--lv-radius-sm); color: var(--lv-color-fg); background: transparent; border: 0; cursor: pointer; font: inherit;"
    >
        ${label}
        <span aria-hidden="true" style="display: inline-flex; transition: transform 150ms ease;" class="group-hover:rotate-180 group-focus-within:rotate-180">@template.lievit.icon(name = "chevron-down", size = "1rem")</span>
    </button>
    <div
        id="${panelId}"
        role="region"
        aria-label="${label}"
        data-slot="navigation-menu-content"
        class="${open ? "" : "hidden "}group-hover:block group-focus-within:block"
        style="position: absolute; top: 100%; left: 0; z-index: var(--lv-z-popover); min-width: 16rem; margin-top: var(--lv-space-1); background: var(--lv-color-bg); border: 1px solid var(--lv-color-border); border-radius: var(--lv-radius-md); box-shadow: var(--lv-shadow-md); padding: var(--lv-space-2);"
    >
        <ul data-slot="navigation-menu-content-list" style="list-style: none; margin: 0; padding: 0; display: grid; gap: 2px;">
            ${content}
        </ul>
    </div>
</li>
