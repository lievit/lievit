@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.selection-footer - the "N of M row(s) selected" region below the data table.

  shadcn's Data Table shows a muted line under the table:
    "{selected} of {total} row(s) selected."
  (table.getFilteredSelectedRowModel().rows.length of table.getFilteredRowModel().rows.length). This
  partial is that region. The counts are SERVER facts the kit passes in (how many rows are selected,
  how many are in the current filtered set), like the page/total the pager reads. An optional `actions`
  slot holds bulk-action controls (Delete selected, Export selected) the adopter wires; it renders only
  when there IS a selection, so the bulk bar appears on demand.

  A11y: the count line is aria-live="polite" so a screen reader announces the running selected count as
  rows are toggled (the selection changes without a navigation). The text is plain, muted, shadcn-styled.

  Params:
    int     selected = 0     number of selected rows (server fact).
    int     total    = 0     number of rows in the current filtered set (server fact).
    String  noun     = "row" the singular noun ("row" -> "row(s) selected"); for a typed list pass e.g. "listing".
    Content actions  = null  optional bulk-action slot; rendered only when selected > 0.
    String  klass    = ""    extra classes on the footer row.

  Usage:
    @@template.lievit.data-table.selection-footer(
      selected = view.selectedCount(), total = view.rows().size(),
      actions = @@`@@template.lievit.button(variant = "destructive", size = "sm",
                   attrs = "l:click=\"deleteSelected\"", content = @@`Delete selected`)`)
--%>
@param int selected = 0
@param int total = 0
@param String noun = "row"
@param gg.jte.Content actions = null
@param String klass = ""
<div
  data-slot="data-table-selection-footer"
  class="flex items-center gap-[var(--lv-space-2)] py-[var(--lv-space-4)] ${klass}"
  style="font-family:var(--lv-font-sans);"
>
  <div
    data-slot="data-table-selection-info"
    aria-live="polite"
    class="flex-1 text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]"
  >${selected} of ${total} ${noun}(s) selected.</div>
  @if(actions != null && selected > 0)
    <div data-slot="data-table-selection-actions" class="flex items-center gap-[var(--lv-space-2)]">${actions}</div>
  @endif
</div>
