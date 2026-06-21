@import gg.jte.Content
<%--
  lievit-ui :: table.caption - the <caption> of the table primitive.
  The accessible name of the table; rendered below it (caption-bottom on the table).
  Params: klass (extra classes for <caption>), content (the caption text).
--%>
@param String klass = ""
@param gg.jte.Content content
<caption data-slot="table-caption" class="lv-table-caption mt-4 text-[var(--lv-text-sm)] ${klass}" style="color:var(--lv-color-muted);">
  ${content}
</caption>
