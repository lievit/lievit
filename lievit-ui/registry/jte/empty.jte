@import gg.jte.Content
@import gg.jte.output.StringOutput
@import gg.jte.html.escape.Escape
<%--
  Copyright 2026 Francesco Bilotta
  Licensed under the Apache License, Version 2.0 (the "License").

  lievit-ui empty partial -- a full-width blank-slate placeholder for surfaces with no data:
  empty lists, empty search results, empty inboxes. Icon/illustration + optional title +
  optional description + optional action CTA slot. Purely presentational, no client state.

  TIER: PARTIAL presentational -> JTE partial (ADR-0012 server-first pivot). There is nothing
  client about an empty state: the controller already knows the list is empty, renders this
  partial in place of the list, and the morph replaces it when items appear. Server-first
  works trivially here.

  STRUCTURE (scientific decision rule):
    - Inventory reference: Ant Design Empty (image/icon, title, description, action slot,
      size variants); the AD `simpleImage` preset maps to `icon-only` here.
    - No WAI-ARIA APG pattern applies: the component is a static presentational region with
      no interactive role and no composite widget behaviour. A root aria-label (if the
      caller needs the region to be discoverable) is passed via `attrs`; the partial does
      NOT auto-generate one from `title` (that would duplicate text already visible).
    - Styling: ORIGINAL generation over --lv-* (OKLCH) tokens; visual look inspired by
      Tailwind UI (NO code copied).

  A11y (no WAI-ARIA APG pattern -- purely presentational region):
    - Root: plain <div>, no role override. Illustration wrapper: aria-hidden="true" when
      decorative (imageAlt is blank AND image slot is null). When imageAlt is non-empty,
      aria-hidden is dropped from the wrapper and the <img> alt carries the accessible text.
    - Icon: rendered via @template.lievit.icon(label = null) -- the icon partial emits
      aria-hidden="true" automatically when label is null (decorative by default).
    - Title: <p> element (NOT a heading; heading level is a page-structure decision for
      the caller, not for a presentational placeholder).
    - Description: <p> element.
    - Action slot: opaque Content; the caller-provided button carries its own accessible name.
    - Keyboard: Tab skips illustration + text (non-focusable); action slot button is in the
      normal Tab order (platform-native, no enhancer needed).
    - Focus management: platform-only. No trap, no initial-focus. Not an overlay.

  Params:
    String variant    = "default"  "default" | "search" | "error" | "offline" -- drives
                                   the default icon; does NOT change colour (single muted
                                   surface for all variants; distinction is icon + caller copy).
    String size       = "md"       "sm" | "md" | "lg" -- scales illustration, title,
                                   description proportionally; sm fits inside a combobox
                                   listbox; lg fills a full-page blank-slate.
    String title      = null       primary message as a <p>; null => element omitted (the
                                   partial never bakes in default copy -- that is the controller's job).
    String description = null      secondary explanatory text as a <p>; null => omitted.
    String imageUrl   = null       URL of a custom illustration; overrides the default icon
                                   when set (rendered as <img src>). SAFE: URL is routed
                                   through Escape.htmlAttribute before emission.
    String imageAlt   = ""         alt for the custom image; default "" (decorative). The
                                   caller MUST set a meaningful value when the image is semantic.
    boolean iconOnly  = false      suppress title + description, show only the illustration;
                                   canonical for sm inside a combobox empty state.
    String cssClass   = ""         extra utility classes on the root element.
    String attrs      = ""         TRUSTED raw ($unsafe) -- STATIC author-typed strings only
                                   (aria-label, id, data-testid). NEVER per-row DB values.
    Map of String to String dataAttrs = {}  SAFE escaped dynamic data-* (each value via
                                            Escape.htmlAttribute).
    gg.jte.Content action = null   optional CTA slot (typically a button or link the caller
                                   provides); null => slot omitted. iconOnly suppresses action.
    gg.jte.Content image  = null   alternative illustration slot: a custom SVG wrapper,
                                   a @template.lievit.icon, or a caller-owned <img>. When
                                   set, takes precedence over imageUrl and the default icon.

  Usage:
    @@template.lievit.empty()

    @@template.lievit.empty(
        variant = "search",
        title = "Nessun risultato",
        description = "Nessun contatto corrisponde ai filtri attivi.",
        action = @@`@@template.lievit.button(content = @@`Azzera filtri`)`)

    @@template.lievit.empty(size = "sm", iconOnly = true,
        attrs = "aria-label=\"Lista vuota\"")
--%>
@param String variant = "default"
@param String size = "md"
@param String title = null
@param String description = null
@param String imageUrl = null
@param String imageAlt = ""
@param boolean iconOnly = false
@param String cssClass = ""
@param String attrs = ""
@param java.util.Map<String, String> dataAttrs = java.util.Map.of()
@param gg.jte.Content action = null
@param gg.jte.Content image = null

<%-- Default icon per variant: the switch drives which Lucide slug is shown when neither
     imageUrl nor the image slot are supplied. --%>
!{var _defaultIcon = switch (variant) {
    case "search"  -> "search-x";
    case "error"   -> "triangle-alert";
    case "offline" -> "wifi-off";
    default        -> "inbox";
  };}

<%-- Illustration size classes per size: icon glyph size + image max-width.
     sm: --lv-space-8 (32 px) / md: --lv-space-10 (40 px) / lg: --lv-space-16 (64 px).
     All class strings are COMPLETE + static so the Tailwind scanner picks them up. --%>
!{var _iconSize = switch (size) {
    case "sm" -> "var(--lv-space-8)";
    case "lg" -> "var(--lv-space-16)";
    default   -> "var(--lv-space-10)";
  };}

<%-- Illustration container size class (used for image max-width cap + icon wrapper sizing). --%>
!{var _illustrationSizeClass = switch (size) {
    case "sm" -> "w-[var(--lv-space-8)] h-[var(--lv-space-8)]";
    case "lg" -> "w-[var(--lv-space-16)] h-[var(--lv-space-16)] max-w-[160px]";
    default   -> "w-[var(--lv-space-10)] h-[var(--lv-space-10)] max-w-[96px]";
  };}

<%-- Title typography per size. --%>
!{var _titleClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-sm)] font-[var(--lv-font-medium)]";
    case "lg" -> "text-[length:var(--lv-text-lg)] font-[var(--lv-font-semibold)]";
    default   -> "text-[length:var(--lv-text-base)] font-[var(--lv-font-medium)]";
  };}

