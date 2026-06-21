@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/footer partial -- shadcn's ItemFooter: a full-width band at the bottom of an item
  row, with content pushed to the edges.

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE: shadcn's ItemFooter is `flex basis-full items-center justify-between gap-2` (the same
  shape as ItemHeader but read as the closing band). basis-full breaks the flex-wrap line so it
  spans the whole row under the content/actions. Reproduced verbatim with tokens for the gap.

  A11y: a plain layout band; its children carry their own semantics.

  Params:
    gg.jte.Content content      the footer children.
    String cssClass = ""        extra utility classes on the footer.

  Usage:
    @@template.lievit.item.footer(content = @@`
      <span>Updated 2 days ago</span>
      @@template.lievit.badge(label = "draft")
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="item-footer"
  class="flex basis-full items-center justify-between gap-[var(--lv-space-2)] ${cssClass}"
>
  ${content}
</div>
