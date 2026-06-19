@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.cell - one <td> in the server-first data table.

  A padded, bottom-bordered data cell. Pass scope="row" + as a <th> for a row-header cell
  (the first column of a row identifying it); the default is a plain <td>. The cell content is
  the caller's typed projection (escaped text, a badge, a real <a href>, an icon), mirroring the
  kit's typed Cell switch: this partial owns the chrome, the caller owns what the cell shows.

  Params:
    align   - "left" (default) | "center" | "right".
    header  - true to render a <th scope="row"> (row-header cell) instead of a <td>.
    klass   - extra classes for the cell.
    content - the cell's rendered content.
--%>
@param String align = "left"
@param boolean header = false
@param String klass = ""
@param gg.jte.Content content
!{var alignClass = align.equals("right") ? "text-right" : (align.equals("center") ? "text-center" : "text-left");}
@if(header)
  <th
    scope="row"
    data-slot="data-table-cell"
    class="lv-table-cell px-[var(--lv-space-2)] py-[var(--lv-space-3)] align-middle font-[var(--lv-font-medium)] ${alignClass} ${klass}"
    style="border-bottom:1px solid var(--lv-color-border);"
  >${content}</th>
@else
  <td
    data-slot="data-table-cell"
    class="lv-table-cell px-[var(--lv-space-2)] py-[var(--lv-space-3)] align-middle ${alignClass} ${klass}"
    style="border-bottom:1px solid var(--lv-color-border);"
  >${content}</td>
@endif
