@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui sidebar/group-action partial -- a trailing action affordance pinned to the end of a
  sidebar group heading (shadcn Sidebar SidebarGroupAction): the small "add" control beside a
  section label (e.g. "+ new project" next to a "Projects" group).

  TIER: STATIC presentational -> JTE partial. No state of its own. Positioned by the enhancer's
  injected CSS (absolute, pinned to the group's top-right) keyed on data-slot="sidebar-group-action";
  the group's <div data-slot="sidebar-group"> is the positioning context, so pass this into the
  group's `action` slot. Hidden on the collapsed icon rail (lv-sidebar-collapsible), like the
  group heading it sits beside.

  STRUCTURE (shadcn SidebarGroupAction): an absolutely-positioned <button> (or any control passed
  as `content`) at the group's trailing edge, aligned with the heading. Default glyph is the
  Lucide "plus" (an "add to this group" trigger); pass `content` for your own control.

  A11y: a real <button aria-label>; when you pass your own `content`, YOU own its accessible name.
  The default glyph is decorative (aria-hidden via the icon partial), named by aria-label.

  Params:
    String label = "Add"         accessible name for the default button (ignored when content set).
    String icon = "plus"         Lucide glyph for the default button (ignored when content set).
    gg.jte.Content content = null supply your own control instead of the default button.
    String cssClass = ""         extra utility classes.

  Usage (inside a group's action slot):
    @@template.lievit.sidebar.group(label = "Projects",
      action = @@`@@template.lievit.sidebar.group-action(label = "New project")`,
      content = @@`...items...`)
--%>
@param String label = "Add"
@param String icon = "plus"
@param gg.jte.Content content = null
@param String cssClass = ""
@if(content != null)
    <span
        data-slot="sidebar-group-action"
        data-sidebar="group-action"
        class="lv-sidebar-group-action lv-sidebar-collapsible ${cssClass}"
        style="position: absolute; top: var(--lv-space-1); right: var(--lv-space-2); display: inline-flex;"
    >${content}</span>
@else
    <button
        type="button"
        data-slot="sidebar-group-action"
        data-sidebar="group-action"
        aria-label="${label}"
        class="lv-sidebar-group-action lv-sidebar-collapsible ${cssClass}"
        style="position: absolute; top: var(--lv-space-1); right: var(--lv-space-2); display: inline-flex; align-items: center; justify-content: center; aspect-ratio: 1; padding: var(--lv-space-1); border: 0; border-radius: var(--lv-radius-sm); background: transparent; color: inherit; cursor: pointer;"
    >
        <span aria-hidden="true" style="display: inline-flex;">@template.lievit.icon(name = icon, size = "0.95rem")</span>
    </button>
@endif
