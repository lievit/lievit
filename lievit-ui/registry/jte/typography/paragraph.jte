@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui typography.paragraph partial -- a block of body text (Ant Typography.Paragraph parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state. Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    A real <p> element with the body type ramp + a colour `type` intent. Optional `clamp` line
    count truncates with an ellipsis via the line-clamp utility (Ant's `ellipsis={{ rows }}`),
    expressed as a static Tailwind line-clamp-N for the common 1..6 rows.
    Inventory reference: Ant Design Typography.Paragraph. Original generation over --lv-* tokens.

  A11y: a native <p> carries paragraph semantics. The clamp is purely visual; the full text stays
    in the DOM for AT (no content removed). Colour intent is decorative.

  Params:
    gg.jte.Content content              the paragraph body.
    String type     = "default"         default|secondary|success|warning|danger (colour intent).
    int clamp       = 0                 0 = no clamp; 1..6 = truncate to N lines with an ellipsis.
    String cssClass = ""                extra utility classes.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.typography.paragraph(content = @@`Body copy goes here.`)
    @@template.lievit.typography.paragraph(type = "secondary", clamp = 2, content = @@`Long text...`)
--%>
@param gg.jte.Content content
@param String type = "default"
@param int clamp = 0
@param String cssClass = ""
@param String attrs = ""

!{var color = switch (type) {
    case "secondary" -> "var(--lv-color-muted-fg)";
    case "success"   -> "var(--lv-color-success)";
    case "warning"   -> "var(--lv-color-warning)";
    case "danger"    -> "var(--lv-color-danger)";
    default          -> "var(--lv-color-fg)";
  };}
!{var clampClass = switch (clamp) {
    case 1  -> "line-clamp-1";
    case 2  -> "line-clamp-2";
    case 3  -> "line-clamp-3";
    case 4  -> "line-clamp-4";
    case 5  -> "line-clamp-5";
    case 6  -> "line-clamp-6";
    default -> "";
  };}

<p
  data-slot="paragraph"
  data-type="${type}"
  class="my-[var(--lv-space-3)] text-[length:var(--lv-text-base)] leading-[var(--lv-leading-relaxed)] ${clampClass} ${cssClass}"
  style="font-family:var(--lv-font-sans);color:${color};"
  $unsafe{attrs}
>${content}</p>
