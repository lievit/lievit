@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui alert/action partial -- an optional control region pinned under the alert message
  (server-first, no JS). shadcn composes an AlertAction (a button / link to act on the alert, e.g.
  "Retry" / "Dismiss"); here it is a real OWNED control in column 2, below the description, so it
  is announced within the same live region.

  TIER: STATIC presentational -> JTE partial. The control itself (a real <a>/<button>) is OWNED
  markup the caller passes in; activation is the platform's.

  Params:
    gg.jte.Content content              the action control(s), OWNED (a real <a>/<button>).
    String         cssClass = ""        extra utility classes on the action region.

  Usage:
    @@template.lievit.alert.action(content = @@`<a href="/retry">Retry</a>`)
--%>
@param gg.jte.Content content
@param String cssClass = ""
<div
  data-slot="alert-action"
  class="${cssClass}"
  style="grid-column:2;margin-top:var(--lv-space-2);display:flex;align-items:center;gap:var(--lv-space-2);"
>${content}</div>
