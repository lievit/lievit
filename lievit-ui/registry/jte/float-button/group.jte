@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui float-button.group partial -- a stack of FABs (Ant FloatButton.Group parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's FloatButton.Group pins a column (or row) of FABs to a corner. Here the GROUP owns the
    fixed-position inset + the stacking direction; the nested float-button children are rendered
    with floating=false so they flow inside the group. The caller composes the children into the
    content slot (same composition model as accordion / button-group).
    Inventory reference: Ant Design FloatButton.Group. Original generation over --lv-* tokens.

  A11y: a <div role="group"> with an accessible name (aria-label) so AT announces the cluster.

  Params:
    gg.jte.Content content              the float-button children (each floating=false).
    String position  = "bottom-right"   corner: bottom-right|bottom-left|top-right|top-left.
    String direction = "vertical"       "vertical" (column) | "horizontal" (row).
    String ariaLabel = null             accessible name for the group.
    String cssClass  = ""               extra utility classes.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.float-button.group(ariaLabel = "Quick actions", content = @@`
      @@template.lievit.float-button(icon = "plus", label = "Add", floating = false, type = "primary")
      @@template.lievit.float-button(icon = "pencil", label = "Edit", floating = false)
    `)
--%>
@param gg.jte.Content content
@param String position = "bottom-right"
@param String direction = "vertical"
@param String ariaLabel = null
@param String cssClass = ""
@param String attrs = ""

!{var dirClass = "horizontal".equals(direction) ? "flex-row" : "flex-col";}
!{var posStyle = switch (position) {
    case "bottom-left" -> "position:fixed;left:var(--lv-space-6);bottom:var(--lv-space-6);z-index:50;";
    case "top-right"   -> "position:fixed;right:var(--lv-space-6);top:var(--lv-space-6);z-index:50;";
    case "top-left"    -> "position:fixed;left:var(--lv-space-6);top:var(--lv-space-6);z-index:50;";
    default            -> "position:fixed;right:var(--lv-space-6);bottom:var(--lv-space-6);z-index:50;";
  };}

<div
  data-slot="float-button-group"
  role="group"
  aria-label="${ariaLabel}"
  data-direction="${direction}"
  class="flex ${dirClass} items-center gap-[var(--lv-space-3)] ${cssClass}"
  style="${posStyle}"
  $unsafe{attrs}
>${content}</div>
