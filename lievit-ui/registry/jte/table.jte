@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui table partial -- the <table> scroll wrapper (composable set root).

  TIER: PARTIAL presentational (ADR-0012 server-first pivot). Zero client state.
  The table composable set mirrors shadcn Table / TableHeader / TableBody / TableRow /
  TableHead / TableCell / TableCaption / TableFooter: the caller owns the row and cell
  loop, this partial is the <table> wrapper + horizontal-scroll container.

  STRUCTURE (scientific decision rule):
    - WAI-ARIA APG Table pattern (https://www.w3.org/WAI/ARIA/apg/patterns/table/).
      Native <table> supplies implicit role="table"; scope, colspan, rowspan, and
      browser column-width algorithms come for free -- NEVER a <div role="table">.
    - Composable set (shadcn-style): table.jte (wrapper) + table/{header,body,footer,
      row,head,cell,caption}.jte. The caller composes, owns the loop; this partial
      provides ONLY the chrome. data-table.jte is the separate HTMX-driven data view
      that COMPOSES these primitives.
    - Styling: ORIGINAL generation over --lv-* tokens; look inspired by Tailwind UI
      (no code copied).

  A11y (WAI-ARIA APG Table):
    - Native <table> (implicit role="table"). ariaLabel or a visible <caption>
      (rendered via table.caption) is REQUIRED for the accessible name.
    - Keyboard: APG states "Not applicable" -- the platform handles Tab focus on any
      focusable child (sort buttons, checkboxes, action links).
    - No focus trap, no roving tabindex; static structure.

  Params:
    String ariaLabel        = null   aria-label on <table> when no visible caption
                                     is composed as a child. One of ariaLabel or a
                                     table.caption child is REQUIRED for an accessible
                                     name.
    String ariaLabelledBy   = null   aria-labelledby pointing to an element id that
                                     labels the table. Mutually exclusive with ariaLabel.
    String ariaDescribedBy  = null   aria-describedby pointing to an external description
                                     element id.
    String cssClass         = ""     extra utility classes on the <table> element.
    String attrs            = ""     TRUSTED raw ($unsafe) -- STATIC author-typed strings
                                     only (e.g. data-controller="...").
    gg.jte.Content content           the thead / tbody / tfoot / caption blocks composed
                                     by the caller.

  Usage:
    @@template.lievit.table(ariaLabel = "Q2 Listings", content = @@`
      @@template.lievit.table.caption(content = @@`Q2 Listings`)
      @@template.lievit.table.header(content = @@`
        @@template.lievit.table.row(content = @@`
          @@template.lievit.table.head(content = @@`Ref`)
          @@template.lievit.table.head(content = @@`Agent`)
          @@template.lievit.table.head(cssClass = "text-right", content = @@`Price`)
        `)
      `)
      @@template.lievit.table.body(content = @@`
        @@template.lievit.table.row(content = @@`
          @@template.lievit.table.cell(content = @@`A-1024`)
          @@template.lievit.table.cell(content = @@`Cecchetto`)
          @@template.lievit.table.cell(cssClass = "text-right", content = @@`240000`)
        `)
      `)
    `)
--%>
@param String ariaLabel = null
@param String ariaLabelledBy = null
@param String ariaDescribedBy = null
@param String cssClass = ""
@param String attrs = ""
@param gg.jte.Content content
<div data-slot="table-container" class="relative w-full overflow-x-auto">
  <table
    data-slot="table"
    aria-label="${ariaLabel}"
    aria-labelledby="${ariaLabelledBy}"
    aria-describedby="${ariaDescribedBy}"
    class="w-full caption-bottom text-[length:var(--lv-text-sm)] ${cssClass}"
    style="font-family:var(--lv-font-sans);color:var(--lv-color-fg);border-collapse:collapse;"
    $unsafe{attrs}
  >${content}</table>
</div>
