@import gg.jte.Content
<%--
  lievit-ui :: table.footer - the <tfoot> of the table primitive (totals row).
  Muted fill + top border + medium weight, mirroring shadcn TableFooter.
  Params: klass (extra classes for <tfoot>), content (the footer @@template.lievit.table.row block(s)).
--%>
@param String klass = ""
@param gg.jte.Content content
<tfoot
  class="lv-table-footer border-t font-medium [&>tr]:last:border-b-0 ${klass}"
  style="border-color:var(--lv-color-border);background-color:color-mix(in srgb, var(--lv-color-surface) 60%, var(--lv-color-bg));"
>
  ${content}
</tfoot>
