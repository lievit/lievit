@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui badge partial -- a small status pill (inert <span> or asChild <a> link).

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). badge holds no
  client state: variant-to-colour is a pure function of the variant, the server picks it from
  the domain model and renders the HTML, the browser paints it. The former <lv-badge> Lit island
  is gone; this is the to-be. Server-first works trivially -- there is nothing client about a
  status label.

  STRUCTURE (scientific decision rule): shadcn's Badge is a single styled <span> keyed on a
  variant. Two variant families ship side by side under one `variant` param so an adopter can
  use whichever name fits their domain model:
    (a) the SHADCN taxonomy -- `default` (primary fill), `secondary`, `destructive`, `outline`,
        `ghost` (fill-less foreground text), and `link` (primary text, underlines on hover);
    (b) the STATUS family -- `success` / `warning` / `danger` / `info` + muted `neutral`.
  Every variant drives a fill + foreground (and, for `outline`, a border) token pair via a
  switch into two local vars; the vars are then inlined as CSS custom property references on the
  element, so a retheme overrides the token and every pill retints with zero template change.
  The size scale (sm/md/lg) governs text size + padding, NOT height: badge is an inline element,
  not a form control, and does not share the toolbar-alignment height scale (architecture contract
  §5.b). The pill is always rounded-full (--lv-radius-full) regardless of size.

  asChild (server-first polymorphism): shadcn's Badge takes `asChild` to render as a different
  element (most commonly an <a>). The server already knows whether the pill is a link, so instead
  of a render-prop we pass `href`: a non-blank href renders the pill as a real <a> (the browser
  navigates, middle-click + open-in-new-tab work, with a focus-visible ring) while a blank href
  keeps the inert <span>. Same markup + tokens either way; the only delta is the element + its
  interaction affordances -- the server-first equivalent of shadcn's asChild anchor.

  DOT variant: a small coloured circle before the label, aria-hidden (colour is never the sole
  signal; the label text always states the status -- WCAG 1.4.1). Sized as a small circle tinted
  with currentColor at reduced opacity so it adapts to the variant foreground without a new token.
  The dot is static: no pulse / animation (WCAG 2.2.2 / 2.3.3). Use dot=true only when label is
  non-empty (a dot-only badge with no label is colour-as-sole-signal, an anti-pattern).

  CSS COMPAT: the pill keeps the `lv-badge lv-badge--<variant>` class names the island used,
  so any stylesheet that targeted them still applies; the partial is self-styling via inline
  token-driven CSS (no external rule needed), consistent with the other partials.

  A11y (no WAI-ARIA APG pattern): a status pill is decorative text; it carries no explicit role
  (it is not a live region -- the surrounding context, e.g. a table cell or an alert, owns any
  announcement). Colour is never the only signal: the label text always states the status.
  The dot is aria-hidden="true" (visual-only). The leading slot icon SHOULD be aria-hidden by
  the call site; the spec does not force it here because the call site controls semantic meaning.
  When href is set the pill becomes a real focusable <a> link with focus-visible ring; the
  platform supplies role=link + Tab focus + Enter navigation for free.

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    * attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only (wire directives,
      target/rel). NEVER interpolate a per-row DB-derived value into attrs.
    * dataAttrs (SAFE, escaped) -- Map<String,String> of dynamic data-* attributes. Each entry
      renders as data-<key>="<value>" with the VALUE escaped via Escape.htmlAttribute (the same
      routine ContentType.Html uses for a ${} in attribute-value position). Per-row DB values
      go here and ONLY here.

  Params:
    String variant           = "neutral"  shadcn: "default" | "secondary" | "destructive" |
                                          "outline" | "ghost" | "link"; status: "neutral" |
                                          "success" | "warning" | "danger" | "info".
    String label             = null       the pill text (used when no content slot is supplied).
    boolean dot              = false      renders a small coloured dot before the label (same colour
                                          as the variant fg via currentColor); aria-hidden.
    gg.jte.Content leading               optional leading slot: an icon or inline markup before label;
                                          only one of dot/leading should be used per call.
    gg.jte.Content content               optional rich children; takes precedence over label.
    String href              = null       non-blank => render as <a href> (asChild), else <span>.
    String size              = "md"       "sm" | "md" | "lg" -- text size + padding scale.
    String cssClass          = ""         extra utility classes on the pill root.
    String attrs             = ""         TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}     SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.badge(variant = "success", label = "Attivo")
    @@template.lievit.badge(variant = "warning", label = "In attesa", dot = true)
    @@template.lievit.badge(variant = "secondary", label = "Draft")
    @@template.lievit.badge(variant = "outline", label = "v2")
    @@template.lievit.badge(variant = "danger", content = @@`<strong>Scaduto</strong>`)
    @@template.lievit.badge(variant = "default", label = "Open issue", href = "/issues/42")
    @@template.lievit.badge(variant = "neutral", label = "Bozza",
        attrs = "target=\"_blank\" rel=\"noopener\"",
        dataAttrs = java.util.Map.of("testid", row.id()))
