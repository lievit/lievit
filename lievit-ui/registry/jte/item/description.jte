@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/description partial -- shadcn's ItemDescription: the typed muted secondary line
  of an item row.

  TIER: STATIC presentational -> JTE partial. Pure layout + typography, no client state.

  STRUCTURE (scientific decision rule): shadcn ships ItemDescription as data-slot="item-description"
  on a <p> (not a free content slot) precisely so the media variant can react to its presence
  (group-has-[[data-slot=item-description]]). We mirror the exact slot + the <p> element + the
  muted colour + the inline-link affordances (underline, primary on hover). line-clamp-2 keeps it
  to two lines like shadcn.

  A11y: a paragraph of secondary text; any inline <a> keeps its own semantics and gets the
  underline/primary-on-hover cue.

  Params:
    gg.jte.Content content      the description text/markup.
    String cssClass = ""        extra utility classes on the description.

  Usage:
    @@template.lievit.item.description(content = @@`24 documenti`)
--%>
@param gg.jte.Content content
@param String cssClass = ""

<p
  data-slot="item-description"
  class="line-clamp-2 text-[length:var(--lv-text-sm)] leading-normal font-[var(--lv-font-normal)] text-balance text-[var(--lv-color-muted-fg)] [&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-[var(--lv-color-primary)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  ${content}
</p>
