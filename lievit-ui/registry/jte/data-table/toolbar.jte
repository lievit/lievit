@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui :: data-table.toolbar - the controls row ABOVE the server-first data table.

  shadcn's Data Table puts a control row above the <table>: a filter <Input> on the left and a
  column-visibility <DropdownMenu> ("Columns") pushed to the right (ml-auto). This partial is that
  row as a slot/region: a `search` slot on the left, an `end` slot on the right (the column-visibility
  toggle and any bulk-action buttons), composed in one flex row that matches shadcn's `flex items-center
  py-4`. Both are SLOTS (the caller owns the wired controls) so the partial stays presentational.

  SERVER-FIRST: the search/filter and column-visibility are SERVER facts the kit holds (a filter query,
  a set of hidden columns), like sort and page. The partial renders the affordance + the wire hook seam;
  lievit-kit (or a plain controller) wires the actual round-trip. The search input is the lievit input
  partial type="search" with a `model` for the wire field (and a real `name` so it POSTs JS-off inside a
  surrounding <form>); the column-visibility dropdown is the sibling data-table.column-visibility partial.

  Params:
    Content search  = null   the left slot: the search / filter affordance (e.g. @template.lievit.input
                             type="search"). null renders nothing on the left (the `end` slot still
                             right-aligns).
    Content end     = null   the right slot: the column-visibility toggle + bulk-action buttons. Pushed
                             to the right edge (ml-auto) exactly like shadcn's "Columns" button.
    String  klass   = ""     extra classes on the toolbar row.

  Usage:
    @@template.lievit.data-table.toolbar(
      search = @@`@@template.lievit.input(name = "q", type = "search", size = "sm",
                   placeholder = "Filter...", model = "query", cssClass = "max-w-[20rem]")`,
      end = @@`@@template.lievit.data-table.column-visibility(content = @@`...`)`
    )
--%>
@param gg.jte.Content search = null
@param gg.jte.Content end = null
@param String klass = ""
<div
  data-slot="data-table-toolbar"
  class="flex items-center gap-[var(--lv-space-2)] py-[var(--lv-space-4)] ${klass}"
  style="font-family:var(--lv-font-sans);"
>
  @if(search != null)
    <div data-slot="data-table-search" class="flex items-center">${search}</div>
  @endif
  @if(end != null)
    <div data-slot="data-table-toolbar-end" class="ml-auto flex items-center gap-[var(--lv-space-2)]">${end}</div>
  @endif
</div>
