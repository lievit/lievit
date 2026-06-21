@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui item/media partial -- shadcn's ItemMedia: the leading media region of an item row,
  with the three shadcn variants (default | icon | image).

  TIER: STATIC presentational -> JTE partial. Pure layout, no client state.

  STRUCTURE (scientific decision rule): the core item.jte renders an inline item-media wrapper for
  the simple case. This partial is the TYPED form: it carries data-variant so the icon/image chrome
  matches shadcn exactly:
    - default: transparent, just centres the slot (an inline icon/index).
    - icon: a size-8 rounded bordered muted tile around a centred svg (svg sized to 4 when unstyled).
    - image: a size-10 rounded overflow-clipped tile whose <img> fills + object-covers.
  The base also self-starts + nudges down when the row has a description, the same sibling-aware
  rule shadcn ships. Use it inside the item's `leading` slot.

  A11y: media images MUST carry their own alt; decorative icons come from the Lucide partial
  (aria-hidden by default). The media tile itself is presentational.

  Params:
    gg.jte.Content content      the icon / image / index markup.
    String variant  = "default" default | icon | image.
    String cssClass = ""        extra utility classes on the media tile.

  Usage:
    @@template.lievit.item(leading = @@`
      @@template.lievit.item.media(variant = "icon", content = @@`@@template.lievit.icon(name = "folder")`)
    `, content = @@`...`)

    @@template.lievit.item.media(variant = "image", content = @@`<img src="/a.jpg" alt="Avatar">`)
--%>
@param gg.jte.Content content
@param String variant = "default"
@param String cssClass = ""

!{var variantClass = switch (variant) {
    case "icon" -> "size-8 rounded-[var(--lv-radius-sm)] border border-[var(--lv-color-border)] bg-[var(--lv-color-muted-bg)] [&_svg:not([class*='size-'])]:size-4";
    case "image" -> "size-10 overflow-hidden rounded-[var(--lv-radius-sm)] [&_img]:size-full [&_img]:object-cover";
    default -> "bg-transparent";
  };}

<div
  data-slot="item-media"
  data-variant="${variant}"
  class="flex shrink-0 items-center justify-center gap-[var(--lv-space-2)] group-has-[[data-slot=item-description]]/item:translate-y-0.5 group-has-[[data-slot=item-description]]/item:self-start [&_svg]:pointer-events-none ${variantClass} ${cssClass}"
>
  ${content}
</div>
