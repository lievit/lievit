@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui data-list/row partial -- one <li> row of a data-list: an optional leading media slot,
  a left content column, and an optional right actions cluster, vertically centred and wrapping
  gracefully on narrow widths. The row the divided list (data-list.jte) stacks and rules between.

  TIER: STATIC presentational -> JTE partial. Layout + styling only; an actionable row puts its own
  <a>/<button> in the content/actions slot (it keeps its own semantics + focus ring).

  STRUCTURE (scientific decision rule): shadcn's divided-list <li> is a flex row, content growing,
  trailing actions pinned to the end (justify-between); Filament's list rows are the same. We expose
  leading / content / trailing slots like item.jte (the same composability) but as a real <li> with
  role="listitem", since data-list is a true <ul role="list"> (item.jte is a div-based row).

  A11y: role="listitem" (the parent <ul> is role="list"); a hover tint signals an actionable row,
  but the affordance is the <a>/<button> in a slot, not the row. Decorative leading icons come from
  the Lucide partial (aria-hidden); media images carry their own alt.

  Params:
    gg.jte.Content content        the main column (name + meta, or any markup).
    gg.jte.Content leading = null leading media slot (icon, avatar, image, index).
    gg.jte.Content actions = null trailing actions cluster (badge, buttons, chevron, meta).
    String role     = "listitem"  the row role; override for a non-list context.
    String cssClass = ""          extra utility classes on the row.

  Usage:
    @@template.lievit.data-list.row(
      leading = @@`@@template.lievit.avatar(name = "Mario Rossi")`,
      content = @@`
        <span class="font-[var(--lv-font-medium)]">Mario Rossi</span>
        <span class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">mario@@example.com</span>
      `,
      actions = @@`@@template.lievit.badge(label = "Attivo", variant = "success")`)
--%>
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content actions = null
@param String role = "listitem"
@param String cssClass = ""

<li
  data-slot="data-list-row"
  role="${role}"
  class="group/data-list-row flex flex-wrap items-center gap-[var(--lv-space-3)] px-[var(--lv-space-4)] py-[var(--lv-space-3)] text-[length:var(--lv-text-sm)] transition-colors hover:bg-[var(--lv-color-muted-bg)] ${cssClass}"
>
  @if(leading != null)
    <div data-slot="data-list-row-media" class="flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] [&_svg]:pointer-events-none">
      ${leading}
    </div>
  @endif
  <div data-slot="data-list-row-content" class="flex min-w-0 flex-1 flex-col gap-[var(--lv-space-1)]">
    ${content}
  </div>
  @if(actions != null)
    <div data-slot="data-list-row-actions" class="flex shrink-0 items-center gap-[var(--lv-space-2)]">
      ${actions}
    </div>
  @endif
</li>
