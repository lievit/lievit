@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui space partial -- set spacing between inline children (Ant Design Space parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). Zero client state;
  the server renders a flex container with a token gap. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Space is the "set a consistent gap between a small group of inline controls" primitive
    (buttons in a toolbar, a label + a tag). It differs from Flex by intent: Space is the
    horizontal-by-default, wrap-friendly inline cluster; Flex is the general two-axis box. Both
    compile to the same flex utilities here; Space exists as the discoverable, intent-named API
    Ant users reach for. Direction (horizontal|vertical), size (small|middle|large or a raw length),
    wrap, and align map onto Tailwind utilities + the --lv-space-* scale.
    Inventory reference: Ant Design Space. Original generation over --lv-* tokens; no Ant code copied.

  A11y (no WAI-ARIA pattern): a spacing wrapper carries no role and is not interactive.

  Params:
    gg.jte.Content content              the inline children to space apart.
    String direction = "horizontal"     "horizontal" (row, wrap) | "vertical" (column).
    String size      = "small"          none|small|middle|large (token scale) OR a raw CSS length.
    String align     = "center"         cross-axis: start|end|center|baseline.
    boolean wrap     = true             allow wrapping (horizontal default true, Ant parity).
    String cssClass  = ""               extra utility classes on the root.
    String attrs     = ""               TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.space(content = @@`@@template.lievit.button(label="Save") @@template.lievit.button(label="Cancel")`)
    @@template.lievit.space(direction = "vertical", size = "middle", content = @@`...`)
--%>
@param gg.jte.Content content
@param String direction = "horizontal"
@param String size = "small"
@param String align = "center"
@param boolean wrap = true
@param String cssClass = ""
@param String attrs = ""

!{var vertical = "vertical".equals(direction);}
!{var dir = vertical ? "flex-col" : "flex-row";}
!{var alignClass = switch (align) {
    case "start"    -> "items-start";
    case "end"      -> "items-end";
    case "baseline" -> "items-baseline";
    default         -> "items-center";
  };}
<%-- vertical stacks never wrap; horizontal honours the wrap flag (Ant default true). --%>
!{var wrapClass = (!vertical && wrap) ? "flex-wrap" : "flex-nowrap";}
!{var sizeToken = switch (size) {
    case "none"   -> "var(--lv-space-0)";
    case "middle" -> "var(--lv-space-4)";
    case "large"  -> "var(--lv-space-6)";
    case "small"  -> "var(--lv-space-2)";
    default       -> null;
  };}
!{var gapStyle = "gap:" + (sizeToken != null ? sizeToken : size) + ";";}

<div
  data-slot="space"
  data-direction="${direction}"
  class="inline-flex ${dir} ${alignClass} ${wrapClass} ${cssClass}"
  style="${gapStyle}"
  $unsafe{attrs}
>${content}</div>
