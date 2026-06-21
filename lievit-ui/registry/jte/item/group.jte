@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/group partial -- shadcn's ItemGroup: the list wrapper that holds a set of item
  rows (and item separators).

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE: shadcn's ItemGroup is `role="list"` + `group/item-group flex flex-col`. The role makes
  the wrapped rows a real list for assistive tech (each child item should carry role="listitem").
  We reproduce the role + the flex column exactly.

  A11y (WAI-ARIA list): role="list" names the container as a list; pass role="listitem" on each
  @@template.lievit.item inside so the count and position are announced. Without children rows
  carrying listitem, the list is empty to AT, so always pair them.

  Params:
    gg.jte.Content content      the item rows (and item separators) in this group.
    String cssClass = ""        extra utility classes on the group.

  Usage:
    @@template.lievit.item.group(content = @@`
      @@template.lievit.item(role = "listitem", content = @@`@@template.lievit.item.title(content = @@`A`)`)
      @@template.lievit.item.separator()
      @@template.lievit.item(role = "listitem", content = @@`@@template.lievit.item.title(content = @@`B`)`)
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="item-group"
  role="list"
  class="group/item-group flex flex-col ${cssClass}"
>
  ${content}
</div>
