@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui watermark partial -- a repeating text watermark over content (Ant Watermark parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state. Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Watermark overlays a repeating mark over its children (anti-screenshot / ownership hint).
    Ant does it by drawing the text to a <canvas> in JS and tiling it as a background image -- that
    needs script, which the strict CSP forbids. The CSP-clean equivalent renders the mark as REAL
    tiled DOM: a wrapper positions the content, and an aria-hidden overlay tiles the text as a
    flex-wrap of rotated <span>s (`count` repeats). No canvas, no data-URI, no script: pure tiled
    text the server emits, pointer-events:none so it never intercepts clicks, user-select:none so
    it cannot be copied. The mark text is author-typed (trusted, HTML-escaped via ${}).
    Inventory reference: Ant Design Watermark. Original generation over --lv-* tokens; no Ant code copied.

  A11y: the overlay is aria-hidden="true" (decorative); the content underneath is untouched and
    fully reachable. pointer-events:none keeps the overlay out of the interaction path.

  Params:
    gg.jte.Content content              the content the watermark sits over.
    String text     = "lievit"          the mark text (repeated). HTML-escaped.
    int count       = 60                how many tiled repeats to render (covers the area).
    double rotate   = -22               rotation of each mark in degrees.
    double opacity  = 0.10              mark opacity (0..1); keep low so content stays readable.
    String color    = "var(--lv-color-muted-fg)"  mark colour (token or raw).
    String gap      = "var(--lv-space-12)"         horizontal gap between marks (token or raw).
    String cssClass = ""                extra utility classes on the wrapper.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.watermark(text = "RISERVATO", content = @@`<div>...page...</div>`)
    @@template.lievit.watermark(text = "DRAFT", opacity = 0.06, content = @@`...`)
--%>
@param gg.jte.Content content
@param String text = "lievit"
@param int count = 60
@param double rotate = -22
@param double opacity = 0.10
@param String color = "var(--lv-color-muted-fg)"
@param String gap = "var(--lv-space-12)"
@param String cssClass = ""
@param String attrs = ""

!{var clampedCount = Math.max(0, Math.min(400, count));}
!{var markStyle = "transform:rotate(" + rotate + "deg);color:" + color + ";opacity:" + opacity + ";font-size:var(--lv-text-sm);font-family:var(--lv-font-sans);white-space:nowrap;";}

<div
  data-slot="watermark"
  class="relative ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{attrs}
>
  <div data-slot="watermark-content" class="relative z-0">${content}</div>
  <%-- The tiled overlay: aria-hidden decoration, never in the pointer path, never selectable. --%>
  <div
    data-slot="watermark-overlay"
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 z-10 flex flex-wrap content-start items-start justify-around overflow-hidden select-none"
    style="row-gap:var(--lv-space-10);column-gap:${gap};"
  >
    @for(int i = 0; i < clampedCount; i++)
      <span data-slot="watermark-mark" style="${markStyle}">${text}</span>
    @endfor
  </div>
</div>
