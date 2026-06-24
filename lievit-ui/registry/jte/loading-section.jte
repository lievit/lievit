@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui loading-section partial -- unified loading state component. Three modes in one
  partial, selected via the `mode` param:

    spinner  -- an animated SVG ring: use for action feedback (saving, submitting).
    skeleton -- a shimmer layout placeholder: use while fetching a whole content region.
    section  -- a real content slot overlaid by a spinner when active: use for regions that
                show existing content but need to block interaction during an async op.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). Pure display,
  no client state; the server picks the mode and the morph swaps it out once done.

  STRUCTURE (scientific decision rule): Filament v3 ships three sibling components
  (Loading Section, Skeleton, Spinner) with overlapping purposes and a composition hierarchy.
  lievit unifies them under one partial with a mode switch so the call site declares intent
  rather than composing primitives manually. Spinner and skeleton are also available as
  standalone partials (spinner.jte, skeleton.jte) for inline / narrow-context use.

  SELF-CONTAINED (no cross-partial deps): the spinner SVG ring and skeleton bars are inlined
  directly in each mode branch. This keeps loading-section.jte deployable as a single file and
  avoids the circular-reference risk that would arise if the section overlay called the spinner
  partial recursively. The standalone spinner.jte/skeleton.jte partials are equivalent; changes
  to the SVG ring anatomy must be mirrored in both files (intentional duplication, not drift).

  SPINNER SVG anatomy: background track circle (opacity 0.25) + foreground arc.
  Circumference = 2 * pi * 10 = 62.832; dasharray = 31.416 (half circumference);
  dashoffset = 10.472 (1/6 of circumference), giving a ~300-deg visible arc.
  viewBox="0 0 24 24" fixed; width/height attributes drive the rendered size.

  SKELETON shimmer: controlled by lv-skeleton--active class + skeleton.css.

  SECTION overlay: an aria-hidden div positioned absolute (over the content slot via
  relative container) showing an inlined SVG spinner ring. The content slot is the real
  page content; the overlay is removed when the op completes (htmx swap / morph).

  A11y:
    spinner/skeleton modes: role="status" + aria-live="polite" + aria-atomic="true" on root.
    section mode: root is role="region" (not a live region -- the content owns announcements);
    the overlay carries aria-hidden="true" so screen readers skip the decorative spinner;
    aria-busy="true" on the root signals the blocked state to AT.
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages

  Params:
    String mode          = "spinner"  "spinner" | "skeleton" | "section".
    String size          = "md"       "sm" | "md" | "lg" -- ring diameter (spinner/overlay) or
                                      text-row height (skeleton). NOT used in section mode.
    String variant       = "default"  "default" | "primary" -- spinner stroke colour. Skeleton +
                                      section modes ignore this param.
    String label         = "Loading..."  accessible name (sr-only in spinner/skeleton; visible tip
                                      in section mode when showTip=true).
    boolean showTip      = false      section mode: render label as a visible tip text line.
    boolean active       = true       skeleton mode: shimmer animation active.
    int skeletonRows     = 3          skeleton mode, skeletonShape=lines: number of text rows.
    String skeletonShape = "lines"    skeleton mode: "lines"|"card"|"avatar-row"|"image"|"button-bar".
    boolean fullPage     = false      section mode: fixed viewport overlay (blocks entire page).
    String cssClass      = ""         extra utility classes on the root element.
    String attrs         = ""         TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* (value escaped via Escape.htmlAttribute).
    Content content      = null       section mode only: the real content slot.

  Usage:
    @@template.lievit.loading-section()
    @@template.lievit.loading-section(mode = "skeleton", skeletonShape = "avatar-row")
    @@template.lievit.loading-section(mode = "section", label = "Saving", showTip = true) {
      <!-- real content -->
    }
    @@template.lievit.loading-section(mode = "spinner", size = "lg", variant = "primary")
--%>
@param String mode = "spinner"
@param String size = "md"
@param String variant = "default"
@param String label = "Loading…"
@param boolean showTip = false
@param boolean active = true
@param int skeletonRows = 3
@param String skeletonShape = "lines"
@param boolean fullPage = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param Content content = null

!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

<%-- ========================================================================
     SPINNER MODE
     ======================================================================== --%>
@if("spinner".equals(mode))
  !{var svgSize = switch (size) { case "sm" -> "16"; case "lg" -> "40"; default -> "24"; };}
  !{var strokeColor = "primary".equals(variant) ? "var(--lv-color-primary)" : "var(--lv-color-muted-fg)";}
  <span
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="${label}"
    data-slot="loading-section"
    data-mode="spinner"
    data-size="${size}"
    data-variant="${variant}"
    class="lv-spinner inline-flex items-center justify-center ${cssClass}"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
    <svg
      aria-hidden="true"
      focusable="false"
      class="lv-spinner__ring animate-spin motion-reduce:animate-none"
      width="${svgSize}"
      height="${svgSize}"
      viewBox="0 0 24 24"
      fill="none"
      style="color:${strokeColor};"
    >
      <%-- background track circle --%>
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>
      <%-- foreground arc: dasharray=31.416 (half circ), dashoffset=10.472 (1/6), giving ~300-deg arc --%>
      <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="31.416" stroke-dashoffset="10.472" stroke-linecap="round"/>
    </svg>
    <span class="sr-only">${label}</span>
  </span>

