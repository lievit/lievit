@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui grid.row partial -- a 24-column grid row (Ant Design Row parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; the server renders a
  CSS-grid container. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Grid is a 24-column system (Row + Col with span/offset, gutter, justify, align). lievit
    otherwise leans on Tailwind utilities, but a fixed 24-column system is awkward to express with
    Tailwind's 12-column utilities AND requires dynamic class names a Tailwind scanner would purge.
    So the column math is expressed as a CSS Grid via INLINE style (fully static, no safelist): the
    row sets `grid-template-columns:repeat(24,minmax(0,1fr))`; each grid.col spans N of the 24.
    Gutter maps onto the --lv-space-* scale; justify/align map onto grid distribution keywords.
    Inventory reference: Ant Design Row. Original generation over --lv-* tokens; no Ant code copied.

  A11y (no WAI-ARIA pattern): a layout grid carries no role and is not interactive.

  Params:
    gg.jte.Content content              the grid.col children.
    String gutter   = "middle"          none|small|middle|large (column gap, token scale) OR a raw
                                        CSS length used verbatim.
    String justify  = "start"           main-axis: start|end|center|between|around|evenly.
    String align    = "stretch"         cross-axis: start|end|center|stretch.
    String cssClass = ""                extra utility classes on the root.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.grid.row(gutter = "middle", content = @@`
      @@template.lievit.grid.col(span = 12, content = @@`Left`)
      @@template.lievit.grid.col(span = 12, content = @@`Right`)
    `)
--%>
@param gg.jte.Content content
@param String gutter = "middle"
@param String justify = "start"
@param String align = "stretch"
@param String cssClass = ""
@param String attrs = ""

!{var justifyClass = switch (justify) {
    case "end"     -> "justify-end";
    case "center"  -> "justify-center";
    case "between" -> "justify-between";
    case "around"  -> "justify-around";
    case "evenly"  -> "justify-evenly";
    default        -> "justify-start";
  };}
!{var alignClass = switch (align) {
    case "start"  -> "items-start";
    case "end"    -> "items-end";
    case "center" -> "items-center";
    default       -> "items-stretch";
  };}
!{var gutterToken = switch (gutter) {
    case "none"   -> "var(--lv-space-0)";
    case "small"  -> "var(--lv-space-2)";
    case "middle" -> "var(--lv-space-4)";
    case "large"  -> "var(--lv-space-6)";
    default       -> null;
  };}
!{var gridStyle = "display:grid;grid-template-columns:repeat(24,minmax(0,1fr));gap:" + (gutterToken != null ? gutterToken : gutter) + ";";}

<div
  data-slot="grid-row"
  class="${justifyClass} ${alignClass} ${cssClass}"
  style="${gridStyle}"
  $unsafe{attrs}
>${content}</div>
