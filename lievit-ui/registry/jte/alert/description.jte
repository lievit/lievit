@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert/description partial -- the body text of an alert (server-first, no JS). The shadcn
  AlertDescription: col-start-2 grid justify-items-start gap-1 text-sm text-muted-foreground. A
  standalone data-slot for callers composing an alert body by hand; the alert partial inlines the
  same markup for its `description` (or `content`) region.

  TIER: STATIC presentational -> JTE partial. Pure token-styled text.

  Params:
    gg.jte.Content content              the description body.
    String         cssClass = ""        extra utility classes on the description.

  Usage:
    @@template.lievit.alert.description(content = @@`The listing was not persisted.`)
--%>
@param gg.jte.Content content
@param String cssClass = ""
<div
  data-slot="alert-description"
  class="${cssClass}"
  style="grid-column:2;display:grid;justify-items:start;row-gap:var(--lv-space-1);font-size:var(--lv-text-sm);color:var(--lv-color-muted-fg);"
>${content}</div>