<%-- Description typography per size. --%>
!{var _descClass = switch (size) {
    case "sm" -> "text-[length:var(--lv-text-xs)]";
    case "lg" -> "text-[length:var(--lv-text-base)]";
    default   -> "text-[length:var(--lv-text-sm)]";
  };}

<%-- Gap between illustration and title per size. --%>
!{var _gapIllustration = switch (size) {
    case "sm" -> "var(--lv-space-2)";
    case "lg" -> "var(--lv-space-4)";
    default   -> "var(--lv-space-3)";
  };}

<%-- The illustration wrapper is aria-hidden when decorative (image slot is null AND imageAlt
     is blank, meaning either the default icon or a decorative imageUrl). When imageAlt is
     non-empty the caller marks the image as semantic; aria-hidden is dropped from the wrapper
     and the <img> alt carries the accessible description. When a custom image slot is passed,
     the caller owns the semantics -- no forced aria-hidden on the wrapper. --%>
!{boolean _wrapperDecorativeAriaHidden = (image == null) && (imageAlt == null || imageAlt.isBlank());}

<%-- Safe escaped imageUrl: the URL must not be allowed to inject markup into the src
     attribute. We write it into a StringOutput via the attribute escaper and embed the
     result with $unsafe so the already-escaped text is not re-escaped by JTE. --%>
!{var _escapedImageUrl_ = new StringOutput();}
!{if (imageUrl != null) { Escape.htmlAttribute(imageUrl, _escapedImageUrl_); }}
!{var _escapedImageUrl = _escapedImageUrl_.toString();}

<%-- SAFE dynamic data-* fragment: keys allowed as simple identifiers only.
     Pattern mirrors button.jte / alert.jte exactly.
     JTE's HTML parser forbids a raw @for in attribute-NAME position, so the fragment is
     built once here and emitted with $unsafe. Each VALUE is routed through the JTE own
     attribute escaper (Escape.htmlAttribute). --%>
!{var _dataAttrs_ = new StringOutput();}
!{for (var e : dataAttrs.entrySet()) {
    if (e.getKey() != null && e.getKey().matches("[A-Za-z][A-Za-z0-9-]*")) {
      _dataAttrs_.writeContent(" data-" + e.getKey() + "=\"");
      Escape.htmlAttribute(e.getValue() == null ? "" : e.getValue(), _dataAttrs_);
      _dataAttrs_.writeContent("\"");
    }
  }}
!{var _dataAttrsMarkup = _dataAttrs_.toString();}

<div
  data-slot="empty"
  data-variant="${variant}"
  data-size="${size}"
  class="flex w-full flex-col items-center justify-center gap-[var(--lv-space-6)] rounded-[var(--lv-radius-lg)] py-[var(--lv-space-10)] text-center ${cssClass}"
  style="font-family:var(--lv-font-sans);"
  $unsafe{_dataAttrsMarkup}
  $unsafe{attrs}
>
  <%-- Illustration: custom image slot wins, then imageUrl, then default icon. The size cap
       (_illustrationSizeClass) rides the image element; the default icon instead sits inside a
       Filament-grade rounded-full tinted circle (the blank slate reads as a deliberate empty state,
       not a stray glyph). --%>
  <div
    data-slot="empty-illustration"
    class="flex shrink-0 items-center justify-center"
    aria-hidden="${_wrapperDecorativeAriaHidden ? "true" : null}"
  >
    @if(image != null)
      <div class="${_illustrationSizeClass} flex items-center justify-center">${image}</div>
    @elseif(imageUrl != null)
      <img
        src="$unsafe{_escapedImageUrl}"
        alt="${imageAlt}"
        class="${_illustrationSizeClass} object-contain"
      >
    @else
      <span
        data-slot="empty-icon-circle"
        class="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--lv-color-muted-bg)] p-[var(--lv-space-3)] text-[var(--lv-color-muted-fg)]"
      >@template.lievit.icon(name = _defaultIcon, size = _iconSize, cssClass = "text-[var(--lv-color-muted-fg)]")</span>
    @endif
  </div>

  <%-- Text block: suppressed entirely when iconOnly=true. --%>
  @if(!iconOnly)
    @if(title != null)
      <p
        data-slot="empty-title"
        class="${_titleClass} m-0 leading-[var(--lv-leading-tight)] tracking-tight text-[var(--lv-color-fg)]"
      >${title}</p>
    @endif
    @if(description != null)
      <p
        data-slot="empty-description"
        class="${_descClass} m-0 max-w-xs leading-[var(--lv-leading-relaxed)] text-[var(--lv-color-muted-fg)]"
      >${description}</p>
    @endif
  @endif

  <%-- Action slot: suppressed when null or when iconOnly=true. --%>
  @if(action != null && !iconOnly)
    <div
      data-slot="empty-action"
      class="flex items-center justify-center gap-[var(--lv-space-3)] pt-[var(--lv-space-1)]"
    >${action}</div>
  @endif
</div>
