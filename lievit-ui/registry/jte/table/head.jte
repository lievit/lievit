@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.head partial -- a header cell <th> in the composable table set.

  TIER: PARTIAL (sub-partial; composed inside table.header rows).

  STRUCTURE: native <th scope="..."> (implicit role="columnheader" or "rowheader" per scope).
  Renders the muted header look. When ariaSort is set, the aria-sort attribute is emitted on
  THIS element (the th), NOT on an inner button: the APG sortable-table example is explicit.
  The sort interaction button lives inside the content slot (composed by data-table.jte); this
  partial is the container only.

  A11y (WAI-ARIA APG Table + sortable-table example):
    - scope="col" (default) -> implicit role="columnheader".
    - scope="row" -> implicit role="rowheader" (for row-header columns, e.g. name/ID).
    - scope="colgroup" | "rowgroup" -> spanning group headers.
    - aria-sort: "ascending" | "descending" | "none" | null. Set by the server (data-table.jte
      reads sort state); null (default) drops the attribute for non-sortable columns.
      Per the APG, aria-sort goes on <th>, not on the inner button.
    - Hidden columns: set cssClass="sr-only" to keep the header in the a11y tree while
      hiding it visually (required for colspan / a11y math correctness).

  Params:
    String scope     = "col"    HTML scope: "col" | "colgroup" | "row" | "rowgroup".
    String ariaSort  = null     "ascending" | "descending" | "none" | null.
                                null -> attribute dropped (non-sortable column).
    String cssClass  = ""       extra utility classes (e.g. "text-right", "sr-only").
    gg.jte.Content content      the column header label (plain text or a sort button slot).

  Usage:
    @@template.lievit.table.head(content = @@`Name`)
    @@template.lievit.table.head(scope = "row", content = @@`ID`)
    @@template.lievit.table.head(ariaSort = "ascending", content = @@`
      <button type="button" hx-get="..." ...>Name <span aria-hidden="true">&#9650;</span></button>
    `)
    @@template.lievit.table.head(cssClass = "sr-only", content = @@`Actions`)
--%>
@param String scope = "col"
@param String ariaSort = null
@param String cssClass = ""
@param String edge = ""
@param gg.jte.Content content
<%-- Filament fi-ta edge gutter: the first/last header cell gets an extra outer inset (ps-6 / pe-6)
     so the header label aligns with the body content off the card frame. Complete static literals so
     the Tailwind scanner keeps them; "" (interior column) adds nothing. --%>
!{var _edgeClass = switch (edge) {
    case "first" -> "ps-[var(--lv-space-6)]";
    case "last"  -> "pe-[var(--lv-space-6)]";
    default      -> "";
  };}
<%--
  Header cell styling:
  - Height via min-height (not fixed: a group header spanning two lines must still be readable).
  - px-[var(--lv-space-4)] horizontal + py-[var(--lv-space-2)] vertical (md default; size
    variant is the data-table.jte responsibility, not this primitive's concern).
  - Filament-grade: subtle tint (35% surface), small-semibold muted label.
  - [&:has([role=checkbox])]:pr-0 aligns a checkbox col header flush with the cell checkbox.
--%>
<th
  scope="${scope}"
  data-slot="table-head"
  aria-sort="${ariaSort}"
  class="h-[var(--lv-space-9)] px-[var(--lv-space-4)] py-[var(--lv-space-2)] text-left align-middle text-[length:var(--lv-text-xs)] font-[var(--lv-font-semibold)] tracking-wide whitespace-nowrap [&:has([role=checkbox])]:pr-0 ${_edgeClass} ${cssClass}"
  style="color:var(--lv-color-muted-fg);"
>${content}</th>
