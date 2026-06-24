@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui stat-card partial -- single-metric KPI display card: prominent label + value + optional
  trend indicator (direction + delta magnitude) + leading/trailing/footer slots + optional link wrapper.

  TIER: PARTIAL -- purely presentational; zero client state, fires no actions. The server computes
  and pre-formats the value; this partial renders it. htmx refresh on the card is an adopter concern
  wired through the attrs channel; this partial ships no timing logic of its own.

  STRUCTURE (scientific decision rule): no WAI-ARIA APG composite pattern applies to a pure static
  numeric display card (APG patterns index verified at https://www.w3.org/WAI/ARIA/apg/patterns/;
  the applicable norms are WCAG 2.2 SC 1.1.1, SC 1.4.3, and SC 4.1.2). The root element is figure,
  the HTML5 element for self-contained content with its caption -- the correct semantic container for
  a metric tile (title = figcaption, value = the metric illustration). Ant Design Statistic consulted
  as feature inventory (value, title, prefix/suffix, precision, trend direction+value, loading state,
  card layout); Tailwind UI Stats / KPI card patterns consulted for visual layout vocabulary.
  Styling is original generation over --lv-* tokens (no code copied from any reference).

  TOKEN NOTE: --lv-text-4xl does not exist in lievit-tokens.css (the scale stops at --lv-text-3xl
  as of this writing). The spec mandates it for size="lg"; the token is emitted as-is per the spec
  to be wire-compatible when the token ships. The fallback when the token is undefined is no
  font-size change (CSS ignores an unknown var() fallback cascade). If the visual result is wrong
  in the interim, define the token or use size="md" and override with cssClass / inline style.

  A11y (WCAG 2.2; no WAI-ARIA APG pattern -- pure display element):
    - Non-linked card: figure[aria-labelledby=titleId] root; figcaption[id=titleId] = metric label.
      Screen reader announces the label on figure entry, then reads value/trend/description in order.
    - Linked card: a[aria-label="title: prefix value suffix"] wrapping figure[aria-hidden="true"].
      The inner figure is aria-hidden to avoid double-announcing the inner structure.
    - Value: p[data-slot=stat-card-value][aria-atomic="true"] so HTMX morph triggers a full re-read.
    - Prefix / suffix: span[aria-hidden="true"] (decorative symbols; meaning carried by value text
      and by the a[aria-label] on linked cards).
    - Trend indicator: span[role="img"][aria-label="Tendenza: in aumento, +12 %"] -- direction AND
      magnitude communicated textually, never by colour alone (WCAG SC 1.4.1 + 4.1.2). Inline trend
      SVG icons carry aria-hidden="true" (decorative; meaning is in the parent role=img label).
    - Loading state: aria-busy="true" on the root figure; skeleton bars aria-hidden="true".
    - Footer hr: role="separator" aria-hidden="true" (decorative divider, suppressed from SR).
    - Leading slot: div[aria-hidden="true"] (the slot is decorative; adopter supplies accessible
      names for any meaningful icon or avatar placed here).
    - Trailing slot: div (no aria-hidden -- adopter may place interactive elements with own names).
    - No focus trap, no roving tabindex, no initial focus steal, no live region: display only.
    - Link card focus ring: the native a element receives platform focus; --lv-ring provides the ring.

  Params:
    String title            (required) metric label (e.g. "Nuovi contatti"); becomes the figure
                            accessible name via aria-labelledby. Rendered above the value.
    String value            (required) pre-formatted metric value (e.g. "1 284", "92,4 %"). The
                            controller owns number formatting + locale; the partial is a dumb renderer.
    String prefix       = "" symbol displayed immediately before the value (e.g. "EUR", "#"); decorative.
    String suffix       = "" symbol displayed immediately after the value (e.g. "%", "k"); decorative.
    String description  = "" secondary line below trend: context, period, or source note; empty omits it.
    String trend        = "none" up | down | neutral | none -- direction of the trend indicator and
                            its intent colour (up=success green, down=destructive red, neutral=muted).
    String trendValue   = "" delta text alongside the trend icon (e.g. "+12 %", "-340 EUR").
    String trendLabel   = "" screen-reader label override for the trend span[role=img]; when empty the
                            auto-generated "Tendenza: in aumento, +12 %" label is used.
    boolean loading     = false skeleton state: replaces value + trend with animated placeholder bars;
                            emits aria-busy="true" on the root figure.
    String size         = "md" sm | md | lg -- scales the value font size and card padding only
                            (display component, NOT toolbar-height aligned; architecture contract 5b).
    String variant      = "default" default | info | success | warning | destructive -- controls the
                            decorative left-border accent colour only; does not recolour the value text.
    String href         = null when set, wraps the card in an a[href] making it a navigable link;
                            the a carries aria-label derived from title + prefix + value + suffix.
    gg.jte.Content leading  = null icon / avatar / pictogram to the left of the title+value column.
    gg.jte.Content trailing = null top-right corner content (period badge, settings icon button, etc.).
    gg.jte.Content footer   = null ruled bottom section (sparkline, comparison bar, detail link row).
    String cssClass     = "" extra utility classes appended to the card root element.
    String attrs        = "" TRUSTED raw ($unsafe) -- STATIC author-typed strings only (data-testid,
                            HTMX directives). Never feed a per-row DB-derived value through this channel.
    Map<String,String> dataAttrs = {} SAFE escaped dynamic data-* attributes (values via Escape.htmlAttribute).
                            Use for per-row identifiers when the card appears inside a loop.

  Usage:
    @@template.lievit.stat-card(title = "Nuovi contatti", value = "284")
    @@template.lievit.stat-card(
      title = "Ricavi mensili", value = "38 000", prefix = "EUR",
      trend = "up", trendValue = "+12 %",
      variant = "success", size = "lg",
      attrs = "hx-get=\"/stats/revenue\" hx-trigger=\"every 30s\" hx-target=\"this\" hx-swap=\"outerHTML\"")
