@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/item partial -- one navigation entry of a sidebar: a real <a href> with an
  optional Lucide icon, label and badge, OR a collapsible parent that discloses a sub-tree of
  child items (Wave 3, server-first, no JS, no client state).

  TIER: STATIC presentational -> JTE partial. A leaf item is a plain anchor; navigation is the
  browser's, and which one is current is a server fact (`active` -> aria-current="page"), never
  client state. A parent item (one carrying a `content` sub-tree) discloses its children with a
  native <details>/<summary> -- the CSP-clean, zero-JS disclosure (the same JS-off pattern gest
  uses for its dropdowns); `open` is the server-rendered hint (open it when a child is current).
  No wire, no enhancer for the sub-tree: <details> toggles itself.

  STRUCTURE (shadcn Sidebar SidebarMenuItem / SidebarMenuSub model): a leaf is <li><a href>; a
  parent is <li><details><summary>...</summary><ul class="...sub">...children...</ul></details>.
  The label hides on the collapsed icon rail (lv-sidebar-collapsible), leaving the icon as the
  rail glyph -- so leaf items want an `icon`.

  A11y: leaf = a real <a> with aria-current="page" when active; parent = native <details>, whose
  <summary> is a real disclosure button the platform exposes with aria-expanded for free (Enter /
  Space toggle it natively). The icon is decorative (the icon partial's default aria-hidden).

  Params:
    String key                 a stable key (used in the disclosure id).
    String label               the visible entry text.
    String href = ""           leaf destination; required for a leaf, ignored for a parent.
    String icon = ""           optional Lucide icon name (the rail glyph when collapsed).
    String badge = ""          optional short badge text (counts / "new"); hidden on the rail.
    boolean active = false     marks the current page (aria-current="page" + highlight).
    boolean disabled = false   dims the entry + drops it from the tab order.
    boolean open = false       parent only: render the <details> open (e.g. a child is current).
    gg.jte.Content content     optional child items (sidebar/item entries) => makes this a parent.
    String cssClass = ""       extra utility classes on the entry.

  Usage:
    @@template.lievit.sidebar.item(key = "home", href = "/", label = "Home", icon = "house", active = true)
    @@template.lievit.sidebar.item(key = "settings", label = "Settings", icon = "settings", open = true, content = @@`
      @@template.lievit.sidebar.item(key = "team", href = "/settings/team", label = "Team", active = true)
    `)
--%>
@param String key
@param String label
@param String href = ""
@param String icon = ""
@param String badge = ""
@param boolean active = false
@param boolean disabled = false
@param boolean open = false
@param gg.jte.Content content = null
@param String cssClass = ""
!{var hasIcon = icon != null && !icon.isEmpty();}
!{var hasBadge = badge != null && !badge.isEmpty();}
!{var isParent = content != null;}
!{var rowStyle = "display: flex; align-items: center; gap: var(--lv-space-2); width: 100%; box-sizing: border-box; padding: var(--lv-space-2); border-radius: var(--lv-radius-md); color: inherit; text-decoration: none; font: inherit; text-align: left; cursor: pointer; background: " + (active ? "var(--lv-color-sidebar-accent)" : "transparent") + "; font-weight: " + (active ? "500" : "400") + ";";}
@if(isParent)
    <li data-slot="sidebar-menu-item" class="${cssClass}">
        <details data-sidebar="disclosure" open="${open}">
            <summary
                data-slot="sidebar-menu-button"
                aria-current="${active ? "page" : null}"
                aria-disabled="${disabled ? "true" : null}"
                class="lv-sidebar-item"
                style="${rowStyle} list-style: none; opacity: ${disabled ? "0.5" : "1"};"
            >
                @if(hasIcon)
                    <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
                @endif
                <span class="lv-sidebar-collapsible" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}</span>
                @if(hasBadge)
                    <span data-slot="sidebar-menu-badge" class="lv-sidebar-collapsible" style="flex-shrink: 0; font-size: var(--lv-text-xs); padding: 0 var(--lv-space-2); border-radius: var(--lv-radius-full); background: var(--lv-color-sidebar-border); color: var(--lv-color-sidebar-fg);">${badge}</span>
                @endif
                <span aria-hidden="true" class="lv-sidebar-collapsible lv-sidebar-chevron" style="flex-shrink: 0; display: inline-flex; transition: transform 0.15s ease;">@template.lievit.icon(name = "chevron-right", size = "0.9rem")</span>
            </summary>
            <ul
                data-slot="sidebar-menu-sub"
                class="lv-sidebar-collapsible"
                style="list-style: none; margin: 2px 0; padding-left: var(--lv-space-4); border-left: 1px solid var(--lv-color-sidebar-border); display: flex; flex-direction: column; gap: 2px;"
            >
                ${content}
            </ul>
        </details>
    </li>
@else
    <li data-slot="sidebar-menu-item" class="${cssClass}">
        <a
            href="${href}"
            data-slot="sidebar-menu-button"
            aria-current="${active ? "page" : null}"
            aria-disabled="${disabled ? "true" : null}"
            tabindex="${disabled ? "-1" : null}"
            class="lv-sidebar-item"
            style="${rowStyle} opacity: ${disabled ? "0.5" : "1"}; pointer-events: ${disabled ? "none" : "auto"};"
        >
            @if(hasIcon)
                <span aria-hidden="true" style="flex-shrink: 0; display: inline-flex;">@template.lievit.icon(name = icon, size = "1rem")</span>
            @endif
            <span class="lv-sidebar-collapsible" style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${label}</span>
            @if(hasBadge)
                <span data-slot="sidebar-menu-badge" class="lv-sidebar-collapsible" style="flex-shrink: 0; font-size: var(--lv-text-xs); padding: 0 var(--lv-space-2); border-radius: var(--lv-radius-full); background: var(--lv-color-sidebar-border); color: var(--lv-color-sidebar-fg);">${badge}</span>
            @endif
        </a>
    </li>
@endif
