@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.row - one <tr> in the server-first data table.

  A bottom-bordered, hover-highlighted row; a selected row gets a steadier muted fill via the
  data-state attribute (shadcn parity). The caller renders one of these per data item inside the
  data-table `rows` slot, filling it with @template.lievit.data-table.cell blocks. No row data lives here;
  it arrives via the `content` slot from the controller's typed model.

  Params:
    state   - "selected" to mark the row selected, else "" (default).
    id      - optional row id, stamped as data-row-id for the caller's action wiring.
    klass   - extra classes for the <tr>.
    content - the row's @@template.lievit.data-table.cell blocks.
--%>
@param String state = ""
@param String id = null
@param String klass = ""
@param gg.jte.Content content
<tr
  data-slot="data-table-row"
  data-row-id="${id == null || id.isBlank() ? null : id}"
  data-state="${state.isEmpty() ? null : state}"
  class="lv-table-row border-b transition-colors hover:bg-[color-mix(in_srgb,var(--lv-color-surface)_60%,var(--lv-color-bg))] data-[state=selected]:bg-[color-mix(in_srgb,var(--lv-color-surface)_85%,var(--lv-color-bg))] ${klass}"
  style="border-color:var(--lv-color-border);"
>
  ${content}
</tr>
