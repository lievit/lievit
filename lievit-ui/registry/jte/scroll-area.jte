@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui scroll-area partial -- a scrollable viewport with optional overlay scrollbar rails.

  TIER (planning two-tier model): ENHANCER. When overlay=false this is a purely static partial
  (a div with overflow + optional ARIA), zero JS. When overlay=true the Stimulus controller
  (`data-controller="lv-scroll-area"`) sizes and positions custom overlay rails that replace the
  native scrollbar, syncing thumb size/position via scroll and ResizeObserver. The CSP constraint
  (no inline script, no on* handler) is met in both modes: behaviour lives in the controller,
  wired via data-controller + data-action descriptors, never an inline event handler.

  STRUCTURE (scientific decision rule): shadcn/Radix ship a JS scrollbar that papers over native
  scrollbar inconsistency. For overlay=false we use the STANDARDISED `overflow-*` properties
  (zero JS, CSP-clean, keyboard-scrollable). For overlay=true we render custom div rails driven
  by the controller (pointer drag, ResizeObserver sync, aria-valuenow updates), matching the
  shadcn API surface (type/hideDelay). Both modes expose the same data-slot anatomy so CSS
  selectors work uniformly.

  VIEWPORT ID: the overlay rails reference the viewport via aria-controls. We derive a
  per-call id from System.identityHashCode(content) -- this gives a stable-enough id within
  one HTTP response (two calls with different Content instances give different ids). The adopter
  can override via a named id in dataAttrs if true uniqueness across the page is required.

  OVERLAY SCROLLBAR VISIBILITY (data-type + data-scrolling + data-pointer-over):
    "hover"  -- rail visible when the pointer is over the scroll area or it is actively scrolling.
    "always" -- rail always visible.
    "scroll" -- rail visible only while scrolling (fades on stop, after hideDelay ms).
  The CSS in scroll-area.css drives visibility via these data attributes; the controller sets them.
  When overlay=false none of these attributes are rendered (native scrollbar is visible).

  A11y: the viewport carries tabindex="0" (keyboard-scrollable) and conditionally role="region"
  + aria-label / aria-labelledby when a label is provided (named scrollable landmark). Each
  overlay rail carries role="scrollbar" + aria-controls + aria-orientation + aria-valuenow (the
  controller keeps aria-valuenow live); without them the custom rail would be decorative and AT
  users would depend solely on the keyboard-scrollable viewport. The platform's own scrollbar is
  suppressed via the lv-scrollbar-hide class (scroll-area.css: scrollbar-width:none +
  ::-webkit-scrollbar{display:none}) only when overlay=true.

  EXTRA ATTRIBUTES (two channels, by trust -- the XSS decision rule):
    attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only (wire directives,
      target/rel). NEVER interpolate a per-row DB-derived value into attrs.
    dataAttrs (SAFE, escaped) -- Map<String,String> of dynamic data-* attributes. Each entry
      renders as data-<key>="<value>" with the VALUE escaped via Escape.htmlAttribute. Per-row
      DB values go here and ONLY here.

  Params:
    gg.jte.Content content                the scrollable content (required).
    String height             = null      CSS max-height value e.g. "400px"; null = no max-height.
    String width              = null      CSS max-width value; null = inherits.
    String orientation        = "vertical"  "vertical" | "horizontal" | "both".
    boolean overlay           = false     true = hide native scrollbar + activate overlay rails.
    int hideDelay             = 1000      ms before overlay rail hides after scroll stop (overlay=true only).
    String type               = "hover"   "hover" | "always" | "scroll" -- overlay rail visibility policy.
    String ariaLabel          = null      aria-label on viewport; triggers role="region" + landmark.
    String ariaLabelledBy     = null      aria-labelledby referencing an external element.
    String cssClass           = ""        extra utility classes on the scroll-area root.
    String viewportCssClass   = ""        extra utility classes on the viewport div.
    String attrs              = ""        TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    java.util.Map<String,String> dataAttrs = {}  SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.scroll-area(height = "400px", content = @@`<p>Long content...</p>`)
    @@template.lievit.scroll-area(orientation = "horizontal", content = @@`<div style="width:60rem">Wide</div>`)
    @@template.lievit.scroll-area(overlay = true, type = "hover", ariaLabel = "Changelog", content = @@`...`)
    @@template.lievit.scroll-area(overlay = true, orientation = "both", hideDelay = 500, content = @@`...`)
--%>
@param gg.jte.Content content
@param String height = null
@param String width = null
@param String orientation = "vertical"
@param boolean overlay = false
@param int hideDelay = 1000
@param String type = "hover"
@param String ariaLabel = null
@param String ariaLabelledBy = null
@param String cssClass = ""
@param String viewportCssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

<%-- Orientation flags --%>
!{var isVertical = "vertical".equals(orientation);}
!{var isHorizontal = "horizontal".equals(orientation);}
!{var isBoth = "both".equals(orientation);}

<%-- Overflow classes for the viewport --%>
!{var overflowClass = isBoth ? "overflow-auto" : (isHorizontal ? "overflow-x-auto overflow-y-hidden" : "overflow-y-auto overflow-x-hidden");}

