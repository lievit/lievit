@import gg.jte.Content
<%--
  lievit-ui :: table.head - a header cell <th> in the table primitive.
  Renders <th scope="..."> (accessible header association) with the muted header look.
  Params:
    scope   - "col" (default) for a column header, "row" for a row header.
    klass   - extra classes for the <th> (e.g. "text-right").
    content - the header label.
--%>
@param String scope = "col"
@param String klass = ""
@param gg.jte.Content content
<th
  scope="${scope}"
  data-slot="table-head"
  class="lv-table-head h-[var(--lv-space-9)] px-2 text-left align-middle font-medium whitespace-nowrap ${klass}"
  style="color:var(--lv-color-fg);background-color:color-mix(in srgb, var(--lv-color-surface) 70%, var(--lv-color-bg));"
>
  ${content}
</th>
