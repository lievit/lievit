@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/menu-action partial -- a trailing action affordance pinned to the end of a
  sidebar menu item (shadcn Sidebar SidebarMenuAction): the small "more" / "add" control that
  sits at the row's right edge, decoupled from the item's own <a> so the row navigates while the
  action does its own thing (open a menu, create a child, ...).

  TIER: STATIC presentational -> JTE partial. No state of its own. It is positioned by the
  enhancer's injected CSS (absolute, pinned to the row end) keyed on data-slot="sidebar-menu-action";
  the menu item's <li> is the positioning context, so pass this into the item's `action` slot.
  The optional `showOnHover` mirrors shadcn: the action is hidden until the row is hovered or a
  descendant has focus (so the row stays clean), revealed on interaction; without it the action
  is always visible. Hidden on the collapsed icon rail (lv-sidebar-collapsible).

  STRUCTURE (shadcn SidebarMenuAction): an absolutely-positioned <button> (or any control passed
  as `content`) at the row's trailing edge. Default glyph is the Lucide "ellipsis" (a "more
  actions" trigger); pass `content` to supply your own control (e.g. a dropdown trigger).

  A11y: a real <button aria-label> (the platform exposes it); when you pass your own `content`,
  YOU own its accessible name. The default glyph is decorative (aria-hidden via the icon partial),
  named by aria-label on the button.

  Params:
    String label = "More"        accessible name for the default button (ignored when content set).
    String icon = "ellipsis"     Lucide glyph for the default button (ignored when content set).
    boolean showOnHover = false  reveal only on row hover / focus-within (shadcn showOnHover).
    gg.jte.Content content = null supply your own control instead of the default button.
    String cssClass = ""         extra utility classes.

  Usage (inside an item's action slot):
    @@template.lievit.sidebar.item(key = "deals", href = "/deals", label = "Deals",
      action = @@`@@template.lievit.sidebar.menu-action(label = "Deal actions")`)
--%>
@param String label = "More"
@param String icon = "ellipsis"
@param boolean showOnHover = false
@param gg.jte.Content content = null
@param String cssClass = ""
!{var hoverClass = showOnHover ? " lv-sidebar-action-hover" : "";}
@if(content != null)
    <span
        data-slot="sidebar-menu-action"
        data-sidebar="menu-action"
        class="lv-sidebar-menu-action lv-sidebar-collapsible${hoverClass} ${cssClass}"
        style="position: absolute; top: var(--lv-space-1); right: var(--lv-space-1); display: inline-flex;"
    >${content}</span>
@else
    <button
        type="button"
        data-slot="sidebar-menu-action"
        data-sidebar="menu-action"
        aria-label="${label}"
        class="lv-sidebar-menu-action lv-sidebar-collapsible${hoverClass} ${cssClass}"
        style="position: absolute; top: var(--lv-space-1); right: var(--lv-space-1); display: inline-flex; align-items: center; justify-content: center; aspect-ratio: 1; padding: var(--lv-space-1); border: 0; border-radius: var(--lv-radius-sm); background: transparent; color: inherit; cursor: pointer;"
    >
        <span aria-hidden="true" style="display: inline-flex;">@template.lievit.icon(name = icon, size = "0.95rem")</span>
    </button>
@endif
