@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui spinner partial -- an animated SVG ring that signals an indeterminate
  background operation in progress.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). Pure display,
  no client state: the server renders it or not; the morph removes it when done.

  STRUCTURE (scientific decision rule): an SVG ring (background circle + foreground arc,
  both stroke=currentColor). The arc uses stroke-dasharray to produce a 300-degree chasing
  arc; the SVG rotates via Tailwind animate-spin (a standard rotate keyframe). Ant Design Spin
  and react-aria both use a rotating SVG ring for their spinner; lievit generates an original
  variant over --lv-* tokens. prefers-reduced-motion: animate-spin suppressed via
  motion-reduce:animate-none (Tailwind built-in).

  A11y (WAI-ARIA role=status): role="status" + aria-live="polite" + aria-atomic="true" +
  aria-label on the root (explicit mirrors of the implicit defaults for cross-AT consistency,
  per MDN recommendation). A sr-only span carries the label text inside the live region so
  aria-atomic="true" announces the full text. The decorative SVG is aria-hidden="true".
  No focus management -- a loading indicator must NOT receive focus on update (WCAG 4.1.3).
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role
  https://www.w3.org/WAI/WCAG22/Understanding/status-messages

  SVG ring anatomy: background track circle (opacity 0.25) + foreground arc.
  Circumference = 2 * pi * 10 = 62.832; dasharray = 31.416 (half circumference = 180-deg arc);
  dashoffset = 10.472 (1/6 of circumference) shifts the arc start, giving a 300-deg visible arc.
  The SVG is sized via width/height attributes (sm=16px, md=24px, lg=40px) over a fixed
  viewBox="0 0 24 24" so the proportions are identical at every scale.

  VARIANT colours: default uses --lv-color-muted-fg (neutral busy); primary uses
  --lv-color-primary (branded busy, e.g. inside a primary button). Both derive from the
  --lv-* token set so they retheme automatically.

  Inline context: the root is a <span> (not <div>) so the spinner can be composed inside
  inline or flex contexts (e.g. inside a switch thumb span or a toast flex row) without
  generating an invalid block-inside-inline nesting. role=status on a <span> is valid per
  ARIA 1.2 (roles are orthogonal to HTML element semantics).

  Params:
    String size     = "md"         "sm" (16px) | "md" (24px, default) | "lg" (40px) -- ring diameter.
    String variant  = "default"    "default" (--lv-color-muted-fg) | "primary" (--lv-color-primary).
    String label    = "Loading..."   accessible name; visually hidden (sr-only). Pass "" when the
                                    spinner is inside an aria-hidden parent (decorative context).
    String cssClass = ""           extra utility classes on the root.
    String attrs    = ""           TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.spinner()
    @@template.lievit.spinner(size = "lg", variant = "primary", label = "Caricamento in corso")
    @@template.lievit.spinner(size = "sm", label = "")
--%>
@param String size = "md"
@param String variant = "default"
@param String label = "Loading…"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var svgSize = switch (size) {
    case "sm" -> "16";
    case "lg" -> "40";
    default   -> "24";
  };}
!{var strokeColor = "primary".equals(variant) ? "var(--lv-color-primary)" : "var(--lv-color-muted-fg)";}

!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

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
    <%-- foreground arc: dasharray=31.416 (half circumference), dashoffset=10.472 (1/6), giving ~300-deg arc --%>
    <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2.5" stroke-dasharray="31.416" stroke-dashoffset="10.472" stroke-linecap="round"/>
  </svg>
  <span class="sr-only">${label}</span>
</span>
