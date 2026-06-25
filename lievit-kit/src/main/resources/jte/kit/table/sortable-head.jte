@import dev.lievit.kit.AdminListView
@import dev.lievit.kit.SortDirection
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-kit :: kit.table.sortable-head - one column header cell (Filament fi-ta-header-cell).

  A sortable column renders a real <a href> (server-first, JS-off) carrying the sort link the host
  built, with aria-sort=ascending|descending when it is the active sort column, and a chevron-up
  (asc) / chevron-down (desc) / muted chevrons-up-down (sortable, not sorted) glyph. A non-sortable
  column (or no sort href) renders the bare label. The <th> root is constant; only the INNER content
  switches (the JTE static-checker rejects an @if/@else that opens a different ROOT tag per branch,
  so the conditional stays inside the cell, never on the <th> itself).

  Params:
    header   - the AdminListView.Header (label / sortKey / sortable / sortDirection / isSorted()).
    sortHref - the sort link for this column (host's printf(%s) with the sort key), or "" for none.
--%>
@param AdminListView.Header header
@param String sortHref = ""
!{var canSort = header.sortable() && sortHref != null && !sortHref.isBlank();}
!{var ariaSort = !header.isSorted() ? null : (header.sortDirection() == SortDirection.ASC ? "ascending" : "descending");}
<th
  scope="col"
  data-slot="table-head"
  aria-sort="${ariaSort}"
  data-sortable="${header.sortable()}"
  data-sort-key="${header.sortKey()}"
  <%-- Filament fidelity: header cells use a SUBTLE tint (the bottom divider does the head/body
       separation; Filament's fi-ta-header-cell is near-transparent), px-3 padding, and a small muted
       semibold label. Lightened from the prior heavy 70% surface band toward the Filament header look. --%>
  class="lv-table-head h-[var(--lv-space-9)] px-[var(--lv-space-3)] py-[var(--lv-space-2)] text-left align-middle text-[length:var(--lv-text-xs)] font-[var(--lv-font-semibold)] tracking-wide whitespace-nowrap"
  style="color:var(--lv-color-muted-fg);background-color:color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg));"
>
  @if(canSort)
    <a
      href="${sortHref}"
      data-slot="table-sort-link"
      class="inline-flex items-center gap-[var(--lv-space-1)] no-underline text-[var(--lv-color-muted-fg)] hover:text-[var(--lv-color-fg)]"
    >
      <span>${header.label()}</span>
      @if(!header.isSorted())
        <span aria-hidden="true" class="text-[var(--lv-color-muted-fg)]">@template.lievit.icon(name = "chevrons-up-down", size = "1rem")</span>
      @elseif(header.sortDirection() == SortDirection.ASC)
        <span aria-hidden="true">@template.lievit.icon(name = "chevron-up", size = "1rem")</span>
      @else
        <span aria-hidden="true">@template.lievit.icon(name = "chevron-down", size = "1rem")</span>
      @endif
    </a>
  @else
    <span>${header.label()}</span>
  @endif
</th>
