@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui chip partial -- a small rounded tag, optionally REMOVABLE. The Filament "active
  filter" pill / shadcn Badge-with-dismiss: a label with an optional trailing x that drops it.

  TIER: STATIC presentational -> JTE partial (ADR-0012 server-first pivot). A chip carries no
  client state: variant-to-colour is pure, and removal is a server action. So the whole chip is
  server-rendered, zero JS, CSP-clean.

  CHIP vs BADGE (why a separate component): badge.jte is an inert STATUS pill (rounded-sm, no
  affordance). A chip is an INTERACTIVE selection/filter tag: rounded-full, and its defining
  feature is the optional REMOVE affordance. Same token vocabulary as badge so they retheme
  together, different shape + an interaction.

  REMOVE = server-first (no JS): a non-blank `removeHref` renders the trailing x as a real
  <a href> the browser navigates (middle-click / open-in-new-tab work), so removing a chip is a
  plain GET to a URL the server builds (e.g. "drop this filter"). No removeHref => an inert pill
  with no x. (A JS-dismiss adopter can still delegate off [data-slot="chip-remove"].) The x is an
  inline Lucide glyph so the component is self-contained -- no registry icon dependency.

  A11y: the chip text states the selection (colour is never the only signal). The remove link
  carries an explicit `removeLabel` aria-label (e.g. "Rimuovi filtro: Stato = Aperto") because
  the visible x glyph is aria-hidden; it gains the platform anchor semantics + a focus ring.
  IMPORTANT: pass a meaningful removeLabel whenever removeHref is set, else the control is
  unlabelled for assistive tech.

  STAYING AGNOSTIC: this is a generic removable tag. Domain meaning (which filter, a filiale,
  a person) lives in the ADOPTER's call (the label + the removeHref it builds), never here.

  Params:
    String variant      = "neutral"  same family as badge: "default" (primary) | "secondary" |
                                     "destructive" | "outline" | "neutral" | "success" |
                                     "warning" | "danger" | "info".
    String label        = null       the chip text (used when no content slot is supplied).
    gg.jte.Content content           optional rich children; takes precedence over label.
    String removeHref   = null       non-blank => render a trailing remove x as an <a href>.
    String removeLabel  = null       aria-label for the remove link (REQUIRED when removeHref set).
    String cssClass     = ""         extra utility classes on the chip.

  Usage:
    @@template.chip(label = "Bozza")
    @@template.chip(variant = "info", label = "Stato: Aperto",
                   removeHref = "/attivita?stato=", removeLabel = "Rimuovi filtro Stato")
--%>
@param String variant = "neutral"
@param String label = null
@param gg.jte.Content content = null
@param String removeHref = null
@param String removeLabel = null
@param String cssClass = ""

!{var bg = switch (variant) {
    case "default"     -> "var(--lv-color-primary)";
    case "secondary"   -> "var(--lv-color-secondary)";
    case "destructive" -> "var(--lv-color-destructive)";
    case "outline"     -> "transparent";
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "danger"      -> "var(--lv-color-danger)";
    case "info"        -> "var(--lv-color-info)";
    default            -> "var(--lv-color-surface)";
  };}
!{var fg = switch (variant) {
    case "default"     -> "var(--lv-color-primary-fg)";
    case "secondary"   -> "var(--lv-color-secondary-fg)";
    case "destructive" -> "var(--lv-color-destructive-fg)";
    case "outline"     -> "var(--lv-color-fg)";
    case "success"     -> "var(--lv-color-success-fg)";
    case "warning"     -> "var(--lv-color-warning-fg)";
    case "danger"      -> "var(--lv-color-danger-fg)";
    case "info"        -> "var(--lv-color-info-fg)";
    default            -> "var(--lv-color-muted)";
  };}
!{var border = "outline".equals(variant) ? "var(--lv-color-border)" : "transparent";}
!{var removable = removeHref != null && !removeHref.isBlank();}
!{var chipClass = "lv-chip lv-chip--" + variant + " inline-flex items-center gap-[var(--lv-space-1)] rounded-full border px-[var(--lv-space-2)] py-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] leading-none " + cssClass;}
!{var chipStyle = "font-family:var(--lv-font-sans);background:" + bg + ";color:" + fg + ";border-color:" + border + ";";}

<span data-slot="chip" data-variant="${variant}" class="${chipClass}" style="${chipStyle}">
  <span data-slot="chip-label">@if(content != null)${content}@else${label}@endif</span>
  @if(removable)
  <a
    href="${removeHref}"
    data-slot="chip-remove"
    aria-label="${removeLabel}"
    class="-mr-[var(--lv-space-1)] inline-flex shrink-0 items-center rounded-full p-[2px] opacity-70 no-underline transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="color:inherit;"
  ><svg aria-hidden="true" focusable="false" width="0.875rem" height="0.875rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg></a>
  @endif
</span>
