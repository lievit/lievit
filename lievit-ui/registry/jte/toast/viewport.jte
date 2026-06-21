@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui toast/viewport partial -- the fixed stack container that holds several toasts at one
  corner (sonner's Toaster region; data-slot="toast-viewport"). Server-rendered, zero JS.

  TIER: STATIC presentational -> JTE partial. Pure layout (a fixed-corner flex column with a gap),
  no client state: the server already knows which toasts to show, so it renders them stacked.

  STRUCTURE (scientific decision rule): sonner renders ONE fixed region per corner that column-
  stacks its toasts. We reproduce that with a fixed flex column anchored to the chosen `position`
  (the six sonner corners) and a token gap between toasts. Bottom positions stack column-reverse so
  a new toast appears nearest the edge and pushes the older ones away from it, matching sonner. The
  toasts inside are rendered with standalone=false so they flow in this column instead of fixing
  themselves.

  A11y: a plain layout container; each child toast owns its own role=alert/status live region, so
  the viewport itself carries no role.

  Params:
    String position = "bottom-right"  one of: top-left | top-center | top-right |
                                      bottom-left | bottom-center | bottom-right.
    gg.jte.Content content            the @template.lievit.toast(standalone = false, ...) calls.
    String cssClass = ""              extra utility classes on the viewport.

  Usage:
    @@template.lievit.toast.viewport(position = "top-right", content = @@`
      @@template.lievit.toast(standalone = false, variant = "success", content = @@`Saved.`)
      @@template.lievit.toast(standalone = false, variant = "info", content = @@`Heads up.`)
    `)
--%>
@param String position = "bottom-right"
@param gg.jte.Content content
@param String cssClass = ""

!{var bottom = position.startsWith("bottom");}
!{var posStyle = switch (position) {
    case "top-left"      -> "top: var(--lv-space-4); left: var(--lv-space-4); align-items: flex-start;";
    case "top-center"    -> "top: var(--lv-space-4); left: 50%; transform: translateX(-50%); align-items: center;";
    case "top-right"     -> "top: var(--lv-space-4); right: var(--lv-space-4); align-items: flex-end;";
    case "bottom-left"   -> "bottom: var(--lv-space-4); left: var(--lv-space-4); align-items: flex-start;";
    case "bottom-center" -> "bottom: var(--lv-space-4); left: 50%; transform: translateX(-50%); align-items: center;";
    default              -> "bottom: var(--lv-space-4); right: var(--lv-space-4); align-items: flex-end;"; // bottom-right
  };}

<div
  data-slot="toast-viewport"
  data-position="${position}"
  class="flex gap-[var(--lv-space-3)]"
  style="position: fixed; z-index: var(--lv-z-toast, 9000); flex-direction: ${bottom ? "column-reverse" : "column"}; ${posStyle}"
>${content}</div>
