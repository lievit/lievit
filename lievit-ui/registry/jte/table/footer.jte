@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.footer partial -- the <tfoot> of the composable table set.

  TIER: PARTIAL (sub-partial; composed inside @@template.lievit.table).

  STRUCTURE: native <tfoot> (implicit role="rowgroup"). Used for totals rows,
  summary rows, or the pagination region when composed via data-table.jte.
  Muted fill + top border + medium weight (shadcn TableFooter parity).

  A11y (WAI-ARIA APG Table):
    - Native <tfoot> (implicit role="rowgroup").
    - The last row's bottom border is suppressed via [&>tr]:last-child:border-b-0.

  Params:
    String cssClass       = ""     extra utility classes on <tfoot>.
    gg.jte.Content content         the footer row(s): @@template.lievit.table.row blocks.

  Usage:
    @@template.lievit.table.footer(content = @@`
      @@template.lievit.table.row(content = @@`
        @@template.lievit.table.cell(content = @@`Total`)
        @@template.lievit.table.cell(cssClass = "text-right", content = @@`$480,000`)
      `)
    `)
--%>
@param String cssClass = ""
@param gg.jte.Content content
<tfoot
  data-slot="table-footer"
  class="border-t font-[var(--lv-font-medium)] [&>tr]:last:border-b-0 ${cssClass}"
  style="border-color:var(--lv-color-border);background-color:color-mix(in srgb, var(--lv-color-surface) 60%, var(--lv-color-bg));"
>${content}</tfoot>
