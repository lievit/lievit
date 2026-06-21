@import gg.jte.Content
<%--
  lievit-ui :: table.cell - a data cell <td> in the table primitive.
  Params: klass (extra classes, e.g. "text-right tabular-nums"), content (the cell value).
--%>
@param String klass = ""
@param gg.jte.Content content
<td data-slot="table-cell" class="lv-table-cell p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${klass}">
  ${content}
</td>
