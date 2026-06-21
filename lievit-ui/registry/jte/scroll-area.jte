@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui scroll-area partial -- a scrollable viewport with a token-styled custom scrollbar.

  TIER (planning two-tier model): STATIC presentational -> JTE partial. A scroll area is pure
  CSS: a viewport with `overflow` + a styled scrollbar. shadcn/Radix ship a JS scrollbar to
  paper over native-scrollbar inconsistency and to drive the thumb; the modern platform gives
  us styled scrollbars natively via the STANDARDISED `scrollbar-width` + `scrollbar-color`
  properties, which work as plain inline `style=` (the same delivery every other lievit partial
  uses), so the partial styles the native scrollbar from the --lv-* tokens with ZERO JS, ZERO
  inline script, ZERO inline on* handler (strict CSP refuses those) and NO <style> block (kept
  consistent with the rest of the kit, which never ships one). No client state, no lifecycle =>
  no Lit island, no wire component.

  STRUCTURE (scientific decision rule -- compared shadcn/Radix/native): Radix's value is the
  custom-rendered scrollbar (a div thumb it positions in JS). We trade that for the native
  styled scrollbar: criterion (3) robustness (no JS, can't fail, CSP-clean) and (5) bundle size
  (zero KB) both win for a server-first kit; the only loss is pixel-identical cross-browser
  thumb styling, acceptable for a gestionale. The thumb colour reads --lv-color-border, so a
  retheme retints it.

  type modes (shadcn `type`): map to scrollbar VISIBILITY, server-pure via standardised CSS:
    - "auto"   (default): a scrollbar shows only when content overflows (browser default).
    - "always": reserve the gutter so the scrollbar never shifts layout (`scrollbar-gutter:
                stable`) and keep the thumb tinted at rest.
    - "hover" / "scroll": reserve the gutter AND start the thumb TRANSPARENT (`scrollbar-color:
                transparent transparent`) so it is hidden until the adopter's reveal rule paints
                it. Reveal-on-hover needs a `:hover` rule, which a CSP-clean partial cannot inline;
                ship that one rule in your own stylesheet (the same opt-in pattern avatar uses):
                  [data-slot="scroll-area"][data-type="hover"]:hover,
                  [data-slot="scroll-area"][data-type="hover"]:focus-within {
                    scrollbar-color: var(--lv-color-border) transparent;
                  }
                Without it the viewport still scrolls (wheel / keyboard / touch) with a hidden
                scrollbar -- the behaviour, not just the chrome, is intact.

  orientation: "vertical" (default) | "horizontal" | "both" -- which axis may overflow + scroll.

  A11y: the viewport is a focusable scroll container (`tabindex="0"` so keyboard users can scroll
  it with the arrow keys, the platform behaviour for a scrollable region) carrying role="region"
  + an aria-label when `label` is set (a named scrollable landmark); unlabelled, it is a plain
  focusable scroller. The scrollbar itself is the platform's, so it needs no ARIA.

  Params:
    gg.jte.Content content              the scrollable content.
    String orientation = "vertical"     "vertical" | "horizontal" | "both".
    String type        = "auto"         "auto" | "always" | "hover" | "scroll".
    String label       = null           aria-label => a named role="region"; null => unlabelled.
    String maxHeight   = "18rem"         max viewport height (vertical/both) before it scrolls.
    String cssClass    = ""             extra utility classes on the viewport.

  Usage:
    @@template.lievit.scroll-area(maxHeight = "12rem", content = @@`<p>... long content ...</p>`)
    @@template.lievit.scroll-area(orientation = "horizontal", type = "always", content = @@`<div style="width: 60rem">wide</div>`)
    @@template.lievit.scroll-area(label = "Changelog", type = "hover", content = @@`...`)
--%>
@param gg.jte.Content content
@param String orientation = "vertical"
@param String type = "auto"
@param String label = null
@param String maxHeight = "18rem"
@param String cssClass = ""

!{var horizontal = "horizontal".equals(orientation);}
!{var both = "both".equals(orientation);}
!{var overflowX = horizontal || both ? "auto" : "hidden";}
!{var overflowY = horizontal ? "hidden" : "auto";}
!{var reserveGutter = "always".equals(type) || "hover".equals(type) || "scroll".equals(type);}
!{var hideThumb = "hover".equals(type) || "scroll".equals(type);}
!{var thumbColor = hideThumb ? "transparent transparent" : "var(--lv-color-border) transparent";}
!{var hasLabel = label != null && !label.isBlank();}

<div
  data-slot="scroll-area"
  data-orientation="${orientation}"
  data-type="${type}"
  role="${hasLabel ? "region" : null}"
  aria-label="${label}"
  tabindex="0"
  class="lv-scroll-area relative rounded-[var(--lv-radius-sm)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)] ${cssClass}"
  style="overflow-x: ${overflowX}; overflow-y: ${overflowY}; max-height: ${horizontal ? "none" : maxHeight}; scrollbar-width: thin; scrollbar-color: ${thumbColor};${reserveGutter ? " scrollbar-gutter: stable;" : ""}"
>
  <div data-slot="scroll-area-viewport" class="min-w-full">${content}</div>
</div>
