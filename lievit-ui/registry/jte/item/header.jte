@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/header partial -- shadcn's ItemHeader: a full-width band at the top of an item
  row, with content pushed to the edges (title left, action right).

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE: shadcn's ItemHeader is `flex basis-full items-center justify-between gap-2` so it
  spans the whole row (basis-full breaks the flex-wrap line) and edge-justifies its children. We
  reproduce that exactly with tokens for the gap.

  A11y: a plain layout band; its children carry their own semantics.

  Params:
    gg.jte.Content content      the header children (e.g. a title slot + an actions slot).
    String cssClass = ""        extra utility classes on the header.

  Usage:
    @@template.lievit.item.header(content = @@`
      @@template.lievit.item.title(content = @@`Recent files`)
      @@template.lievit.icon(name = "more-horizontal")
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="item-header"
  class="flex basis-full items-center justify-between gap-[var(--lv-space-2)] ${cssClass}"
>
  ${content}
</div>
