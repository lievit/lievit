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
<%-- Filament fidelity: header cells use a SUBTLE tint (the bottom divider does the head/body
     separation; Filament's fi-ta-header-cell is near-transparent), px-3 padding, and a small
     muted-semibold label. Lightened from the prior heavy 70% surface band toward the Filament look. --%>
<th
  scope="${scope}"
  data-slot="table-head"
  class="lv-table-head h-[var(--lv-space-9)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left align-middle text-[length:var(--lv-text-xs)] font-[var(--lv-font-semibold)] tracking-wide whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${klass}"
  style="color:var(--lv-color-muted-fg);background-color:color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg));"
>
  ${content}
</th>