<%-- Label presence: drives role=region + aria-label/labelledby on the viewport --%>
!{var hasLabel = (ariaLabel != null && !ariaLabel.isBlank()) || (ariaLabelledBy != null && !ariaLabelledBy.isBlank());}

<%-- Viewport unique id for aria-controls on the overlay rails --%>
!{var viewportId = "lv-sa-" + Integer.toHexString(System.identityHashCode(content));}

<%-- Root inline style: CSS custom properties for max-h/max-w; null drops the style attr --%>
!{var rootStyleParts = (height != null ? "--lv-sa-max-h:" + height + ";" : "") + (width != null ? "--lv-sa-max-w:" + width + ";" : "");}
!{var rootStyle = rootStyleParts.isEmpty() ? null : rootStyleParts;}

<%-- Viewport: scrollbar-hide class only when overlay=true --%>
!{var scrollbarHideClass = overlay ? " lv-scrollbar-hide" : "";}

<%-- Viewport max-h/max-w via CSS custom properties set on root; arbitrary values reference them --%>
!{var vpHeightClass = height != null ? " max-h-[var(--lv-sa-max-h)]" : "";}
!{var vpWidthClass = width != null ? " max-w-[var(--lv-sa-max-w)]" : "";}

<%-- Overlay rail: vertical shown when overlay=true AND (vertical OR both) --%>
!{var showVerticalRail = overlay && (isVertical || isBoth);}
<%-- Overlay rail: horizontal shown when overlay=true AND (horizontal OR both) --%>
!{var showHorizontalRail = overlay && (isHorizontal || isBoth);}
<%-- Corner: shown when overlay=true AND both --%>
!{var showCorner = overlay && isBoth;}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<div
  data-slot="scroll-area"
  data-orientation="${orientation}"
  data-type="${overlay ? type : null}"
  data-hide-delay="${overlay ? String.valueOf(hideDelay) : null}"
  data-controller="${overlay ? "lv-scroll-area" : null}"
  class="lv-scroll-area relative${cssClass.isBlank() ? "" : " " + cssClass}"
  style="${rootStyle}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>
  <div
    data-slot="scroll-area-viewport"
    id="${viewportId}"
    tabindex="0"
    role="${hasLabel ? "region" : null}"
    aria-label="${ariaLabel}"
    aria-labelledby="${ariaLabelledBy}"
    data-lv-scroll-area-target="${overlay ? "viewport" : null}"
    data-action="${overlay ? "scroll->lv-scroll-area#scrolled" : null}"
    class="h-full w-full rounded-[inherit] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] ${overflowClass}${vpHeightClass}${vpWidthClass}${scrollbarHideClass}${viewportCssClass.isBlank() ? "" : " " + viewportCssClass}"
  >${content}</div>

  @if(showVerticalRail)
  <div
    data-slot="scroll-area-bar"
    data-orientation="vertical"
    role="scrollbar"
    aria-controls="${viewportId}"
    aria-orientation="vertical"
    aria-valuenow="0"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Vertical scrollbar"
    tabindex="-1"
    data-lv-scroll-area-target="verticalRail"
    class="lv-scrollbar-rail lv-scrollbar-rail--vertical absolute right-0 top-0 flex h-full w-2.5 touch-none select-none flex-col p-px"
  >
    <div
      data-slot="scroll-area-thumb"
      data-lv-scroll-area-target="verticalThumb"
      data-action="pointerdown->lv-scroll-area#dragStartVertical pointermove->lv-scroll-area#dragMoveVertical pointerup->lv-scroll-area#dragEndVertical pointercancel->lv-scroll-area#dragEndVertical"
      class="lv-scrollbar-thumb relative flex-1 rounded-full bg-[var(--lv-color-border)]"
    ></div>
  </div>
  @endif

  @if(showHorizontalRail)
  <div
    data-slot="scroll-area-bar"
    data-orientation="horizontal"
    role="scrollbar"
    aria-controls="${viewportId}"
    aria-orientation="horizontal"
    aria-valuenow="0"
    aria-valuemin="0"
    aria-valuemax="100"
    aria-label="Horizontal scrollbar"
    tabindex="-1"
    data-lv-scroll-area-target="horizontalRail"
    class="lv-scrollbar-rail lv-scrollbar-rail--horizontal absolute bottom-0 left-0 flex h-2.5 w-full touch-none select-none flex-row p-px"
  >
    <div
      data-slot="scroll-area-thumb"
      data-lv-scroll-area-target="horizontalThumb"
      data-action="pointerdown->lv-scroll-area#dragStartHorizontal pointermove->lv-scroll-area#dragMoveHorizontal pointerup->lv-scroll-area#dragEndHorizontal pointercancel->lv-scroll-area#dragEndHorizontal"
      class="lv-scrollbar-thumb relative flex-1 rounded-full bg-[var(--lv-color-border)]"
    ></div>
  </div>
  @endif

  @if(showCorner)
  <div
    data-slot="scroll-area-corner"
    aria-hidden="true"
    class="lv-scrollbar-corner absolute bottom-0 right-0 h-2.5 w-2.5"
  ></div>
  @endif
</div>
