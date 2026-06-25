@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui grid.col partial -- one cell in a 24-column grid.row (Ant Design Col parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state; the server renders a
  grid item spanning N of the 24 columns. Zero JS, zero enhancer, CSP-clean.

  STRUCTURE (scientific decision rule):
    The column span + optional left offset are expressed via the CSS grid-column shorthand on an
    INLINE style (static, no Tailwind safelist of dynamic col-span-* classes). span = how many of
    the 24 tracks the cell occupies; offset = how many empty tracks precede it (Ant `offset`),
    rendered as an explicit grid-column-start so subsequent auto-placed columns flow after it.
    Inventory reference: Ant Design Col (span, offset). Original generation over --lv-* tokens.

  A11y (no WAI-ARIA pattern): a grid cell carries no role and is not interactive.

  Params:
    gg.jte.Content content              the cell content.
    int span        = 24                columns to occupy (1..24); 24 = full width.
    int offset      = 0                 empty columns to the left of the cell (0..23).
    String cssClass = ""                extra utility classes on the cell.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.grid.col(span = 8, content = @@`...`)
    @@template.lievit.grid.col(span = 8, offset = 4, content = @@`pushed right`)
--%>
@param gg.jte.Content content
@param int span = 24
@param int offset = 0
@param String cssClass = ""
@param String attrs = ""

<%-- With an offset the cell pins an explicit start track (offset+1) and spans `span` tracks;
     without one it uses the span shorthand and is auto-placed. Clamp span to 1..24. --%>
!{var clampedSpan = Math.max(1, Math.min(24, span));}
!{var colStyle = offset > 0
    ? "grid-column:" + (offset + 1) + " / span " + clampedSpan + ";"
    : "grid-column:span " + clampedSpan + " / span " + clampedSpan + ";";}

<div
  data-slot="grid-col"
  data-span="${clampedSpan}"
  class="min-w-0 ${cssClass}"
  style="${colStyle}"
  $unsafe{attrs}
>${content}</div>
