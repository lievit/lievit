@import gg.jte.Content
@*
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item partial -- a generic list/menu row: an optional leading media slot, a
  title + description content column, and an optional trailing actions slot.

  TIER: STATIC presentational -> JTE partial. The row is layout + styling; any interactivity
  (a clickable row, a menu item with keyboard nav) is the adopter's <a>/<button> or a Lit
  menu island. This is shadcn's `Item` (the composable row), not a stateful control.

  STRUCTURE (scientific decision rule): shadcn composes Item + ItemMedia + ItemContent +
  ItemTitle + ItemDescription + ItemActions. In JTE we expose the three regions as Content
  slots (leading / content / trailing) and let the caller fill them, which keeps the same
  composability without N partials. Variants (default | outline | muted) and sizes
  (default | sm) mirror shadcn's cva. shadcn wins styling ergonomics; there is no Radix
  behaviour to defer to for a presentational row.

  A11y: defaults to a plain <div>. When the row is a real list entry pass role="listitem"
  via `role` and wrap a group in role="list". When it is actionable, put the <a>/<button> in
  the leading/content slot (it keeps its own semantics + focus ring); the row itself adds a
  hover tint so the affordance reads. Media images must carry their own alt; decorative icons
  come from the Lucide partial (aria-hidden by default).

  Params:
    gg.jte.Content content        the main column (use title/description partials or markup).
    gg.jte.Content leading = null leading media slot (icon, avatar, image, index number).
    gg.jte.Content trailing = null trailing slot (actions, chevron, badge, meta).
    String variant  = "default"   default | outline | muted.
    String size     = "default"   default | sm.
    String role     = null        e.g. "listitem"; null => plain div.
    String cssClass = ""          extra utility classes on the root.

  Usage:
    @template.item(
      leading = @`@template.icon(name = "folder")`,
      content = @`
        <div class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-snug">Contratti</div>
        <p class="text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]">24 documenti</p>
      `,
      trailing = @`@template.icon(name = "chevron-right", cssClass = "text-[var(--lv-color-muted-fg)]")`
    )

    Grouped list:
    <div role="list" class="flex flex-col">
      @template.item(role = "listitem", content = @`<span>Riga A</span>`)
      @template.item(role = "listitem", content = @`<span>Riga B</span>`)
    </div>
*@
@param gg.jte.Content content
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param String variant = "default"
@param String size = "default"
@param String role = null
@param String cssClass = ""

!{var variantClass = switch (variant) {
    case "outline" -> "border-[var(--lv-color-border)]";
    case "muted" -> "bg-[var(--lv-color-muted-bg)]";
    default -> "bg-transparent";
  };}
!{var sizeClass = size.equals("sm") ? "gap-[var(--lv-space-2)] px-[var(--lv-space-4)] py-[var(--lv-space-3)]" : "gap-[var(--lv-space-4)] p-[var(--lv-space-4)]";}

<div
  data-slot="item"
  data-variant="${variant}"
  data-size="${size}"
  role="${role}"
  class="group/item flex flex-wrap items-center rounded-[var(--lv-radius-md)] border border-transparent text-[length:var(--lv-text-sm)] transition-colors outline-none focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)] ${variantClass} ${sizeClass} ${cssClass}"
>
  @if(leading != null)
    <div data-slot="item-media" class="flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] [&_svg]:pointer-events-none">
      ${leading}
    </div>
  @endif
  <div data-slot="item-content" class="flex flex-1 flex-col gap-[var(--lv-space-1)]">
    ${content}
  </div>
  @if(trailing != null)
    <div data-slot="item-actions" class="flex items-center gap-[var(--lv-space-2)]">
      ${trailing}
    </div>
  @endif
</div>
