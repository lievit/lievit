@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui description-list partial -- a read-only label->value list rendered as a real
  <dl> grid: each row a <dt> term + <dd> definition (description-list.item). This is the
  detail-page primitive the kit's AdminViewView.Section (its ordered label-to-display map) and
  Filament's infolist section grid need: a structured READ of a record, N columns, terms left,
  values right. NOT data-table (no sorting/selection), NOT a form (read-only, no inputs).

  TIER: STATIC presentational -> JTE partial. Pure layout; the values are already-projected
  strings the controller resolved (the kit's "silent-slot" lesson: the template iterates resolved
  display, never re-runs a closure).

  STRUCTURE (scientific decision rule): the semantic HTML for label->value is <dl>/<dt>/<dd>
  (shadcn has no dedicated export; its dashboards compose a grid of dt/dd). Filament's infolist
  section is an N-column grid of entry-wrappers (label column + value column). We ship the <dl>
  grid container here and the <dt>+<dd> pair in description-list/item.jte (mirroring item.jte +
  item/* sub-parts). `columns` drives the grid via the inline --lv-dl-cols custom property (no
  inline stylesheet element, CSP-friendly even under a style-nonce policy); an item may span more
  than one column (description-list.item columnSpan via a grid-column span), mirroring the kit's
  Entry.columnSpan / ResolvedNode.Field.columnSpan. The grid collapses to one column on small
  screens by default; pass a Tailwind sm: utility through cssClass to tune the breakpoint.

  TOKEN FIDELITY: terms read --lv-color-muted-fg, values --lv-color-fg; the grid gap reads the
  space scale, so a theme retints + respaces the whole list.

  A11y: a native <dl> already associates each <dt> with its <dd> for assistive tech (a description
  list); no extra ARIA needed. The list is read-only content, not a control.

  Params:
    gg.jte.Content content        the rows (description-list.item partials).
    int columns     = 1           the column count from the sm: breakpoint (1..N); 1 => a stacked list.
    String cssClass = ""          extra utility classes on the list root.

  Usage:
    @@template.lievit.description-list(columns = 2, content = @@`
      @@template.lievit.description-list.item(term = "Nome", content = @@`Mario Rossi`)
      @@template.lievit.description-list.item(term = "Email", content = @@`mario@@example.com`)
      @@template.lievit.description-list.item(term = "Note", columnSpan = 2, content = @@`Cliente storico.`)
    `)
--%>
@param gg.jte.Content content
@param int columns = 1
@param String cssClass = ""

!{var cols = Math.max(1, columns);}

<dl
  data-slot="description-list"
  data-columns="${cols}"
  class="m-0 grid grid-cols-1 gap-x-[var(--lv-space-6)] gap-y-[var(--lv-space-4)] text-[length:var(--lv-text-sm)] sm:[grid-template-columns:repeat(var(--lv-dl-cols),minmax(0,1fr))]"
  style="font-family:var(--lv-font-sans); --lv-dl-cols:${cols};"
>
  ${content}
</dl>
