@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table.header partial -- the <thead> of the composable table set.

  TIER: PARTIAL (sub-partial; composed inside @@template.lievit.table).

  STRUCTURE: native <thead> (implicit role="rowgroup"). Holds one or more
  @@template.lievit.table.row blocks of @@template.lievit.table.head cells.
  A sticky-header mode is supported: the caller passes stickyHeader=true and
  provides a scroll-area wrapper; this partial sets position:sticky + a bottom
  shadow separator + z-index above scrolling rows.

  A11y (WAI-ARIA APG Table):
    - Native <thead> (implicit role="rowgroup").
    - No ARIA role override needed: the semantic is correct by element choice.

  Params:
    boolean stickyHeader  = false  position:sticky + z-var(--lv-z-sticky) on this
                                   element. Caller must supply an overflow scroll wrapper.
    String cssClass       = ""     extra utility classes on <thead>.
    gg.jte.Content content         the header row(s): @@template.lievit.table.row blocks.

  Usage:
    @@template.lievit.table.header(content = @@`
      @@template.lievit.table.row(content = @@`
        @@template.lievit.table.head(content = @@`Name`)
        @@template.lievit.table.head(content = @@`Price`)
      `)
    `)
    @@template.lievit.table.header(stickyHeader = true, content = @@`...`)
--%>
@param boolean stickyHeader = false
@param String cssClass = ""
@param gg.jte.Content content
!{var _theadStyle = stickyHeader
    ? "position:sticky;top:0;z-index:var(--lv-z-sticky);background:var(--lv-color-bg);box-shadow:0 1px 0 0 var(--lv-color-border);"
    : "";}
<thead
  data-slot="table-header"
  data-sticky-header="${stickyHeader ? "true" : null}"
  class="${cssClass}"
  style="${_theadStyle}background-color:${stickyHeader ? "var(--lv-color-bg)" : "color-mix(in srgb, var(--lv-color-surface) 35%, var(--lv-color-bg))"};"
>${content}</thead>
