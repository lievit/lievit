@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui skeleton partial -- a shimmer placeholder that reserves layout space while real
  content loads. The shimmer travels left-to-right via a CSS gradient animation that references
  --lv-skeleton-bg and --lv-skeleton-shimmer tokens; prefers-reduced-motion collapses the
  animation to a static fill (handled in skeleton.css via the lv-skeleton--active class).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). Pure display,
  no client state; the server renders it and the morph replaces it once the real content arrives.

  STRUCTURE (scientific decision rule): shadcn's Skeleton uses a single muted div with
  animate-pulse. lievit ships a shimmer variant (sliding gradient, industry-standard for content
  placeholders -- used by Facebook, YouTube, LinkedIn) instead of pulse, because shimmer signals
  "fetching from a distant source" more precisely than pulse and avoids the flicker effect on
  multi-row stacks at 60fps. Tokens (--lv-skeleton-bg, --lv-skeleton-shimmer) mean a retheme is
  a token override, not a template edit.

  SHAPE vocabulary: five presets cover the universal loading patterns.
    lines       -- N text rows with deterministic varying widths (no DB data, no RNG).
                   Widths cycle through ["100%","75%","88%","62%","94%"] by row index mod 5.
    card        -- a tall rectangular block (image/card thumb placeholder).
    avatar-row  -- a circle + two text lines side-by-side (user row placeholder).
    image       -- a wide shallow rectangle (hero image placeholder).
    button-bar  -- a single short rounded-full strip (button placeholder).

  SIZE scale: sm/md/lg scales the text-row height (lines shape only) and circle diameter
  (avatar-row shape only). card/image/button-bar have intrinsic proportions.

  A11y (WAI-ARIA): role="status" + aria-live="polite" + aria-atomic="true" on the root so
  assistive tech announces the busy state. aria-label carries the accessible label. A sr-only
  span carries the same text inside the live region for aria-atomic. The decorative bars are
  aria-hidden="true" (they are purely visual; the text label conveys all meaning).
  https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Roles/status_role

  ANIMATION CSS: lives in skeleton.css (component-scoped). The .lv-skeleton--active class
  enables the shimmer gradient + keyframe on .lv-skeleton__bar; without it the bars are a
  static --lv-skeleton-bg fill. The reduced-motion override (@media prefers-reduced-motion)
  is in skeleton.css alongside the animation rule so the suppression is co-located with its cause.

  Params:
    String size          = "md"     "sm" | "md" | "lg" -- text-row height + avatar-row circle size.
    boolean active       = true     true: shimmer animation; false: static muted fill.
    int skeletonRows     = 3        lines shape: number of text placeholder rows.
    String skeletonShape = "lines"  "lines" | "card" | "avatar-row" | "image" | "button-bar".
    String label         = "Loading..."  accessible name; sr-only.
    String cssClass      = ""       extra utility classes on the root.
    String attrs         = ""       TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}  SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.skeleton()
    @@template.lievit.skeleton(skeletonShape = "avatar-row", active = false)
    @@template.lievit.skeleton(skeletonRows = 5, size = "sm")
--%>
@param String size = "md"
@param boolean active = true
@param int skeletonRows = 3
@param String skeletonShape = "lines"
@param String label = "Loading…"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var activeClass = active ? "lv-skeleton--active" : "";}
!{var lineHeights = java.util.Map.of("sm", "0.75rem", "md", "1rem", "lg", "1.25rem");}
!{var lineH = lineHeights.getOrDefault(size, "1rem");}
<%-- Deterministic width sequence: no DB data, no RNG; cycles by row index mod 5. --%>
!{var widths = java.util.List.of("100%", "75%", "88%", "62%", "94%");}

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
