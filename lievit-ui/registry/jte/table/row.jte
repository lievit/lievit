@import gg.jte.Content
<%--
  lievit-ui :: table.row - a <tr> in the table primitive.
  Bottom border + hover highlight; a selected row gets a steadier muted fill via the
  data-state attribute (shadcn parity).
  Params:
    state   - "selected" to mark the row selected, else "" (default).
    klass   - extra classes for the <tr>.
    content - the row's @@template.lievit.table.head / @@template.lievit.table.cell blocks.
--%>
@param String state = ""
@param String klass = ""
@param gg.jte.Content content
<tr
  data-state="${state.isEmpty() ? null : state}"
  class="lv-table-row border-b transition-colors hover:bg-[color-mix(in_srgb,var(--lv-color-surface)_60%,var(--lv-color-bg))] data-[state=selected]:bg-[color-mix(in_srgb,var(--lv-color-surface)_85%,var(--lv-color-bg))] ${klass}"
  style="border-color:var(--lv-color-border);"
>
  ${content}
</tr>
