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

  MULTI-LEVEL + EXTERNAL LINK SUPPORT (issue #494, ADR sw-architecture-008 backflow): a nav spans two
  apps or carries disclosure groups, so a nav item may be a DROPDOWN PARENT or open an EXTERNAL host.
  Three extra row shapes are read on top of the kit idiom; the sidebar.item partial already supports
  both natively (a `content` sub-tree makes it a native <details> disclosure; a leaf is a real <a
  href>), so no new primitive is needed:
    - `parent`="true" (+ `key`/`label`/`icon`): opens a disclosure group; the rows that immediately
      follow carrying `child`="true" are ITS children (collected here into the parent's content slot).
    - `child`="true": a child leaf belonging to the preceding parent (same item keys).
    - `external`="true" on any leaf: an absolute-URL link into an external host -> rel=noopener +
      target="_blank" (Filament's openInNewTab semantics, issue #494).
  A plain leaf (no marker) is a same-shell nav item, exactly as the bare kit idiom defines.

  Server-first / strict-CSP: every entry is a real <a href> (the sidebar.item partial) or a group
  heading; a dropdown is a native <details> (sidebar.item parent), zero JS, JS-off correct; nothing
  inline-scripts. The badge is the lievit-ui badge partial (token-styled).

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
<%-- Per-row child range (issue #494): a `parent` row's children are the immediately-following `child`
     rows. The ranges are computed once in Java so the markup iterates leaves + parents without nested
     scanning; a `child` row is rendered only inside its parent's content slot (skipped in the outer
     loop). ADR sw-architecture-008 backflow. --%>
!{var childEnd = new int[rows.size()];}
!{
  for (int i = 0; i < rows.size(); i++) {
    if ("true".equals(rows.get(i).get("parent"))) {
      int e = i + 1;
      while (e < rows.size() && "true".equals(rows.get(e).get("child"))) e++;
      childEnd[i] = e;
    } else {
      childEnd[i] = i;
    }
  }
}
@for(var gi = 0; gi < labels.size(); gi++)
  !{var gStart = starts.get(gi);}
  !{var gEnd = ends.get(gi);}
  @template.lievit.sidebar.group(label = labels.get(gi), content = @`
    @for(var i = gStart; i < gEnd; i++)
      !{var item = rows.get(i);}
      @if("true".equals(item.get("child")))
        <%-- consumed by the preceding parent's content slot below; never rendered standalone --%>
      @elseif("true".equals(item.get("parent")))
        <%-- Dropdown parent (issue #494): a native <details> disclosure whose children are the rows
             that follow with child="true". Zero JS, JS-off correct. ADR sw-architecture-008. --%>
        !{var pKey = item.getOrDefault("key", item.getOrDefault("label", ""));}
        !{var pStart = i + 1;}
        !{var pChildEnd = childEnd[i];}
        @template.lievit.sidebar.item(
          key = pKey,
          label = item.getOrDefault("label", ""),
          icon = item.getOrDefault("icon", ""),
          content = @`
            @for(var c = pStart; c < pChildEnd; c++)
              !{var child = rows.get(c);}
              !{var cExternal = "true".equals(child.get("external"));}
              !{var cKey = child.getOrDefault("key", child.getOrDefault("href", child.getOrDefault("label", "")));}
              @template.lievit.sidebar.item(
                key = cKey,
                label = child.getOrDefault("label", ""),
                href = child.getOrDefault("href", ""),
                icon = child.getOrDefault("icon", ""),
                badge = child.getOrDefault("badge", ""),
                active = cKey.equals(page.activeNav()),
                target = cExternal ? "_blank" : "",
                rel = cExternal ? "noopener" : ""
              )
            @endfor
          `
        )
      @else
        <%-- Leaf item (same-shell or external link, issue #494): external="true" adds rel=noopener +
             target="_blank" (Filament's openInNewTab semantics). ADR sw-architecture-008. --%>
        !{var external = "true".equals(item.get("external"));}
        !{var key = item.getOrDefault("key", item.getOrDefault("href", item.getOrDefault("label", "")));}
        @template.lievit.sidebar.item(
          key = key,
          label = item.getOrDefault("label", ""),
          href = item.getOrDefault("href", ""),
          icon = item.getOrDefault("icon", ""),
          badge = item.getOrDefault("badge", ""),
          active = key.equals(page.activeNav()),
          target = external ? "_blank" : "",
          rel = external ? "noopener" : ""
        )
      @endif
    @endfor
  `)
@endfor
