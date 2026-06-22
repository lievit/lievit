@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui data-list partial -- a divided list surface: a real <ul role="list"> whose <li> rows
  (data-list.row) are separated by a hairline rule (the shadcn "divide-y" list pattern). Each row
  is a left content column + an optional right actions cluster. This is the read-only LIST display
  primitive the kit's infolist / RepeatableEntry and gest's profile lists need: distinct from
  `item` (a single composable card-like row) and from `data-table` (a sortable/selectable grid).

  TIER: STATIC presentational -> JTE partial. Pure layout + styling; any actionable row puts its
  own <a>/<button> in the content or actions slot and keeps its own semantics + focus ring.

  STRUCTURE (scientific decision rule): shadcn has no single "DataList" export, it composes a
  <ul class="divide-y"> of rows; Filament's fi-* lists and the infolist RepeatableEntry render the
  same shape (a bordered card wrapping divided rows, content left, actions right). We ship the
  container here (the <ul>, the optional bordered card chrome, the divide rule) and the row in
  data-list/row.jte, mirroring how item.jte ships item + item/* sub-parts. One Content slot
  (`content`) holds the rows so the caller composes freely; `bordered` wraps the list in the card
  surface (border + radius + card bg), matching Filament's panelled lists; flush drops it for an
  inline divided list.

  TOKEN FIDELITY: the divide + border read --lv-color-border; the bordered surface reads
  --lv-color-card / --lv-color-card-fg + --lv-radius-lg, so a theme retints the whole list.

  A11y (WAI-ARIA list): role="list" on the <ul> (Safari drops the implicit list role when
  list-style is removed, so it is stated), each row carries role="listitem" (data-list.row sets it).
  The list itself is presentational; the rows carry the content and any controls.

  Params:
    gg.jte.Content content        the rows (data-list.row partials).
    boolean bordered = true       wrap the list in a bordered card surface (Filament panelled list);
                                  false => a flush, inline divided list with no outer chrome.
    String role     = "list"      the list role; override to null for a bare presentational <ul>.
    String cssClass = ""          extra utility classes on the list root.

  Usage:
    @@template.lievit.data-list(content = @@`
      @@template.lievit.data-list.row(
        content = @@`<span class="font-[var(--lv-font-medium)]">Mario Rossi</span>`,
        actions = @@`@@template.lievit.badge(label = "Attivo", variant = "success")`)
      @@template.lievit.data-list.row(content = @@`<span>Luca Bianchi</span>`)
    `)
--%>
@param gg.jte.Content content
@param boolean bordered = true
@param String role = "list"
@param String cssClass = ""

!{var chromeClass = bordered
    ? "overflow-hidden rounded-[var(--lv-radius-lg)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] text-[var(--lv-color-card-fg)]"
    : "";}

<ul
  data-slot="data-list"
  data-bordered="${bordered}"
  role="${role}"
  class="m-0 flex list-none flex-col p-0 [&>li:not(:first-child)]:border-t [&>li]:border-[var(--lv-color-border)] ${chromeClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  ${content}
</ul>
