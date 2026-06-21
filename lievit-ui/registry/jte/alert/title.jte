@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert/title partial -- the heading line of an alert (server-first, no JS). The shadcn
  AlertTitle: col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight. A standalone data-slot
  for callers composing an alert body by hand; the alert partial inlines the same markup when you
  pass its `title` slot.

  TIER: STATIC presentational -> JTE partial. Pure token-styled text.

  Params:
    gg.jte.Content content              the title text.
    String         cssClass = ""        extra utility classes on the title.

  Usage:
    @@template.lievit.alert.title(content = @@`Could not save`)
--%>
@param gg.jte.Content content
@param String cssClass = ""
<div
  data-slot="alert-title"
  class="${cssClass}"
  style="grid-column:2;min-height:1rem;font-weight:var(--lv-font-medium);letter-spacing:-0.01em;"
>${content}</div>
