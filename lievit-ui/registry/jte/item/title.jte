@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/title partial -- shadcn's ItemTitle: the typed title sub-part of an item row.

  TIER: STATIC presentational -> JTE partial. Pure layout + typography, no client state.

  STRUCTURE (scientific decision rule): shadcn ships ItemTitle as a distinct data-slot="item-title"
  rather than a free content slot so the media variant CSS ("translate the media when a description
  is present") and the title typography are addressable by slot. We mirror the exact data-slot so
  those sibling-aware rules keep working. Sits inside the item's content column.

  A11y: a plain styled <div>; when the item is actionable the link/button lives elsewhere in the
  row and keeps its own semantics. The title text is content, not a control.

  Params:
    gg.jte.Content content      the title text/markup.
    String cssClass = ""        extra utility classes on the title.

  Usage:
    @@template.lievit.item(content = @@`
      @@template.lievit.item.title(content = @@`Contratti`)
      @@template.lievit.item.description(content = @@`24 documenti`)
    `)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<div
  data-slot="item-title"
  class="flex w-fit items-center gap-[var(--lv-space-2)] text-[length:var(--lv-text-sm)] leading-snug font-[var(--lv-font-medium)] text-[var(--lv-color-fg)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  ${content}
</div>
