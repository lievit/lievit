<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui separator partial -- a thin divider line between content groups.

  TIER: STATIC presentational -> JTE partial. A separator is a single styled rule with
  no client state; the former <lv-separator> island held nothing the server cannot render.

  STRUCTURE (scientific decision rule): WAI-ARIA APG separator pattern. shadcn/Radix render
  a <div role="separator"> with aria-orientation; the platform has no native horizontal-rule
  element that also carries orientation, so the role-on-div approach wins (it expresses both
  orientations and stays decoratable). A purely decorative divide passes decorative=true,
  which drops it from the accessibility tree (aria-hidden) per the APG note that a separator
  with no semantic meaning should not be announced.

  A11y (WAI-ARIA separator): role="separator" + aria-orientation when announced; when
  decorative, role and aria-orientation are dropped and aria-hidden="true" hides the rule.
  shadcn/Radix default decorative=true (a divider carries no semantic meaning by default),
  so this defaults to true; pass decorative=false to announce a meaningful divide.

  Params:
    String orientation = "horizontal"   "horizontal" | "vertical".
    boolean decorative = true            true => hidden from assistive tech (no role); shadcn default.
    String cssClass    = ""              extra utility classes on the rule.

  Usage:
    @@template.lievit.separator()
    @@template.lievit.separator(orientation = "vertical")
    @@template.lievit.separator(decorative = false)
--%>
@param String orientation = "horizontal"
@param boolean decorative = true
@param String cssClass = ""

!{var isVertical = "vertical".equals(orientation);}
!{var sizeClass = isVertical ? "inline-block h-full w-px" : "block h-px w-full";}

<div
  data-slot="separator"
  data-orientation="${orientation}"
  role="${decorative ? null : "separator"}"
  aria-orientation="${decorative ? null : orientation}"
  aria-hidden="${decorative ? "true" : null}"
  class="shrink-0 border-0 bg-[var(--lv-color-border)] ${sizeClass} ${cssClass}"
></div>
