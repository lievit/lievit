@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.cell partial -- a data cell <td> in the composable table set.

  TIER: PARTIAL (sub-partial; composed inside table.body rows).

  STRUCTURE: native <td> (implicit role="cell"). Comfortable cell padding matching
  Filament fi-ta-cell density (px-4 + py-3 as default, overridable via cssClass).
  Numeric columns (right-aligned, tabular-nums) pass cssClass="text-right font-mono tabular-nums".
  Row-header columns use table.head with scope="row", not this partial.

  A11y (WAI-ARIA APG Table):
    - Native <td> (implicit role="cell").
    - colspan: pass as a standard HTML attribute via cssClass (e.g. for empty-state spans);
      for colspan in attribute position use the attrs param (TRUSTED) or compose directly.
    - [&:has([role=checkbox])]:pr-0 aligns a checkbox column cell flush with the header.

  Params:
    String cssClass  = ""     extra utility classes (e.g. "text-right", "font-mono tabular-nums",
                               "sr-only" for hidden column cells).
    String attrs     = ""     TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                               (e.g. colspan="3", data-col-id="name").
    gg.jte.Content content    the cell value or composed markup (badge, link, action button).

  Usage:
    @@template.lievit.table.cell(content = @@`Cecchetto`)
    @@template.lievit.table.cell(cssClass = "text-right font-mono tabular-nums",
      content = @@`240000`)
    @@template.lievit.table.cell(attrs = "colspan=\"3\"",
      content = @@`<span class="text-[var(--lv-color-muted)]">No data.</span>`)
--%>
@param String cssClass = ""
@param String attrs = ""
@param String edge = ""
@param gg.jte.Content content
<%-- Filament fi-ta edge gutter: the first/last cell of a row gets an extra outer inset so the
     content sits off the card frame. Complete static class literals so the Tailwind scanner keeps
     them. "" (interior cell) adds nothing. --%>
!{var _edgeClass = switch (edge) {
    case "first" -> "ps-[var(--lv-space-6)]";
    case "last"  -> "pe-[var(--lv-space-6)]";
    default      -> "";
  };}
<td
  data-slot="table-cell"
  class="px-[var(--lv-space-4)] py-[var(--lv-space-3)] align-middle [&:has([role=checkbox])]:pr-0 ${_edgeClass} ${cssClass}"
  $unsafe{attrs}
>${content}</td>
