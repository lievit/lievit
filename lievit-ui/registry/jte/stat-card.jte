@import gg.jte.Content
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui stat-card partial -- a KPI (key-metric) card: a heading, a big primary value, an
  optional description line carrying a trend icon, an optional leading icon, a colour tint, and an
  optional whole-card link. The dashboard stat tile the kit's io.lievit.kit.StatWidget resolves to
  (heading / value / description / icon / color / descriptionIcon + IconPosition / url + newTab).

  TIER: STATIC presentational -> JTE partial. Pure presentation; the values are the already-resolved
  strings the controller read from the widget (StatWidget.value() is a Supplier evaluated at render
  time, so the template only ever paints the resolved String). The inline sparkline (StatWidget.chart)
  is a chart island, NOT this static card: pass it through the `chart` slot.

  STRUCTURE (scientific decision rule): shadcn dashboards build a stat as a Card with a small label,
  a large number, and a muted delta line with a trend arrow; Filament's StatsOverview stat is the
  same. We reuse the card surface vocabulary inline (border + radius-xl + card bg + shadow-xs) rather
  than nesting @template.lievit.card, because a stat needs the whole-surface link wrapper (an <a>
  around everything when `url` is set) which a slot-based card can't host cleanly. The trend icon
  sits before or after the description (StatWidget.descriptionIconPosition = BEFORE | AFTER). The
  colour tints the value + trend (StatWidget.color), mapping a Color name to a --lv-color-* var.

  TOKEN FIDELITY: surface reads --lv-color-card / --lv-color-card-fg + --lv-radius-xl + --lv-shadow-xs;
  heading + description read --lv-color-muted-fg; the colour tint maps to a --lv-color-* var, never a hex.

  A11y: when `url` is set the whole card is a single <a> (the entire tile is the link target, the
  Filament behaviour); the leading + trend icons are decorative (aria-hidden via the Lucide partial);
  the heading + value carry the meaning. A non-link card is a plain region.

  Params:
    String heading                the metric label (StatWidget.heading).
    String value                  the big primary value (the resolved StatWidget.value()).
    String description = null     the delta/comparison line (StatWidget.description); null => omitted.
    String icon        = null     a leading icon name (StatWidget.icon); null => none.
    String descriptionIcon = null the trend icon name beside the description (StatWidget.descriptionIcon).
    String iconPosition = "before" before | after: the trend icon side (StatWidget.IconPosition).
    String color       = null     a semantic colour token name tinting value + trend (StatWidget.color):
                                  primary | secondary | success | warning | danger | info; null => default fg.
    String url         = null     turns the whole card into a link (StatWidget.url); null => a plain card.
    boolean newTab     = false    open the link in a new tab (StatWidget.opensInNewTab()).
    gg.jte.Content chart = null   an optional sparkline slot (a chart island); the static card holds the seam.
    String cssClass    = ""       extra utility classes on the card root.

  Usage:
    @@template.lievit.statCard(heading = "Annunci attivi", value = "142")
    @@template.lievit.statCard(
      heading = "Annunci attivi", value = "142",
      description = "+12 questa settimana", descriptionIcon = "trending-up",
      color = "success", url = "/admin/listings")
--%>
@param String heading
@param String value
@param String description = null
@param String icon = null
@param String descriptionIcon = null
@param String iconPosition = "before"
@param String color = null
@param String url = null
@param boolean newTab = false
@param gg.jte.Content chart = null
@param String cssClass = ""

!{var hasIcon = icon != null && !icon.isBlank();}
!{var hasDescription = description != null && !description.isBlank();}
!{var hasTrendIcon = descriptionIcon != null && !descriptionIcon.isBlank();}
!{var isLink = url != null && !url.isBlank();}
!{var iconAfter = "after".equals(iconPosition);}
!{var tintVar = switch (color == null ? "" : color) {
    case "primary" -> "var(--lv-color-primary)";
    case "secondary" -> "var(--lv-color-secondary)";
    case "success" -> "var(--lv-color-success)";
    case "warning" -> "var(--lv-color-warning)";
    case "danger", "destructive" -> "var(--lv-color-danger)";
    case "info" -> "var(--lv-color-info)";
    default -> "var(--lv-color-card-fg)";
  };}
!{var surfaceClass = "relative flex flex-col gap-[var(--lv-space-2)] rounded-[var(--lv-radius-xl)] border border-[var(--lv-color-border)] bg-[var(--lv-color-card)] p-[var(--lv-space-6)] text-[var(--lv-color-card-fg)] shadow-[var(--lv-shadow-xs)]";}
!{var linkClass = isLink ? "transition-colors hover:bg-[var(--lv-color-muted-bg)] outline-none focus-visible:border-[var(--lv-color-ring)] focus-visible:shadow-[var(--lv-ring)]" : "";}

@if(isLink)
  <a
    data-slot="stat-card"
    data-color="${color}"
    href="${url}"
    target="${newTab ? "_blank" : null}"
    rel="${newTab ? "noopener noreferrer" : null}"
    class="${surfaceClass} ${linkClass} no-underline ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >
@else
  <div
    data-slot="stat-card"
    data-color="${color}"
    class="${surfaceClass} ${cssClass}"
    style="font-family:var(--lv-font-sans);"
  >
@endif
    <div data-slot="stat-card-header" class="flex items-center justify-between gap-[var(--lv-space-2)]">
      <span data-slot="stat-card-heading" class="text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)] text-[var(--lv-color-muted-fg)]">${heading}</span>
      @if(hasIcon)
        <span data-slot="stat-card-icon" class="shrink-0 text-[var(--lv-color-muted-fg)]" style="color:${tintVar};">
          @template.lievit.icon(name = icon, size = "1.25rem")
        </span>
      @endif
    </div>
    <div data-slot="stat-card-value" class="text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)] leading-none tracking-tight" style="color:${tintVar};">${value}</div>
    @if(hasDescription)
      <div data-slot="stat-card-description" class="flex items-center gap-[var(--lv-space-1)] text-[length:var(--lv-text-sm)] text-[var(--lv-color-muted-fg)]" style="color:${tintVar};">
        @if(hasTrendIcon && !iconAfter)
          <span data-slot="stat-card-trend" class="shrink-0">@template.lievit.icon(name = descriptionIcon, size = "1rem")</span>
        @endif
        <span>${description}</span>
        @if(hasTrendIcon && iconAfter)
          <span data-slot="stat-card-trend" class="shrink-0">@template.lievit.icon(name = descriptionIcon, size = "1rem")</span>
        @endif
      </div>
    @endif
    @if(chart != null)
      <div data-slot="stat-card-chart" class="mt-[var(--lv-space-2)]">${chart}</div>
    @endif
@if(isLink)
  </a>
@else
  </div>
@endif
