@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui badge partial -- a small status pill, the gestionale status indicator.

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). The former
  <lv-badge> island held no client state; variant-to-colour is a pure function of the
  variant, so the server renders the whole pill. The Lit island is gone; this is the to-be.

  STRUCTURE (scientific decision rule): shadcn's Badge is a single styled <span> keyed on a
  variant. Two variant families ship side by side so a retheme retints every pill from the
  tokens: (a) the SHADCN taxonomy -- `default` (primary fill), `secondary`, `destructive`,
  `outline`, plus the fill-less `ghost` (foreground text) and `link` (primary text, underlines on
  hover) -- so an adopter coming from shadcn names the same variants; (b) the STATUS family
  the gestionale uses -- success / warning / danger / info -- plus a muted `neutral` default.
  Every variant drives a fill + foreground (and, for `outline`, a transparent fill + border)
  token pair, exactly the mapping the dropped island shipped extended with the shadcn names.
  The label is plain text (the common kit call: @@template.lievit.badge(variant=.., label="..")),
  with an optional Content slot for rich children that takes precedence when supplied (the
  same content-over-scalar precedence kbd.jte uses).

  asChild (server-first polymorphism): shadcn's Badge takes `asChild` to render as a different
  element (most commonly an <a> link). The server already knows whether the pill is a link, so
  instead of a render-prop we pass `href`: a non-blank href renders the pill as a real <a> (the
  browser navigates, middle-click + open-in-new-tab work, with a focus-visible ring) while a
  blank href keeps the inert <span>. Same markup + tokens either way; the only delta is the
  element + its interaction affordances -- the server-first equivalent of shadcn's asChild anchor.

  CSS COMPAT: the pill keeps the `lv-badge lv-badge--<variant>` class names the island used,
  so any stylesheet that targeted them still applies; the partial is self-styling via inline
  token-driven CSS (no external rule needed), consistent with the other w1a partials.

  A11y: a status pill is decorative text; it carries no role (it is not a live region -- the
  surrounding context, e.g. a table cell or an alert, owns any announcement). Colour is never
  the only signal: the label text always states the status. When `href` is set the pill becomes
  a real focusable link, so it gains the platform's anchor semantics + a focus-visible ring.

  Params:
    String variant         = "neutral"  shadcn: "default" | "secondary" | "destructive" | "outline" |
                                        "ghost" | "link"; status: "neutral" | "success" | "warning" |
                                        "danger" | "info".
    String label           = null       the pill text (used when no content slot is supplied).
    gg.jte.Content content              optional rich children; takes precedence over label.
    String href            = null       non-blank => render as an <a> link (asChild), else a <span>.
    String cssClass        = ""         extra utility classes on the pill.

  Usage:
    @@template.lievit.badge(variant = "success", label = "Attivo")
    @@template.lievit.badge(variant = "secondary", label = "Draft")
    @@template.lievit.badge(variant = "outline", label = "v2")
    @@template.lievit.badge(variant = "danger", content = @@`<strong>Scaduto</strong>`)
    @@template.lievit.badge(variant = "default", label = "Open issue", href = "/issues/42")
--%>
@param String variant = "neutral"
@param String label = null
@param gg.jte.Content content = null
@param String href = null
@param String cssClass = ""

!{var bg = switch (variant) {
    case "default"     -> "var(--lv-color-primary)";
    case "secondary"   -> "var(--lv-color-secondary)";
    case "destructive" -> "var(--lv-color-destructive)";
    case "outline"     -> "transparent";
    case "ghost"       -> "transparent";
    case "link"        -> "transparent";
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "danger"      -> "var(--lv-color-danger)";
    case "info"        -> "var(--lv-color-info)";
    default            -> "var(--lv-color-surface)";
  };}
!{var fg = switch (variant) {
    case "default"     -> "var(--lv-color-primary-fg)";
    case "secondary"   -> "var(--lv-color-secondary-fg)";
    // shadcn's Badge destructive is text-white. The destructive-fg token resolves to white,
    // so it gives the same white-on-red pill while staying token-driven (no hardcoded hex --
    // the kit's law + the no-hex test gate). Same visual as shadcn, retheme-safe.
    case "destructive" -> "var(--lv-color-destructive-fg)";
    case "outline"     -> "var(--lv-color-fg)";
    // shadcn ghost: no fill, foreground text (the accent tint is the <a> hover only);
    // link: primary-coloured text that underlines on hover (the only non-pill-looking variant).
    case "ghost"       -> "var(--lv-color-fg)";
    case "link"        -> "var(--lv-color-primary)";
    case "success"     -> "var(--lv-color-success-fg)";
    case "warning"     -> "var(--lv-color-warning-fg)";
    case "danger"      -> "var(--lv-color-danger-fg)";
    case "info"        -> "var(--lv-color-info-fg)";
    default            -> "var(--lv-color-muted)";
  };}
!{var border = "outline".equals(variant) ? "var(--lv-color-border)" : "transparent";}
!{var isLink = href != null && !href.isBlank();}
<%-- link variant: shadcn renders no pill, just primary text that underlines on hover. --%>
!{var variantClass = "link".equals(variant) ? " underline-offset-4" : "";}
!{var pillClass = "lv-badge lv-badge--" + variant + " inline-flex items-center gap-[var(--lv-space-1)] rounded-full border px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]" + variantClass + " " + cssClass;}
!{var pillStyle = "font-family:var(--lv-font-sans);background:" + bg + ";color:" + fg + ";border-color:" + border + ";";}
<%-- the <a> (asChild) hover affordance: link underlines, every other variant keeps the opacity hover. --%>
!{var anchorHover = "link".equals(variant) ? "hover:underline" : "no-underline transition-colors hover:opacity-90";}

@if(isLink)
<a
  href="${href}"
  data-slot="badge"
  data-variant="${variant}"
  class="${pillClass} ${anchorHover}"
  style="${pillStyle}"
>@if(content != null)${content}@else${label}@endif</a>
@else
<span
  data-slot="badge"
  data-variant="${variant}"
  class="${pillClass}"
  style="${pillStyle}"
>@if(content != null)${content}@else${label}@endif</span>
@endif
