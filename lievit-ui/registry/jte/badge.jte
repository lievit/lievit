@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui badge partial -- a small status pill, the gestionale status indicator.

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). The former
  <lv-badge> island held no client state; variant-to-colour is a pure function of the
  variant, so the server renders the whole pill. The Lit island is gone; this is the to-be.

  STRUCTURE (scientific decision rule): shadcn's Badge is a single styled <span> keyed on a
  variant. The status variants map to the status tokens (success / warning / danger / info)
  plus a muted neutral default; each variant drives a fill + foreground token pair, exactly
  the mapping the dropped island shipped, so a retheme retints every pill from the tokens.
  The label is plain text (the common kit call: @@template.badge(variant=.., label="..")),
  with an optional Content slot for rich children that takes precedence when supplied (the
  same content-over-scalar precedence kbd.jte uses).

  CSS COMPAT: the pill keeps the `lv-badge lv-badge--<variant>` class names the island used,
  so any stylesheet that targeted them still applies; the partial is self-styling via inline
  token-driven CSS (no external rule needed), consistent with the other w1a partials.

  A11y: a status pill is decorative text; it carries no role (it is not a live region -- the
  surrounding context, e.g. a table cell or an alert, owns any announcement). Colour is never
  the only signal: the label text always states the status.

  Params:
    String variant         = "neutral"  "neutral" | "success" | "warning" | "danger" | "info".
    String label           = null       the pill text (used when no content slot is supplied).
    gg.jte.Content content              optional rich children; takes precedence over label.
    String cssClass        = ""         extra utility classes on the pill.

  Usage:
    @@template.badge(variant = "success", label = "Attivo")
    @@template.badge(variant = "danger", content = @@`<strong>Scaduto</strong>`)
--%>
@param String variant = "neutral"
@param String label = null
@param gg.jte.Content content = null
@param String cssClass = ""

!{var bg = switch (variant) {
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger"  -> "var(--lv-color-danger)";
    case "info"    -> "var(--lv-color-info)";
    default        -> "var(--lv-color-surface)";
  };}
!{var fg = switch (variant) {
    case "success" -> "var(--lv-color-success-fg)";
    case "warning" -> "var(--lv-color-warning-fg)";
    case "danger"  -> "var(--lv-color-danger-fg)";
    case "info"    -> "var(--lv-color-info-fg)";
    default        -> "var(--lv-color-muted)";
  };}

<span
  data-slot="badge"
  data-variant="${variant}"
  class="lv-badge lv-badge--${variant} inline-flex items-center rounded-[var(--lv-radius-sm)] px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none ${cssClass}"
  style="font-family:var(--lv-font-sans);background:${bg};color:${fg};"
>@if(content != null)${content}@else${label}@endif</span>
