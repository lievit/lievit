<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui navigation-menu/link partial -- one real <a href> entry of a navigation-menu, either
  a top-level bare link or a link inside a rich panel (Wave 2, server-first, no JS).

  TIER: STATIC presentational -> JTE partial. A plain anchor; navigation is the browser's. The
  active link carries aria-current="page" + a token-styled highlight, derived server-side from the
  `active` param (which route is being rendered), never client state.

  STRUCTURE (Radix NavigationMenu link model): a real <a> so middle-click / open-in-new-tab work.
  `inPanel` switches between the top-level pill style and the richer in-panel row (icon + label +
  optional description), the same two presentations the dropped island rendered.

  A11y: a real anchor; aria-current="page" on the active one (the standard "current page" cue the
  platform + AT understand). The optional icon is decorative (aria-hidden via the icon partial's
  default).

  Params:
    String href                the destination (a real anchor href).
    String label               the visible link text.
    String description = ""    a short line under the label (in-panel rows only).
    String icon = ""           an optional Lucide icon name (in-panel rows only).
    boolean active = false     marks the current page (aria-current + highlight).
    boolean inPanel = false    true => the richer in-panel row; false => a top-level pill.
    String cssClass = ""       extra utility classes on the anchor.

  Usage:
    @@template.lievit.navigation-menu.link(href = "/docs", label = "Docs", active = true)
    @@template.lievit.navigation-menu.link(href = "/analytics", label = "Analytics", description = "Track everything", icon = "eye", inPanel = true)
--%>
@param String href
@param String label
@param String description = ""
@param String icon = ""
@param boolean active = false
@param boolean inPanel = false
@param String cssClass = ""
@if(inPanel)
    <li>
        <a
            href="${href}"
            data-slot="navigation-menu-panel-link"
            aria-current="${active ? "page" : null}"
            class="flex items-start ${cssClass}"
            style="gap: var(--lv-space-2); padding: var(--lv-space-2) var(--lv-space-3); border-radius: var(--lv-radius-sm); color: var(--lv-color-fg); text-decoration: none; background: ${active ? "var(--lv-color-surface)" : "transparent"};"
        >
            @if(!icon.isEmpty())
                <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex; margin-top: 2px;">@template.lievit.icon(name = icon, size = "1rem")</span>
            @endif
            <span style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 500;">${label}</span>
                @if(!description.isEmpty())
                    <span style="color: var(--lv-color-muted); font-size: var(--lv-text-xs); line-height: 1.3;">${description}</span>
                @endif
            </span>
        </a>
    </li>
@else
    <li>
        <a
            href="${href}"
            data-slot="navigation-menu-link"
            aria-current="${active ? "page" : null}"
            class="inline-flex items-center ${cssClass}"
            style="gap: var(--lv-space-1); padding: var(--lv-space-2) var(--lv-space-3); border-radius: var(--lv-radius-sm); color: var(--lv-color-fg); text-decoration: none; background: ${active ? "var(--lv-color-surface)" : "transparent"};"
        >${label}</a>
    </li>
@endif
