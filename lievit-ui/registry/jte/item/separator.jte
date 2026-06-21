<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/separator partial -- shadcn's ItemSeparator: a horizontal divider between item
  rows in an item group.

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE (scientific decision rule): shadcn's ItemSeparator wraps the shared Separator
  (horizontal, decorative) and stamps data-slot="item-separator". We do the same shape inline (a
  role-less, aria-hidden token rule) rather than @@template.lievit.separator so the item-separator
  slot is the element itself, matching shadcn's addressable slot. A separator between rows is
  decorative (the list semantics already convey grouping), so it stays out of the a11y tree.

  A11y (WAI-ARIA): decorative divider -> aria-hidden, no role; the item-group's role="list" carries
  the grouping semantics.

  Params:
    String cssClass = ""        extra utility classes on the divider.

  Usage:
    @@template.lievit.item.separator()
--%>
@param String cssClass = ""

<div
  data-slot="item-separator"
  data-orientation="horizontal"
  aria-hidden="true"
  class="shrink-0 border-0 bg-[var(--lv-color-border)] block h-px w-full ${cssClass}"
></div>
