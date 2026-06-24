@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/group partial -- one labelled section of a sidebar: an optional heading +
  a <ul> menu of sidebar/item entries (Wave 3, server-first, no JS, no state).

  TIER: STATIC presentational -> JTE partial. A group is pure markup; its items arrive via the
  @param Content slot, filled by the caller from its typed model. The group heading hides when the
  sidebar collapses to the icon rail (CSS on the root's data-state, lv-sidebar-collapsible), so no
  client state lives here.

  STRUCTURE (shadcn Sidebar SidebarGroup model): a section with an optional uppercase heading and a
  <ul role="list"> of menu items. When the group is labelled the menu is associated to its heading
  via aria-labelledby so AT announces the section name.

  A11y: the heading is a real <div> styled as a section label; the menu is a <ul> whose items are
  real <a href> (sidebar/item). When labelled, the <ul> is aria-labelledby the heading id.

  Params:
    String label = ""         optional section heading (hidden on the collapsed icon rail).
    gg.jte.Content content     the menu items (sidebar/item entries).
    gg.jte.Content action = null optional trailing action by the heading (sidebar/group-action),
                              pinned to the group's top-right; the group div is its positioning ctx.
    String cssClass = ""       extra utility classes on the group.

  Usage:
    @@template.lievit.sidebar.group(label = "Platform", content = @@`
      @@template.lievit.sidebar.item(key = "home", href = "/", label = "Home", icon = "house", active = true)
    `)
--%>
@param String label = ""
@param gg.jte.Content content
@param gg.jte.Content action = null
@param String cssClass = ""
!{var hasLabel = label != null && !label.isEmpty();}
!{var labelId = hasLabel ? "lv-sidebar-group-" + label.toLowerCase().replaceAll("[^a-z0-9]+", "-") : null;}
<div data-slot="sidebar-group" class="lv-sidebar-group ${cssClass}" style="position: relative; display: flex; flex-direction: column; gap: var(--lv-space-1);">
    @if(action != null)${action}@endif
    @if(hasLabel)
        <div
            id="${labelId}"
            data-slot="sidebar-group-label"
            class="lv-sidebar-collapsible"
            style="padding: var(--lv-space-1) var(--lv-space-2); font-size: var(--lv-text-xs); font-weight: 600; color: var(--lv-color-muted); text-transform: uppercase; letter-spacing: 0.03em;"
        >${label}</div>
    @endif
    <ul
        data-slot="sidebar-menu"
        aria-labelledby="${hasLabel ? labelId : null}"
        style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 2px;"
    >
        ${content}
    </ul>
</div>