<%-- ========================================================================
     SKELETON MODE
     ======================================================================== --%>
@elseif("skeleton".equals(mode))
  !{var activeClass = active ? "lv-skeleton--active" : "";}
  !{var lineHeights = java.util.Map.of("sm", "0.75rem", "md", "1rem", "lg", "1.25rem");}
  !{var lineH = lineHeights.getOrDefault(size, "1rem");}
  <%-- Deterministic width sequence: cycles by row index mod 5 -- no DB data, no RNG. --%>
  !{var widths = java.util.List.of("100%", "75%", "88%", "62%", "94%");}
  <div
    role="status"
    aria-live="polite"
    aria-atomic="true"
    aria-label="${label}"
    data-slot="loading-section"
    data-mode="skeleton"
    data-shape="${skeletonShape}"
    data-size="${size}"
    data-active="${active ? "true" : "false"}"
    class="lv-skeleton ${activeClass} ${cssClass}"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
    <span class="sr-only">${label}</span>

    @if("lines".equals(skeletonShape))
      <div aria-hidden="true" class="lv-skeleton__lines flex flex-col" style="gap: var(--lv-space-2);">
        @for(int i = 0; i < skeletonRows; i++)
          <div
            class="lv-skeleton__bar rounded-[var(--lv-radius-sm)]"
            style="height:${lineH};width:${widths.get(i % widths.size())};"
          ></div>
        @endfor
      </div>
    @elseif("card".equals(skeletonShape))
      <div aria-hidden="true" class="lv-skeleton__bar rounded-[var(--lv-radius-sm)]" style="width:100%;height:12rem;"></div>
    @elseif("avatar-row".equals(skeletonShape))
      !{var avatarSize = "sm".equals(size) ? "2rem" : "lg".equals(size) ? "3rem" : "2.5rem";}
      <div aria-hidden="true" class="lv-skeleton__avatar-row flex items-center" style="gap: var(--lv-space-3);">
        <div class="lv-skeleton__bar rounded-[var(--lv-radius-full)]" style="width:${avatarSize};height:${avatarSize};flex-shrink:0;"></div>
        <div class="flex flex-col" style="gap: var(--lv-space-2); flex:1;">
          <div class="lv-skeleton__bar rounded-[var(--lv-radius-sm)]" style="height:${lineH};width:60%;"></div>
          <div class="lv-skeleton__bar rounded-[var(--lv-radius-sm)]" style="height:${lineH};width:40%;"></div>
        </div>
      </div>
    @elseif("image".equals(skeletonShape))
      <div aria-hidden="true" class="lv-skeleton__bar rounded-[var(--lv-radius-sm)]" style="width:100%;height:6rem;"></div>
    @elseif("button-bar".equals(skeletonShape))
      <div aria-hidden="true" class="lv-skeleton__bar rounded-[var(--lv-radius-full)]" style="width:8rem;height:2.25rem;"></div>
    @endif
  </div>

<%-- ========================================================================
     SECTION MODE -- real content slot + overlay spinner
     ======================================================================== --%>
@else
  !{var overlaySvgSize = switch (size) { case "sm" -> "16"; case "lg" -> "40"; default -> "24"; };}
  !{var overlayStrokeColor = "primary".equals(variant) ? "var(--lv-color-primary)" : "var(--lv-color-muted-fg)";}
  !{var positionStyle = fullPage ? "position:fixed;inset:0;z-index:var(--lv-z-overlay);" : "position:relative;";}
  <div
    role="region"
    aria-busy="true"
    aria-label="${label}"
    data-slot="loading-section"
    data-mode="section"
    data-size="${size}"
    data-full-page="${fullPage ? "true" : "false"}"
    class="lv-loading-section ${cssClass}"
    style="${positionStyle}"
    $unsafe{dataAttrsMarkup}
    $unsafe{attrs}
  >
    @if(content != null)
      ${content}
    @endif
    <%-- Overlay: aria-hidden -- purely visual; AT sees only the aria-busy on the root. --%>
    <div
      aria-hidden="true"
      class="lv-loading-section__overlay absolute inset-0 flex flex-col items-center justify-center"
      style="background:var(--lv-color-overlay,rgba(255,255,255,0.7));z-index:1;"
    >
      <%-- Inlined SVG ring (no cross-partial call; self-contained per inline-trivial-bits rule). --%>
      <svg
        aria-hidden="true"
        focusable="false"
        class="lv-spinner__ring animate-spin motion-reduce:animate-none"
        width="${overlaySvgSize}"
        height="${overlaySvgSize}"
        viewBox="0 0 24 24"
        fill="none"
        style="color:${overlayStrokeColor};"
      >
        <%-- background track circle --%>
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" opacity="0.25"/>
        <%-- foreground arc: dasharray=31.416, dashoffset=10.472, ~300-deg arc --%>
        <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="31.416" stroke-dashoffset="10.472" stroke-linecap="round"/>
      </svg>
      @if(showTip)
        <span
          data-slot="loading-section-tip"
          style="margin-top:var(--lv-space-3);font-size:var(--lv-text-sm);color:var(--lv-color-muted-fg);font-family:var(--lv-font-sans);"
        >${label}</span>
      @endif
    </div>
  </div>
@endif
