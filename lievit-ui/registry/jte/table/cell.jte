@import gg.jte.Content
<%--
  lievit-ui :: table.cell - a data cell <td> in the table primitive.
  Params: klass (extra classes, e.g. "text-right tabular-nums"), content (the cell value).
--%>
@param String klass = ""
@param gg.jte.Content content
<td class="lv-table-cell p-2 align-middle whitespace-nowrap ${klass}">
  ${content}
</td>
