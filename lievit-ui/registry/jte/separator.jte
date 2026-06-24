<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui separator partial -- a visual and semantic dividing line between content sections.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). A separator holds
  zero client state; the server renders the dividing line directly as an <hr> (horizontal or
  vertical) or as a flex-row label variant. Zero JS, zero enhancer, trivially server-first.

  STRUCTURE (scientific decision rule):
    a11y source: WAI-ARIA 1.2 separator role (non-focusable, document-structure variant):
      https://www.w3.org/TR/wai-aria-1.2/#separator
    HTML-ARIA implicit role mapping for <hr>:
      https://www.w3.org/TR/html-aria/#el-hr
    The <hr> element carries role="separator" IMPLICITLY in all conformant browsers and AT
    -- no manual role attribute needed. We prefer <hr> over a div-with-role because native
    semantics are free and robust; a div-with-role requires an explicit role attribute on
    every branch including the decorative variant.
    The label variant (Ant Design Divider "children" use case) uses a <div role="separator">
    because the <hr> element is void (cannot contain children); the outer container takes the
    explicit role and aria-label carries the accessible name.
    Inventory reference: Ant Design Divider (orientation, label in the middle, dashed/solid).
    Styling: original generation over --lv-* (OKLCH) tokens; look inspired by Tailwind UI.

  A11y (WAI-ARIA separator, non-focusable document-structure variant):
    - <hr> carries role="separator" implicitly (zero manual role needed).
    - aria-orientation="horizontal" | "vertical" emitted on the element.
      The horizontal value is the spec default but we emit it explicitly for AT clarity.
    - decorative=true => role="presentation" (explicit, overrides the implicit <hr> role),
      no aria-orientation (presentation elements carry no ARIA state properties).
      Default is decorative=false (semantic) because silently erasing the role is the
      worse error; use decorative=true only when the surrounding structure already
      communicates the grouping and the line is purely cosmetic.
    - label variant: <div role="separator" aria-orientation="horizontal" aria-label="${label}">
      The two flanking line spans carry aria-hidden="true" (pure decoration; the container
      aria-label is the accessible name). Label variant is horizontal-only.
    - Not focusable: tabindex is never set. This component has an empty keyboard map.
    - No aria-valuenow / aria-valuemin / aria-valuemax: those belong on the focusable
      resizable pane splitter (resizable-panes, S2), not on a static document separator.

  Params:
    String orientation = "horizontal"  "horizontal" | "vertical" -- the axis the line runs
                                       along; sets aria-orientation + layout.
    String variant = "default"         "default" | "dashed" | "dotted" -- the line-stroke
                                       style. default=solid. Colour intent is always from
                                       --lv-color-border (no success/warning/destructive).
    boolean decorative = false         true => role="presentation" (erased from a11y tree,
                                       no aria-orientation); use when the page structure
                                       already communicates grouping.
    String label = null                optional centred label text (e.g. "OR", "Section A");
                                       replaces the <hr> with the flex-row label variant.
                                       Label is horizontal-only (vertical ignores it).
    String labelPosition = "center"    "left" | "center" | "right" -- shifts the flex ratios
                                       so the label appears at the chosen edge. Ignored when
                                       label is null or orientation=vertical.
    String cssClass = ""               extra utility classes on the root element.
    String attrs = ""                  TRUSTED raw ($unsafe) -- STATIC author-typed strings
                                       only (e.g. id="section-break-1"). NEVER feed per-row
                                       DB-derived values here (that channel is wireArgs/dataAttrs
                                       on WIRE components; this PARTIAL has no dataAttrs channel).

  Usage:
    @@template.lievit.separator()
    @@template.lievit.separator(orientation = "vertical")
    @@template.lievit.separator(variant = "dashed")
    @@template.lievit.separator(label = "OR")
    @@template.lievit.separator(label = "Section A", labelPosition = "left")
    @@template.lievit.separator(decorative = true)
--%>
@param String orientation = "horizontal"
@param String variant = "default"
@param boolean decorative = false
@param String label = null
@param String labelPosition = "center"
@param String cssClass = ""
@param String attrs = ""

!{var isVertical = "vertical".equals(orientation);}
!{var hasLabel = label != null && !isVertical;}
!{var variantClass = switch (variant) {
    case "dashed" -> "border-dashed";
    case "dotted" -> "border-dotted";
    default       -> "border-solid";
  };}

@if(hasLabel)
<%-- Label variant: <div role="separator"> replaces the void <hr>. The two flanking spans are
     aria-hidden decoration; the accessible name comes from aria-label on the container.
     labelPosition shifts flex ratios: left=>left span flex-none (zero width), center=>both
     flex-1, right=>right span flex-none (zero width). --%>
!{var leftClass = "left".equals(labelPosition) ? "hidden" : "flex-1 border-t " + variantClass;}
!{var rightClass = "right".equals(labelPosition) ? "hidden" : "flex-1 border-t " + variantClass;}
<div
  data-slot="separator"
  data-orientation="horizontal"
  data-variant="${variant}"
  data-decorative="${decorative}"
  role="${decorative ? "presentation" : "separator"}"
  aria-orientation="${decorative ? null : "horizontal"}"
  aria-label="${decorative ? null : label}"
  class="flex items-center gap-[var(--lv-space-3)] my-[var(--lv-space-4)] ${cssClass}"
  style="color:var(--lv-color-border);"
  $unsafe{attrs}
>
  <span class="${leftClass}" aria-hidden="true" style="${leftClass.contains("border-t") ? "border-color:var(--lv-color-border);" : ""}"></span>
  <span class="shrink-0 text-[length:var(--lv-text-sm)] font-[var(--lv-font-normal)] px-[var(--lv-space-3)]" style="color:var(--lv-color-muted);font-family:var(--lv-font-sans);">${label}</span>
  <span class="${rightClass}" aria-hidden="true" style="${rightClass.contains("border-t") ? "border-color:var(--lv-color-border);" : ""}"></span>
</div>
@elseif(isVertical)
<%-- Vertical: inline-block, self-stretch in flex row, border-left as the stroke.
     The adopter controls the container height; the component does not impose a fixed height. --%>
<hr
  data-slot="separator"
  data-orientation="vertical"
  data-variant="${variant}"
  data-decorative="${decorative}"
  role="${decorative ? "presentation" : null}"
  aria-orientation="${decorative ? null : "vertical"}"
  class="inline-block self-stretch border-0 border-l ${variantClass} mx-[var(--lv-space-2)] ${cssClass}"
  style="border-color:var(--lv-color-border);border-width:var(--lv-border-width,1px);"
  $unsafe{attrs}
/>
@else
<%-- Horizontal (default): block full-width line, border-top as the stroke. --%>
<hr
  data-slot="separator"
  data-orientation="horizontal"
  data-variant="${variant}"
  data-decorative="${decorative}"
  role="${decorative ? "presentation" : null}"
  aria-orientation="${decorative ? null : "horizontal"}"
  class="block w-full border-0 border-t ${variantClass} my-[var(--lv-space-4)] ${cssClass}"
  style="border-color:var(--lv-color-border);border-width:var(--lv-border-width,1px);"
  $unsafe{attrs}
/>
@endif
