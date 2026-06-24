@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  navigation-menu/menu/group partial -- a labelled group of links inside a navigation-menu/menu
  panel. Renders an optional visible group heading followed by a nested <ul> of panel links.

  TIER: PARTIAL -- pure server-rendered presentation, no client state.

  STRUCTURE: a <li> containing an optional group heading <p> + a <ul> of navigation-menu/link
  (inPanel=true) items. The heading is a plain <p> (not a heading level -- navigation panels are
  not document sections; APG Disclosure Navigation does not specify a heading role for group
  labels). It is informational text, visible to AT via natural reading order.

  A11y:
    - No explicit role on the group container (it is a list item inside the panel list).
    - Group heading <p>: rendered as visible text; AT reads it in natural Tab/reading order.
    - No aria-label on the group <ul> (the visible heading provides the group context).

  Params:
    String label = null         optional visible group heading text (omit for an unlabelled group).
    gg.jte.Content content      the navigation-menu/link items (inPanel=true) for this group.
    String cssClass = ""        extra utility classes on the group <li>.
--%>
@param String label = null
@param gg.jte.Content content
@param String cssClass = ""

<li data-slot="navigation-menu-group" class="${cssClass}" style="list-style:none;">
  @if(label != null && !label.isBlank())
    <p data-slot="navigation-menu-group-label" style="margin:0 0 var(--lv-space-1);padding:var(--lv-space-1) var(--lv-space-3);font-size:var(--lv-text-xs);font-weight:var(--lv-font-medium);color:var(--lv-color-muted-fg);text-transform:uppercase;letter-spacing:0.06em;">${label}</p>
  @endif
  <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px;">${content}</ul>
</li>
