@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui tooltip partial -- a floating contextual label, CSS-only (no JS).

  TIER: STATIC presentational -> JTE partial. The former <lv-tooltip> island used Floating UI
  + Lit state to toggle a panel. Per ADR-0012 the server-pure path is CSS: the label text is
  already in the DOM and revealed by the wrapper's :hover / :focus-within. No positioning JS;
  the label sits relative to the trigger in flow on the chosen `side`. Escape-to-dismiss (an
  island nicety needing a listener) is dropped; leaving / blurring the trigger hides it, which
  satisfies the APG dismissable requirement for a CSS tooltip.

  STRUCTURE (scientific decision rule): WAI-ARIA APG tooltip pattern rendered with Tailwind
  group-hover / group-focus-within. The trigger references the label via aria-describedby (the
  APG contract) so assistive tech announces the description on focus; the visual reveal is the
  CSS group toggle. A real tooltip role + aria-describedby is what makes this a tooltip rather
  than a decorative title attribute, so both are kept.

  POSITIONING (server-first equivalent of Radix side/align/sideOffset): shadcn places the content
  on a `side` (top/right/bottom/left) with an `align` (start/center/end) and a `sideOffset` gap.
  We map that to a pure-CSS absolute position computed at render time: `side` chooses which edge
  the panel anchors to (and the cross-axis centring for align=center), `align` shifts it to the
  start/end edge, and `sideOffset` is the token margin between trigger and panel. `data-side` /
  `data-align` mirror Radix's data attributes so a stylesheet can hook them. The little
  `data-slot="tooltip-arrow"` square (a rotated box, shadcn's arrow) points back at the trigger
  from the panel's anchored edge; it is aria-hidden (decorative). No JS, no Floating UI.

  A11y (WAI-ARIA tooltip): panel has role="tooltip" + a stable id; the trigger carries
  aria-describedby pointing at that id, so the label is announced on hover AND on keyboard focus.

  Params:
    gg.jte.Content trigger             the element the tooltip describes.
    String         content             the tooltip label text.
    String         tipId   = "lv-tooltip"  id linking aria-describedby to the label.
    String         side    = "top"     one of: top | right | bottom | left (which edge to float on).
    String         align   = "center"  one of: start | center | end (cross-axis alignment).
    String         sideOffset = null  the gap between trigger and panel (a token; defaults to the
                                    level-1 spacing token when null).
    String         cssClass = ""        extra utility classes on the wrapper.

  Usage:
    @@template.lievit.tooltip(content = "Save document", tipId = "save-tip", trigger = @@`
      <button aria-describedby="save-tip">Save</button>
    `)
    @@template.lievit.tooltip(content = "Filters", side = "right", align = "start", trigger = @@`
      <button aria-describedby="filters-tip">Filters</button>
    `, tipId = "filters-tip")
--%>
@param gg.jte.Content trigger
@param String content
@param String tipId = "lv-tooltip"
@param String side = "top"
@param String align = "center"
@param String sideOffset = null
@param String cssClass = ""

!{var vertical = "left".equals(side) || "right".equals(side);}
!{var customOffset = sideOffset != null && !sideOffset.isBlank();}
<%--
  The gap between trigger and panel. By DEFAULT it is the level-1 spacing token, applied as a
  per-side bracketed Tailwind margin class (offsetClass) so the dimension reads a spacing token.
  A caller-supplied sideOffset overrides it inline (offsetStyle). Either way it is token-driven.
--%>
!{var offsetClass = customOffset ? "" : switch (side) {
    case "right"  -> "ml-[var(--lv-space-1)]";
    case "bottom" -> "mt-[var(--lv-space-1)]";
    case "left"   -> "mr-[var(--lv-space-1)]";
    default       -> "mb-[var(--lv-space-1)]"; // top
  };}
!{var offsetStyle = !customOffset ? "" : switch (side) {
    case "right"  -> "margin-left:" + sideOffset + ";";
    case "bottom" -> "margin-top:" + sideOffset + ";";
    case "left"   -> "margin-right:" + sideOffset + ";";
    default       -> "margin-bottom:" + sideOffset + ";"; // top
  };}
<%-- Anchor the panel to the chosen side; the cross-axis position depends on align. --%>
!{var sidePos = switch (side) {
    case "right"  -> "left:100%;";
    case "bottom" -> "top:100%;";
    case "left"   -> "right:100%;";
    default       -> "bottom:100%;"; // top
  };}
<%-- align maps to the cross axis: top/bottom -> horizontal; left/right -> vertical. --%>
!{var alignPos = vertical
    ? switch (align) { case "start" -> "top:0;"; case "end" -> "bottom:0;"; default -> "top:50%; transform:translateY(-50%);"; }
    : switch (align) { case "start" -> "left:0;"; case "end" -> "right:0;"; default -> "left:50%; transform:translateX(-50%);"; };}
<%-- The arrow is a small rotated square pinned to the panel edge that faces the trigger. --%>
!{var arrowPos = switch (side) {
    case "right"  -> "left:0; top:50%; transform:translate(-50%,-50%) rotate(45deg);";
    case "bottom" -> "top:0; left:50%; transform:translate(-50%,-50%) rotate(45deg);";
    case "left"   -> "right:0; top:50%; transform:translate(50%,-50%) rotate(45deg);";
    default       -> "bottom:0; left:50%; transform:translate(-50%,50%) rotate(45deg);"; // top
  };}

<span data-slot="tooltip" class="group relative inline-block ${cssClass}">
  <span data-slot="tooltip-trigger" aria-describedby="${tipId}" class="inline-block">${trigger}</span>
  <span
    data-slot="tooltip-content"
    data-side="${side}"
    data-align="${align}"
    id="${tipId}"
    role="tooltip"
    class="invisible absolute z-[var(--lv-z-popover)] ${offsetClass} rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-fg)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] leading-[var(--lv-leading)] whitespace-nowrap text-[var(--lv-color-bg)] opacity-0 shadow-[var(--lv-shadow-md)] transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
    style="font-family:var(--lv-font-sans); ${sidePos} ${alignPos} ${offsetStyle}"
  >${content}<span data-slot="tooltip-arrow" aria-hidden="true" class="absolute z-[var(--lv-z-popover)] block size-[0.5rem] rounded-[var(--lv-radius-sm)] bg-[var(--lv-color-fg)]" style="${arrowPos}"></span></span>
</span>
