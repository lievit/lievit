@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui flex partial -- a flexbox layout primitive (Ant Design Flex parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). A layout box holds
  zero client state; the server renders a <div> with the flexbox utility classes derived from the
  typed params. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant Design ships a Flex component (vertical, justify, align, gap, wrap) so authors do not
    hand-write flex utilities for every cluster. lievit otherwise relies on raw Tailwind utilities;
    this primitive packages the common cluster behind a typed API while STILL compiling to the same
    Tailwind utilities (no new runtime). The token-scale gap maps the Ant "small|middle|large"
    sizes onto the --lv-space-* scale; a numeric/custom gap is accepted as a raw length too.
    Inventory reference: Ant Design Flex. Original generation over --lv-* tokens; no Ant code copied.

  A11y (no WAI-ARIA pattern): a layout box carries no role and is not interactive (no focus
    management). The author adds semantic meaning at the call site (role/aria on attrs) when the
    cluster is more than presentation.

  Params:
    gg.jte.Content content              the children laid out in the flex container.
    boolean vertical    = false         flex-direction column when true (Ant `vertical`).
    String justify      = "start"       main-axis distribution: start|end|center|between|around|evenly.
    String align        = "stretch"     cross-axis alignment: start|end|center|baseline|stretch.
    String gap          = "middle"      none|small|middle|large (token scale) OR a raw CSS length
                                        ("12px", "var(--x)") used verbatim.
    boolean wrap        = false         allow flex items to wrap onto multiple lines.
    boolean inline      = false         inline-flex instead of flex.
    String cssClass     = ""            extra utility classes on the root.
    String attrs        = ""            TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.flex(gap = "small", content = @@`<button>A</button><button>B</button>`)
    @@template.lievit.flex(vertical = true, gap = "large", align = "center", content = @@`...`)
    @@template.lievit.flex(justify = "between", align = "center", content = @@`...`)
--%>
@param gg.jte.Content content
@param boolean vertical = false
@param String justify = "start"
@param String align = "stretch"
@param String gap = "middle"
@param boolean wrap = false
@param boolean inline = false
@param String cssClass = ""
@param String attrs = ""

!{var display = inline ? "inline-flex" : "flex";}
!{var dir = vertical ? "flex-col" : "flex-row";}
!{var justifyClass = switch (justify) {
    case "end"     -> "justify-end";
    case "center"  -> "justify-center";
    case "between" -> "justify-between";
    case "around"  -> "justify-around";
    case "evenly"  -> "justify-evenly";
    default        -> "justify-start";
  };}
!{var alignClass = switch (align) {
    case "start"    -> "items-start";
    case "end"      -> "items-end";
    case "center"   -> "items-center";
    case "baseline" -> "items-baseline";
    default         -> "items-stretch";
  };}
!{var wrapClass = wrap ? "flex-wrap" : "flex-nowrap";}
<%-- gap: a known size keyword maps onto the spacing token scale; anything else is treated as a
     raw CSS length and inlined as a style (so "12px", "1rem", "var(--x)" all work verbatim). --%>
!{var gapToken = switch (gap) {
    case "none"   -> "var(--lv-space-0)";
    case "small"  -> "var(--lv-space-2)";
    case "middle" -> "var(--lv-space-4)";
    case "large"  -> "var(--lv-space-6)";
    default       -> null;
  };}
!{var gapStyle = "gap:" + (gapToken != null ? gapToken : gap) + ";";}

<div
  data-slot="flex"
  data-vertical="${vertical ? "true" : null}"
  class="${display} ${dir} ${justifyClass} ${alignClass} ${wrapClass} ${cssClass}"
  style="${gapStyle}"
  $unsafe{attrs}
>${content}</div>
