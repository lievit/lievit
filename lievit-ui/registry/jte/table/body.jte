@import gg.jte.Content
<%--
  lievit-ui :: table.body - the <tbody> of the table primitive.
  The last row's bottom border is removed (shadcn parity) via the lv-table-body class.
  Params: klass (extra classes for <tbody>), content (the data @@template.table.row blocks).
--%>
@param String klass = ""
@param gg.jte.Content content
<tbody class="lv-table-body [&_tr:last-child]:border-0 ${klass}">
  ${content}
</tbody>
