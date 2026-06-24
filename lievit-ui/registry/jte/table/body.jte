@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.body partial -- the <tbody> of the composable table set.

  TIER: PARTIAL (sub-partial; composed inside @@template.lievit.table).

  STRUCTURE: native <tbody> (implicit role="rowgroup"). HTMX swaps this element
  (+ the pagination region) on sort / page / filter operations when data-table.jte
  composes this set with HTMX wiring.

  A11y (WAI-ARIA APG Table):
    - Native <tbody> (implicit role="rowgroup").

  Params:
    String cssClass       = ""     extra utility classes on <tbody>.
    gg.jte.Content content         the data rows: @@template.lievit.table.row blocks.

  Usage:
    @@template.lievit.table.body(content = @@`
      @@template.lievit.table.row(content = @@`...`)
    `)
--%>
@param String cssClass = ""
@param gg.jte.Content content
<%-- [&_tr:last-child]:border-b-0 -- shadcn parity: drop the last row's bottom divider. --%>
<tbody data-slot="table-body" class="[&_tr:last-child]:border-b-0 ${cssClass}">${content}</tbody>