--%>
@param String title
@param String value
@param String prefix = ""
@param String suffix = ""
@param String description = ""
@param String trend = "none"
@param String trendValue = ""
@param String trendLabel = ""
@param boolean loading = false
@param String size = "md"
@param String variant = "default"
@param String href = null
@param gg.jte.Content leading = null
@param gg.jte.Content trailing = null
@param gg.jte.Content footer = null
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()

!{var _titleId = "sc-" + Integer.toHexString(title.hashCode());}
!{var _isLink = href != null && !href.isBlank();}
!{var _hasTrend = !"none".equals(trend);}
!{var _hasDescription = !description.isBlank();}
!{var _hasLeading = leading != null;}
!{var _hasTrailing = trailing != null;}
!{var _hasFooter = footer != null;}
<%-- size: value font-size + card padding. See TOKEN NOTE above re: --lv-text-4xl. --%>
!{var _sizeValue = switch (size) {
    case "sm" -> "var(--lv-text-2xl)";
    case "lg" -> "var(--lv-text-4xl)";
    default   -> "var(--lv-text-3xl)";
  };}
!{var _sizePad = switch (size) {
    case "sm" -> "var(--lv-space-4)";
    case "lg" -> "var(--lv-space-6)";
    default   -> "var(--lv-space-5)";
  };}
<%-- variant: left-border accent colour only. "default" keeps the border transparent. --%>
!{var _accentColor = switch (variant) {
    case "info"        -> "var(--lv-color-info)";
    case "success"     -> "var(--lv-color-success)";
    case "warning"     -> "var(--lv-color-warning)";
    case "destructive" -> "var(--lv-color-destructive)";
    default            -> "transparent";
  };}
<%-- trend: intent colour + auto-generated accessible label (direction + magnitude in Italian). --%>
!{var _trendColor = switch (trend) {
    case "up"   -> "var(--lv-color-success)";
    case "down" -> "var(--lv-color-destructive)";
    default     -> "var(--lv-color-muted-fg)";
  };}
