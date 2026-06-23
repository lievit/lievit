@import gg.jte.Content
<%--
  lievit-ui :: table.cell - a data cell <td> in the table primitive.
  Params: klass (extra classes, e.g. "text-right tabular-nums"), content (the cell value).
--%>
@param String klass = ""
@param gg.jte.Content content
<%-- Filament fidelity: comfortable cell padding (Filament fi-ta-cell is px-3 py-4-ish); px-3 + a
     taller py-3 reads as Filament's roomier rows without the prior cramped p-2 density. --%>
<td data-slot="table-cell" class="lv-table-cell px-[var(--lv-space-3)] py-[var(--lv-space-3)] align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${klass}">
  ${content}
</td>
