@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.caption partial -- the <caption> of the composable table set.

  TIER: PARTIAL (sub-partial; composed inside @@template.lievit.table).

  STRUCTURE: native <caption> (implicit "caption" role). The preferred mechanism for
  the accessible name of a table: screen readers announce it before reading cells.
  The parent table.jte sets caption-side:bottom (shadcn parity); the caption appears
  below the table visually.

  A11y (WAI-ARIA APG Table):
    - <caption> is the preferred accessible name mechanism over aria-label. When a
      visible caption is present, do NOT also set ariaLabel on table.jte (duplicate
      name, axe-core table-duplicate-name violation).
    - Visually-hidden captions: pass cssClass="sr-only" to hide the caption visually
      while keeping it in the a11y tree. This is the pattern when an external heading
      already labels the table visually but an in-table accessible name is also needed
      (the APG allows it; axe-core allows it when it is not a duplicate of visible text).

  Params:
    String cssClass  = ""     extra utility classes (e.g. "sr-only" for a visually-hidden
                               caption, "text-left" for left-aligned caption text).
    gg.jte.Content content    the caption text or markup.

  Usage:
    @@template.lievit.table.caption(content = @@`Q2 Listings`)
    @@template.lievit.table.caption(cssClass = "sr-only", content = @@`Users table`)
--%>
@param String cssClass = ""
@param gg.jte.Content content
<caption
  data-slot="table-caption"
  class="mt-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] ${cssClass}"
  style="color:var(--lv-color-muted);"
>${content}</caption>