!{var _autoTrendLabel = switch (trend) {
    case "up"   -> "Tendenza: in aumento" + (trendValue.isBlank() ? "" : ", " + trendValue);
    case "down" -> "Tendenza: in calo"    + (trendValue.isBlank() ? "" : ", " + trendValue);
    default     -> "Tendenza: stabile"    + (trendValue.isBlank() ? "" : ", " + trendValue);
  };}
!{var _effectiveTrendLabel = trendLabel.isBlank() ? _autoTrendLabel : trendLabel;}
<%-- linked card: full accessible name on the a element (prefix+value+suffix conveyed in text). --%>
!{var _linkLabel = title + ": " + prefix + value + suffix;}
<%-- card shell style: token-driven, no hardcoded colours. --%>
!{var _cardStyle = "font-family:var(--lv-font-sans);padding:" + _sizePad + ";border-radius:var(--lv-radius-lg);border:1px solid var(--lv-color-border);border-left-width:3px;border-left-color:" + _accentColor + ";background:var(--lv-color-card);color:var(--lv-color-card-fg);box-shadow:var(--lv-shadow-sm);";}

<%-- SAFE dynamic data-* attributes: keys allowlisted to simple identifiers ([A-Za-z][A-Za-z0-9-]*);
     values escaped via Escape.htmlAttribute. JTE's HTML parser forbids a raw @for in attribute-NAME
     position, so the fragment is built once here and emitted with $unsafe. --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var _e : dataAttrs.entrySet()) {
    if (_e.getKey() != null && _e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + _e.getKey() + "=\"");
      Escape.htmlAttribute(_e.getValue() == null ? "" : _e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<%-- figure is ALWAYS the semantic root (aria-labelledby ties it to its figcaption); when href is
     set, a stretched-link <a> overlays the whole card (position:relative on the figure + absolute
     inset-0 on the a). This keeps every tag balanced within one static branch (JTE HTML checker)
     and is the canonical accessible card-link pattern. loading=true sets aria-busy on the figure. --%>
<figure
  data-slot="stat-card"
  data-variant="${variant}"
  data-size="${size}"
  aria-labelledby="${_titleId}"
  aria-busy="${loading ? "true" : null}"
  class="${cssClass}"
  style="${_cardStyle}display:flex;flex-direction:column;${_isLink ? "position:relative;" : ""}"
  $unsafe{attrs}
  $unsafe{_dataAttrsMarkup}
>
@if(_isLink)
  <a
    href="${href}"
    data-slot="stat-card-link"
    aria-label="${_linkLabel}"
    class="absolute inset-0 rounded-[var(--lv-radius-lg)] focus-visible:outline-none focus-visible:shadow-[var(--lv-ring)]"
    style="z-index:1;"
  ></a>
@endif

  <%-- Header row: title + optional leading/trailing layout. --%>
  <div data-slot="stat-card-header" style="display:flex;align-items:flex-start;justify-content:space-between;gap:var(--lv-space-3);">
    @if(_hasLeading)
    <%-- leading slot: aria-hidden -- the slot is decorative (icon, avatar, pictogram).
         Adopter must supply accessible names for any meaningful content placed here. --%>
    <div data-slot="stat-card-leading" aria-hidden="true" style="flex-shrink:0;display:inline-flex;align-items:center;color:var(--lv-color-muted-fg);">
      ${leading}
    </div>
    @endif
    <div style="flex:1 1 0%;min-width:0;">
      @if(!_isLink)
      <%-- figcaption id is the target of the figure's aria-labelledby; emitted only when not linked
           because the linked figure is aria-hidden and needs no labelledby. --%>
      <figcaption
        id="${_titleId}"
        data-slot="stat-card-title"
        style="margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);color:var(--lv-color-muted-fg);line-height:1;"
      >${title}</figcaption>
      @else
      <figcaption
        data-slot="stat-card-title"
        style="margin:0;font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);color:var(--lv-color-muted-fg);line-height:1;"
      >${title}</figcaption>
      @endif
    </div>
    @if(_hasTrailing)
    <%-- trailing slot: NOT aria-hidden -- adopter may place interactive elements here. --%>
    <div data-slot="stat-card-trailing" style="flex-shrink:0;">
      ${trailing}
    </div>
    @endif
  </div>

  <%-- Body: value row (or skeleton) + trend indicator + description. --%>
  @if(loading)
  <%-- Skeleton state: animated placeholder bars replace value + trend. The root figure already
       carries aria-busy="true"; bars are aria-hidden so the SR does not announce "placeholder". --%>
  <div data-slot="stat-card-skeleton" aria-hidden="true" style="display:flex;flex-direction:column;gap:var(--lv-space-2);margin-top:var(--lv-space-3);">
    <span style="display:block;height:2rem;width:50%;border-radius:var(--lv-radius-sm);background:var(--lv-color-muted-bg);animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;"></span>
    <span style="display:block;height:1rem;width:33%;border-radius:var(--lv-radius-sm);background:var(--lv-color-muted-bg);animation:pulse 2s cubic-bezier(0.4,0,0.6,1) infinite;"></span>
  </div>
  @else
  <%-- Value row: prefix (decorative, aria-hidden) + value + suffix (decorative, aria-hidden).
       aria-atomic="true" on the value p ensures HTMX morph re-announces the full value. --%>
  <div data-slot="stat-card-value-row" style="display:flex;align-items:baseline;gap:var(--lv-space-1);margin-top:var(--lv-space-3);">
    @if(!prefix.isBlank())
    <span aria-hidden="true" data-slot="stat-card-prefix" style="font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);color:var(--lv-color-fg);">${prefix}</span>
    @endif
    <p
      data-slot="stat-card-value"
      aria-atomic="true"
      style="margin:0;font-size:${_sizeValue};font-weight:var(--lv-font-semibold);line-height:1;letter-spacing:-0.025em;color:var(--lv-color-fg);"
    >${value}</p>
    @if(!suffix.isBlank())
    <span aria-hidden="true" data-slot="stat-card-suffix" style="font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);color:var(--lv-color-fg);">${suffix}</span>
    @endif
  </div>

  @if(_hasTrend)
  <%-- Trend indicator: role="img" with aria-label carries the semantic (direction + magnitude).
       The SVG icon is aria-hidden (decorative; the role=img label is the a11y signal).
       Colour alone never conveys the trend direction (WCAG SC 1.4.1 + 4.1.2). --%>
  <div data-slot="stat-card-trend" data-trend="${trend}" style="margin-top:var(--lv-space-2);">
    <span
      role="img"
      aria-label="${_effectiveTrendLabel}"
      style="display:inline-flex;align-items:center;gap:var(--lv-space-1);font-size:var(--lv-text-sm);font-weight:var(--lv-font-medium);color:${_trendColor};"
    >
      @if("up".equals(trend))
      <svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="18 15 12 9 6 15"></polyline></svg>
      @elseif("down".equals(trend))
      <svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>
      @else
      <svg xmlns="http://www.w3.org/2000/svg" width="1rem" height="1rem" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
      @endif
      @if(!trendValue.isBlank())
      <%-- trendValue is inside the role=img span and so audibly implied by the aria-label;
           the span is aria-hidden to avoid double-reading by SR (aria-label is the authority). --%>
      <span aria-hidden="true">${trendValue}</span>
      @endif
    </span>
  </div>
  @endif

  @if(_hasDescription)
  <p data-slot="stat-card-description" style="margin:var(--lv-space-1) 0 0;font-size:var(--lv-text-sm);color:var(--lv-color-muted-fg);line-height:var(--lv-leading);">${description}</p>
  @endif
  @endif

  @if(_hasFooter)
  <%-- Footer: decorative rule + content slot. The hr carries role="separator" aria-hidden="true"
       so the SR does not announce a blank "separator" interrupting the reading flow of the card. --%>
  <hr role="separator" aria-hidden="true" style="margin:var(--lv-space-3) 0 0;border:0;border-top:1px solid var(--lv-color-border);">
  <div data-slot="stat-card-footer" style="margin-top:var(--lv-space-3);">
    ${footer}
  </div>
  @endif

</figure>
