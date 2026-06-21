@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui popover/anchor partial -- the shadcn PopoverAnchor: decouples the positioning anchor
  from the trigger (server-first, no JS). Wrap the element the panel should position against; give
  the popover the matching `anchorId` so its position-anchor resolves to this element's
  --<anchorId>-anchor instead of the trigger button.

  TIER: STATIC presentational -> JTE partial. Pure CSS anchor-name carrier; the content is OWNED.

  STRUCTURE (shadcn PopoverAnchor + CSS Anchor Positioning): a wrapper with
  style="anchor-name:--<anchorId>-anchor;" so the popover panel's position-anchor binds here. The
  trigger can then live anywhere on the page; the panel still floats beside THIS element.

  Params:
    String         anchorId            the anchor key; the popover must be given the same `anchorId`.
    gg.jte.Content content              the anchored element (OWNED markup).
    String         cssClass = ""        extra utility classes on the anchor.

  Usage:
    @@template.lievit.popover.anchor(anchorId = "cell-7", content = @@`<td>...</td>`)
    @@template.lievit.popover(id = "cell-pop", anchorId = "cell-7", trigger = @@`Edit`, content = @@`...`)
--%>
@param String anchorId
@param gg.jte.Content content
@param String cssClass = ""
<span
  data-slot="popover-anchor"
  class="${cssClass}"
  style="anchor-name:--${anchorId}-anchor;"
>${content}</span>
