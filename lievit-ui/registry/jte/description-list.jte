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
  size controls the row gap and base text size (sm/md/lg scale) so a caller can match the
  surrounding page density without overriding individual rows.
  bordered wraps the <dl> in a card chrome (border + radius + bg) for use inside panel-like
  surfaces; off by default (lists are usually flush in an existing card/section).
  title + extra render a header row above the <dl> when the list needs a visible label.

  A11y: a native <dl> already associates each <dt> with its <dd> for assistive tech (a description
  list); no extra ARIA needed. The list is read-only content, not a control.

  Params:
    gg.jte.Content content        the rows (description-list.item partials).
    int columns     = 1           the column count from the sm: breakpoint (1..N); 1 => a stacked list.
    boolean bordered = false      wrap the <dl> in a card chrome (border + radius + bg).
    String size     = "md"        row-gap + base text size: "sm" | "md" | "lg".
    String title    = null        optional section heading rendered above the <dl>; omitted when null.
    gg.jte.Content extra = null   optional slot beside the title (actions, a badge, a link).
    String cssClass = ""          extra utility classes on the <dl> root.

  Usage:
    @@template.lievit.description-list(columns = 2, content = @@`
      @@template.lievit.description-list.item(term = "Nome", content = @@`Mario Rossi`)
      @@template.lievit.description-list.item(term = "Email", content = @@`mario@@example.com`)
      @@template.lievit.description-list.item(term = "Note", columnSpan = 2, content = @@`Cliente storico.`)
    `)

    @@template.lievit.description-list(columns = 2, title = "Dettagli contatto", bordered = true, content = @@`
      @@template.lievit.description-list.item(term = "Nome", content = @@`Mario Rossi`)
    `)
--%>
@param gg.jte.Content content
@param int columns = 1
@param boolean bordered = false
@param String size = "md"
@param String title = null
@param gg.jte.Content extra = null
@param String cssClass = ""

!{var cols = Math.max(1, columns);}

!{var gapYClass = "sm".equals(size) ? "gap-y-[var(--lv-space-2)]"
    : "lg".equals(size) ? "gap-y-[var(--lv-space-7)]"
    : "gap-y-[var(--lv-space-4)]";}

!{var textSizeClass = "sm".equals(size) ? "text-[length:var(--lv-text-xs)]"
    : "lg".equals(size) ? "text-[length:var(--lv-text-base)]"
    : "text-[length:var(--lv-text-sm)]";}

!{var borderedClass = bordered
    ? "border border-[var(--lv-color-border)] rounded-[var(--lv-radius-md)] bg-[var(--lv-color-card)] p-[var(--lv-space-4)]"
    : "";}

@if(title != null)
<div data-slot="description-list-header" class="mb-[var(--lv-space-4)] flex items-center justify-between">
  <p data-slot="description-list-title" class="m-0 text-[length:var(--lv-text-sm)] text-[var(--lv-color-fg)]" style="font-weight:var(--lv-font-semibold);">${title}</p>
  @if(extra != null)<div data-slot="description-list-extra">${extra}</div>@endif
</div>
@endif

<dl
  data-slot="description-list"
  data-columns="${cols}"
  data-size="${size}"
  data-bordered="${bordered}"
  class="m-0 grid grid-cols-1 gap-x-[var(--lv-space-6)] ${gapYClass} ${textSizeClass} sm:[grid-template-columns:repeat(var(--lv-dl-cols),minmax(0,1fr))] ${borderedClass} ${cssClass}"
  style="font-family:var(--lv-font-sans); --lv-dl-cols:${cols};"
>
  ${content}
</dl>