--%>
@param String variant = "neutral"
@param String label = null
@param boolean dot = false
@param gg.jte.Content leading = null
@param gg.jte.Content content = null
@param String href = null
@param String size = "md"
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

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
    default            -> "var(--lv-color-muted-bg)";
  };}
!{var fg = switch (variant) {
    case "default"     -> "var(--lv-color-primary-fg)";
    case "secondary"   -> "var(--lv-color-secondary-fg)";
    // shadcn's Badge destructive is text-white. The destructive-fg token resolves to white,
    // so it gives the same white-on-red pill while staying token-driven (no hardcoded hex).
    case "destructive" -> "var(--lv-color-destructive-fg)";
    case "outline"     -> "var(--lv-color-fg)";
    // ghost: no fill, foreground text; link: primary-coloured text that underlines on hover.
    case "ghost"       -> "var(--lv-color-fg)";
    case "link"        -> "var(--lv-color-primary)";
    case "success"     -> "var(--lv-color-success-fg)";
    case "warning"     -> "var(--lv-color-warning-fg)";
    case "danger"      -> "var(--lv-color-danger-fg)";
    case "info"        -> "var(--lv-color-info-fg)";
    default            -> "var(--lv-color-muted-fg)";
  };}
!{var border = "outline".equals(variant) ? "var(--lv-color-border)" : "transparent";}
!{var isLink = href != null && !href.isBlank();}
<%-- link variant: shadcn renders no pill, just primary text that underlines on hover. --%>
!{var variantClass = "link".equals(variant) ? " underline-offset-4" : "";}
<%-- size scale: text-size + padding. Inline elements, NOT height-based (architecture contract
     §5.b: the height-based scale is for form controls; badges are inline, not block). --%>
!{var sizeClass = switch (size) {
    case "sm" -> "px-[var(--lv-space-2)] py-[var(--lv-space-px)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "px-[var(--lv-space-3)] py-[var(--lv-space-1)] text-[length:var(--lv-text-base)]";
    default   -> "px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)]";
  };}
!{var pillClass = "lv-badge lv-badge--" + variant + " inline-flex items-center gap-[var(--lv-space-1)] rounded-full border whitespace-nowrap leading-none font-[var(--lv-font-medium)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]" + variantClass + " " + sizeClass + " " + cssClass;}
!{var pillStyle = "font-family:var(--lv-font-sans);background:" + bg + ";color:" + fg + ";border-color:" + border + ";";}
<%-- the <a> (asChild) hover affordance: link underlines, every other variant uses opacity hover. --%>
!{var anchorHover = "link".equals(variant) ? "hover:underline" : "no-underline transition-[color,opacity] hover:opacity-90";}

<%-- SAFE dynamic data-* attributes: each value escaped via Escape.htmlAttribute. JTE's HTML
     parser forbids a raw @for in attribute-NAME position, so we build the fragment once here.
     Keys must be simple identifiers ([A-Za-z][A-Za-z0-9-]*); a non-identifier key is dropped. --%>
!{var dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), dataAttrs_);
      dataAttrs_.writeContent("\"");
    }
  }}
!{var dataAttrsMarkup = dataAttrs_.toString();}

@if(isLink)
<a
  href="${href}"
  data-slot="badge"
  data-variant="${variant}"
  data-size="${size}"
  class="${pillClass} ${anchorHover}"
  style="${pillStyle}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)${leading}@endif@if(dot)<span aria-hidden="true" style="display:inline-block;width:0.5em;height:0.5em;border-radius:9999px;background:currentColor;opacity:0.7;flex-shrink:0;"></span>@endif@if(content != null)${content}@else${label}@endif</a>
@else
<span
  data-slot="badge"
  data-variant="${variant}"
  data-size="${size}"
  class="${pillClass}"
  style="${pillStyle}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
>@if(leading != null)${leading}@endif@if(dot)<span aria-hidden="true" style="display:inline-block;width:0.5em;height:0.5em;border-radius:9999px;background:currentColor;opacity:0.7;flex-shrink:0;"></span>@endif@if(content != null)${content}@else${label}@endif</span>
@endif
