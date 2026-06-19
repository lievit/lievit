@import gg.jte.Content
<%--
  lievit-ui :: table.header - the <thead> of the table primitive.
  Holds one (or more) header @@template.table.row blocks of @@template.table.head cells.
  Params: klass (extra classes for <thead>), content (the header row(s)).
--%>
@param String klass = ""
@param gg.jte.Content content
<thead class="lv-table-header ${klass}">
  ${content}
</thead>
