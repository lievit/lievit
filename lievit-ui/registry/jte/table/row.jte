@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.row partial -- a <tr> in the composable table set.

  TIER: PARTIAL (sub-partial; composed inside table.header, table.body, table.footer).

  STRUCTURE: native <tr> (implicit role="row"). Bottom border + optional hover highlight.
  A selected row is communicated via aria-selected="true" (server-owned state, passed as a
  param by the caller / data-table; the table-select.enhancer.ts toggles it on the fly for
  the bulk-select scenario). data-state="selected" drives the CSS tint for consistency with
  shadcn patterns; both are kept in sync.

  A11y (WAI-ARIA APG Table):
    - Native <tr> (implicit role="row").
    - aria-selected: "true" | "false" | null. Omit (null) when the table has no selection
      model (default). When selectable=true, emit "false" on each row; the enhancer
      flips it on check.
    - aria-rowindex: 1-based row index within the FULL dataset (not just the current page).
      Omit when the table is not paginated (null -> attribute dropped).

  Params:
    String ariaSelected   = null   "true" | "false" | null (attribute dropped when null).
    String ariaRowIndex   = null   1-based row index in the full dataset; null -> omitted.
    String state          = ""     "selected" sets data-state for CSS hooks (shadcn parity).
    String dataRowId      = null   row identity (already HTML-escaped by caller) written to
                                   data-row-id for the table-select.enhancer + HTMX swaps.
    boolean hoverable     = true   row hover highlight via --lv-color-accent.
    boolean striped       = false  even-row tint (caller passes true for even rows).
    boolean bordered      = false  per-cell border style (matches parent table bordered flag).
    String cssClass       = ""     extra utility classes on <tr>.
    gg.jte.Content content         the head / cell blocks for this row.

  Usage:
    @@template.lievit.table.row(content = @@`
      @@template.lievit.table.head(content = @@`Name`)
      @@template.lievit.table.head(content = @@`Price`)
    `)
    @@template.lievit.table.row(ariaSelected = "false", dataRowId = row.id(),
      state = "selected", content = @@`...`)
--%>
@param String ariaSelected = null
@param String ariaRowIndex = null
@param String state = ""
@param String dataRowId = null
@param boolean hoverable = true
@param boolean striped = false
@param boolean bordered = false
@param String cssClass = ""
@param gg.jte.Content content
<%-- data-state: null drops the attribute when empty (smart attribute, no @if in name position). --%>
!{var _hoverClass = hoverable ? "hover:bg-[color-mix(in_srgb,var(--lv-color-accent)_70%,var(--lv-color-bg))] data-[state=selected]:bg-[color-mix(in_srgb,var(--lv-color-accent)_40%,var(--lv-color-bg))]" : "";}
!{var _stripedStyle = striped ? "background-color:color-mix(in srgb, var(--lv-color-surface) 40%, var(--lv-color-bg));" : "";}
!{var _borderStyle = bordered ? "border:1px solid var(--lv-color-border);" : "border-bottom:1px solid var(--lv-color-border);";}
<tr
  data-slot="table-row"
  data-state="${state.isEmpty() ? null : state}"
  data-row-id="${dataRowId}"
  aria-selected="${ariaSelected}"
  aria-rowindex="${ariaRowIndex}"
  class="transition-colors ${_hoverClass} ${cssClass}"
  style="${_borderStyle}${_stripedStyle}"
>${content}</tr>
