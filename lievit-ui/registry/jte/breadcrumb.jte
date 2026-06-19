@import java.util.List
@import java.util.Map
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui breadcrumb partial -- an accessible breadcrumb navigation trail.

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). The former
  <lv-breadcrumb> island held no client state; the trail is a fact the SERVER already knows
  (the route being rendered), so the server emits the whole <nav>. The Lit island is gone.

  STRUCTURE (scientific decision rule): WAI-ARIA breadcrumb pattern (the model the dropped
  island cited). A <nav aria-label> landmark wraps an ordered <ol> -- the ordinal list
  communicates the root-to-current sequence to assistive tech. Each non-current item is a real
  <a href> (the browser navigates, middle-click + open-in-new-tab work, no JS); the LAST item
  is the current page, rendered as a non-link <span aria-current="page"> (you cannot navigate
  to where you already are). The separator glyph between items is aria-hidden so a screen
  reader does not announce it. This mirrors the navigation-menu + sidebar partials: real
  anchors, server-known active state, zero client.

  DATA SHAPE: items arrive as a typed List<Map<String,String>>, root-to-current, each map
  keyed `label` (required, the visible text) and `href` (optional, the navigation target).
  The last item is treated as current regardless of whether it carries an href. This is the
  same List<Map<String,String>> idiom the dashboard block uses, so it compiles against the
  bare jte runtime with no custom record type to ship.

  CSS COMPAT: keeps the `lv-breadcrumb*` class names the island used so any stylesheet that
  targeted them still applies; the partial is self-styling via token-driven utilities.

  Params:
    List<Map<String,String>> items   the trail, root-to-current; each map: label (+ optional href).
    String separator = "/"           the glyph between items (aria-hidden).
    String label     = "Breadcrumb"  aria-label for the <nav> landmark.
    String cssClass  = ""            extra utility classes on the <nav>.

  Usage:
    @@template.breadcrumb(items = java.util.List.of(
      java.util.Map.of("label", "Home", "href", "/"),
      java.util.Map.of("label", "Properties", "href", "/properties"),
      java.util.Map.of("label", "Via Roma 12")))
--%>
@param List<Map<String, String>> items = java.util.List.of()
@param String separator = "/"
@param String label = "Breadcrumb"
@param String cssClass = ""

<nav
  data-slot="breadcrumb"
  aria-label="${label}"
  class="lv-breadcrumb block text-[length:var(--lv-text-sm)] ${cssClass}"
  style="font-family:var(--lv-font-sans);"
>
  <ol data-slot="breadcrumb-list" class="lv-breadcrumb__list m-0 flex list-none flex-wrap items-center p-0">
    @for(var i = 0; i < items.size(); i++)
      !{var item = items.get(i);}
      !{var isCurrent = i == items.size() - 1;}
      !{var isFirst = i == 0;}
      !{var href = item.get("href");}
      <li data-slot="breadcrumb-item" class="lv-breadcrumb__item inline-flex items-center">
        @if(!isFirst)
          <span class="lv-breadcrumb__separator select-none px-[var(--lv-space-2)] text-[var(--lv-color-muted)]" aria-hidden="true">${separator}</span>
        @endif
        @if(isCurrent)
          <span data-slot="breadcrumb-current" class="lv-breadcrumb__current font-[var(--lv-font-medium)] text-[var(--lv-color-muted)]" aria-current="page">${item.getOrDefault("label", "")}</span>
        @else
          <a data-slot="breadcrumb-link" class="lv-breadcrumb__link rounded-[var(--lv-radius-sm)] text-[var(--lv-color-primary)] no-underline hover:underline focus-visible:shadow-[var(--lv-ring)] focus-visible:outline-none" href="${href == null ? "#" : href}">${item.getOrDefault("label", "")}</a>
        @endif
      </li>
    @endfor
  </ol>
</nav>
