@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui typography.title partial -- a heading (Ant Design Typography.Title parity).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012). Zero client state. Zero JS, CSP-clean.

  STRUCTURE (scientific decision rule):
    Ant's Typography family (Title/Text/Paragraph/Link) is a system of consistent text styles.
    lievit ships label + link but no heading system; this adds Title. The heading LEVEL maps to a
    real semantic <h1>..<h5> element (so document outline + AT heading navigation are correct),
    written as literal-tag branches because gg.jte's HTML parser does not accept a dynamic tag name.
    A `type` colour intent (secondary/success/warning/danger) tints the heading via --lv-* tokens.
    Inventory reference: Ant Design Typography.Title (level 1-5, type). Original generation over
    --lv-* tokens; no Ant code copied.

  A11y: a real <hN> element carries its heading role + level natively (no manual aria). Colour is
    never the sole signal -- the heading text carries the meaning; the type tint is decorative.

  Params:
    gg.jte.Content content              the heading text/markup.
    int level       = 1                 1..5 -> <h1>..<h5> (clamped). Visual size follows level.
    String type     = "default"         default|secondary|success|warning|danger (colour intent).
    String cssClass = ""                extra utility classes on the heading.
    String attrs    = ""                TRUSTED raw ($unsafe) -- STATIC author-typed strings only.

  Usage:
    @@template.lievit.typography.title(level = 1, content = @@`Page title`)
    @@template.lievit.typography.title(level = 3, type = "secondary", content = @@`Subsection`)
--%>
@param gg.jte.Content content
@param int level = 1
@param String type = "default"
@param String cssClass = ""
@param String attrs = ""

!{var lvl = Math.max(1, Math.min(5, level));}
!{var sizeClass = switch (lvl) {
    case 1  -> "text-[length:var(--lv-text-4xl)]";
    case 2  -> "text-[length:var(--lv-text-3xl)]";
    case 3  -> "text-[length:var(--lv-text-2xl)]";
    case 4  -> "text-[length:var(--lv-text-xl)]";
    default -> "text-[length:var(--lv-text-lg)]";
  };}
!{var color = switch (type) {
    case "secondary" -> "var(--lv-color-muted-fg)";
    case "success"   -> "var(--lv-color-success)";
    case "warning"   -> "var(--lv-color-warning)";
    case "danger"    -> "var(--lv-color-danger)";
    default          -> "var(--lv-color-fg)";
  };}
!{var headClass = "m-0 font-[var(--lv-font-semibold)] leading-[var(--lv-leading-tight)] " + sizeClass + " " + cssClass;}
!{var headStyle = "font-family:var(--lv-font-sans);color:" + color + ";";}

@if(lvl == 1)
<h1 data-slot="title" data-level="1" class="${headClass}" style="${headStyle}" $unsafe{attrs}>${content}</h1>
@elseif(lvl == 2)
<h2 data-slot="title" data-level="2" class="${headClass}" style="${headStyle}" $unsafe{attrs}>${content}</h2>
@elseif(lvl == 3)
<h3 data-slot="title" data-level="3" class="${headClass}" style="${headStyle}" $unsafe{attrs}>${content}</h3>
@elseif(lvl == 4)
<h4 data-slot="title" data-level="4" class="${headClass}" style="${headStyle}" $unsafe{attrs}>${content}</h4>
@else
<h5 data-slot="title" data-level="5" class="${headClass}" style="${headStyle}" $unsafe{attrs}>${content}</h5>
@endif
