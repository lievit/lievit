@import java.util.List
@import java.util.Map
@import dev.lievit.kit.page.KitPageView
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.page.sidebar-nav - the Filament panel SIDEBAR navigation tree, rendered from a
  KitPageView onto the lievit-ui sidebar / sidebar.group / sidebar.item partials. The fi-sidebar-nav:
  a sequence of labelled GROUPS, each a section of nav ITEMS; every item is a real <a href> (the
  browser navigates, JS-off correct) with an optional Lucide icon, an optional badge, and
  aria-current="page" on the active route (the active item is a SERVER fact, never client state).

  This sub-part owns ONLY the nav body (the group/item iteration); the surrounding <nav> landmark +
  collapse trigger come from the lievit-ui sidebar partial that kit/page.jte wraps this in. It is the
  panel analog of kit/table/sortable-head.jte: one focused piece the shell composes.

  DATA SHAPE (the KitPageView.navGroups idiom, server-projected by KitPageComponent.navGroups):
  a flat List<Map<String,String>> where a row is EITHER a group header (key `groupLabel`, opens a new
  group) OR a nav item (keys `key`, `label`, `href`, `icon`, `badge`, `badgeVariant`). Items before
  the first label form one leading unlabelled group. The active key is matched against page.activeNav.
  This is the SAME segmentation lievit-ui blocks/app-shell does, lifted here so the kit owns it and a
  nav item can carry a badge variant (a coloured count) the bare block could not.

  Server-first / strict-CSP: every entry is a real <a href> (the sidebar.item partial) or a group
  heading; nothing inline-scripts. The badge is the lievit-ui badge partial (token-styled).

  Params:
    page - the KitPageView render bundle (read .navGroups() + .activeNav()).
--%>
@param KitPageView page

<%-- Segment the flat nav rows into labelled groups, exactly as blocks/app-shell does: a groupLabel
     row opens a new group, the item rows that follow belong to it; rows before the first label form
     one leading unlabelled group. The start/end ranges are computed once in Java so the markup just
     iterates the precomputed segments (no @if/@else opening a different root tag per branch). --%>
!{var rows = page.navGroups();}
!{var labels = new java.util.ArrayList<String>();}
!{var starts = new java.util.ArrayList<Integer>();}
!{var ends = new java.util.ArrayList<Integer>();}
!{
  int cursor = 0;
  if (cursor < rows.size() && !rows.get(cursor).containsKey("groupLabel")) {
    labels.add(""); starts.add(0);
    int e = 0; while (e < rows.size() && !rows.get(e).containsKey("groupLabel")) e++;
    ends.add(e); cursor = e;
  }
  while (cursor < rows.size()) {
    labels.add(rows.get(cursor).getOrDefault("groupLabel", ""));
    int s = cursor + 1; int e = s;
    while (e < rows.size() && !rows.get(e).containsKey("groupLabel")) e++;
    starts.add(s); ends.add(e); cursor = e;
  }
}
@for(var gi = 0; gi < labels.size(); gi++)
  !{var gStart = starts.get(gi);}
  !{var gEnd = ends.get(gi);}
  @template.lievit.sidebar.group(label = labels.get(gi), content = @`
    @for(var i = gStart; i < gEnd; i++)
      !{var item = rows.get(i);}
      !{var key = item.getOrDefault("key", item.getOrDefault("href", item.getOrDefault("label", "")));}
      @template.lievit.sidebar.item(
        key = key,
        label = item.getOrDefault("label", ""),
        href = item.getOrDefault("href", ""),
        icon = item.getOrDefault("icon", ""),
        badge = item.getOrDefault("badge", ""),
        active = key.equals(page.activeNav())
      )
    @endfor
  `)
@endfor
