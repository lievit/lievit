@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui dropdown-menu/group partial -- a semantic grouping of related menu items inside a
  dropdown-menu (Wave 2/3, server-first, no JS). The shadcn DropdownMenuGroup: it bundles items
  that belong together (separated from other groups by a dropdown-menu/separator), and carries
  role="group" so assistive tech announces the boundary; pass a `labelId` that matches a
  dropdown-menu/label `id` to name the group (aria-labelledby).

  TIER: STATIC presentational -> JTE partial. A wrapper; the items are OWNED, server-rendered.

  STRUCTURE (shadcn DropdownMenuGroup, Radix Group): a plain wrapper element. shadcn's div has no
  role; we add role="group" (WAI-ARIA APG menu grouping) so the group boundary is announced, the
  accessible-faithful choice for a labelled group of menuitems.

  A11y: role="group" inside the role="menu" panel; aria-labelledby -> a dropdown-menu/label id.

  Params:
    gg.jte.Content content              the group's items (dropdown-menu/item entries), OWNED.
    String         labelId = ""         id of a dropdown-menu/label that names this group.
    String         cssClass = ""        extra utility classes on the group.

  Usage:
    @@template.lievit.dropdown-menu.label(label = "Account", id = "acct-lbl")
    @@template.lievit.dropdown-menu.group(labelId = "acct-lbl", content = @@`
      @@template.lievit.dropdown-menu.item(href = "/profile", label = "Profile")
      @@template.lievit.dropdown-menu.item(href = "/settings", label = "Settings")
    `)
--%>
@param gg.jte.Content content
@param String labelId = ""
@param String cssClass = ""
<div
    role="group"
    data-slot="dropdown-menu-group"
    aria-labelledby="${labelId.isEmpty() ? null : labelId}"
    class="${cssClass}"
>${content}</div>
