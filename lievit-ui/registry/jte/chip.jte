@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui chip partial -- a small rounded tag, optionally REMOVABLE. The Filament "active
  filter" pill / shadcn Badge-with-dismiss: a label with an optional trailing x that drops it.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). A chip carries no
  client state: variant-to-colour is pure, and removal is a server action. The whole chip is
  server-rendered, zero JS, CSP-clean.

  CHIP vs BADGE (why a separate component): badge.jte is an inert STATUS pill (no affordance).
  A chip is a SELECTION/FILTER tag whose defining feature is the optional REMOVE affordance.
  Both are rounded-full (shadcn's Badge is the full pill); same token vocabulary so they retheme
  together. They differ by semantic contract: a badge is always inert; a chip optionally carries
  a named interactive control. Combining them into one would force conditionals that obscure the
  access contract for each -- the "single component does two things" anti-pattern.

  REMOVE = server-first (no JS): a non-blank `removeHref` renders the trailing x as a real
  <a href> the browser navigates (middle-click / open-in-new-tab work), so removing a chip is a
  plain GET to a URL the server builds (e.g. "drop this filter"). No removeHref => an inert span
  with no x. (An htmx/wire adopter can delegate off [data-slot="chip-remove"] from outside.)

  SIZE: same sm/md/lg text + padding scale as badge; NOT height-based (architecture contract
  §5.b). The radius is always --lv-radius-full regardless of size.

  A11y (no WAI-ARIA APG pattern): the chip text states the selection (colour is never the only
  signal -- WCAG 1.4.1). The outer <span> is a non-interactive container. The remove link is a
  real <a href> carrying an explicit `removeLabel` aria-label (e.g. "Rimuovi filtro: Stato =
  Aperto") because the visible x glyph is aria-hidden="true" focusable="false"; the platform
  supplies role=link + Tab focus + Enter navigation for free. IMPORTANT: pass a meaningful
  removeLabel whenever removeHref is set -- a missing removeLabel produces an unlabelled
  interactive control (axe-core link-name violation). The template emits a dev warning comment
  when removeHref is set and removeLabel is blank/null.

  EXTRA ATTRIBUTES -- two channels, by trust (the XSS decision rule):
    * attrs (TRUSTED, raw) -- $unsafe, STATIC author-typed strings only.
      NEVER interpolate a per-row DB-derived value into attrs.
    * dataAttrs (SAFE, escaped) -- Map<String,String> of dynamic data-* attributes. Each entry
      renders as data-<key>="<value>" with the VALUE escaped via Escape.htmlAttribute. Per-row
      DB values go here and ONLY here.

  STAYING AGNOSTIC: this is a generic removable tag. Domain meaning (which filter, a filiale,
  a person) lives in the ADOPTER's call (the label + the removeHref it builds), never here.

  Params:
    String variant           = "neutral"  same vocabulary as badge: "default" | "secondary" |
                                          "destructive" | "outline" | "ghost" | "link" |
                                          "neutral" | "success" | "warning" | "danger" | "info".
    String label             = null       the chip text (used when no content slot is supplied).
    gg.jte.Content leading               optional leading slot: an icon before the label.
    gg.jte.Content content               optional rich children; takes precedence over label.
    String removeHref        = null       non-blank => trailing remove x rendered as <a href>.
    String removeLabel       = null       aria-label for the remove link (REQUIRED when removeHref
                                          is set; absence is an a11y defect -- axe link-name).
    String size              = "md"       "sm" | "md" | "lg" -- text size + padding scale.
    String cssClass          = ""         extra utility classes on the chip root.
    String attrs             = ""         TRUSTED raw ($unsafe) -- STATIC author-typed strings only.
    Map<String,String> dataAttrs = {}     SAFE dynamic data-* (value escaped via Escape.htmlAttribute).

  Usage:
    @@template.lievit.chip(label = "Bozza")
    @@template.lievit.chip(variant = "info", label = "Stato: Aperto",
                   removeHref = "/attivita?stato=", removeLabel = "Rimuovi filtro Stato")
    @@template.lievit.chip(variant = "success", size = "sm",
                   leading = @@`@@template.lievit.icon(name = "check", size = "0.75rem")`,
                   label = "Attivo")
--%>
@param String variant = "neutral"
@param String label = null
@param gg.jte.Content leading = null
@param gg.jte.Content content = null
@param String removeHref = null
@param String removeLabel = null
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
    case "destructive" -> "var(--lv-color-destructive-fg)";
    case "outline"     -> "var(--lv-color-fg)";
    // mirror badge: ghost = no fill / foreground text; link = primary-coloured text.
    case "ghost"       -> "var(--lv-color-fg)";
    case "link"        -> "var(--lv-color-primary)";
    case "success"     -> "var(--lv-color-success-fg)";
    case "warning"     -> "var(--lv-color-warning-fg)";
    case "danger"      -> "var(--lv-color-danger-fg)";
    case "info"        -> "var(--lv-color-info-fg)";
    default            -> "var(--lv-color-muted-fg)";
  };}
!{var border = "outline".equals(variant) ? "var(--lv-color-border)" : "transparent";}
!{var removable = removeHref != null && !removeHref.isBlank();}
<%-- link variant mirrors badge: underline-offset so the primary text reads as a link. --%>
!{var variantClass = "link".equals(variant) ? " underline-offset-4" : "";}
<%-- size scale: text-size + padding. Inline elements, NOT height-based (architecture contract
     §5.b: the height-based scale is for form controls; chips are inline, not block). --%>
!{var sizeClass = switch (size) {
    case "sm" -> "px-[var(--lv-space-2)] py-[var(--lv-space-px)] text-[length:var(--lv-text-xs)]";
    case "lg" -> "px-[var(--lv-space-3)] py-[var(--lv-space-1)] text-[length:var(--lv-text-base)]";
    default   -> "px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)]";
  };}
!{var chipClass = "lv-chip lv-chip--" + variant + " inline-flex items-center gap-[var(--lv-space-1)] rounded-full border whitespace-nowrap leading-none font-[var(--lv-font-medium)]" + variantClass + " " + sizeClass + " " + cssClass;}
!{var chipStyle = "font-family:var(--lv-font-sans);background:" + bg + ";color:" + fg + ";border-color:" + border + ";";}

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

<span
  data-slot="chip"
  data-variant="${variant}"
  data-size="${size}"
  class="${chipClass}"
  style="${chipStyle}"
  $unsafe{dataAttrsMarkup}
  $unsafe{attrs}
><span data-slot="chip-label">@if(leading != null)${leading}@endif@if(content != null)${content}@else${label}@endif</span>@if(removable)<%-- a11y: removeLabel is REQUIRED when removeHref is set; a missing label is an axe link-name violation --%>@if(removeLabel == null || removeLabel.isBlank())<!-- WARNING: removeLabel is required when removeHref is set (axe-core link-name) -->@endif<a
    href="${removeHref}"
    data-slot="chip-remove"
    aria-label="${removeLabel != null && !removeLabel.isBlank() ? removeLabel : ""}"
    class="-mr-[var(--lv-space-1)] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 no-underline transition-[opacity] hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="color:inherit;"
  ><svg aria-hidden="true" focusable="false" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></a>@endif</span>
